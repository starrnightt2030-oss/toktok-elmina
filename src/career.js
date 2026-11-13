// Career layer (Phase 6): missions list, reputation levels and garage customisations.
// Pure data + small helpers; main.js wires them into the existing fare / change / save systems.
// Save fields (all optional, unknown keys are kept by the save migration, saveVersion stays 1):
//   save.missions = { <id>: 1 }        missions finished
//   save.rep      = { xp: <number> }   reputation points
//   save.mods     = { rims, lights, seats }   fitted customisation option ids
//   save.modsOwned = [ '<item>:<option>' ]   bought options

export const REP_LEVELS = [
  { xp: 0, n: 'اسطى جديد' },
  { xp: 60, n: 'اسطى' },
  { xp: 160, n: 'اسطى شاطر' },
  { xp: 320, n: 'معلم' },
  { xp: 540, n: 'معلم كبير' },
  { xp: 850, n: 'أسطورة المينا' },
];
export function repLevel(xp) { let l = 0; REP_LEVELS.forEach((r, i) => { if (xp >= r.xp) l = i; }); return l; }
export function repProgress(xp) {
  const l = repLevel(xp), cur = REP_LEVELS[l], next = REP_LEVELS[l + 1];
  return { level: l, name: cur.n, next: next ? next.n : null, into: xp - cur.xp, need: next ? next.xp - cur.xp : 0, frac: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}
/** points for one finished ride: rating 1–5, exact change, no money lost, no hits, mission success */
export function rideXP({ rating, short, lost, hits, mission, failed }) {
  let x = Math.round(rating * 3) + (short ? 0 : 3) + (lost ? 0 : 2) + (hits ? 0 : 3) - Math.min(4, hits || 0);
  if (mission && !failed) x += 15;
  return Math.max(1, x);
}
export const LEVEL_REWARD = l => l * 25;   // money given on reaching level l

/* --- missions: each one is a normal ride on the fare + change system with a fixed rider, start and destination ---
   from/to are POI keys; to:'@wgarage' resolves to the Wardian workshop at runtime. urgent = timed (fail when late). */
export const MISSIONS = [
  { id: 'wardian', n: 'مشوار الورديان', from: 'fish', to: 'wplaza', bonus: 20, lvl: 0,
    d: 'الحاجة أم سمير مستنياك عند سوق السمك، وديها ساحة الورديان.',
    intro: 'يا اسطى، وديني {d} الله يخليك، بنتي ساكنة هناك',
    pax: { names: ['الحاجة أم سمير'], female: true, title: 'يا حاجة', pitch: 1.15, rate: .95, look: { shirt: '#3b2a4a', pants: '#3b2a4a', skin: '#c69472', hijab: '#1f1f2a', galabeya: true }, likes: [], ride: ['بنتي ساكنة في الورديان، رايحة أزورها', 'الورديان حتة جميلة يا اسطى، بس خلي بالك من المطبات'] } },
  { id: 'qabbari', n: 'مشوار القباري', from: 'wplaza', to: 'qstop', bonus: 20, lvl: 0,
    d: 'الحاج عبده واقف في ساحة الورديان، عايز يروح موقف القباري عشان يلحق الميكروباص.',
    intro: 'يا اسطى، وصّلني {d}، عايز ألحق ميكروباص محطة مصر',
    pax: { names: ['الحاج عبده'], title: 'يا حاج', pitch: .85, rate: .95, look: { shirt: '#e9e2d0', pants: '#e9e2d0', skin: '#8a5a3b', galabeya: true }, likes: [], ride: ['القباري دي حتتي من زمان يا اسطى، اتولدت هنا', 'زمان كان فيه قطر بيعدي من هنا، دلوقتي كله عربيات'] } },
  { id: 'delivery', n: 'توصيل طلبية', from: 'market', to: '@wgarage', bonus: 20, lvl: 0,
    d: 'صبي المحل مستنيك عند سوق الخضار بطلبية قطع غيار، وصّله لورشة أبو حمادة في الورديان.',
    intro: 'يا اسطى، معايا طلبية لـ {d}، وصّلني بيها بالراحة عشان فيها حاجات بتتكسر',
    pax: { names: ['حمادة صبي المحل'], title: 'يا حمادة', pitch: 1.2, rate: 1.1, look: { shirt: '#c9302a', pants: '#2a3550', skin: '#9c6b48', cap: '#1d4f86' }, likes: [], ride: ['المعلم قالي لو الطلبية وصلت سليمة هياخدني معاه الورشة', 'براحة على المطب يا اسطى، الكرتونة دي فيها لمبات'] } },
  { id: 'worker', n: 'عامل الميناء', from: 'micro', to: 'gate1', bonus: 15, lvl: 0,
    d: 'عم سيد عامل في الميناء ونازل من الميكروباص، وصّله لحد بوابة ١ قبل ما ورديته تبدأ.',
    intro: 'وصّلني {d} يا اسطى، الوردية بتاعتي قربت',
    pax: { names: ['عم سيد'], title: 'يا عم سيد', pitch: .8, rate: 1.05, look: { shirt: '#2f5f8c', pants: '#24303f', skin: '#8a5a3b', cap: '#f2c218' }, likes: [], ride: ['الشغل في الميناء النهارده كتير، فيه مركب كبيرة داخلة', 'إحنا الوردية بتاعتنا بتبدأ بدري، والتأخير ممنوع'] } },
  { id: 'urgent', n: 'مشوار مستعجل', from: 'clinic', to: 'gate50', bonus: 30, lvl: 2, urgent: true,
    d: 'راكب مستعجل عند المستوصف لازم يلحق بوابة ٥٠ قبل ما الوقت يخلص. لو اتأخرت المهمة بتفشل وتقدر تعيدها.',
    intro: 'الحقني يا اسطى! لازم أكون عند {d} في أسرع وقت',
    pax: { names: ['الأستاذ شريف'], title: 'يا أستاذ', pitch: 1.05, rate: 1.25, look: { shirt: '#f2f2f2', pants: '#2a2a2a', skin: '#c69472' }, likes: [], ride: ['بسرعة يا اسطى الله يخليك، الميعاد مش هيستنى', 'لو وصلت في الميعاد هزوّدك'] } },
];

/* --- garage customisations: bought once, previewed before buying, saved, visual only --- */
export const MODS = [
  { id: 'rims', n: 'الجنوط', lvl: 1, opts: [
    { id: 'stock', n: 'الأصلية', p: 0, c: null },
    { id: 'chrome', n: 'كروم لامع', p: 120, c: '#e9eef2', metal: 1, rough: .18 },
    { id: 'gold', n: 'دهبي', p: 180, c: '#d9a63c', metal: 1, rough: .25 },
    { id: 'red', n: 'أحمر سبور', p: 150, c: '#c62828', metal: .3, rough: .35 } ] },
  { id: 'lights', n: 'أنوار إضافية', lvl: 0, opts: [
    { id: 'none', n: 'من غير', p: 0 },
    { id: 'blue', n: 'نيون أزرق تحت الشاسيه', p: 100, c: '#2f8bff' },
    { id: 'green', n: 'نيون أخضر تحت الشاسيه', p: 100, c: '#36e07a' },
    { id: 'gold', n: 'لمبات سقف دهبي', p: 140, c: '#ffc44a', roof: true } ] },
  { id: 'seats', n: 'الفرش الداخلي', lvl: 0, opts: [
    { id: 'stock', n: 'الأصلي', p: 0, c: null },
    { id: 'red', n: 'جلد أحمر', p: 90, c: '#9e1b1b' },
    { id: 'leopard', n: 'قطيفة نمر', p: 130, c: '#c8902e', pattern: 'leopard' },
    { id: 'blue', n: 'قطيفة زرقا', p: 110, c: '#1f3f7a', pattern: 'velvet' } ] },
];
export function modOpt(item, id) { const m = MODS.find(x => x.id === item); return m && (m.opts.find(o => o.id === id) || m.opts[0]); }
