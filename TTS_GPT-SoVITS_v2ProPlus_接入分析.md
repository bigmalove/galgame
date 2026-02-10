# TTS：GPT-SoVITS v2ProPlus 接入分析（统一解析方案）

目标：在不改动现有 COT 输出格式（`<p tts="...">` / 简化格式预处理）的前提下，为 `数据库界面插件.js` 的 TTS 增加 **GPT-SoVITS（api_v2.py）** 支持，并与现有 **LittleWhiteBox（火山/小白盒）** 的解析链路统一。

---

## 1. 现有实现回顾（当前脚本的 TTS 数据流）

### 1.1 解析侧：统一抽象为 `segment.tts`
脚本最终会将对话段落解析为类似结构：

```js
{
  type: 'dialogue',
  speaker: '角色名',
  text: '对话内容',
  tts: {
    speaker: '音色名',   // 可选
    emotion: '中性',     // 可选
    context: ''          // 可选
  }
}
```

其中 `tts` 的来源包括：
- 标准格式：`<p tts="speaker=xxx;emotion=xxx;context=xxx">...</p>`
- 简化格式预处理：`<p>角色名[表情,音色]: "..."</p>` 会转换为带 `tts="..."` 的段落（并自动补 `emotion`）

### 1.2 播放侧：`TTSManager.speak(segment, segmentId)`
现有播放逻辑以 **LittleWhiteBox** 为核心（`topWindow.xiaobaixTts` / `topWindow.LittleWhiteBox`），并在播放过程中与口型同步模块联动：
- 播放前：根据 `speaker` 解析音色、推断 `resourceId`
- 播放后：通过音频元素 `playing/ended` 事件启动/停止口型同步

---

## 2. 设计目标（为什么要“统一解析”）

要接入 GPT-SoVITS，关键不是重新定义输出格式，而是：

1) **解析侧保持不变**：仍然只产出 `segment.tts`（speaker/emotion/context），不要求 AI 输出新标签/新字段  
2) **播放侧做“Provider 适配”**：同一份 `segment.tts`，根据设置选择不同引擎（LittleWhiteBox / GPT-SoVITS）  
3) **设置与 UI 统一入口**：引擎切换、默认音色、音色列表，都在同一块 TTS 设置里管理  

这样做的收益：
- 不需要改 COT / prompt（用户成本最低）
- 现有 `<p tts="...">`、简化格式、角色音色绑定等机制继续有效
- 新引擎只需要实现“把 speaker 解析成能播放的参数”的映射即可

---

## 3. GPT-SoVITS（api_v2.py）接入要点

### 3.1 GPT-SoVITS 的“音色”本质
GPT-SoVITS（api_v2.py）通常需要：
- `ref_audio_path`：参考音频路径（在 GPT-SoVITS 服务器侧的文件系统路径）
- `prompt_text` / `prompt_lang`：参考音频对应的文本与语言（可为空但推荐填）
- `text_lang`：待合成文本语言

它不像 LittleWhiteBox 那样天然给你一个 `speaker=value/resourceId` 的固定 ID，因此更合适的做法是：
> 在前端维护一个 **“音色 Profile 列表”**（name → ref_audio_path/prompt_*），让 `segment.tts.speaker` 只负责选中 profile。

### 3.2 建议的音色 Profile JSON（与脚本 UI 对应）
在设置面板里维护一个数组：

```json
[
  {
    "name": "桃夭",
    "desc": "女声-温柔",
    "refAudioPath": "wavs/taoyao.wav",
    "promptText": "你好呀，很高兴见到你。",
    "promptLang": "zh",
    "textLang": "zh"
  }
]
```

字段说明：
- `name`：用于 COT/简化格式/角色绑定里选择的“音色名”（必须）
- `refAudioPath`：对应 `ref_audio_path`（必须）
- `promptLang`：对应 `prompt_lang`（推荐）
- `promptText`：对应 `prompt_text`（推荐）
- `textLang`：可选（若不填则用全局 `textLang`）
- `desc`：UI 展示用（可选）

### 3.3 请求方式建议：GET `/tts`（兼容代理与口型同步）
为了最大化兼容性（特别是 **SillyTavern 的 /proxy/corsProxy** 代理能力），前端优先使用：
- `GET {apiUrl}{endpoint}?text=...&text_lang=...&ref_audio_path=...&prompt_lang=...&prompt_text=...&...`

并支持一个开关：
- `useCorsProxy=true`：将 URL 交给酒馆代理（同源），便于口型同步读取音频流

---

## 4. 本次接入方案（已落地到代码的关键点）

