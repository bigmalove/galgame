# `skin-western` 元素级图片皮肤改造计划

## 1. 背景
当前整图覆盖方案无法保证：

1. 元素缩放后的纹理精度和位置稳定性。
2. 按钮可点击区域与视觉区域的长期一致。
3. 桌面端与移动端在不同分辨率下的精确对齐。

本计划改为“按 UI 元素单独配置图片 + 裁剪 + 保存”的方案。

## 2. 目标

1. 保留 `skin-western` 皮肤 ID，不新增公开皮肤项。
2. 提供“皮肤设置界面”，可对主界面元素逐项上传、裁剪、预览、保存。
3. 保留动态剧情背景层，仅限制在主画框区域显示。
4. 保证真实交互节点不变，视觉层和点击层一致。
5. 支持桌面/移动两套元素资源。

## 3. 范围与非范围

### 3.1 范围内

1. 回退当前整图风格改动。
2. 新增元素级皮肤数据存储。
3. 新增皮肤编辑 UI（选择元素、裁剪、参数编辑、保存）。
4. 新增 `skin-western` 元素级渲染逻辑。
5. 导入导出支持元素级皮肤资源。

### 3.2 范围外

1. 不改 `skin` 公共字段定义，不改 JSON schema，不改 `@types`。
2. 不改变按钮事件绑定和业务行为。
3. 不在本阶段重做其他皮肤（`ancient/persona/jrpg/classic`）。

## 4. 总体方案

### 4.1 数据层

新增 IndexedDB 存储（建议：`STORE_UI_SKINS`），每条记录建议结构：

```json
{
  "id": "pack_default:skin-western:dialog_panel:desktop:normal",
  "packId": "pack_default",
  "skinId": "skin-western",
  "elementId": "dialog_panel",
  "device": "desktop",
  "state": "normal",
  "imageBlob": "Blob",
  "layout": {
    "anchorX": 0,
    "anchorY": 0,
    "offsetX": 0,
    "offsetY": 0,
    "width": 0,
    "height": 0,
    "zIndex": 0
  },
  "scaleMode": "stretch",
  "slice": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
  "textPadding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
  "updatedAt": "ISO8601"
}
```

### 4.2 元素枚举（第一版）

1. `main_frame_scene`（主画框遮罩/裁切参考）
2. `dialog_panel`（对话框底图）
3. `name_badge`（名牌）
4. `btn_reroll`
5. `btn_free_input`
6. `footer_btn_common`（LOG/CLOSE/VIEW/CONFIG/PREV/AUTO/SKIP）
7. `footer_btn_choices`
8. `footer_btn_next`
9. `status_bar_container`
10. `fullscreen_btn`
11. `bgm_widget`

### 4.3 渲染层

1. 保持 `overlay.js` 现有 DOM 结构不变。
2. 通过 `#gal-global-overlay.skin-western` 注入元素 CSS 变量。
3. 视觉图层使用伪元素或额外装饰层，统一 `pointer-events: none`。
4. 交互节点保留原按钮节点，点击逻辑完全不变。
5. `gal-layer-bg` 继续显示剧情背景，并应用主画框裁切变量。

### 4.4 编辑层

复用并扩展 `src/ui/sprite-upload.js` 里的 `ImageCropper`：

1. 支持自由比例/目标比例切换。
2. 支持桌面与移动预览切换。
3. 支持保存裁剪结果 + 元素布局参数。
4. 支持一键重置当前元素配置。

## 5. 实施阶段

### 阶段 0：回退

1. 回退 `src/ui/styles.js` 和 `dist/数据库界面插件.dist.js` 的整图方案改动。
2. `npm run build`，确认打包一致。

### 阶段 1：数据结构与迁移

1. 在 `src/core/constants.js` 增加 `STORE_UI_SKINS`。
2. 在 `src/db/init.js` 提升 DB 版本并创建新 store。
3. 新增 `src/db/ui-skins.js`（保存/查询/删除/按图包过滤）。

### 阶段 2：渲染引擎

1. 新增 `src/ui/skin-western-runtime.js`（读取元素配置并注入样式变量）。
2. 在 `settings-panel.js` 的 `applySkin()`/`applySettingsToUI()` 链路接入运行时刷新。
3. 优先实现 `dialog_panel/name_badge/按钮类/NEXT` 的可见效果。

### 阶段 3：皮肤编辑界面

1. 在资源管理内新增子标签页（建议：`皮肤编辑`）。
2. 左侧元素列表，中间预览，右侧裁剪与参数编辑。
3. 支持保存到当前图包下的 `skin-western`。

### 阶段 4：导入导出扩展

1. 扩展 `src/ui/asset-io.js` 导出内容，增加 `ui-skins/` 目录与 manifest 字段。
2. 导入流程解析并恢复元素资源至目标图包。

### 阶段 5：验收与回归

1. 桌面宽屏验收元素对齐、缩放、点击。
2. 移动端验收布局和底栏完整性。
3. 切换其他皮肤验证无回归。
4. `npm run build` 成功，`dist/数据库界面插件.dist.js` 包含新逻辑。

## 6. 验收标准

1. `skin-western` 启用后，关键元素全部由独立图片驱动。
2. 按钮视觉与点击区域一致，不出现误触偏移。
3. 背景仅在主画框显示，切换场景正常。
4. 桌面/移动端资源自动切换，无遮挡和错位。
5. 导入导出可完整迁移皮肤元素配置。

## 7. 风险与应对

1. 风险：元素过多导致配置复杂。
   应对：先做 10~11 个核心元素，后续再加扩展元素。
2. 风险：移动端适配成本高。
   应对：设备维度独立存储，分别裁剪和布局。
3. 风险：导入导出兼容历史包。
   应对：manifest 版本字段 + 缺省回退逻辑。

## 8. 里程碑与预估

1. M1（0.5 天）：完成回退与基线恢复。
2. M2（1 天）：完成数据层 + 基础渲染。
3. M3（1.5 天）：完成皮肤编辑界面 MVP。
4. M4（1 天）：完成导入导出 + 回归验证。

## 9. 下一步执行建议

1. 先执行阶段 0，恢复稳定基线。
2. 紧接阶段 1 与阶段 2，尽快做出可预览的最小闭环。
3. 最后补阶段 3 与阶段 4，形成完整可用工具链。

