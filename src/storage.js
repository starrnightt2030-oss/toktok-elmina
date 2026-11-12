// Save data and settings storage.
//
// - Every key goes through `ls` so the Beta build (VITE_CHANNEL=beta) uses its own keys
//   ("beta_" prefix) and can never overwrite the main game's save.
// - The save carries `saveVersion`. Old saves (no version) are migrated with a backup copy written
//   first; the migrated save is only written back after it has been verified field by field.
//   If anything looks wrong the game keeps playing from memory and leaves the stored save alone.

export const CHANNEL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CHANNEL) || 'main';
export const IS_BETA = CHANNEL === 'beta';
export const NS = IS_BETA ? 'beta_' : '';
export const SAVE_KEY = 'aps_tuk_v2';
export const SAVE_VERSION = 1;

export function makeStore(backend, ns = NS) {
  return {
    ns,
    get(k) { try { return backend.getItem(ns + k); } catch (e) { return null; } },
    set(k, v) { try { backend.setItem(ns + k, v); return true; } catch (e) { return false; } },
    del(k) { try { backend.removeItem(ns + k); return true; } catch (e) { return false; } },
    raw(k) { try { return backend.getItem(k); } catch (e) { return null; } },   // un-prefixed read (Beta import)
  };
}
export const ls = makeStore(typeof localStorage !== 'undefined' ? localStorage : { getItem() { return null; }, setItem() { throw new Error('no storage'); }, removeItem() {} });

export const SAVE_DEFAULTS = Object.freeze({ wallet: 60, total: 0, trips: 0, owned: ['yellow', 'orange', 'red'], paint: 'yellow', slogan: 'ماشي بدعا الوالدين', vehicle: 'tuk' });
const FIELDS = {
  wallet: v => typeof v === 'number' && isFinite(v) && v >= 0,
  total: v => typeof v === 'number' && isFinite(v) && v >= 0,
  trips: v => Number.isInteger(v) && v >= 0,
  owned: v => Array.isArray(v) && v.every(x => typeof x === 'string'),
  paint: v => typeof v === 'string' && v.length > 0,
  slogan: v => typeof v === 'string',
  vehicle: v => v === 'tuk' || v === 'van',
};

/** Pure: turn any parsed save object into a version-1 save. Unknown keys are kept. */
export function migrate(data) {
  const out = Object.assign({}, data);
  const fixed = [];
  for (const [k, ok] of Object.entries(FIELDS)) {
    if (!(k in out)) { out[k] = Array.isArray(SAVE_DEFAULTS[k]) ? SAVE_DEFAULTS[k].slice() : SAVE_DEFAULTS[k]; continue; }
    if (!ok(out[k])) { fixed.push(k); out[k] = Array.isArray(SAVE_DEFAULTS[k]) ? SAVE_DEFAULTS[k].slice() : SAVE_DEFAULTS[k]; }
  }
  if (!out.owned.includes(out.paint)) out.owned = out.owned.concat([out.paint]);
  out.saveVersion = SAVE_VERSION;
  return { save: out, fixed };
}

/** Every valid field of the original must survive the migration unchanged. */
export function verify(original, migrated) {
  for (const [k, ok] of Object.entries(FIELDS)) {
    if (k in original && ok(original[k]) && JSON.stringify(original[k]) !== JSON.stringify(migrated[k])) {
      if (k === 'owned' && original.owned.every(x => migrated.owned.includes(x))) continue;
      return false;
    }
  }
  const round = JSON.parse(JSON.stringify(migrated));
  return JSON.stringify(round) === JSON.stringify(migrated) && round.saveVersion === SAVE_VERSION;
}

/**
 * Load the save. Returns { save, status, writable, notes }.
 * status: 'new' | 'current' | 'migrated' | 'migrated-unsaved' | 'corrupt' | 'future'
 * writable=false means persist() must not touch the stored save this session.
 */
export function loadSave(store = ls) {
  const notes = [];
  const raw = store.get(SAVE_KEY);
  if (raw == null) return { save: migrate({}).save, status: 'new', writable: true, notes };
  let data;
  try { data = JSON.parse(raw); } catch (e) { data = null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    // keep the unreadable save untouched; play from defaults without overwriting it
    store.set(SAVE_KEY + '_unreadable_backup', raw);
    notes.push('الحفظ مش مقروء، اتعمل منه نسخة واللعبة شغالة من غير ما تكتب فوقه');
    return { save: migrate({}).save, status: 'corrupt', writable: false, notes };
  }
  if (typeof data.saveVersion === 'number' && data.saveVersion > SAVE_VERSION) {
    notes.push('الحفظ من نسخة أحدث، مش هيتعدل');
    return { save: migrate(data).save, status: 'future', writable: false, notes };
  }
  if (data.saveVersion === SAVE_VERSION) {
    const { save, fixed } = migrate(data);
    if (fixed.length) notes.push('اتصلحت قيم: ' + fixed.join('، '));
    return { save, status: 'current', writable: true, notes };
  }
  // version 0 → 1: backup first, migrate, verify, then write
  const bk = SAVE_KEY + '_backup_v0';
  const hadBackup = store.get(bk) != null;
  const backupOk = hadBackup || store.set(bk, raw);
  const { save, fixed } = migrate(data);
  if (fixed.length) notes.push('قيم مش سليمة رجعت للافتراضي: ' + fixed.join('، '));
  const ok = backupOk && verify(data, save) && store.get(bk) === (hadBackup ? store.get(bk) : raw);
  if (!ok) { notes.push('الترحيل ما اتأكدش، الحفظ القديم فضل زي ما هو'); return { save, status: 'migrated-unsaved', writable: false, notes }; }
  if (!store.set(SAVE_KEY, JSON.stringify(save))) return { save, status: 'migrated-unsaved', writable: false, notes };
  const back = JSON.parse(store.get(SAVE_KEY));
  if (!verify(data, back)) { store.set(SAVE_KEY, raw); notes.push('القراءة بعد الكتابة فشلت، رجعنا الحفظ القديم'); return { save, status: 'migrated-unsaved', writable: false, notes }; }
  return { save, status: 'migrated', writable: true, notes };
}

/** Beta only: copy the main game's save into the Beta save without touching the original. */
export function importMainSave(store = ls) {
  const raw = store.raw(SAVE_KEY);   // the main game's un-prefixed key, read only
  if (raw == null) return { ok: false, why: 'مفيش حفظ في النسخة الأساسية على الجهاز ده' };
  let data; try { data = JSON.parse(raw); } catch (e) { return { ok: false, why: 'حفظ النسخة الأساسية مش مقروء' }; }
  const { save } = migrate(data);
  if (!verify(data, save)) return { ok: false, why: 'النسخة المستوردة ما اتطابقتش مع الأصل' };
  const prev = store.get(SAVE_KEY);
  if (prev != null) store.set(SAVE_KEY + '_before_import', prev);
  if (!store.set(SAVE_KEY, JSON.stringify(save))) return { ok: false, why: 'مساحة التخزين مش متاحة' };
  return { ok: true, save };
}
