# Live2D 双角色同屏 & 显示不全：改造方案 A（单 Canvas / 单 `PIXI.Application`）

你确认的问题是两类：

1. **两个角色启用 Live2D 后无法稳定同时显示**（理想是左/右各一只同屏）。
2. **Live2D “显示不全 / 被裁切”**（截图属于典型：容器高度受 UI 挤压 + `overflow:hidden` + 采用居中对齐导致裁切）。

本文不再展开“多 canvas 多 app”方案的排查，而是直接把 **方案 A（单 WebGL Context）** 细化成可落地的改造说明。

## 本次落地选择（结论）

- **全屏/主界面渲染**：`Live2DStage` 挂到 `.gal-game-content`，**单 Canvas + 单 `PIXI.Application`**。
- **不加 mask（最自由）**：左右两只用“虚拟槽位矩形”定位，模型允许自由溢出/重叠。
- **避免显示不全**：不再把 canvas 限制在 DOM slot 内，采用 **bottom-align + contain 拟合**，不再被 `overflow:hidden` 裁切。
- **避免遮盖 UI**：把 `.gal-live2d-stage-canvas` 放在 UI 下层（CSS `z-index` 低于角色层/对话层），按钮/对话框永远在上。
- **预览/位置编辑复用同一舞台**：用 `pushMount/popMount` 临时切换挂载点，避免“又创建一个 app”导致多 WebGL context。

---

## 1) 当前实现梳理（为什么会导致“两只同屏不稳”）

### 1.1 当前渲染链路

- 舞台更新入口：`SpriteManager.updateCharacterSprite()`：`数据库界面插件.js:7565`
- Live2D 渲染触发（异步 IIFE）：`数据库界面插件.js:7658`
- 模型加载：`Live2DManager.loadModel()`：`数据库界面插件.js:585`
- 渲染到容器：`Live2DManager.renderTo()`：`数据库界面插件.js:833`

### 1.2 当前的关键结构性问题

`Live2DManager.renderTo()` 每次渲染会：

1. 在 `topWindow` 创建一个新的 `<canvas>`，append 到指定容器（`.gal-live2d-canvas-container`）
2. `new PIXI.Application({ view: canvas, ... })`
3. `app.stage.addChild(model)` 并 `app.start()`

对应位置：

- 创建 canvas：`数据库界面插件.js:896`
- 创建 app：`数据库界面插件.js:908`
- addChild：`数据库界面插件.js:944`

这等价于：**每个角色一个 WebGL Context**。两只同屏 = 两个 context 同时跑 Live2D。

> 这在 Cubism Web / pixi-live2d-display 的实际兼容性里并不稳：常见表现就是“第二只出来后第一只不再绘制/变黑/闪烁”，最终用户感知为“只能显示一个 Live2D”。

---

## 2) “显示不全/裁切”的根因（截图对应）

当前拟合与对齐策略是“居中对齐”：

- `model.anchor.set(0.5, 0.5)`：`数据库界面插件.js:934`
- `model.y = renderHeight / 2 + offsetY`：`数据库界面插件.js:940`
- 容器启用裁切：`containerElement.style.overflow = 'hidden'`：`数据库界面插件.js:904`

当立绘层可用高度被 UI（按钮/对话框/底栏）挤压时，“居中对齐 + contain”会让模型上/下同时顶到边界，裁切就会非常明显，视觉上像“缺一截”。

解决这类问题的通用做法是：**改成“脚底对齐（bottom align） + contain 拟合”**。

---

## 3) 方案 A 总览（单 canvas + 单 app + 多 Live2D 模型）

目标：让整个 `.gal-game-content` 只有一个 Pixi 渲染器（一个 WebGL Context），在同一 stage 内同时绘制左右两只（甚至更多只）模型。

### 3.1 改造后的核心思路

- 把 “canvas/app 的生命周期” 从 **角色级** 提升为 **立绘层级**
- 一个 `Live2DStage` 单例负责：
  - 挂载一个 canvas 到 `.gal-game-content`（全屏/主界面渲染）
  - 创建一个 `PIXI.Application`
  - 维护 `left/right` 两个 slot 的 `PIXI.Container`（不加 mask，仅做定位用）
  - 把每个角色的 `Live2DModel` 加到对应 slotContainer
  - 负责 resize/重排时重新布局

