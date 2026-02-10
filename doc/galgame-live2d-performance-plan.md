# Galgame界面插件：Live2D 加载/渲染性能与稳定性优化计划

> 面向问题：
> 1) 点击 `NEXT` 到“需要加载 Live2D 模型”的段落时明显卡顿；快速连点时模型可能不渲染。
> 2) 第二个 Live2D 模型渲染后，第一个模型有较高概率“停止运动/冻结”。
> 3) 希望支持 **预加载** 与 **退场缓存**，避免重复加载。

---

## 1. 现状梳理：目前 Live2D 的加载/渲染链路

以下以当前脚本主文件为准：`初始模板/脚本/galgame通用生成器/数据库界面插件.js`。

### 1.1 从 NEXT 到渲染的调用链

1) 用户点击 `NEXT`
   - 事件：`$(doc).on('click', '#gal-global-overlay [data-action="next"]', ...)`
   - 位置：`初始模板/脚本/galgame通用生成器/数据库界面插件.js:11299`
   - 行为：`state.currentIndex++` 后直接调用 `updateOverlaySegmentDisplay(state)`（**未 await**）。

2) 更新覆盖层内容
   - 函数：`updateOverlaySegmentDisplay(state)`
   - 位置：`初始模板/脚本/galgame通用生成器/数据库界面插件.js:11430`
   - 行为：更新文字/进度/NEXT 状态后，`await SpriteManager.updateSprite(...)`，再应用背景 `applySceneTint(...)`。

3) 立绘/Live2D 切换入口
   - 函数：`SpriteManager.updateSprite($overlay, characterId, expression)`
   - 位置：`初始模板/脚本/galgame通用生成器/数据库界面插件.js:8446`
   - 行为：分配左右槽位 → 调用 `updateCharacterSprite(...)`。

4) 角色节点重建 + Live2D 渲染触发
   - 函数：`SpriteManager.updateCharacterSprite(...)`
   - 位置：`初始模板/脚本/galgame通用生成器/数据库界面插件.js:8509`
   - 关键点：
     - 通过 `getCharacterUseLive2D(...)` 与 `hasLive2DModel(...)` 判定是否启用 Live2D（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:3256`、`:7367`）。
     - 若启用：写入 `.gal-live2d-canvas-container`，然后启动一个 **异步 IIFE**：
       - `await Live2DManager.loadModel(characterId)`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:585`）
       - `await Live2DManager.renderTo(characterId, $container[0])`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:963`）
     - 注意：这段渲染 **不在 updateOverlaySegmentDisplay 的 await 链上**，而是“后台跑”。

5) SDK 加载与模型构建
   - Live2D SDK 加载器：`Live2DLoader.load()`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:266`）
     - 首次需要 Live2D 时，会从 CDN/IndexedDB 拉取并注入 `PIXI + Cubism Core + pixi-live2d-display`，解析/执行发生在主线程。
   - 模型加载：`Live2DManager.loadModel(...)`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:585`）
     - 从 IndexedDB 取模型文件集合 → `_buildModelBlobUrl(...)` 将 moc/纹理/动作等打包成可加载的 URL → `Live2DModel.from(...)` 实例化。

6) 多角色渲染方式（当前是“方案 A：全局舞台”）
   - `Live2DManager.renderTo(...)`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:963`）
     - **containerElement.isConnected** 时走“方案 A”：`Live2DStage.ensureMounted(...)` + `Live2DStage.attach(...)`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:1509`）。
     - 否则走“方案 B”：为该角色新建 canvas/PIXI.Application（更重，也更容易引发资源/上下文问题）。

---

## 2. 问题分析：为什么会卡、会丢渲染、会冻结

### 2.1 NEXT 到“首次 Live2D 段落”时明显卡顿

**主因（高概率）：按需加载大体积 SDK，解析/执行阻塞主线程。**

- `Live2DLoader.load()` 首次运行时，会注入 `pixi.min.js`、`live2dcubismcore.min.js`、`live2d.min.js`、`pixi-live2d-display`。这些脚本体积较大，**解析与执行不可避免地阻塞 UI**。

**次因：模型打包/实例化的 CPU 与内存压力较大。**

- `Live2DManager.loadModel()` 内部需要将 IndexedDB 里的多文件拼成可加载的 model URL，并创建 Live2DModel 实例；这一过程会产生显著的 JS 运算与内存分配（后续还会触发 GC），体感就会“卡一下”。

### 2.2 快速连点 NEXT 时模型偶尔不渲染

这里存在两个叠加的竞态源：

1) **NEXT 事件处理没有 await 更新流程**
   - `NEXT` handler 里直接调用 `updateOverlaySegmentDisplay(state)`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:11299`），用户快速连点会导致**多次 UI 更新并发进行**。

