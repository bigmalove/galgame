# Live2D 通用表情/动作方案（数据库界面插件）

目标：在不要求每个 Live2D 模型都自带同名资源的前提下，提供一套“通用表情/动作标签”，让任意新添加的 Live2D 模型都能通过同一套标签进行调用；对资源缺失的模型自动降级；对不匹配的模型允许用户手动映射修正。

参考：pixi-live2d-display（通过 `PIXI.live2d.Live2DModel.from()` 加载模型，通过 `model.motion()` / `model.expression()` 控制）。本插件已按该思路从 CDN 动态加载 Pixi、Cubism Core 与 `pixi-live2d-display`。  

相关文件：
- `初始模板/脚本/galgame通用生成器/数据库界面插件.js`
- `初始模板/脚本/galgame通用生成器/数据库界面插件.css`

---

## 现状梳理（已具备的能力）

### 1) SDK/模型加载能力

`数据库界面插件.js` 内的 `Live2DLoader` 会按顺序：
1. 加载 `pixi.js@6`（必要时将 `window.PIXI` 暴露到顶层窗口）
2. 加载 Cubism 4 Core（`live2dcubismcore.min.js`）
3. 加载 Cubism 2.1 Core（`live2d.min.js`，用于旧模型）
4. 加载 `pixi-live2d-display`（带 IndexedDB 缓存）

这与 pixi-live2d-display README 的推荐使用方式一致（CDN 方式下导出至 `PIXI.live2d.*`）。

### 2) 渲染与基础控制

`Live2DManager` 负责：
- `loadModel(characterId)`：加载 Live2D 模型并缓存
- `renderTo(characterId, domContainer)` / `Live2DStage.attach(...)`：把模型挂载到指定容器/全局舞台
- `setExpression(characterId, expressionName)`：对外传入“游戏表情名”，内部做一次简单匹配后调用 `model.expression(...)`
- `playMotion(characterId, motionGroup, index=0)`：直接调用 `model.motion(...)`

CSS 层面：
- `.gal-live2d-stage-canvas` 下置到 UI 层下面，避免遮挡按钮/弹窗
- `#gal-live2d-settings-modal` 强制最高 `z-index`，保证设置弹窗可用

### 3) 已存在“通用标签 -> 资源名”映射雏形（但目前未完全串起来）

插件内同时存在两套相似的映射逻辑：

1. `Live2DManager._matchExpression()`  
用于 `Live2DManager.setExpression()`，把游戏表情（如“微笑/生气”）模糊匹配到模型 `expressionManager.definitions` 里的真实表情名。

2. `EXPRESSION_LIVE2D_MAP` + `matchLive2DExpression()` / `matchLive2DMotion()` + `showLive2DSettingsModal()`  
这套更完整：
- 默认映射：`EXPRESSION_LIVE2D_MAP` 同时包含 `expressions` 候选列表与 `motions` 候选列表
- 允许用户为单角色配置覆盖：
  - `expressionMapping[tag] = "真实表情名"`
  - `motionMapping[tag] = { group: "动作组名", index: 0, enabled: true }` 或 `{ enabled: false }`
- 设置界面 `showLive2DSettingsModal(characterId)` 提供“自动匹配/清空/保存”，并把配置落到 `localStorage` 的 `LIVE2D_CONFIG_KEY`

关键问题：目前“更完整的映射 + 动作联动”的入口函数 `setLive2DCharacterExpression(characterId, expressionName, playMotion)` 没有被主流程调用；主流程仍主要走 `Live2DManager.setExpression()`（仅表情、不读用户映射、不联动动作）。因此用户在设置界面做的动作/表情映射，未必会对实际对话流程生效。

---

## 能否做“默认通用表情/动作”？结论

可以做，但“通用”的定义需要更务实：

- 不能保证每个模型都含有“开心/生气/难过”等语义一致的表情文件或动作组；不同作者的命名差异很大，甚至只有 `exp_01`、`motion_02`。
- 但可以保证：对外暴露一套固定的“通用标签集”，并通过以下策略尽最大可能落地：
  1. 自动匹配：用候选词/规则从模型的可用表情与动作组里找最可能的目标
  2. 自动降级：找不到就跳过（只做表情、不做动作；或保持当前）
  3. 手动覆盖：为匹配不准的模型提供 UI 映射，保证最终可用

换句话说：**“每个模型都能调用”可以做到**，但语义一致性取决于模型资源与映射质量；需要“自动 + 可配置”的两级方案。

---

## 推荐落地方案（基于当前代码最小改造）

