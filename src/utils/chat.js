import { SCRIPT_NAME } from '../core/constants.js';
import { topWindow } from '../core/env.js';

// ============================================
// 数据库集成 - 从AutoCardUpdaterAPI获取角色列表
// ============================================
export function getCharacterListFromDatabase() {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const characters = [];
  try {
    // 1. 首先尝试从当前角色卡获取角色名
    const charName =
      (_h =
        (_d =
          (_c =
            (_b = (_a = topWindow.SillyTavern) === null || _a === void 0 ? void 0 : _a.getContext) === null ||
            _b === void 0
              ? void 0
              : _b.call(_a)) === null || _c === void 0
            ? void 0
            : _c.characters) === null || _d === void 0
          ? void 0
          : _d[
              (_g =
                (_f = (_e = topWindow.SillyTavern) === null || _e === void 0 ? void 0 : _e.getContext) === null ||
                _f === void 0
                  ? void 0
                  : _f.call(_e)) === null || _g === void 0
                ? void 0
                : _g.characterId
            ]) === null || _h === void 0
        ? void 0
        : _h.name;
    if (charName) {
      characters.push({
        id: 'current_char',
        name: charName,
        type: '当前角色',
        source: '角色卡',
      });
      console.log(`[${SCRIPT_NAME}] 从角色卡获取: ${charName}`);
    }
    // 2. 尝试获取AutoCardUpdaterAPI
    const api = topWindow.AutoCardUpdaterAPI;
    if (!api || typeof api.exportTableAsJson !== 'function') {
      console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 未找到或未初始化`);
      return characters;
    }
    const tableData = api.exportTableAsJson();
    if (!tableData || typeof tableData !== 'object') {
      console.log(`[${SCRIPT_NAME}] 表格数据为空`);
      return characters;
    }
    // 主角相关表名和列名变体
    const protagonistSheets = ['主角信息', '主角', '玩家信息', 'User', 'user', '用户'];
    const protagonistNameCols = ['人物名称', '姓名', '名字', '角色名', 'name', 'Name'];
    // NPC相关表名和列名变体
    const npcSheets = ['重要人物表', '重要人物', 'NPC', 'npc', '角色列表', '人物列表'];
    const npcNameCols = ['姓名', '人物名称', '角色名', '名字', 'name', 'Name'];
    // 遍历所有表格查找角色信息
    Object.keys(tableData).forEach(sheetKey => {
      if (!sheetKey.startsWith('sheet_')) return;
      const sheet = tableData[sheetKey];
      const sheetName = (sheet === null || sheet === void 0 ? void 0 : sheet.name) || '';
      const content = (sheet === null || sheet === void 0 ? void 0 : sheet.content) || [];
      if (content.length < 2) return;
      const headers = content[0] || [];
      const findNameColumn = cols => {
        for (const col of cols) {
          const idx = headers.indexOf(col);
          if (idx !== -1) return idx;
        }
        return -1;
      };
      // 检查是否是主角表
      if (protagonistSheets.includes(sheetName)) {
        const nameColIndex = findNameColumn(protagonistNameCols);
        if (nameColIndex !== -1) {
          for (let i = 1; i < content.length; i++) {
            const row = content[i];
            const name = row === null || row === void 0 ? void 0 : row[nameColIndex];
            if (name && typeof name === 'string' && name.trim()) {
              characters.push({
                id: `protagonist_${i}`,
                name: name.trim(),
                type: '主角',
                source: sheetName,
              });
            }
          }
        }
      }
      // 检查是否是NPC表
      if (npcSheets.includes(sheetName)) {
        const nameColIndex = findNameColumn(npcNameCols);
        if (nameColIndex !== -1) {
          for (let i = 1; i < content.length; i++) {
            const row = content[i];
            const name = row === null || row === void 0 ? void 0 : row[nameColIndex];
            if (name && typeof name === 'string' && name.trim()) {
              if (!characters.find(c => c.name === name.trim())) {
                characters.push({
                  id: `npc_${i}`,
                  name: name.trim(),
                  type: 'NPC',
                  source: sheetName,
                });
              }
            }
          }
        }
      }
    });
    console.log(
      `[${SCRIPT_NAME}] 从数据库获取到 ${characters.length} 个角色:`,
      characters.map(c => c.name),
    );
  } catch (e) {
    console.error(`[${SCRIPT_NAME}] 获取角色列表失败:`, e);
  }
  return characters;
}
