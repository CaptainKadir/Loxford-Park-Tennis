// One-time move of saved data to the current key names (the keys were renamed once; settings, career, story and
// tournament progress must survive it). Runs first, before any module reads its storage. Copies, never deletes.
const OLD = 'openCourt.', NEW = 'loxford.';
try {
  const ls = globalThis.localStorage;
  if (ls) for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(OLD) && ls.getItem(NEW + k.slice(OLD.length)) == null) ls.setItem(NEW + k.slice(OLD.length), ls.getItem(k));
  }
} catch { /* storage unavailable: nothing to move */ }
