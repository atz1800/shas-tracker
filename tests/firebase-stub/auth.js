const cfg = () => { try { return JSON.parse(localStorage.getItem('__stub') || '{}'); } catch(e) { return {}; } };
window.__calls = window.__calls || [];
export const getAuth = () => ({ currentUser: cfg().loggedOut ? null : { uid: 'u1' } });
export class GoogleAuthProvider {}
export const signInWithPopup = async () => {}; export const signInWithRedirect = async () => {};
export const getRedirectResult = async () => null;
export const signOut = async () => { window.__calls.push('signOut'); const c = cfg(); c.loggedOut = true; localStorage.setItem('__stub', JSON.stringify(c)); };
export const deleteUser = async () => { window.__calls.push('deleteUser'); };
export const reauthenticateWithPopup = async () => {};
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(cfg().loggedOut ? null : { uid: 'u1', displayName: 'ישראל ישראלי', email: 'test@example.com', photoURL: null }), 30); return () => {}; };
