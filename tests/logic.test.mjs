// בדיקות יחידה ללוגיקה הטהורה שבקובץ המקור index.html (דף יומי, תאריכים, מיזוג סנכרון, מספור עמודים).
// הקוד נלקח ישירות מ-index.html, מקומפל ב-esbuild ורץ ב-vm עם תחליפים מינימליים ל-React/DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { HDate } from '@hebcal/core';
import { DafYomi } from '@hebcal/learning';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];
const { code } = await transform(src, { loader: 'jsx' });
const EXPORTS = ['SHAS', 'TOTAL_AMUDIM', 'TRACTATE_BY_NAME', 'amudList', 'amudCount', 'hasAmud', 'dafYomiList', 'getTodayDafYomi', 'hebrewBirthdayAtAge',
  'migrateKeys', 'mergeInto', 'mergeJournal', 'mergeStreak', 'amudSeq', 'hebNum', 'cleanChapName', 'calcStreak', 'parseLocalDate', 'READER_ENDS_A'];
const ctx = {
  React: { useState: () => [], useEffect() {}, useRef: () => ({}), useMemo: f => f(), createElement() {}, Fragment: 'F', useLayoutEffect() {} },
  ReactDOM: { createRoot: () => ({ render() {} }) },
  document: { getElementById: () => null }, navigator: {}, console, Intl, Date, Math, JSON, Promise, setTimeout, clearTimeout,
};
ctx.window = ctx; ctx.hebcal = { HDate };
vm.createContext(ctx);
vm.runInContext(code + `;globalThis.__x = { ${EXPORTS.join(', ')} };`, ctx);
const X = ctx.__x;

test('total: 2,705 dafim in the Vilna Shas; 17 tractates end on amud aleph', () => {
  const dafim = X.SHAS.flatMap(s => s.tractates).reduce((s, t) => s + t.dafim, 0);
  assert.equal(dafim, 2705);
  assert.equal(X.READER_ENDS_A.length, 17);
  assert.equal(X.TOTAL_AMUDIM, 2705 * 2 - 17);
});
test('amud list: Berakhot ends at 64a, Tamid runs 25a–33b', () => {
  const b = X.amudList(X.TRACTATE_BY_NAME['ברכות']);
  assert.deepEqual([...b.at(-1)], [64, 'א']);
  assert.equal(b.length, X.amudCount(X.TRACTATE_BY_NAME['ברכות']));
  const t = X.amudList(X.TRACTATE_BY_NAME['תמיד']);
  assert.deepEqual([...t[0]], [25, 'א']);
  assert.deepEqual([...t.at(-1)], [33, 'ב']);
});
test('daf yomi matches @hebcal/learning for a full cycle and beyond', () => {
  const list = X.dafYomiList();
  assert.equal(list.length, 2711);
  for (let i = 0; i < 3000; i++) {
    const ref = new DafYomi(new Date(2020, 0, 5 + i));
    assert.equal(list[i % list.length].daf, ref.getBlatt(), 'day ' + i);
  }
});
test('hebrew birthday at age: Adar rules', () => {
  // ז׳ אדר א׳ תשמ״ד (שנה מעוברת) → בשנה פשוטה: אדר
  assert.equal(X.hebrewBirthdayAtAge(new Date(1984, 1, 10), 50).hebrew, 'ז׳ אדר תשצ״ד');
  // י״ב אדר תשמ״ה (פשוטה) → בשנה מעוברת: אדר ב׳
  assert.equal(X.hebrewBirthdayAtAge(new Date(1985, 2, 5), 50).hebrew, 'י״ב אדר ב׳ תשצ״ה');
});
test('migrateKeys moves old Tamid 2–10 keys to 25–33', () => {
  const out = X.migrateKeys({ 'תמיד||2||א': true, 'תמיד||10||ב': 3, 'ברכות||2||א': true });
  assert.deepEqual(Object.keys(out).sort(), ['ברכות||2||א', 'תמיד||25||א', 'תמיד||33||ב'].sort());
  assert.equal(out['תמיד||33||ב'], 3);
});
test('mergeInto: union, higher review count wins, skipped (locally deleted) keys stay deleted', () => {
  assert.equal(X.mergeInto({ a: true }, { a: true }), null);
  assert.deepEqual({ ...X.mergeInto({ a: true }, { a: true, b: true }) }, { a: true, b: true });
  assert.deepEqual({ ...X.mergeInto({ a: 2 }, { a: 5 }) }, { a: 5 });
  assert.equal(X.mergeInto({ a: true }, { a: true, b: true }, new Set(['b'])), null);
});
test('mergeJournal: adds entries by id, keeps local edits and deletions', () => {
  const local = [{ id: 3, text: 'local edit' }, { id: 1, text: 'one' }];
  const server = [{ id: 3, text: 'server' }, { id: 2, text: 'two' }, { id: 1, text: 'one' }];
  assert.deepEqual([...X.mergeJournal(local, server).map(e => e.id)], [3, 2, 1]);
  assert.equal(X.mergeJournal(local, server)[0].text, 'local edit');
  assert.equal(X.mergeJournal(local, server, new Set([2])), null);
});
test('mergeStreak: later date wins, same day — higher count', () => {
  assert.equal(X.mergeStreak({ date: '2026-10-10', count: 3 }, { date: '2026-10-09', count: 9 }), null);
  assert.deepEqual({ ...X.mergeStreak({ date: '2026-10-09', count: 3 }, { date: '2026-10-10', count: 1 }) }, { date: '2026-10-10', count: 1 });
  assert.deepEqual({ ...X.mergeStreak({ date: '2026-10-10', count: 3 }, { date: '2026-10-10', count: 4 }) }, { date: '2026-10-10', count: 4 });
});
test('amudSeq / hebNum / cleanChapName', () => {
  assert.deepEqual([...X.amudSeq('21b', '23a')], ['21b', '22a', '22b', '23a']);
  assert.equal(X.hebNum(15), 'ט״ו');
  assert.equal(X.hebNum(2), 'ב׳');
  assert.equal(X.cleanChapName('פרק ראשון - מאימתי'), 'מאימתי');
  assert.equal(X.cleanChapName('פרק ב׳ היה קורא'), 'היה קורא');
});
