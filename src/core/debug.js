import { SCRIPT_NAME } from './constants.js';

const SCRIPT_LOG_PREFIX = `[${SCRIPT_NAME}]`;
const EXTRA_LOG_PREFIXES = ['[Live2DManager]'];
const PLUGIN_STACK_HINTS = ['数据库界面插件.dist.js', 'galgame通用生成器/src/'];

let consolePatched = false;
let globalDebugEnabled = true;
let originalConsole = null;

function isPluginLog(args) {
  if (!Array.isArray(args) || args.length === 0) return false;
  const first = args[0];
  if (typeof first === 'string') {
    if (first.startsWith(SCRIPT_LOG_PREFIX)) return true;
    if (EXTRA_LOG_PREFIXES.some(prefix => first.startsWith(prefix))) return true;
  }
  return isPluginCallsite();
}

function isPluginCallsite() {
  try {
    const stack = new Error().stack;
    if (!stack) return false;
    const stackLines = stack.split('\n').slice(3);
    return stackLines.some(line => PLUGIN_STACK_HINTS.some(hint => line.includes(hint)));
  } catch (e) {
    return false;
  }
}

function shouldSuppress(level, args) {
  if (globalDebugEnabled) return false;
  if (level === 'error') return false;
  return isPluginLog(args);
}

function patchConsole() {
  if (consolePatched) return;
  consolePatched = true;

  originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    debug: (console.debug || console.log).bind(console),
    error: console.error.bind(console),
  };

  const wrap = (level, original) => (...args) => {
    if (shouldSuppress(level, args)) return;
    original(...args);
  };

  console.log = wrap('log', originalConsole.log);
  console.info = wrap('info', originalConsole.info);
  console.warn = wrap('warn', originalConsole.warn);
  console.debug = wrap('debug', originalConsole.debug);
  console.error = wrap('error', originalConsole.error);
}

export function setGlobalDebugEnabled(enabled) {
  patchConsole();
  globalDebugEnabled = !!enabled;
}

export function getGlobalDebugEnabled() {
  return globalDebugEnabled;
}