模型加载（IndexedDB + DataURL + `Live2DModel.from()`）可以继续复用现有 `Live2DManager.loadModel()`，只把“如何渲染到 DOM 容器”这件事重写。

### 3.2 为什么要限制在 slot 内？可以直接铺在主界面吗？

先澄清：**“显示不全/裁切”不是 slot 的必然结果**，而是当前“居中对齐 + 不稳定 bounds/scale”导致模型超出可视区域后被裁掉；用 **bottom align + contain 拟合**后，在 slot 内也能尽量完整显示（只是会按区域大小自动缩小）。

slot（以及 mask）的存在主要是为了两件事：

- **多角色构图**：左/右角色各占一块区域，避免互相覆盖。
- **UI 安全**：不让模型溢出到对话框/按钮区域，保持界面可读性（点击不被挡是 `pointer-events:none` 能解决的，但视觉遮挡依然会影响使用）。

本次落地就是**不限制在 DOM slot 内**（全屏/主界面渲染 + 不加 mask）：

- **canvas 挂载点**：挂到 `.gal-game-content`，尺寸覆盖主界面，彻底摆脱“slot 高度受 UI 挤压导致裁切”的问题。
- **左右站位**：仍读取 `.gal-char-slot.slot-left/right` 的中心点作为参考，生成左右“虚拟槽位矩形”（全高、较宽、允许重叠）。
- **不加 mask**：模型可以自由溢出/重叠；不会再被 slot 的 `overflow:hidden` 裁掉。
- **UI 遮挡**：通过把 `.gal-live2d-stage-canvas` 的 `z-index` 放在 UI 下层来解决（按钮/对话框层永远在上）。

---

## 4) 详细设计（可直接照着写）

### 4.1 新增对象：`Live2DStage`（建议放在 `Live2DManager` 附近）

建议的数据结构：

```js
const Live2DStage = {
  app: null,
  canvas: null,
  mountEl: null,              // `.gal-game-content`（主界面）或预览/编辑容器
  mode: 'story',              // 'story' | 'single'
  focusCharacterId: null,
  dpr: 1,
  mountStack: [],
  slots: {
    left: { el: null, rect: null, container: null },
    right: { el: null, rect: null, container: null },
  },
  instances: new Map(),       // characterId -> { model, slot, bounds, baseScale, speaking }

  ensureMounted(mountEl, { mode } = {}) {},
  pushMount(mountEl, { mode, focusCharacterId } = {}) {},
  popMount() {},
  updateLayout() {},

  attach(characterId, model, slot, { entering } = {}) {},
  detach(characterId) {},

  applyTransform(characterId) {}, // 解决显示不全的关键逻辑
  setFocus(characterId, isSpeaking) {},
  destroy() {}, // 可选：卸载时释放
};
```

要求与建议：

- **只允许一个 app/canvas**：`ensureMounted()` 反复调用也不能 new 第二个 app
- canvas 样式：`position:absolute; inset:0; pointer-events:none;`，并由 CSS 控制较低 `z-index`（把 Live2D 放在 UI 下层）
- Pixi app 建议参数：
  - `backgroundAlpha: 0`
  - `autoDensity: true`
  - `resolution: dpr`（可从现有 `qualityConfig` 迁移）
  - `antialias`/`preserveDrawingBuffer` 建议默认关闭（更省资源，且多同屏更稳）

### 4.2 Slot 布局：虚拟槽位矩形（全高、无 mask）

思路：canvas 覆盖 `.gal-game-content`，但左右站位仍以 DOM 的 `.gal-char-slot.slot-left/right` 为参考（取中心点），生成左右“虚拟槽位矩形”：

1. `mountRect = mountEl.getBoundingClientRect()`
2. 找到 `leftSlotEl/rightSlotEl`，取 `centerX`（找不到就用 `0.32/0.68` 的宽度百分比 fallback）
3. 计算虚拟 rect（示例逻辑）：
   - `height = mountH`，`y = 0`（全屏高度，避免被 slot 高度裁切）
   - `width = max(mountW * 0.45, domSlotW * 1.7)`，并 clamp 到 `[1, mountW]`
   - `x = clamp(centerX - width/2, 0, mountW - width)`
4. left/right 各一个 `PIXI.Container`：`container.position.set(rect.x, rect.y)`

这里**不加 mask**：container 只负责定位，不负责裁剪，所以模型可以跨 rect 溢出/重叠（最自由）。

### 4.3 彻底解决“显示不全”：底部对齐 + contain 拟合

