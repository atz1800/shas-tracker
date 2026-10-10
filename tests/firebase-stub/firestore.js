const cfg = () => { try { return JSON.parse(localStorage.getItem('__stub') || '{}'); } catch(e) { return {}; } };
const DATA = cfg().data || {};
window.__writes = []; window.__rejected = []; window.__calls = window.__calls || [];
const TS = { __ts: 1 };
// מדמה את כללי האבטחה: שדה גדול (>100) שהופך לריק (<10) נדחה, אלא אם יש אישור מחיקה מכוונת לאותו שדה
const GUARDED = ['shas-learned', 'shas-reviews', 'shas-journal', 'shas-hard'];
export const initializeFirestore = () => ({}); export const persistentLocalCache = () => ({}); export const persistentSingleTabManager = () => ({}); export const persistentMultipleTabManager = () => ({}); export const memoryLocalCache = () => ({});
export const doc = (...a) => a.slice(1).join('/');
export const serverTimestamp = () => TS;
export const setDoc = async (ref, data) => {
  window.__writes.push(data);
  const next = { ...DATA, ...data };
  for (const f of GUARDED) {
    const wipe = typeof DATA[f] === 'string' && DATA[f].length > 100 && typeof next[f] === 'string' && next[f].length < 10;
    const ok = next['shas-wipe'] && next['shas-wipe'].field === f && data['shas-wipe'] && data['shas-wipe'].at === TS;
    if (wipe && !ok) { window.__rejected.push(f); const e = new Error('denied'); e.code = 'permission-denied'; throw e; }
  }
  Object.assign(DATA, data);
};
export const deleteDoc = async () => { window.__calls.push('deleteDoc'); for (const k in DATA) delete DATA[k]; };
export const getDocFromServer = async () => {
  const c = cfg();
  if (c.fail) { const e = new Error('x'); e.code = c.fail; throw e; }
  return { exists: () => Object.keys(DATA).length > 0, data: () => DATA };
};
export const onSnapshot = () => () => {};
export const terminate = async () => { window.__calls.push('terminate'); };
export const clearIndexedDbPersistence = async () => { window.__calls.push('clearIDB'); };
export const waitForPendingWrites = async () => {};
