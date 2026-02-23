const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + (part ? part.length : 0), 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    if (!part || !part.length) continue;
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeAscii(text) {
  const src = String(text || '');
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) {
    out[i] = src.charCodeAt(i) & 0xff;
  }
  return out;
}

function decodeLatin1(bytes) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return out;
}

function u32be(input) {
  const value = input >>> 0;
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function normalizeBase64(input) {
  let text = String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!text) return '';
  const mod = text.length % 4;
  if (mod === 1) return '';
  if (mod === 2) text += '==';
  if (mod === 3) text += '=';
  return text;
}

function base64ToBytes(base64Text) {
  const normalized = normalizeBase64(base64Text);
  if (!normalized) throw new Error('无效的 base64 数据');
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
  return out;
}

function tryParseJsonFromMaybeBase64(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj;
  } catch {
    // ignore
  }

  if (!/^[A-Za-z0-9+/=_-]+$/.test(raw) || raw.length < 16) return null;

  try {
    const decoded = base64ToBytes(raw);
    const jsonText = new TextDecoder('utf-8').decode(decoded);
    const obj = JSON.parse(jsonText);
    if (obj && typeof obj === 'object') return obj;
  } catch {
    // ignore
  }

  return null;
}

function looksLikeCharacterCard(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.spec === 'string' && /chara/i.test(obj.spec)) return true;
  if (obj.data && typeof obj.data === 'object' && typeof obj.data.name === 'string') return true;
  if (typeof obj.name === 'string' && (typeof obj.description === 'string' || typeof obj.personality === 'string')) return true;
  return false;
}

function decodePngTextChunk(chunk) {
  if (chunk.type === 'tEXt') {
    const idx = chunk.data.indexOf(0);
    if (idx < 0) return null;
    const keyword = decodeLatin1(chunk.data.subarray(0, idx));
    const text = decodeLatin1(chunk.data.subarray(idx + 1));
    return { keyword, text, kind: 'tEXt' };
  }

  if (chunk.type === 'iTXt') {
    const data = chunk.data;
    let cursor = 0;
    const keywordEnd = data.indexOf(0, cursor);
    if (keywordEnd < 0) return null;
    const keyword = decodeLatin1(data.subarray(cursor, keywordEnd));
    cursor = keywordEnd + 1;
    if (cursor + 2 > data.length) return null;
    const compressionFlag = data[cursor++];
    const compressionMethod = data[cursor++];

    const languageTagEnd = data.indexOf(0, cursor);
    if (languageTagEnd < 0) return null;
    cursor = languageTagEnd + 1;

    const translatedKeywordEnd = data.indexOf(0, cursor);
    if (translatedKeywordEnd < 0) return null;
    cursor = translatedKeywordEnd + 1;

    if (compressionFlag === 1) return null;
    if (compressionMethod !== 0 && compressionMethod !== 1) return null;

    const textBytes = data.subarray(cursor);
    const text = new TextDecoder('utf-8').decode(textBytes);
    return { keyword, text, kind: 'iTXt' };
  }

  return null;
}

