const EDGE_BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3537.57";
const WSS_URL = `wss://${EDGE_BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const VOICE_LIST_URL = `https://${EDGE_BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH_SECONDS = 11644473600;
const SECONDS_TO_NANOSECONDS = 1e9;
const DEFAULT_RATE = "+0%";
const DEFAULT_VOLUME = "+0%";
const DEFAULT_PITCH = "+0Hz";
let clockSkewSeconds = 0;
const EDGE_FALLBACK_SHORT_VOICES = [
  { shortName: "zh-CN-XiaoxiaoNeural", locale: "zh-CN", gender: "Female" },
  { shortName: "zh-CN-YunxiNeural", locale: "zh-CN", gender: "Male" },
  { shortName: "zh-CN-YunyangNeural", locale: "zh-CN", gender: "Male" },
  { shortName: "zh-CN-XiaoyiNeural", locale: "zh-CN", gender: "Female" },
  { shortName: "en-US-JennyNeural", locale: "en-US", gender: "Female" },
  { shortName: "en-US-AriaNeural", locale: "en-US", gender: "Female" },
  { shortName: "en-US-GuyNeural", locale: "en-US", gender: "Male" },
  { shortName: "ja-JP-NanamiNeural", locale: "ja-JP", gender: "Female" },
  { shortName: "ja-JP-KeitaNeural", locale: "ja-JP", gender: "Male" }
];
function toAbortError(message = "Aborted") {
  try {
    return new DOMException(message, "AbortError");
  } catch {
    const err = new Error(message);
    err.name = "AbortError";
    return err;
  }
}
function buildConnectionId() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function dateToString(mode = "utc_string") {
  const now = /* @__PURE__ */ new Date();
  if (mode === "iso_compact") {
    return now.toISOString().replace(/[-:.]/g, "").slice(0, -1);
  }
  return now.toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}
