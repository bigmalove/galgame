# GPT-SoVITS v2ProPlus + SillyTavern `/proxy` 多角色轮换（前端直连方案）

目标：不写后端，不改 GPT-SoVITS 源码，通过 SillyTavern 的 `enableCorsProxy` + `/proxy` 在浏览器侧实现：
- 多角色（多模型）轮换：按角色切 `GPT/SoVITS` 权重
- 调用 `/tts` 合成并播放
- 全程同源请求（避免 CORS / Mixed Content）

## 1. 前提条件（必须）

### 1.1 SillyTavern 开启 CORS 代理
编辑 SillyTavern 根目录 `config.yaml`：

```yaml
enableCorsProxy: true
```

重启 SillyTavern。

### 1.2 GPT-SoVITS API 可从酒馆服务器访问
- GPT-SoVITS 机器防火墙放行端口（默认 `9880`）
- GPT-SoVITS 监听地址需能被局域网访问（例如：`api_v2.py -a 0.0.0.0 -p 9880`）

注意：你在前端传的 `weights_path/ref_audio_path` 都是 **GPT-SoVITS 服务端机器的文件系统路径**，不是酒馆客户端的路径。

## 2. `/proxy` URL 规则（推荐写法）

你已经验证过这种写法可用：

```text
/proxy/http://<ip>:9880/<endpoint>%3F<k>%3D<v>
```

更稳、更不容易写错的方式是：**把目标 URL 整体 `encodeURIComponent`**（无需手动写 `%3F/%3D`）：

```js
function stProxyUrl(targetUrl) {
  return `/proxy/${encodeURIComponent(targetUrl)}`;
}
```

## 3. 单接口快速测试（浏览器 Console）

### 3.1 切换 GPT 权重（GET）