### 1) 统一“通用标签”数据源

以 `EXPRESSION_LIVE2D_MAP` 的 key 作为“通用标签集”是合理的，因为：
- 它已经覆盖常用情绪（默认/微笑/生气/难过/惊讶/害羞/思考…）
- 设置界面也基于这些 key 自动生成映射行（`Object.keys(EXPRESSION_LIVE2D_MAP)`）

建议补充两类标签（按需）：
- 交互类动作：`tap_head`、`tap_body`、`idle`（对应 pixi-live2d-display 示例中的 `model.motion('tap_body')` 这类组名常见）
- 剧情常用：`点头`、`摇头`、`挥手`、`睡觉`（需要看你们实际剧本标签体系）

### 2) 把“表情 + 动作联动 + 用户映射”接入主流程

把 `Live2DManager.setExpression(characterId, expressionName)` 改为使用现有的映射与用户配置（已有全部函数与数据结构），达到：
- 默认：自动匹配表情名；可选联动动作
- 用户配置后：优先按 `expressionMapping/motionMapping` 命中
- 找不到则降级：不抛错、不阻塞渲染

注意：目前 `matchLive2DExpression()` 只读取 `expressionManager.definitions`，而 `getLive2DExpressionList()` 有更强的“多路径”兼容（`definitions/expressions/settings.expressions`）。建议把两者对齐，避免不同模型下自动匹配永远返回 `null`。

### 3) 为“通用动作”建立与表情分离的映射（可选但更合理）

把“情绪”与“动作组”强绑定并不总是正确，因为很多模型的动作组是交互触发（TapHead/TapBody/Idle），与“微笑/生气”无关。

更通用的结构是两张映射表：
- `expressionMapping[tag] -> expressionName`
- `motionMapping[action] -> { group, index, enabled }`

其中 `tag`（情绪标签）与 `action`（动作标签）各自有默认候选集；脚本可以选择只切表情、只播动作或两者组合。

### 4) 映射的存储位置建议

当前实现把 Live2D 配置存入 `localStorage`（`LIVE2D_CONFIG_KEY`），优点是实现简单、跨刷新持久化；缺点是难以在酒馆的“变量系统”里统一管理/导出。

如果你们希望：
- 在不同设备间同步
- 按角色卡/聊天文件隔离
- 可被“酒馆变量管理器”直接查看/备份

可以考虑把映射存到酒馆变量（参考 `.cursor/rules/酒馆变量.mdc`，以及类型声明 `@types/function/variables.d.ts` 的 `getVariables/replaceVariables`）。实践上更推荐：
- 全局变量：放默认映射模板（团队共用）
- 角色卡变量：放某角色专属映射（更贴合“每个添加的 Live2D”）

---

## 可用性与风险点（需要在文档/实现里明确）

1. 表情/动作资源缺失是常态：必须允许“找不到就跳过”，避免影响对话 UI。
2. 命名差异极大：自动匹配只能做到“尽力”，手动映射必须保留。
3. 模型未加载时无法扫描：自动匹配/映射需要模型实例（或读取 model.json/model3.json 的 motions/expressions 定义）。当前设置弹窗已采用“先显示 UI，异步加载模型数据”的方式，体验是对的。
4. 运动优先级与并发：`model.motion(group, index, priority)` 的 priority（例如 `'NORMAL'/'FORCE'`）需要统一策略，否则可能出现动作被打断或排队不符合预期。

---

## 建议的对外调用 API（给剧本/脚本用）

在 `window.galgame.Live2DManager` 的基础上增加一层“通用标签 API”（名称仅示例）：

```js
// 情绪：切表情，可选联动一个动作
galgame.live2d.setTag(characterId, '微笑', { motion: true });

// 动作：只播动作
galgame.live2d.playAction(characterId, 'tap_body');
```

这样剧本层永远只面对“通用标签”，而不是每个模型的真实资源名。

---

## 最小改造清单（便于排期）

1. 让主流程设置表情时读取 `getLive2DConfig(characterId)` 的 `expressionMapping/motionMapping`（复用已写好的函数）。
2. 合并重复的映射代码：用一套 `matchExpression/matchMotion` 取代 `Live2DManager._matchExpression` 与 `matchLive2DExpression` 的重复逻辑。
3. 扩充默认候选词：补充常见动作组名（`idle/tap_body/tap_head` 等），并对 groupName 做归一化（大小写、下划线、连字符、驼峰）。
4. 在设置弹窗里补充动作 index/priority（如确有需要），并在保存时落盘。