function removeIncompatibleCharacters(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const isControl = code >= 0 && code <= 8 || code === 11 || code === 12 || code >= 14 && code <= 31;
    out += isControl ? " " : text[i];
  }
  return out;
}
function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function getVoiceName(voice) {
  if (typeof voice === "string") return voice.trim();
  return String(voice.value || voice.name || "").trim();
}
function buildSsml(text, voice) {
  const voiceName = getVoiceName(voice);
  const escapedText = escapeXml(removeIncompatibleCharacters(String(text || "")));
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voiceName}'><prosody pitch='${DEFAULT_PITCH}' rate='${DEFAULT_RATE}' volume='${DEFAULT_VOLUME}'>${escapedText}</prosody></voice></speak>`;
}
function buildSpeechConfigMessage(timestamp) {
  return `X-Timestamp:${timestamp}\r
Content-Type:application/json; charset=utf-8\r
Path:speech.config\r
\r
{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r
`;
}
function buildSsmlMessage(requestId, timestamp, ssml) {
  return `X-RequestId:${requestId}\r
Content-Type:application/ssml+xml\r
X-Timestamp:${timestamp}Z\r
Path:ssml\r
\r
${ssml}`;
}
function parseHeadersFromTextMessage(textMessage) {
  const headerEndIndex = textMessage.indexOf("\r\n\r\n");
  const headerText = headerEndIndex >= 0 ? textMessage.slice(0, headerEndIndex) : textMessage;
  const headers = {};
  for (const line of headerText.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    headers[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  return headers;
}
function parseHeadersAndDataFromBinaryMessage(binary) {
  if (binary.length < 2) return { headers: {}, payload: new Uint8Array(0) };
  const headerLength = binary[0] << 8 | binary[1];
  if (headerLength <= 0 || headerLength + 2 > binary.length) {
    return { headers: {}, payload: binary.slice(2) };
  }
  const headers = {};
  const headerBytes = binary.slice(2, headerLength + 2);
  const headerText = new TextDecoder().decode(headerBytes);
  for (const line of headerText.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    headers[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  return { headers, payload: binary.slice(headerLength + 2) };
}
function concatChunks(chunks) {
  if (chunks.length === 0) return new Uint8Array(0);
  if (chunks.length === 1) return chunks[0];
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
async function toSha256HexUpper(text) {
  const bytes = new TextEncoder().encode(text);
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.digest) {
    try {
      const digest = await subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    } catch {
    }
  }
  return sha256HexUpperFallback(bytes);
}
function rotateRight(value, bits) {
  return (value >>> bits | value << 32 - bits) >>> 0;
}
function sha256HexUpperFallback(message) {
  const K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  const H = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const withOneByte = message.length + 1;
  const paddedLength = Math.ceil((withOneByte + 8) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 128;
  const bitLength = message.length * 8;
  const high = Math.floor(bitLength / 4294967296);
  const low = bitLength >>> 0;
  padded[paddedLength - 8] = high >>> 24 & 255;
  padded[paddedLength - 7] = high >>> 16 & 255;
  padded[paddedLength - 6] = high >>> 8 & 255;
  padded[paddedLength - 5] = high & 255;
  padded[paddedLength - 4] = low >>> 24 & 255;
  padded[paddedLength - 3] = low >>> 16 & 255;
  padded[paddedLength - 2] = low >>> 8 & 255;
  padded[paddedLength - 1] = low & 255;
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = (padded[j] << 24 | padded[j + 1] << 16 | padded[j + 2] << 8 | padded[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotateRight(w[i - 15], 7) ^ rotateRight(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotateRight(w[i - 2], 17) ^ rotateRight(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = e & f ^ ~e & g;
      const temp1 = h + S1 + ch + K[i] + w[i] >>> 0;
      const S0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const temp2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
    H[5] = H[5] + f >>> 0;
    H[6] = H[6] + g >>> 0;
    H[7] = H[7] + h >>> 0;
  }
  return Array.from(H).map((word) => word.toString(16).padStart(8, "0")).join("").toUpperCase();
}
async function buildSecurityParamsWithReason() {
  try {
    let ticks = Date.now() / 1e3 + clockSkewSeconds;
    ticks += WIN_EPOCH_SECONDS;
    ticks -= ticks % 300;
    ticks *= SECONDS_TO_NANOSECONDS / 100;
    const secMsGec = await toSha256HexUpper(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`);
    return {
      security: { secMsGec, secMsGecVersion: SEC_MS_GEC_VERSION },
      error: ""
    };
  } catch (e) {
    return {
      security: null,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
async function buildSecurityParams() {
  const { security } = await buildSecurityParamsWithReason();
  return security;
}
function mapEdgeVoice(item) {
  const shortName = String(item.ShortName || "").trim();
  if (!shortName) return null;
  const locale = String(item.Locale || "").trim();
  const gender = String(item.Gender || "").trim();
  const friendlyName = String(item.FriendlyName || "").trim();
  const desc = [friendlyName, locale, gender].filter(Boolean).join(" | ");
  return {
    name: shortName,
    value: shortName,
    source: "edge_tts_direct",
    resourceId: null,
    desc: desc || "EdgeTTS Direct"
  };
}
function dedupeVoices(list) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const voice of list) {
    const key = String(voice.value || voice.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(voice);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
function parseServerDateHeader(response) {
  const date = response.headers.get("date") || response.headers.get("Date");
  if (!date) return null;
  const ts = new Date(date).getTime();
  if (!Number.isFinite(ts)) return null;
  return ts / 1e3;
}
async function fetchVoicesOnce(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  const serverDate = parseServerDateHeader(response);
  if (serverDate !== null) {
    const clientDate = Date.now() / 1e3 + clockSkewSeconds;
    clockSkewSeconds += serverDate - clientDate;
  }
  if (!response.ok) {
    throw new Error(`EdgeTTS voices request failed (HTTP ${response.status})`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("EdgeTTS voices response is not an array");
  }
  const mapped = payload.map(mapEdgeVoice).filter(Boolean);
  return dedupeVoices(mapped);
}
async function fetchEdgeVoices() {
  const securityResult = await buildSecurityParamsWithReason();
  const security = securityResult.security;
  const urls = [];
  if (security) {
    urls.push(
      `${VOICE_LIST_URL}&Sec-MS-GEC=${encodeURIComponent(security.secMsGec)}&Sec-MS-GEC-Version=${encodeURIComponent(security.secMsGecVersion)}`
    );
  }
  urls.push(VOICE_LIST_URL);
  let lastError = null;
  for (const url of urls) {
    try {
      const voices = await fetchVoicesOnce(url);
      if (voices.length > 0) return voices;
      lastError = new Error("EdgeTTS voices response is empty");
    } catch (e) {
      lastError = e;
    }
  }
  if (!security && securityResult.error) {
    const base = lastError instanceof Error ? lastError.message : String(lastError || "unknown");
    throw new Error(`EdgeTTS voices request failed. security-unavailable: ${securityResult.error}; last: ${base}`);
  }
  throw lastError instanceof Error ? lastError : new Error("EdgeTTS voices request failed");
}
function getEdgeFallbackVoices() {
  return EDGE_FALLBACK_SHORT_VOICES.map((item) => ({
    name: item.shortName,
    value: item.shortName,
    source: "edge_tts_direct",
    resourceId: null,
    desc: `${item.locale} | ${item.gender}`
  }));
}
async function synthesizeWithSocketUrl(socketUrl, text, voiceName, options, timestampMode, attemptLabel) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3e3, Number(options.timeoutMs)) : 25e3;
  return new Promise((resolve, reject) => {
    let done = false;
    let ws = null;
    let timeoutId = null;
    const chunks = [];
    let sawSocketError = false;
    let sawOpen = false;
    let closeCode = 0;
    let closeReason = "";
    let closeWasClean = false;
    const finish = (fn) => {
      if (done) return;
      done = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
      }
      options.onSocket?.(null);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
      fn();
    };
    const fail = (error) => {
      finish(() => reject(error instanceof Error ? error : new Error(String(error))));
    };
    const onAbort = () => {
      try {
        ws?.close(1e3, "abort");
      } catch {
      }
      fail(toAbortError("EdgeTTS direct synthesis aborted"));
    };
    if (options.signal?.aborted) {
      fail(toAbortError("EdgeTTS direct synthesis aborted"));
      return;
    }
    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }
    ws = new WebSocket(socketUrl);
    ws.binaryType = "arraybuffer";
    options.onSocket?.(ws);
    timeoutId = window.setTimeout(() => {
      try {
        ws?.close(1013, "timeout");
      } catch {
      }
      fail(new Error(`EdgeTTS direct websocket timeout (${attemptLabel})`));
    }, timeoutMs);
    ws.onopen = () => {
      sawOpen = true;
      const timestamp = dateToString(timestampMode);
      ws?.send(buildSpeechConfigMessage(timestamp));
      ws?.send(buildSsmlMessage(buildConnectionId(), timestamp, buildSsml(text, voiceName)));
    };
    ws.onmessage = (event) => {
      if (done) return;
      if (typeof event.data === "string") {
        const headers = parseHeadersFromTextMessage(event.data);
        const path = String(headers.Path || headers.path || "").toLowerCase();
        if (path === "turn.end") {
          try {
            ws?.close(1e3, "turn.end");
          } catch {
          }
        }
        return;
      }
      const handleBinary = async () => {
        const data = event.data;
        let bytes = null;
        if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else if (ArrayBuffer.isView(data)) {
          bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (data instanceof Blob) {
          bytes = new Uint8Array(await data.arrayBuffer());
        }
        if (!bytes || bytes.length < 2) return;
        const { headers, payload } = parseHeadersAndDataFromBinaryMessage(bytes);
        const path = String(headers.Path || headers.path || "").toLowerCase();
        if (path !== "audio") return;
        const contentType = String(headers["Content-Type"] || headers["content-type"] || "").toLowerCase();
        if (contentType && !contentType.startsWith("audio/")) return;
        if (payload.length > 0) {
          chunks.push(payload);
        }
      };
      void handleBinary().catch(fail);
    };
    ws.onerror = () => {
      sawSocketError = true;
    };
    ws.onclose = (event) => {
      closeCode = event.code;
      closeReason = String(event.reason || "").trim();
      closeWasClean = !!event.wasClean;
      if (done) return;
      if (options.signal?.aborted) {
        fail(toAbortError("EdgeTTS direct synthesis aborted"));
        return;
      }
      if (chunks.length <= 0) {
        fail(
          new Error(
            `No audio frame received from EdgeTTS direct websocket (${attemptLabel}; code=${closeCode}, clean=${closeWasClean}, opened=${sawOpen}, errorEvent=${sawSocketError}, reason=${closeReason || "n/a"})`
          )
        );
        return;
      }
      const merged = concatChunks(chunks);
      const blob = new Blob([merged], { type: "audio/mpeg" });
      finish(() => resolve(blob));
    };
  });
}
async function synthesizeToBlob(text, voice, options = {}) {
  const cleanText = removeIncompatibleCharacters(String(text || "")).trim();
  if (!cleanText) {
    throw new Error("EdgeTTS text is empty");
  }
  const voiceName = getVoiceName(voice);
  if (!voiceName) {
    throw new Error("EdgeTTS voice is empty");
  }
  const securityResult = await buildSecurityParamsWithReason();
  const security = securityResult.security;
  const attempts = [];
  if (security) {
    attempts.push({
      socketUrl: `${WSS_URL}&Sec-MS-GEC=${encodeURIComponent(security.secMsGec)}&Sec-MS-GEC-Version=${encodeURIComponent(security.secMsGecVersion)}&ConnectionId=${buildConnectionId()}`,
      timestampMode: "utc_string",
      label: "with-sec/utc"
    });
    attempts.push({
      socketUrl: `${WSS_URL}&Sec-MS-GEC=${encodeURIComponent(security.secMsGec)}&Sec-MS-GEC-Version=${encodeURIComponent(security.secMsGecVersion)}&ConnectionId=${buildConnectionId()}`,
      timestampMode: "iso_compact",
      label: "with-sec/iso"
    });
  }
  const plainBase = `${WSS_URL}&ConnectionId=${buildConnectionId()}`;
  attempts.push({
    socketUrl: plainBase,
    timestampMode: "utc_string",
    label: "plain/utc"
  });
  attempts.push({
    socketUrl: plainBase,
    timestampMode: "iso_compact",
    label: "plain/iso"
  });
  let lastError = null;
  const attemptErrors = [];
  for (const attempt of attempts) {
    try {
      return await synthesizeWithSocketUrl(
        attempt.socketUrl,
        cleanText,
        voiceName,
        options,
        attempt.timestampMode,
        attempt.label
      );
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      attemptErrors.push(`${attempt.label}: ${message}`);
      if (options.signal?.aborted) {
        throw toAbortError("EdgeTTS direct synthesis aborted");
      }
    }
  }
  if (attemptErrors.length > 0) {
    const ua = String(globalThis.navigator?.userAgent || "");
    const isEdgeUA = /Edg\//i.test(ua);
    const allUnopened = attemptErrors.every((msg) => /opened=false/.test(msg));
    const likelyUaRejected = !isEdgeUA && allUnopened;
    const securityHint = !security && securityResult.error ? ` security-unavailable=${securityResult.error};` : "";
    const uaHint = likelyUaRejected ? " likely-cause=ua-not-edg;" : "";
    throw new Error(`EdgeTTS direct synthesis failed.${securityHint}${uaHint} ${attemptErrors.join(" | ")}`);
  }
  throw lastError instanceof Error ? lastError : new Error("EdgeTTS direct synthesis failed");
}
export {
  buildSecurityParams,
  buildSsml,
  escapeXml,
  fetchEdgeVoices,
  getEdgeFallbackVoices,
  synthesizeToBlob
};