2) **Live2D 渲染异步 IIFE 无取消/无一致性校验**
   - `updateCharacterSprite` 会立刻 `$slot.html(...)` 替换 DOM，再启动异步渲染 IIFE。
   - 快速连点时，旧的 `$container[0]` 很容易已经 `isConnected=false`，但异步任务仍会继续执行到 `Live2DManager.renderTo(...)`。

关键风险点在 `Live2DManager.renderTo(...)`：
- 当 `containerElement.isConnected === false` 时，代码会落入“方案 B”，且会把“容器变化”视为 needReload，从而调用 `this.cleanup(characterId)`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:963` 附近逻辑）。
这会造成两类后果：
- 本次渲染直接失败（渲染到已脱离 DOM 的容器，无用户可见结果）。
- 更糟：误触发 cleanup，导致原本已在舞台正常显示的模型被销毁/解绑，表现为“丢模型 / 画面冻结 / 只剩一帧”。

### 2.3 第二个 Live2D 渲染后，第一个模型“停止运动/冻结”

**最可能原因（优先验证）：竞态导致 renderTo 被喂了“已脱离 DOM 的 containerElement”，触发 fallback + cleanup，把第一个模型解绑或销毁。**

触发路径与 2.2 一致，只是更容易在“第二个模型加载较慢 + 用户继续点 NEXT”时复现：
加载第二个模型期间，overlay DOM 多次被重绘/替换 → 某个角色的 renderTo 进入“方案 B” → `needReload` 成立 → `cleanup(characterId)` → 模型不再更新。

**次要可能：Live2DStage 属于全局单例，但缺少全局串行锁，多个角色同时 attach/detach/ensureMounted 时状态交错。**
当前只有 `renderLocks`（按 characterId）做串行化，但舞台相关逻辑是全局共享状态（`Live2DStage.instances/app/canvas/mountEl`），理论上需要额外的“舞台级互斥”来避免交错更新。

---

## 3. 修改计划（按优先级）

### P0（必须先做）：消除竞态，保证“连点不丢、不冻”

- [x] **NEXT/PREV/AUTO 的段落切换改为串行队列**
  - 目标：同一时刻只允许 1 个 `updateOverlaySegmentDisplay` 在跑。
  - 方案：把 handler 改为 `async` 并 `await`，或引入 `overlayUpdateQueue`（Promise 链）+ `desiredIndex` 合并多次点击。
  - 影响点：`初始模板/脚本/galgame通用生成器/数据库界面插件.js:11299`、`:11322`、AUTO 计时器相关。

- [x] **给 overlay 渲染引入“renderToken/版本号”，旧任务自动失效**
  - 每次段落切换：`state.renderToken++`
  - `updateCharacterSprite` 的 Live2D IIFE 在调用 `renderTo` 前检查：
    - 该 token 是否仍是最新
    - `$container[0].isConnected === true`
    - 槽位是否仍属于当前 characterId
  - 旧 token：直接 return，不再触碰 Live2DManager（避免误 cleanup）。

- [x] **Live2DManager.renderTo：对“containerElement 不连通”的情况做硬保护**
  - 如果 `containerElement` 存在但 `!isConnected`：直接 `return false`（不要 fallback，不要 cleanup）。
  - 仅当“明确进入预览/单人模式”时才允许方案 B。
  - 影响点：`初始模板/脚本/galgame通用生成器/数据库界面插件.js:963`。

- [ ] **为 Live2DStage 增加舞台级互斥锁（stageLock）**
  - `ensureMounted/attach/detach/applyTransform/updateLayout` 走同一条 promise 链串行化，避免并发交错。

- [ ] **交互层兜底：更新期间临时禁用 NEXT（或最少节流到 1 帧 1 次）**
  - 防止用户用“高频连点”把系统打进异常状态。

### P1（体验优化）：预加载 SDK 与“下一位角色”的模型

- [x] **SDK 预加载**
  - 在 overlay 第一次显示后（或初始化后 `requestIdleCallback`）触发 `Live2DLoader.load()` / `Live2DManager.init()`。
  - 目标：把“首次 Live2D 卡顿”提前到用户不操作时段，减少 NEXT 触发的卡顿。

- [x] **模型预加载（look-ahead）**
  - 在解析到 segments 后，扫描接下来 N 段（例如 10～15 段）将会出现的 speaker：- 设置里可以设置
    - 若 `getCharacterUseLive2D(speaker)` 且 `hasLive2DModel(speaker)`：后台 `Live2DManager.loadModel(speaker)`
  - 用并发上限（例如 1）避免同时加载多个模型造成更大卡顿。
  - 补充：对连续失败的角色增加了 cooldown（避免频繁重试导致卡顿/刷屏）。

### P2（性能/资源平衡）：退场缓存（LRU）替代立即 cleanup

- [x] **把“退场 cleanup”改为“detach + 缓存”**
  - 现状：`removeOldestNonProtagonist()` 里 400ms 后 `Live2DManager.cleanup(charId)`（`初始模板/脚本/galgame通用生成器/数据库界面插件.js:8418` 附近）。
  - 改进：默认 detach（从舞台移除），但保留 `Live2DManager.models` 中的实例，供后续快速入场复用。

- [x] **增加 LRU 上限与淘汰策略**
  - 例如：最多缓存 2～4 个模型；超过则淘汰最久未使用者（destroy + revoke URL）。-设置里可以设置，默认2个
  - 加一个“清空缓存”入口，便于用户排查显存问题。

### P3（更深层性能）：减少 loadModel 的 CPU/内存开销

- [x] **Blob URL 优化（带兼容性回退）**
  - 结论：`pixi-live2d-display` 内部使用 XHRLoader 加载资源，部分环境（常见于移动端）对 `blob:` 的 XHR 读取会 `Status 0` 并报 `Texture loading error`。
  - 方案：默认优先 Blob；启动时做一次 XHR blob 预检测，不支持则自动切到 DataURL；若 Blob 加载过程中报错则自动回退 DataURL，并禁用后续 Blob 尝试。
  - 远程模型 JSON 也改为 DataURL（避免 XHR blob 不兼容）。

- [ ] **在模型打包/加载大循环中插入“让出主线程”策略**
  - 例如每处理若干纹理 `await new Promise(requestAnimationFrame)` 或 `requestIdleCallback` 分片，避免长任务（Long Task）。

---

## 4. 验收标准（可量化）

- 快速连点 `NEXT`（例如 10 次/秒持续 2 秒）：
  - 最终停留段落的角色显示正确；
  - 不出现“模型不渲染/只剩一帧/冻结”的状态；
  - 控制台无未捕获异常、无明显的重复 cleanup 日志。

- 首次进入 Live2D 段落：
  - UI 文本/按钮先更新（<= 1 帧）；
  - Live2D 在随后 1～3 秒内加载完成（取决于模型体积），期间有清晰的 loading 表现。

- 双 Live2D 同屏：
  - 两个模型都持续 idle motion（或至少渲染持续刷新，不会停在某一帧）；
  - 切换说话者时焦点变化正常。

---

## 5. 推荐的落地顺序

1) P0：串行队列 + renderToken + renderTo 断连保护（先把“丢/冻”彻底压住）
2) P1：SDK 预加载 + look-ahead 模型预加载（解决“第一次卡得离谱”）
3) P2：LRU 缓存（解决“反复入场仍慢”）
4) P3：Blob URL 方案（把大模型加载的 CPU/内存峰值降下来）