这是方案 A 必须做对的核心，否则你仍会在单角色时看到“被裁切”。

推荐默认策略（每个角色在自己的 slot 内）：

1. 取可信 bounds（不要用 `model.width/height` 猜）：
   - textures ready 后，执行 `model.update(0)`（你已有逻辑）
   - `bounds = model.getLocalBounds()`
2. 算 `baseScale`（contain）：
   - `baseScale = min(slotW / bounds.width, slotH / bounds.height) * (1 - safePadding)`
3. 设 pivot 到“底部中心”（比 `anchor` 更通用，避免不同版本行为差异）：
   - `pivotX = bounds.x + bounds.width / 2`
   - `pivotY = bounds.y + bounds.height`
   - `model.pivot.set(pivotX, pivotY)`
4. 设坐标（脚落地）：
   - `model.x = slotW / 2 + offsetX`
   - `model.y = slotH + offsetY`
5. 应用缩放：
   - `model.scale.set(baseScale * userScale)`

> 这套逻辑能让模型“尽可能完整”显示在 slot 内，并保证脚底贴地，不会出现“居中导致上下同时被裁”的效果。

#### 建议新增配置（从现有 `getLive2DConfig(characterId)` 扩展）

- `fitMode`: `'contain' | 'cover'`（默认 `contain`，解决显示不全）
- `safePadding`: `0.02 ~ 0.06`（默认 0.03，避免头发/帽子贴边）
- `origin`: `'bottom' | 'center'`（默认 `bottom`）

其中 `cover` 适合你想做“半身特写”的时候（允许裁切），但要显式让用户选择，默认不建议。

---

## 5) 代码改动落点（按现有代码位置写清楚）

### 5.1 替换舞台渲染触发（最关键一刀）

当前 Live2D 渲染触发在：

- `SpriteManager.updateCharacterSprite()`：`数据库界面插件.js:7658`

现状（简化）：

- `const model = await Live2DManager.loadModel(characterId)`
- `await Live2DManager.renderTo(characterId, $container[0])`

改造后（方案 A）推荐保持调用点不变，但把 `Live2DManager.renderTo()` 内部改造成“舞台早返回”：

1. 从 `$container[0]` 向上找到 `.gal-char-slot`，推断 `slot = left/right`
2. 从 `$container[0]` 向上找到 `.gal-game-content` 作为 `mountEl`
3. `Live2DStage.ensureMounted(mountEl, { mode: 'story' })`
4. `Live2DStage.attach(characterId, model, slot)`
5. `Live2DStage.applyTransform(characterId)`（或 `attach()` 内自动做）

> `.gal-live2d-canvas-container` 可以保留当“触发点/语义容器”，但不再用它来挂 canvas。canvas 统一挂在 `.gal-game-content`（全屏/主界面渲染）里。

### 5.2 清理逻辑：从 `cleanup(charId)` 改成 `stage.detach(charId)`

角色退场的清理目前是：

- `removeOldestNonProtagonist()` 里：`Live2DManager.cleanup(charId)`：`数据库界面插件.js:7489`

方案 A 下建议：

- **只移出舞台**：`Live2DStage.detach(charId)`（不销毁 app/canvas）
- **释放显存/销毁模型**：继续走 `Live2DManager.cleanup(charId)`（内部先 `stage.detach`，再 `model.destroy()`）

理由：

- 释放显存（移动端/多模型很重要）应当发生在“角色退场/彻底清理”阶段，而不是每次切换容器都 destroy renderer
- 模型缓存要不要保留可以后续再做“内存策略”（比如 LRU），但前提是舞台是单例、context 不重复创建

### 5.3 reset/clearAll 时不要销毁 app（只清角色）

当前跨消息会 `SpriteManager.reset()`，内部 `clearAll()` 会对所有角色做 `Live2DManager.cleanup(charId)`：`数据库界面插件.js:7848`

方案 A 推荐：

- reset 时：逐个 `Live2DStage.detach(charId)`（清 `instances`），需要释放显存就走 `Live2DManager.cleanup(charId)`/`cleanupAll()`
- **不要 destroy `Live2DStage.app`**：避免每条消息都重新建 WebGL context（闪烁/性能差/更容易出错）

---

## 6) 预览/设置面板：避免“又创建一个 app”

