import { SCRIPT_NAME } from '../core/constants.js';
import { getSettings } from '../core/settings.js';
import { getAllImagePacks, getCurrentPackId } from '../db/image-packs.js';
import { getAllSprites } from '../db/sprites.js';
import { BUILTIN_BG_PACKS } from '../ui/builtin-bg-packs.js';
import { resolveCharacterIdByKeywords } from '../utils/character-name-keywords.js';

// ============================================
// AI 自动套用内置立绘模板
// 闭环：COT 注入可用模板名 → AI 输出 <sprite action="assign" character="X" template="Y" />
//       → parser 提取 spriteAssignments → process-message 调 handleSpriteAssignments 立即套用
// ============================================

// 延迟引用（ui / worldbook 层依赖统一走 refs，避免循环依赖，见 index.js 装配）
let _listBuiltinSpriteTemplatesRef = null;
let _applySpriteTemplateToCharacterRef = null;
let _injectCOTToWorldbookRef = null;
let _refreshGalgameViewsRef = null;
let _showToastRef = null;

export function setSpriteAutoAssignRefs({
  listBuiltinSpriteTemplates,
  applySpriteTemplateToCharacter,
  injectCOTToWorldbook,
  refreshGalgameViews,
  showToast,
} = {}) {
  if (listBuiltinSpriteTemplates) _listBuiltinSpriteTemplatesRef = listBuiltinSpriteTemplates;
  if (applySpriteTemplateToCharacter) _applySpriteTemplateToCharacterRef = applySpriteTemplateToCharacter;
  if (injectCOTToWorldbook) _injectCOTToWorldbookRef = injectCOTToWorldbook;
  if (refreshGalgameViews) _refreshGalgameViewsRef = refreshGalgameViews;
  if (showToast) _showToastRef = showToast;
}