```js
async function setGptWeights(host, weightsPath) {
  const u = new URL(`http://${host}:9880/set_gpt_weights`);
  u.searchParams.set("weights_path", weightsPath);
  const res = await fetch(`/proxy/${encodeURIComponent(u.toString())}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.Exception || data?.message || `HTTP ${res.status}`);
  return data;
}
```

### 3.2 切换 SoVITS 权重（GET）

```js
async function setSovitsWeights(host, weightsPath) {
  const u = new URL(`http://${host}:9880/set_sovits_weights`);
  u.searchParams.set("weights_path", weightsPath);
  const res = await fetch(`/proxy/${encodeURIComponent(u.toString())}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.Exception || data?.message || `HTTP ${res.status}`);
  return data;
}
```

### 3.3 合成语音（POST `/tts`，返回音频 blob）

```js
async function tts(host, payload) {
  const url = `/proxy/${encodeURIComponent(`http://${host}:9880/tts`)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return await res.blob();
}
```

## 4. 多角色轮换（清理后的最小可用类）

特点：
- 串行队列：保证 `切权重 -> tts` 按顺序执行（GPT-SoVITS 端是全局状态）
- 缓存当前权重：同角色连续说话不重复切
- 使用 POST `/tts`：避免 GET URL 过长、编码痛苦、代理兼容性问题

```js
class GPTSoVITSProxyClient {
  constructor({ host, port = 9880 } = {}) {
    if (!host) throw new Error("host is required");
    this.host = host;
    this.port = port;
    this.characters = {};
    this.current = { name: null, gpt: null, sovits: null };
    this._queue = Promise.resolve();
  }

  _proxy(targetUrl) {
    return `/proxy/${encodeURIComponent(targetUrl)}`;
  }

  _enqueue(task) {
    const run = () => Promise.resolve().then(task);
    this._queue = this._queue.then(run, run);
    return this._queue;
  }

  loadCharacters(characters) {
    this.characters = characters || {};
  }

  async switchCharacter(name) {
    return this._enqueue(async () => {
      const c = this.characters?.[name];
      if (!c) throw new Error(`character not found: ${name}`);

      if (c.gpt_weights && c.gpt_weights !== this.current.gpt) {
        const u = new URL(`http://${this.host}:${this.port}/set_gpt_weights`);
        u.searchParams.set("weights_path", c.gpt_weights);
        const res = await fetch(this._proxy(u.toString()));
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.Exception || data?.message || `set_gpt_weights HTTP ${res.status}`);
        this.current.gpt = c.gpt_weights;
      }

      if (c.sovits_weights && c.sovits_weights !== this.current.sovits) {
        const u = new URL(`http://${this.host}:${this.port}/set_sovits_weights`);
        u.searchParams.set("weights_path", c.sovits_weights);
        const res = await fetch(this._proxy(u.toString()));
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.Exception || data?.message || `set_sovits_weights HTTP ${res.status}`);
        this.current.sovits = c.sovits_weights;
      }

      this.current.name = name;
      return true;
    });
  }

  async speak(text, characterName) {
    return this._enqueue(async () => {
      const name = characterName || this.current.name;
      if (!name) throw new Error("no character selected");
      if (name !== this.current.name) await this.switchCharacter(name);

      const c = this.characters?.[name];
      if (!c) throw new Error(`character not found: ${name}`);

      const payload = {
        text,
        text_lang: c.text_lang || "auto",
        ref_audio_path: c.refer_audio,
        prompt_text: c.refer_text || "",
        prompt_lang: c.ref_lang || c.text_lang || "auto",
        text_split_method: c.text_split_method || "cut5",
        speed_factor: c.speed ?? 1.0,
        streaming_mode: false,
        media_type: c.media_type || "wav",
      };

      const url = this._proxy(`http://${this.host}:${this.port}/tts`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `tts HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      audio.addEventListener(
        "ended",
        () => {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch (e) {}
        },
        { once: true },
      );
      await audio.play();
      return audio;
    });
  }
}
```

## 5. `characters` 配置示例

```js
const characters = {
  "高松灯": {
    gpt_weights: "I:/Downloads/GPT-SoVITS v2 pro plus/GPT_weights_v2/MyGO_高松灯_v2pp.ckpt",
    sovits_weights: "I:/Downloads/GPT-SoVITS v2 pro plus/SoVITS_weights_v2/MyGO_高松灯_v2pp.pth",
    refer_audio: "I:/Downloads/GPT-SoVITS v2 pro plus/refer_audios/高松灯/ref1.wav",
    refer_text: "大家好，我是高松灯，请多多指教。",
    text_lang: "zh",
    ref_lang: "zh",
    speed: 1.0,
  },
  "丰川祥子_白": {
    gpt_weights: "I:/Downloads/GPT-SoVITS v2 pro plus/GPT_weights_v2/Mujica_豊川祥子_白_v2pp.ckpt",
    sovits_weights: "I:/Downloads/GPT-SoVITS v2 pro plus/SoVITS_weights_v2/Mujica_豊川祥子_白_v2pp.pth",
    refer_audio: "I:/Downloads/GPT-SoVITS v2 pro plus/refer_audios/丰川祥子_白/ref1.wav",
    refer_text: "これからもよろしくお願いします。",
    text_lang: "ja",
    ref_lang: "ja",
    speed: 1.0,
  },
};
```

## 6. 常见坑（你日志里出现过的）

1. `400 Bad Request`：GPT-SoVITS `api_v2.py` 会返回 JSON，比如：
   - `{"message":"change gpt weight failed","Exception":"..."}` 或 `{"message":"tts failed","Exception":"..."}`
   - 用 `await res.json()`/`await res.text()` 打印出来才能定位原因
2. 多客户端抢模型：`/set_*_weights` 改的是服务端全局状态，多页面/多设备同时播会互相覆盖。
3. 路径含中文/空格：推荐用 `I:/...` 这种正斜杠路径，并通过 `URLSearchParams` 或 `encodeURIComponent` 生成请求。