历史问题：预览/位置编辑如果“再走一遍 `renderTo()` 并在里面 `new PIXI.Application`”，就会回到 **多 WebGL context**，同屏不稳定问题会复发。

方案 A（已落地）的做法：

1. **复用同一个 canvas（推荐）**
   - 打开预览/编辑：`Live2DStage.pushMount(previewEl, { mode:'single', focusCharacterId })` → `attach()` 目标角色
   - 关闭预览/编辑：`Live2DStage.popMount()` 回到主界面挂载点（`.gal-game-content`）

2. **预览仅显示静态截图（可选，后续再做）**
   - 用 Pixi `renderer.extract` 导出当前模型画面成图片
   - 适合“只看是否正常/表情动作预览”，但不可交互

### 6.1 复用 canvas：实现建议（不要反复 `new PIXI.Application`）

推荐把“挂载点切换”做成 **mount 栈**，避免预览/设置面板与主舞台互相抢 canvas：

```js
// 打开预览（复用同一个 canvas/app）
Live2DStage.pushMount(previewEl, { mode: 'single', focusCharacterId: characterId });
Live2DStage.attach(characterId, model, 'left');

// 关闭预览
Live2DStage.popMount();
```

`pushMount()` 的关键动作（建议顺序）：

1. **保存当前状态**到栈里：`mountEl`、`mode`、已在场角色列表（slot、alpha/visible、是否交互等）。
2. **移动同一个 canvas 节点**：`previewEl.appendChild(canvas)`（DOM re-parent 不会创建新 WebGL context）。
3. **等容器有尺寸再布局**：预览面板常常是先 `display:none` 再 `show()`，需要 `requestAnimationFrame(() => updateLayout())`（或 `ResizeObserver`）。
4. **预览布局模式**：预览时使用 `mode:'single'`，slotRect 直接取“预览容器全区域”；只渲染目标角色。
5. **隐藏/分离其他角色**：  
   - 简单：`otherModel.visible = false` / `alpha = 0`  
   - 更干净：`detach(otherId)`（只从舞台移除，不销毁模型缓存）

`popMount()` 做反向恢复：把 canvas 移回原来的 `.gal-game-content`，恢复 mode、恢复所有角色显示与布局，并 `updateLayout()`。

### 6.2 设置面板（位置/缩放编辑）怎么复用

设置/拖拽编辑本质也是一种“临时挂载 + 临时布局”：

- 打开设置：`pushMount(settingsEl, { mode:'settings', focusCharacterId })`
- settings mode 下把 `canvas.style.pointerEvents = 'auto'`，并启用你原本的交互逻辑（等你把它从 `Live2DManager.enableInteraction()` 迁移到 stage/instance 上）
- 退出设置：保存 transform（offset/scale）到配置 → `popMount()` 复位

> 核心原则：**只有一个 app，一个 canvas**；预览/设置只是改变“canvas 现在挂在哪个 DOM 容器、按什么 rect 来布局、展示哪些模型”。

---

## 7) 验收标准（改完用这个对照）

### 7.1 双角色同屏

- 两个不同 `characterId` 同时启用 Live2D：左/右都能稳定显示
- 连续 NEXT/切换说话者：不会出现某一只消失或只剩一只在更新
- 控制台中 WebGL context 数量稳定为 1（只要 `.gal-game-content` 还在 / 舞台未销毁）

### 7.2 显示不全

- `fitMode=contain + origin=bottom` 时：模型整体尽可能完整，不会被“腰斩”
- UI（按钮/对话框）挤压高度时：角色仍“脚落地”，不会从中间开始裁切
- 移动端横竖屏切换后：`updateLayout()` 触发，slot 位置/大小正确，模型重新拟合

---

## 8) 位置速查（搜索关键词更准）

- `Live2DManager.renderTo`：方案A“舞台早返回”（`ensureMounted`/`attach`/`applyTransform`）
- `const Live2DStage =`：单 Canvas/单 App 的舞台实现（`pushMount/popMount/updateLayout`）
- `SpriteManager.updateCharacterSprite`：Live2D 触发入口（创建 `.gal-live2d-canvas-container` 但不再挂 canvas）
- `showCharacterSpritesModal` + `gal-char-live2d-preview`：预览复用舞台（`pushMount/popMount`）
- `Live2DPositionEditor`：位置/缩放编辑复用舞台（`pushMount/popMount`）
- `.gal-live2d-stage-canvas`：层级与交互（CSS `z-index/pointer-events`）
