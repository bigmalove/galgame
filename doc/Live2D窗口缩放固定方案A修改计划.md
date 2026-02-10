# Live2D 窗口变化导致缩放跳动：方案 A（按高度缩放）修改计划

目标：当窗口/容器 **仅宽度变化** 时，Live2D 模型 **视觉大小不变**；当 **高度变化** 时，模型按高度同比例缩放，从而达到“相对窗口比例固定（以高度为基准）”的效果。

适用文件：`数据库界面插件.js`

---

## 0. 现状与根因（简述）

当前 Live2D 的最终缩放由两部分相乘得到：

- `baseScale`：根据渲染槽位（slot rect）大小与模型 bounds 自动计算出来的“适配缩放”
- `userScale`：用户在设置里保存的倍率（`config.transform.scale`）

在 `Live2DStage.applyTransform(characterId)` 中，`baseScale` 使用：

- `fitScale = min(rect.width / bounds.width, rect.height / bounds.height)`

由于窗口变化会触发 `Live2DStage.updateLayout()` 重新计算 `rect.width/height`，并对每个角色调用 `applyTransform()`，所以 **只要 rect 的宽或高变化，baseScale 就会变化**，最终表现为模型大小跟着窗口变化而跳动。

---

## 1. 方案 A：增加“缩放基准 = 按高度”模式

核心思想：把 `baseScale` 的计算从 “宽高都参与（fit）” 改为 “只看高度（height）”。

新增配置字段（向后兼容）：

- `config.transform.scaleBase`: `'fit' | 'height'`
  - `'fit'`：保留现状（默认值）
  - `'height'`：仅按高度计算 `baseScale`，保证宽度变化不影响模型大小

缩放计算规则：

- `scaleBase === 'fit'`：
  - `baseScale = min(rect.width / bounds.width, rect.height / bounds.height) * (1 - safePadding)`
- `scaleBase === 'height'`：
  - `baseScale = (rect.height / bounds.height) * (1 - safePadding)`

最终缩放：

- `finalScale = baseScale * userScale * speakingFactor`

> 注：方案 A 的目标是“宽度变化不改大小”，因此 `height` 模式不再用宽度兜底，可能出现横向溢出/重叠；当前实现本身允许溢出（未加 mask），通常可接受。

---

## 2. 具体改动点（按模块）

### 2.1 配置默认值与合并逻辑

1) `getDefaultLive2DConfig()`

- 在 `transform` 下增加默认值：
  - `scaleBase: 'fit'`

2) `getLive2DConfig(characterId)`

- 合并默认配置时，确保把 `scaleBase` 合并进去（旧存档缺字段时自动补齐）。

3) `updateLive2DConfig(characterId, partialConfig)`

- 保持现有合并方式即可；只要 `transform` merge 是浅合并，`scaleBase` 会自然被保留/覆盖。

### 2.2 设置弹窗 UI（Live2D 设置）

修改 `showLive2DSettingsModal(characterId)` 的“常规设置 → 位置与大小”区域：

- 增加一个“缩放基准”选项（radio 或 select 均可）：
  - 适应容器（`fit`，默认）
  - 按高度（`height`，推荐）

并确保以下交互都能读写该字段：

- **保存设置**：把 `scaleBase` 写入 `newTransform`，随 `setLive2DConfig()` 一起落盘
- **开始调整位置**（进入 `Live2DPositionEditor` 前的那段保存）：不要丢失 `scaleBase`
- **重置变换**：重置 `scaleBase` 回 `'fit'`

### 2.3 Live2DStage：按 scaleBase 计算 baseScale

修改 `Live2DStage.applyTransform(characterId)`：

- 读取 `config.transform.scaleBase`（缺省按 `'fit'`）
- 按 **方案 A 的规则** 计算 `baseScale`
- 其他逻辑保持不变（位置偏移、说话者轻微放大、容器信息回写等）

### 2.4 Live2DManager.renderTo：旧渲染路径对齐（兜底）

`Live2DManager.renderTo(characterId, containerElement, ...)` 中存在一条“旧渲染路径”（每角色单独 canvas/app）。

为避免在某些边缘场景回退到旧路径时行为不一致，需要同步支持：

- 当 `config.transform.scaleBase === 'height'` 时，旧路径的 `baseScale` 也改为仅按高度计算
- `'fit'` 时保持原样

---

## 3. 实施步骤（Checklist）

- [ ] 在 `getDefaultLive2DConfig()` 增加 `transform.scaleBase = 'fit'`
- [ ] 确认 `getLive2DConfig()` 合并默认配置时包含 `scaleBase`
- [ ] `showLive2DSettingsModal()` 添加“缩放基准”UI，初始化为 `transformConfig.scaleBase || 'fit'`
- [ ] `#gal-live2d-settings-save` 收集并保存 `scaleBase`
- [ ] `#gal-live2d-start-position-edit` 保存 `scaleBase`（避免被覆盖丢失）
- [ ] `#gal-live2d-reset-transform` 重置 `scaleBase` 到 `'fit'`
- [ ] 修改 `Live2DStage.applyTransform()`：按 `'fit'/'height'` 分支计算 `baseScale`
- [ ] 修改 `Live2DManager.renderTo()` 旧路径：按 `'fit'/'height'` 分支计算 `baseScale`

---

## 4. 验收标准（手动验证）

1) **默认行为不变**
- 不改任何设置（`scaleBase` 默认 `fit`）：效果与现在一致

2) **按高度模式生效**
- 在 Live2D 设置里把“缩放基准”切到“按高度（height）”
- 仅改变窗口宽度（拖动左右边框）：模型大小保持不变
- 改变窗口高度（拖动上下边框）：模型大小随高度同比例变化

3) **Story 与 Single 两种挂载都一致**
- Story（左右双角色）与 Single（预览/设置）都能表现一致

---

## 5. 已知风险与可选增强

### 风险：窄屏横向溢出/重叠
`height` 模式下缩放不再受宽度约束，窄屏可能横向溢出或左右角色重叠更明显。

可选增强（不属于方案 A 的硬要求）：

- 增加第三种模式 `scaleBase: 'heightClamp'`：按高度算，但设置一个“最大宽度占比”上限，防止极端窄屏过度溢出。