### 4.1 Provider 选择（统一入口）
新增设置：
- `settings.ttsProvider`: `'littlewhitebox' | 'gpt_sovits_v2'`
- `settings.gptSoVits`: GPT-SoVITS 配置与音色列表

### 4.2 音色列表接口统一：`getTTSVoiceListAsync()`
原本只返回 LittleWhiteBox 音色，现在变为：
- provider = `littlewhitebox` → 走原逻辑（LittleWhiteBox_TTS.json / xiaobaixTts / 兜底免费音色）
- provider = `gpt_sovits_v2` → 从 `settings.gptSoVits.voices` 生成“可选音色列表”

收益：
- 角色音色绑定弹窗 / 管理弹窗 / COT 可用音色列表 都自动跟随 provider

### 4.3 播放接口统一：`TTSManager.speak() → provider 分发`
- provider = `gpt_sovits_v2`：
  - 解析到目标 voice profile（拿到 refAudioPath/promptLang/promptText）
  - 构造 `/tts` URL
  - 按需走酒馆代理
  - 用 `new Audio(url)` 播放，并用 `ended/error` 回收状态
  - `segment.speaker` 存在时才启用口型同步（便于“试听”不等待模型）

- provider = `littlewhitebox`：
  - 保持原逻辑（`xiaobaixTts.speak` / `LittleWhiteBox.callGenerate`）

### 4.4 不改 COT：为什么仍然“统一”
因为输出端仍然只需要做到：
- 写 `tts="speaker=音色名;emotion=...;context=..."`（或简化格式自动转换）

GPT-SoVITS 侧只把“音色名”解释为“某个 voice profile 的 name”，无需改变 AI 输出格式。

---

## 5. 设置界面布局建议（已实现 + 可继续优化）

### 5.1 已实现的布局（建议保持）
TTS 区块建议从上到下：
1. **启用 TTS 配音（格式开关）**：影响是否注入带 `tts="..."` 的 COT 模板
2. **TTS 引擎**：LittleWhiteBox / GPT-SoVITS
3. **自动播放**：切段是否自动朗读
4. **默认音色**：未指定/未绑定时使用
5. （当 provider=GPT-SoVITS 时展开）**GPT-SoVITS 配置块**
   - API 地址
   - 代理开关（建议默认开）
   - text_lang / 切分策略 / media_type / streaming / speed
   - 音色列表 JSON + 保存 + 试听

### 5.2 进一步优化建议
- 把“音色列表 JSON”升级为表格化编辑器（增删改行），并提供导入/导出按钮
- 增加“按 emotion 变体”的可选结构（同一个 name 下按 emotion 选不同 ref 音频）
- “试听”可直接选择某个音色，而不是依赖默认音色

---

## 6. 性能与稳定性优化建议（后续可做）

1) **音色列表缓存策略**
   - LittleWhiteBox 已有 5s cache；GPT-SoVITS 可增加“配置变更时刷新”的轻量缓存

2) **播放复用**
   - GPT-SoVITS 播放可以复用一个 `<audio>`，避免频繁 new Audio（同时记得在 stop 时清理 src）

3) **错误提示分级**
   - 401/403/404/5xx、连接失败、代理失败、refAudioPath 不存在：分别提示不同排查方向

4) **口型同步鲁棒性**
   - 当音频跨域且未走代理时，口型同步会拿不到数据：建议默认 `useCorsProxy=true`

5) **更高级的参数支持**
   - 可在 UI 增加 `top_k/top_p/temperature/seed` 等（api_v2.py 支持），用于更一致的合成表现

---

## 7. 常见问题排查清单

### 7.1 有声音但没有口型
- 开启 `GPT-SoVITS → 使用酒馆代理`
- 或确保 GPT-SoVITS 返回 `Access-Control-Allow-Origin`，并允许匿名跨域

### 7.2 连接失败 / 播放失败
- 检查 `API地址` 是否可从酒馆页面访问（同机不同端口通常可）
- 如果是 https 页面访问 http 本地端口，可能被浏览器 mixed content 阻止（建议同源或代理）

### 7.3 refAudioPath 无效
- `refAudioPath` 是 GPT-SoVITS 服务器“运行环境里的路径”，不是酒馆本地路径
- 先在 GPT-SoVITS WebUI/命令行验证该路径可用

---

## 8. 后续扩展方向（可选）

- 增加对 `POST /tts`（JSON body）的支持（更干净，但需要确认酒馆代理是否支持 POST）
- 若 GPT-SoVITS 服务端提供“模型/权重切换接口”，可在 UI 增加选择并缓存到 voice profile

