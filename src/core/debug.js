import { SCRIPT_NAME } from './constants.js';
import { topWindow } from './env.js';

const SCRIPT_LOG_PREFIX = `[${SCRIPT_NAME}]`;
const EXTRA_LOG_PREFIXES = ['[Live2DManager]'];
const PLUGIN_STACK_HINTS = ['数据库界面插件.dist.js', 'galgame通用生成器/src/'];

let globalDebugEnabled = true;
const patchedConsoles = new WeakSet();

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

function getConsoleTargets() {
  const targets = [];
  if (typeof console !== 'undefined') targets.push(console);
  if (typeof window !== 'undefined' && window?.console) targets.push(window.console);
  if (topWindow?.console) targets.push(topWindow.console);
  return Array.from(new Set(targets));
}

function patchSingleConsole(targetConsole) {
  if (!targetConsole || patchedConsoles.has(targetConsole)) return;
  patchedConsoles.add(targetConsole);

  const original = {
    log: targetConsole.log?.bind(targetConsole),
    info: targetConsole.info?.bind(targetConsole),
    warn: targetConsole.warn?.bind(targetConsole),
    debug: (targetConsole.debug || targetConsole.log)?.bind(targetConsole),
    error: targetConsole.error?.bind(targetConsole),
  };

  const wrap = (level, raw) => (...args) => {
    if (typeof raw !== 'function') return;
    if (shouldSuppress(level, args)) return;
    raw(...args);
  };

  targetConsole.log = wrap('log', original.log);
  targetConsole.info = wrap('info', original.info);
  targetConsole.warn = wrap('warn', original.warn);
  targetConsole.debug = wrap('debug', original.debug);
  targetConsole.error = wrap('error', original.error);
}

function patchConsole() {
  const targets = getConsoleTargets();
  for (const targetConsole of targets) {
    patchSingleConsole(targetConsole);
  }
}

export function setGlobalDebugEnabled(enabled) {
  patchConsole();
  globalDebugEnabled = !!enabled;
}

export function getGlobalDebugEnabled() {
  return globalDebugEnabled;
}
