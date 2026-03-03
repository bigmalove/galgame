import { SCRIPT_NAME } from '../core/constants.js';
import { generateCOTTemplate } from './cot-template.js';
import { WORLDBOOK_NAME, COT_ENTRY_NAME } from './enhanced-mode.js';
import { getPendingSpecialCg } from './special-cg-trigger.js';

// ============================================
// 世界书管理
// ============================================

// 延迟引用: showToast
let _showToastRef = null;

export function setWorldbookRefs({ showToast }) {
  if (showToast) _showToastRef = showToast;
}

function showToast(msg, duration) {
  if (_showToastRef) _showToastRef(msg, duration);
}

/**
 * 检查世界书是否存在
 */
export async function checkWorldbookExists(worldbookName) {
  try {
    const names = getWorldbookNames();
    return names.includes(worldbookName);
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 检查世界书失败:`, e);
    return false;
  }
}

/**
 * 构建 COT 条目对象
 */
function buildCotEntry(cotTemplate) {
  return {
    name: COT_ENTRY_NAME,
    enabled: true,
    content: cotTemplate,
    strategy: {
      type: 'constant',
      keys: [],
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    },
    position: {
      type: 'at_depth',
      role: 'system',
      depth: 0,
      order: 100,
    },
    probability: 100,
    recursion: {
      prevent_incoming: false,
      prevent_outgoing: false,
      delay_until: null,
    },
    effect: {
      sticky: null,
      cooldown: null,
      delay: null,
    },
  };
}

/**
 * 注入COT到世界书
 */
export async function injectCOTToWorldbook() {
  try {
    const pendingSpecialCg = await getPendingSpecialCg();
    const pendingLog = pendingSpecialCg
      ? `rule=${pendingSpecialCg.ruleId}, scene=${pendingSpecialCg.sceneAlias}, cgId=${pendingSpecialCg.cgId}`
      : 'none';
    console.log(`[${SCRIPT_NAME}] COT注入: pendingSpecialCg=${pendingLog}`);
    const cotTemplate = await generateCOTTemplate({ pendingSpecialCg });
    const exists = await checkWorldbookExists(WORLDBOOK_NAME);

    if (!exists) {
      console.log(`[${SCRIPT_NAME}] 创建世界书: ${WORLDBOOK_NAME}`);
      const cotEntry = buildCotEntry(cotTemplate);
      await createOrReplaceWorldbook(WORLDBOOK_NAME, [cotEntry]);
      console.log(`[${SCRIPT_NAME}] 世界书创建成功`);
      showToast('已创建Galgame格式规范世界书');
    } else {
      console.log(`[${SCRIPT_NAME}] 更新世界书: ${WORLDBOOK_NAME}`);
      let worldbook;
      try {
        worldbook = await getWorldbook(WORLDBOOK_NAME);
      } catch (getError) {
        console.log(`[${SCRIPT_NAME}] 世界书获取失败，可能已被删除，重新创建: ${WORLDBOOK_NAME}`);
        const cotEntry = buildCotEntry(cotTemplate);
        await createOrReplaceWorldbook(WORLDBOOK_NAME, [cotEntry]);
        console.log(`[${SCRIPT_NAME}] 世界书已重新创建`);
        showToast('已重新创建Galgame格式规范世界书');
        return true;
      }

      const existingEntry = worldbook.find(e => e.name === COT_ENTRY_NAME);
      if (existingEntry) {
        await updateWorldbookWith(WORLDBOOK_NAME, entries => {
          return entries.map(entry => {
            if (entry.name === COT_ENTRY_NAME) {
              return Object.assign({}, entry, { content: cotTemplate });
            }
            return entry;
          });
        });
        console.log(`[${SCRIPT_NAME}] 条目已更新`);
        showToast('Galgame格式规范已更新');
      } else {
        const cotEntry = buildCotEntry(cotTemplate);
        await createWorldbookEntries(WORLDBOOK_NAME, [cotEntry]);
        console.log(`[${SCRIPT_NAME}] 条目已添加`);
        showToast('Galgame格式规范已添加到世界书');
      }
    }
    return true;
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 注入COT失败:`, e);
    return false;
  }
}

/**
 * 全局开启世界书
 */
export async function enableWorldbookGlobally() {
  try {
    const globalWorldbooks = getGlobalWorldbookNames();
    if (globalWorldbooks.includes(WORLDBOOK_NAME)) {
      console.log(`[${SCRIPT_NAME}] 世界书已全局开启`);
      return true;
    }
    const newGlobal = [...globalWorldbooks, WORLDBOOK_NAME];
    await rebindGlobalWorldbooks(newGlobal);
    console.log(`[${SCRIPT_NAME}] 世界书已全局开启`);
    return true;
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 全局开启世界书失败:`, e);
    return false;
  }
}

/**
 * 全局关闭世界书
 */
export async function disableWorldbookGlobally() {
  try {
    const globalWorldbooks = getGlobalWorldbookNames();
    if (!globalWorldbooks.includes(WORLDBOOK_NAME)) {
      console.log(`[${SCRIPT_NAME}] 世界书未开启，无需关闭`);
      return true;
    }
    const newGlobal = globalWorldbooks.filter(name => name !== WORLDBOOK_NAME);
    await rebindGlobalWorldbooks(newGlobal);
    console.log(`[${SCRIPT_NAME}] 世界书已全局关闭`);
    return true;
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 全局关闭世界书失败:`, e);
    return false;
  }
}
