# 快速开始

## 前置条件

在使用 Galgame 界面插件之前，你需要准备：

1. **SillyTavern**（酒馆）—— [官方网站](https://sillytavern.app/)
2. **酒馆助手插件**（Tavern Helper）—— [安装说明](https://n0vi028.github.io/JS-Slash-Runner-Doc/)

::: warning 注意
确保酒馆助手已正确安装并启用，Galgame 界面插件依赖酒馆助手提供的接口运行。
:::

## 安装插件

### 方式一：导入脚本 JSON（推荐）

1. 下载插件脚本 JSON 文件
2. 在 SillyTavern 中，进入 **扩展** → **酒馆助手** → **脚本管理**
3. 点击 **导入脚本**，选择下载的 JSON 文件
4. 导入成功后，脚本列表中会出现「galgame界面插件」

### 方式二：通过远程链接加载

在酒馆助手的脚本管理中，新建一个脚本，内容填写：

```
import 'https://gcore.jsdelivr.net/gh/bigmalove/galgame@v1.1/dist/数据库界面插件.dist.js'
```

## 第一次启用

1. 打开一个角色卡的聊天界面
2. 在聊天区域的右下角，你会看到一个 **Galgame 按钮**（🎮）
3. 点击按钮即可 **打开/关闭** Galgame 覆盖层
4. 发送消息后，AI 的回复将以 Galgame 格式展示

::: tip 💡 提示
首次使用时，建议先在设置面板中点击「注入世界书」，这样 AI 就会按照 Galgame 格式输出内容。
:::

## 验证是否生效

如果一切正常，你应该能看到：

- ✅ 聊天区域出现半透明的 Galgame 覆盖层
- ✅ AI 的回复以对话框形式逐段展示
- ✅ 点击覆盖层或「下一步」按钮可推进对话

::: info 🎯 我是角色卡作者
如果你想为自己的角色卡制作「开箱即用」的 Galgame 体验，请查看 [角色卡作者接入指南](/card-author/overview)。
:::

## 下一步

了解一下 [界面总览](/guide/ui-overview)，熟悉 Galgame 覆盖层的各个组成部分。
