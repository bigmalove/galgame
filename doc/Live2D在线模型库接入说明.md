# Live2D 在线模型库接入说明（2026-02-12）

## 当前生效入口

已接入到当前实际使用的角色面板：

- `src/ui/asset-manager-parts.js`
- 入口函数：`showCharacterSpritesModal(characterId, onCloseCallback)`
- 触发按钮：Live2D 区块中的“上传模型/更换模型”

点击后会弹出“模型来源”对话框，支持：

1. 本地 ZIP 上传  
2. 远程 URL 保存  
3. 在线模型库浏览并一键填充 URL

## 在线模型库实现

新增模块：

- `src/live2d/online-model-browser.js`

提供能力：

1. 浏览 `Eikanya/Live2d-model` 的目录结构（GitHub Contents API）
2. 只显示目录与 Live2D 模型 JSON 文件（`model3.json / model.json / *.model3.json / *.model.json`）
3. 选中文件后自动生成可加载 URL（可切换 raw / jsDelivr CDN）
4. GitHub API 限流提示（`RateLimitError`）
5. 目录缓存与手动刷新

## 远程模型保存与校验逻辑

在 `src/ui/asset-manager-parts.js` 中新增远程模型处理：

1. 标准化用户 URL（支持 GitHub `blob/tree/raw` 链接转换）
2. 保存前校验 URL 是否为 Live2D 模型 JSON
3. 先写入远程模型记录（`source: 'remote', modelUrl`）
4. 立即调用 `Live2DManager.loadModel(characterId, true)` 做加载校验
5. 校验失败自动回滚到旧模型数据

## 已清理的旧链路

旧的未生效链路仍保持清理状态：

- `src/live2d/char-settings.js` 已删除
- `src/live2d/model-browser.js` 已删除
- `src/index.js` 中旧注入 `setCharSettingsRefs(...)` 已移除

## 备注

- 远程加载底层由 `src/live2d/manager.js` 执行（已支持远程 JSON 解析、资源路径重写、代理回退）。
- 现在 UI 入口与底层能力已对齐，用户可以直接在当前面板完成远程接入与在线选模。
