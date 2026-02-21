# AI画图指导：绿色背景资源合并图（skin-western）

## 目标
拆成两张图生成，避免混淆：
1. 合并图 A：不包含 `main_frame_scene`（只做按钮/面板等元素）。
2. 单图 B：只包含 `main_frame_scene`（主画框边框）。

## 通用约束
- 格式：`PNG`
- 背景：纯色 `#00FF00`
- 禁止：渐变背景、噪点、纹理污染、水印、logo、透视畸变
- 风格：西方奇幻 UI（龙与地下城）

## 主提示词 A（不含 `main_frame_scene`）
你是一名游戏 UI 资产设计师。请生成一张“西方奇幻 Galgame 界面资源合并图”，用于后期切图。画布尺寸 4096x2304，PNG。整张图背景必须是纯色 #00FF00（纯绿），不能有渐变、阴影污染、纹理、噪点。
仅绘制 UI 资源，不要人物、不要场景、不要文字水印。所有元素彼此独立、互不重叠、边缘清晰、四周留足绿色留白，方便裁剪。
风格统一：龙与地下城、古铜金属、羊皮卷轴、轻微磨损质感，高细节，写实游戏 UI 质感。
请在同一张图中包含以下元素：
1. 对话框底图（dialog_panel）
2. 名牌（name_badge）
3. 重绘按钮（btn_reroll）三态：normal / hover / active
4. 自由对话按钮（btn_free_input）三态：normal / hover / active
5. 底栏通用按钮（footer_btn_common）三态：normal / hover / active
6. 选项按钮（footer_btn_choices）三态：normal / hover / active
7. NEXT 按钮（footer_btn_next）三态：normal / hover / active
8. 顶部状态栏底图（status_bar_container）
9. 全屏按钮（fullscreen_btn）三态：normal / hover / active
10. BGM 组件底图（bgm_widget）
元素排布为网格化展示，每个元素之间保留至少 40px 纯绿色间距。每个三态组横向排布，尺寸一致。不要把元素切到画布外。

### A 负面词
人物, 角色, 风景背景, 房间场景, 渐变背景, 非纯绿色背景, 背景纹理, 噪点, 水印, logo, 文字说明, 透视变形, 低清晰度, 模糊, 锯齿, 裁切缺失, 元素重叠

## 主提示词 B（仅 `main_frame_scene`）
你是一名游戏 UI 资产设计师。请仅生成一个 `main_frame_scene`（主画框装饰）资源。画布尺寸 2600x1200，PNG，背景必须是纯色 #00FF00。
只绘制四周边框装饰（木质、古铜、卷轴、奇幻符文），中心区域必须完整保留纯绿色，不允许纹理、发光、阴影或半透明污染。
构图为正视图，不要透视变形；边框四边厚度协调，边缘锐利可裁剪；边框外侧至少留 20px 绿色安全边距。
不要人物、不要场景、不要文字、不要水印、不要 logo。

### B 负面词
中心填充, 中间纹理, 中间发光, 中间阴影, 半透明中心, 非纯绿色中心, 透视变形, 模糊, 锯齿, 水印, logo, 文字说明, 人物, 场景背景

## 差分写法（从 A 到 B）
如果你必须使用“差分指令”，只用下面这组：
- `删除`：A 中元素 1~10（全部删除）
- `新增`：`main_frame_scene`（仅一个）
- `覆盖`：尺寸改为 `2600x1200`
- `覆盖`：中心区域必须纯绿 `#00FF00`，不允许任何像素污染

## 尺寸建议
- A（不含主画框）：
`dialog_panel` 2600x560；`name_badge` 700x180；`btn_reroll / btn_free_input` 420x150（每态）；`footer_btn_common` 260x120（每态）；`footer_btn_choices` 300x120（每态）；`footer_btn_next` 520x150（每态）；`status_bar_container` 620x130；`fullscreen_btn` 240x120（每态）；`bgm_widget` 700x140
- B（主画框）：
`main_frame_scene` 2600x1200