function getPngTextKeyword(chunk) {
  const idx = chunk.data.indexOf(0);
  if (idx < 0) return '';
  return decodeLatin1(chunk.data.subarray(0, idx));
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32ForChunk(typeBytes, dataBytes) {
  let c = 0xffffffff;
  for (let i = 0; i < typeBytes.length; i++) c = CRC32_TABLE[(c ^ typeBytes[i]) & 0xff] ^ (c >>> 8);
  for (let i = 0; i < dataBytes.length; i++) c = CRC32_TABLE[(c ^ dataBytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunkBytes(type, dataBytes) {
  const typeBytes = encodeAscii(type);
  const lenBytes = u32be(dataBytes.length);
  const crcBytes = u32be(crc32ForChunk(typeBytes, dataBytes));
  return concatBytes([lenBytes, typeBytes, dataBytes, crcBytes]);
}

function stringifyCardAsV3(cardObj) {
  const base = typeof structuredClone === 'function'
    ? structuredClone(cardObj)
    : JSON.parse(JSON.stringify(cardObj));
  if (!base || typeof base !== 'object') {
    throw new Error('角色卡数据无效');
  }
  base.spec = 'chara_card_v3';
  base.spec_version = '3.0';
  return JSON.stringify(base);
}

export function isPngBytes(bytes) {
  if (!bytes || bytes.length < PNG_SIGNATURE.length) return false;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

export function parsePngChunks(bytes) {
  if (!isPngBytes(bytes)) throw new Error('不是有效的 PNG 文件');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = dv.getUint32(offset, false);
    offset += 4;
    const type = decodeLatin1(bytes.subarray(offset, offset + 4));
    offset += 4;
    const end = offset + length;
    if (end + 4 > bytes.length) throw new Error('PNG 块数据已损坏或不完整');
    const data = bytes.subarray(offset, end);
    offset = end;
    const crc = dv.getUint32(offset, false);
    offset += 4;
    chunks.push({ type, data, crc });
    if (type === 'IEND') break;
  }
  return chunks;
}

export function extractCardFromPngBytes(bytes) {
  const chunks = parsePngChunks(bytes);
  const candidates = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!['tEXt', 'iTXt'].includes(chunk.type)) continue;
    const decoded = decodePngTextChunk(chunk);
    if (!decoded) continue;
    const cardObj = tryParseJsonFromMaybeBase64(decoded.text);
    if (!looksLikeCharacterCard(cardObj)) continue;

    let score = 1;
    const keyword = String(decoded.keyword || '').toLowerCase();
    if (keyword === 'chara') score += 100;
    else if (keyword === 'ccv3') score += 90;
    else if (keyword.includes('chara')) score += 80;
    if (cardObj && typeof cardObj.spec === 'string' && /chara/i.test(cardObj.spec)) score += 50;
    candidates.push({ score, keyword: decoded.keyword || '', card: cardObj });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    throw new Error('PNG 元数据中未找到角色卡 JSON');
  }
  return { card: best.card, keyword: best.keyword };
}

export function embedCardIntoPngBytes(originalBytes, cardObj, prettyIndent = 2) {
  if (!cardObj || typeof cardObj !== 'object') {
    throw new Error('角色卡数据无效，无法写入 PNG');
  }
  const chunks = parsePngChunks(originalBytes);
  const normalizedIndent = Number.isFinite(Number(prettyIndent))
    ? Math.min(8, Math.max(0, Math.floor(Number(prettyIndent))))
    : 2;
  const jsonText = JSON.stringify(cardObj, null, normalizedIndent);
  const jsonBytes = new TextEncoder().encode(jsonText);
  const base64 = bytesToBase64(jsonBytes);
  const charaTextData = concatBytes([encodeAscii('chara'), new Uint8Array([0]), encodeAscii(base64)]);
  let ccv3TextData = null;
  try {
    const v3Json = stringifyCardAsV3(cardObj);
    const v3Bytes = new TextEncoder().encode(v3Json);
    const v3Base64 = bytesToBase64(v3Bytes);
    ccv3TextData = concatBytes([encodeAscii('ccv3'), new Uint8Array([0]), encodeAscii(v3Base64)]);
  } catch {
    // Ignore v3 fallback failure and keep v2 chara chunk.
  }

  const removeKeywords = new Set(['chara', 'ccv3']);
  const cleaned = [];
  for (const chunk of chunks) {
    if (['tEXt', 'iTXt', 'zTXt'].includes(chunk.type)) {
      const keyword = String(getPngTextKeyword(chunk) || '').toLowerCase();
      if (removeKeywords.has(keyword)) continue;
    }
    cleaned.push({ type: chunk.type, data: chunk.data });
  }

  const iendIndex = cleaned.findIndex(chunk => chunk.type === 'IEND');
  const insertAt = iendIndex >= 0 ? iendIndex : cleaned.length;
  cleaned.splice(insertAt, 0, { type: 'tEXt', data: charaTextData });
  if (ccv3TextData) {
    cleaned.splice(insertAt + 1, 0, { type: 'tEXt', data: ccv3TextData });
  }

  const parts = [PNG_SIGNATURE];
  for (const chunk of cleaned) {
    parts.push(makePngChunkBytes(chunk.type, chunk.data));
  }
  return concatBytes(parts);
}
