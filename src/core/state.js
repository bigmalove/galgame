// ============================================
// 全局可变状态 (getter/setter 模式)
// esbuild IIFE 中 export let 的 live binding 不可靠
// ============================================

// --- 来自 L5810-5817 ---
let _db = null;
let _lastGalgameOptionHash = null;
let _galgameChoicesVisible = false;
let _pendingOptions = null;

// --- 来自 L8017-8027 ---
let _isEnabled = false;
let _hideOtherFloors = false;
let _isSkipping = false;
let _skipTimer = null;
let _isRewinding = false;
let _rewindTimer = null;
let _rewindHoldTimer = null;
let _isLoadingSave = false;
export const REWIND_HOLD_DELAY = 3000;

// db
export function getDb() { return _db; }
export function setDb(v) { _db = v; }

// isEnabled
export function getIsEnabled() { return _isEnabled; }
export function setIsEnabled(v) { _isEnabled = v; }

// hideOtherFloors
export function getHideOtherFloors() { return _hideOtherFloors; }
export function setHideOtherFloors(v) { _hideOtherFloors = v; }

// isSkipping
export function getIsSkipping() { return _isSkipping; }
export function setIsSkipping(v) { _isSkipping = v; }

// skipTimer
export function getSkipTimer() { return _skipTimer; }
export function setSkipTimer(v) { _skipTimer = v; }

// isRewinding
export function getIsRewinding() { return _isRewinding; }
export function setIsRewinding(v) { _isRewinding = v; }

// rewindTimer
export function getRewindTimer() { return _rewindTimer; }
export function setRewindTimer(v) { _rewindTimer = v; }

// rewindHoldTimer
export function getRewindHoldTimer() { return _rewindHoldTimer; }
export function setRewindHoldTimer(v) { _rewindHoldTimer = v; }

// isLoadingSave
export function getIsLoadingSave() { return _isLoadingSave; }
export function setIsLoadingSave(v) { _isLoadingSave = !!v; }

// choices 相关状态
export function getLastGalgameOptionHash() { return _lastGalgameOptionHash; }
export function setLastGalgameOptionHash(v) { _lastGalgameOptionHash = v; }

export function getGalgameChoicesVisible() { return _galgameChoicesVisible; }
export function setGalgameChoicesVisible(v) { _galgameChoicesVisible = v; }

export function getPendingOptions() { return _pendingOptions; }
export function setPendingOptions(v) { _pendingOptions = v; }
