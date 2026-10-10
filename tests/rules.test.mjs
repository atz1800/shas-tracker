// בדיקות לכללי האבטחה של Firestore. מריצים מול האמולטור: npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
const BIG = JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['ברכות||' + (i + 2) + '||א', true])));
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-shas-tracker', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'users/alice'), { 'shas-learned': BIG, 'shas-journal': JSON.stringify([{ id: 1, text: 'x'.repeat(200) }]), 'shas-notes': '{"old":1}' }));
});
const alice = () => env.authenticatedContext('alice').firestore();
const ref = db => doc(db, 'users/alice');

test('owner reads, others and anonymous cannot', async () => {
  await assertSucceeds(getDoc(ref(alice())));
  await assertFails(getDoc(ref(env.authenticatedContext('bob').firestore())));
  await assertFails(getDoc(ref(env.unauthenticatedContext().firestore())));
});
test('other user cannot write', async () => {
  await assertFails(setDoc(ref(env.authenticatedContext('bob').firestore()), { 'shas-learned': '{}' }, { merge: true }));
});
test('normal update allowed', async () => {
  await assertSucceeds(setDoc(ref(alice()), { 'shas-learned': BIG.replace('}', ',"שבת||2||א":true}') }, { merge: true }));
});
test('accidental wipe of big field is blocked', async () => {
  await assertFails(setDoc(ref(alice()), { 'shas-learned': '{}' }, { merge: true }));
  await assertFails(setDoc(ref(alice()), { 'shas-journal': '[]' }, { merge: true }));
});
test('intended wipe (with token for the same field) is allowed', async () => {
  await assertSucceeds(setDoc(ref(alice()), { 'shas-journal': '[]', 'shas-wipe': { field: 'shas-journal', at: serverTimestamp() } }, { merge: true }));
  await assertSucceeds(setDoc(ref(alice()), { 'shas-learned': '{}', 'shas-wipe': { field: 'shas-learned', at: serverTimestamp() } }, { merge: true }));
});
test('wipe token for another field, or a stale token, does not allow a wipe', async () => {
  await assertFails(setDoc(ref(alice()), { 'shas-learned': '{}', 'shas-wipe': { field: 'shas-journal', at: serverTimestamp() } }, { merge: true }));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'users/alice'), { 'shas-wipe': { field: 'shas-learned', at: new Date(2020, 0, 1) } }, { merge: true }));
  await assertFails(setDoc(ref(alice()), { 'shas-learned': '{}' }, { merge: true }));
});
test('unknown fields and wrong types are rejected; old fields may stay', async () => {
  await assertFails(setDoc(ref(alice()), { 'is-admin': true }, { merge: true }));
  await assertFails(setDoc(ref(alice()), { 'shas-learned': { a: 1 } }, { merge: true }));
  await assertFails(setDoc(ref(alice()), { 'shas-streak': 'x'.repeat(300) }, { merge: true }));
  await assertSucceeds(setDoc(ref(alice()), { 'shas-streak': '{"date":"2026-10-10","count":3}' }, { merge: true })); // shas-notes הישן נשאר במסמך
});
test('new user can create own doc with known fields only', async () => {
  const bob = env.authenticatedContext('bob').firestore();
  await assertFails(setDoc(doc(bob, 'users/bob'), { 'shas-learned': '{}', 'x': 1 }));
  await assertSucceeds(setDoc(doc(bob, 'users/bob'), { 'shas-streak': '{"date":"2026-10-10","count":1}' }, { merge: true }));
});
test('owner can delete account doc, others cannot', async () => {
  await assertFails(deleteDoc(ref(env.authenticatedContext('bob').firestore())));
  await assertSucceeds(deleteDoc(ref(alice())));
});