// 归一化模板 URL 用于「模板是否已被套用」比对：
// 抹掉 host（cdn/gcore.jsdelivr.net 双源等价）与 @tag（内置包版本升级后路径不变），只留路径
function normalizeTemplateUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.pathname.replace(/^\/gh\/([^/@]+\/[^/@]+)@[^/]+\//, '/gh/$1/').toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

// 候选模板：当前图包名匹配某内置包 → 只用该包模板，否则全部内置包；
// 排除已被套用（任一表情 URL 已出现在立绘库）的模板；跨包同名模板保留靠前者
export async function getAvailableSpriteTemplates() {
  if (typeof _listBuiltinSpriteTemplatesRef !== 'function') return [];
  const templates = await _listBuiltinSpriteTemplatesRef();
  if (!Array.isArray(templates) || templates.length === 0) return [];

  let scoped = templates;
  try {
    const currentPackId = getCurrentPackId();
    const allPacks = await getAllImagePacks();
    const currentPackName = allPacks.find(p => p.id === currentPackId)?.name || '';
    const matchedBuiltin = BUILTIN_BG_PACKS.find(p => p.name === currentPackName);
    if (matchedBuiltin) {
      const filtered = templates.filter(tpl => tpl.packId === matchedBuiltin.id);
      if (filtered.length > 0) scoped = filtered;
    }
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 自动立绘：候选包筛选失败，回退全部内置包:`, error);
  }

  const usedUrls = new Set(
    (await getAllSprites(null, true)).map(sp => normalizeTemplateUrl(sp?.imageUrl)).filter(Boolean),
  );

  const byName = new Map();
  for (const tpl of scoped) {
    const name = String(tpl?.characterId || '').trim();
    if (!name || byName.has(name)) continue;
    const occupied = (tpl.expressions || []).some(e => usedUrls.has(normalizeTemplateUrl(e?.url)));
    if (occupied) continue;
    byName.set(name, tpl);
  }
  return Array.from(byName.values());
}

// COT 刷新：仿 special-cg-trigger 的 inFlight+queued 防抖，避免连续套用时并发注入世界书
const cotRefreshState = { inFlight: false, queued: false, lastReason: '' };

function notifyCotRefresh(reason = 'unknown') {
  if (typeof _injectCOTToWorldbookRef !== 'function') return;
  cotRefreshState.lastReason = reason;
  if (cotRefreshState.inFlight) {
    cotRefreshState.queued = true;
    return;
  }
  cotRefreshState.inFlight = true;
  Promise.resolve()
    .then(() => _injectCOTToWorldbookRef())
    .catch(error => {
      console.warn(`[${SCRIPT_NAME}] 自动立绘刷新COT失败:`, error);
    })
    .finally(() => {
      cotRefreshState.inFlight = false;
      if (cotRefreshState.queued) {
        cotRefreshState.queued = false;
        notifyCotRefresh(`queued:${cotRefreshState.lastReason}`);
      }
    });
}

// COT 段生成：首次列举需 fetch 内置包 manifest（无超时），8s 兜底降级为空段；
// 列举迟到完成后补刷一次 COT，做到最终一致
const COT_SECTION_TIMEOUT_MS = 8000;
const TIMEOUT_SENTINEL = Symbol('timeout');
let _listingPromise = null;
let _lateRefreshScheduled = false;

export async function buildAutoSpriteAssignCotSection() {
  if (typeof _listBuiltinSpriteTemplatesRef !== 'function') return '';

  if (!_listingPromise) _listingPromise = getAvailableSpriteTemplates();
  const listing = _listingPromise;
  const result = await Promise.race([
    listing,
    new Promise(resolve => setTimeout(() => resolve(TIMEOUT_SENTINEL), COT_SECTION_TIMEOUT_MS)),
  ]);

  if (result === TIMEOUT_SENTINEL) {
    if (!_lateRefreshScheduled) {
      _lateRefreshScheduled = true;
      listing
        .then(list => {
          if (Array.isArray(list) && list.length > 0) notifyCotRefresh('templates-late-ready');
        })
        .catch(() => {})
        .finally(() => {
          _lateRefreshScheduled = false;
          if (_listingPromise === listing) _listingPromise = null;
        });
    }
    return '';
  }

  _listingPromise = null;
  const available = Array.isArray(result) ? result : [];
  if (available.length === 0) return '';

  const templateNames = available.map(tpl => tpl.characterId).join(', ');
  let assignedNames = [];
  try {
    assignedNames = Array.from(new Set((await getAllSprites(null, false)).map(sp => String(sp?.characterId || '').trim()).filter(Boolean)));
  } catch (error) {
    console.warn(`[${SCRIPT_NAME}] 自动立绘：获取已有立绘角色失败:`, error);
  }
  const assignedLine = assignedNames.length > 0 ? `\n- 已有立绘的角色: ${assignedNames.join(', ')}（禁止为这些角色输出本标签）` : '';

  return `
### 新角色立绘模板（自动分配）
- 可用立绘模板: ${templateNames}${assignedLine}
- **触发条件**: 当剧情中出现**有名字、将持续登场的新主要角色或重要配角**，且不在"已有立绘"列表中时，根据其性别、年龄与气质从可用模板中选最合适的一个，输出: \`<sprite action="assign" character="角色名" template="模板名" />\`
- **使用规则**:
  - 模板名**必须**从可用列表原样选取，禁止自创或改写。
  - 每个角色最多分配一次；每个模板只能分配给一个角色，用过即不可再用。
  - 路人、群众、一次性登场的无名角色**不要**分配。
  - 没有气质合适的模板时**不输出**本标签。
  - 标签放在 <maintext> 内、该角色首次登场的对话之前。
- **示例**: \`<sprite action="assign" character="星野雫" template="${available[0].characterId}" />\`
`;
}

// ============================================
// 消费：幂等套用
// 流式期间同一标签会被 debounce 重解析反复送达，refreshGalgameViews 又会再触发一轮
// processNewMessage —— processedKeys 同步登记挡重复，串行队列消除 check-then-write 竞态
// ============================================

const PROCESSED_KEYS_LIMIT = 300;
const processedKeys = new Set();
let applyQueue = Promise.resolve();

function rememberKey(key) {
  processedKeys.add(key);
  if (processedKeys.size > PROCESSED_KEYS_LIMIT) {
    const oldest = processedKeys.values().next().value;
    processedKeys.delete(oldest);
  }
}

async function applyOne(character, templateName) {
  const rawName = String(character || '').trim();
  const wantedTemplate = String(templateName || '').trim();
  if (!rawName || !wantedTemplate) return;

  // 角色（或其别名）已有立绘 → 终态跳过
  const existingSprites = await getAllSprites(null, false);
  const existingIds = Array.from(new Set(existingSprites.map(sp => String(sp?.characterId || '').trim()).filter(Boolean)));
  const resolvedExisting = resolveCharacterIdByKeywords(rawName, existingIds);
  if (resolvedExisting && existingIds.includes(resolvedExisting)) {
    console.log(`[${SCRIPT_NAME}] 自动立绘：角色「${rawName}」已有立绘，跳过`);
    return;
  }

  const available = await getAvailableSpriteTemplates();
  const template = available.find(tpl => tpl.characterId === wantedTemplate);
  if (!template) {
    console.warn(`[${SCRIPT_NAME}] 自动立绘：模板「${wantedTemplate}」不可用（不存在或已被占用），跳过角色「${rawName}」`);
    return;
  }

  await _applySpriteTemplateToCharacterRef(template, rawName, { silent: true });
  console.log(`[${SCRIPT_NAME}] 自动立绘：已为「${rawName}」套用模板「${wantedTemplate}」（${template.expressions.length} 个表情）`);
  if (typeof _showToastRef === 'function') {
    _showToastRef(`AI 已为「${rawName}」自动套用立绘「${wantedTemplate}」`);
  }
  if (typeof _refreshGalgameViewsRef === 'function') {
    _refreshGalgameViewsRef();
  }
  notifyCotRefresh('sprite-auto-assigned');
}

export function handleSpriteAssignments(assignments, { mesId = '' } = {}) {
  if (typeof _applySpriteTemplateToCharacterRef !== 'function') return;
  const settings = getSettings();
  if (settings.autoSpriteAssignEnabled === false) return;
  if (!Array.isArray(assignments) || assignments.length === 0) return;

  for (const assignment of assignments) {
    const character = String(assignment?.character || '').trim();
    const templateName = String(assignment?.template || '').trim();
    if (!character || !templateName) continue;

    const key = `${mesId}::${character}::${templateName}`;
    if (processedKeys.has(key)) continue;
    rememberKey(key);

    applyQueue = applyQueue
      .then(() => applyOne(character, templateName))
      .catch(error => {
        // 失败回滚 key，下个流式 tick 可自动重试（如网络瞬断）
        processedKeys.delete(key);
        console.warn(`[${SCRIPT_NAME}] 自动立绘套用失败（${character} ← ${templateName}）:`, error);
      });
  }
}

// 聊天切换时清空（mesId 跨聊天撞号）
export function resetSpriteAutoAssignSession() {
  processedKeys.clear();
}
