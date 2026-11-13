// Alexandria Shipyard training centre («مركز تدريب شركة ترسانة الإسكندرية»), built from the site plan the user supplied.
// Phase 7: approved as the game's training centre; the map was widened so it stands at near-real size (0.11 m per plan pixel,
// about 92% of the plan's 0–20 m scale bar) instead of being squeezed into one city block.
//
// The plan is drawn north-up, main entrance and exit gate on its south side (الشارع العام), شارع ترسانة الإسكندرية on its west.
// In the game the compound stands south of the port avenue across from the shipyard gate: the plan is turned 180° so both gates
// face the avenue and the exit gate lines up with the shipyard gate (x = 170). The plan's west street is the city street at x = 286.
//
// You can drive in through either gate and around the whole compound: the entrance plaza, the lane between the admin building and
// the workshop block, the students' corridor that runs through the workshop block (two workshops open onto it and you can drive
// into them), the road from the exit gate past the welding shops, the path along the tree belt to the back yard, and the
// promenade along the classrooms.

const S_PX = 0.11;                                  // metres per plan pixel
const PX = { x0: 60, x1: 1110, y0: 100, y1: 985 };  // compound wall in plan pixels
const X1 = 170 + (1030 - PX.x0) * S_PX;             // exit gate (plan x 1030) on the shipyard gate axis
export const TC = {
  X0: +(X1 - (PX.x1 - PX.x0) * S_PX).toFixed(2), X1: +X1.toFixed(2),
  Z0: 15.5, Z1: +(15.5 + (PX.y1 - PX.y0) * S_PX).toFixed(2),
};
const wx = px => TC.X1 - (px - PX.x0) * S_PX;       // plan → world (180° turn)
const wz = py => TC.Z0 + (PX.y1 - py) * S_PX;
const r1 = v => Math.round(v * 10) / 10;
TC.gateMain = r1(wx(342.5));
TC.gateExit = r1(wx(1030));
TC.wx = wx; TC.wz = wz;

// inner roads (world): used by GPS, the minimap and the reset-to-road points
const ZP = r1(wz(930)), ZC = r1(wz(600)), ZT = r1(wz(520)), XG = r1(wx(495)), XL = r1(wx(158)), XD = r1(wx(800)), XE = r1(wx(955)), ZE = r1(wz(940));
TC.graph = edge => {
  const gm = TC.gateMain, ge = TC.gateExit;
  edge([gm, 0], [gm, ZP], 'tc'); edge([gm, ZP], [XG, ZP], 'tc'); edge([gm, ZP], [XL, ZP], 'tc'); edge([XL, ZP], [XL, r1(wz(170))], 'tc');
  edge([XG, ZP], [XG, ZC], 'tc'); edge([XG, ZC], [XG, ZT], 'tc');
  edge([XG, ZC], [XE, ZC], 'tc');                                        // students' corridor through the workshop block
  edge([XG, ZT], [XD, ZT], 'tc'); edge([XD, ZT], [XE, ZT], 'tc');
  // exit road: in at the exit gate, then north between the welding shops and the workshop block
  edge([ge, 0], [ge, TC.Z0], 'tc'); edge([ge, TC.Z0], [XE, ZE], 'tc'); edge([XE, ZE], [XE, ZC], 'tc'); edge([XE, ZC], [XE, ZT], 'tc');
  edge([XD, ZT], [r1(wx(600)), r1(wz(175))], 'tc'); edge([r1(wx(600)), r1(wz(175))], [r1(wx(370)), r1(wz(175))], 'tc');   // tree belt → back yard
};
TC.POI = {
  tcmain: { n: 'مركز تدريب الترسانة — المدخل', x: TC.gateMain, z: 6.5, sx: 0, sz: 5.5, area: 'campus' },
  tcexit: { n: 'بوابة خروج مركز التدريب', x: TC.gateExit - 8, z: 6.5, sx: 0, sz: 5.5, area: 'campus' },
  tcadm: { n: 'مبنى الإدارة والفصول النظرية', x: r1(wx(338)), z: ZP, sx: 0, sz: 4.4, area: 'campus' },
  tcweld: { n: 'ورش اللحام — مركز التدريب', x: XE, z: r1(wz(700)), sx: -3.6, sz: 0, area: 'campus' },
  tcback: { n: 'صالة الترقية — مركز التدريب', x: r1(wx(420)), z: r1(wz(175)), sx: 0, sz: -3.6, area: 'campus' },
};

export function buildTraining(ctx) {
  const { T, scene, S, Merger, NI, col, ctex, rep, texPave, texConc, GAMEF, plainSign, person, palmsList, lampsList, flag } = ctx;
  const out = { meshes: [], buildings: [], walks: [], rooms: [] };
  const rect = (x0, x1, y0, y1) => { const a = wx(x0), b = wx(x1), c = wz(y0), d = wz(y1); return [Math.min(a, b), Math.max(a, b), Math.min(c, d), Math.max(c, d)]; };
  const pbox = (r, y0, y1, color, h) => { const [x0, x1, z0, z1] = rect(...r); S.box(x0, x1, y0, y1, z0, z1, color); if (h) col(x0, x1, z0, z1, h); return [x0, x1, z0, z1]; };

  // ---------------------------------------------------------------- textures
  const noise = (g, w, h, n, cols, s) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, s, s); } };
  const facInst = ctex(512, 256, (g, w, h) => {   // classrooms / admin: cream render, window bands with blue glass, floor lines
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h); noise(g, w, h, 2500, ['rgba(90,70,45,.05)', 'rgba(255,255,255,.06)'], 3);
    for (let c = 0; c < 4; c++) { const x = c * 128 + 18; g.fillStyle = '#c9b48d'; g.fillRect(x - 6, 58, 104, 140); const gr = g.createLinearGradient(0, 64, 0, 192); gr.addColorStop(0, '#8fb3d2'); gr.addColorStop(1, '#2f5272'); g.fillStyle = gr; g.fillRect(x, 64, 92, 128);
      g.fillStyle = '#e8eef3'; g.fillRect(x + 44, 64, 4, 128); g.fillRect(x, 126, 92, 4); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 6, 68, 30, 120); g.fillStyle = '#d8ccb2'; g.fillRect(x - 8, 194, 108, 8); }
    g.fillStyle = '#20334D'; g.fillRect(0, 238, w, 18); g.fillStyle = '#C87938'; g.fillRect(0, 234, w, 4);
  });
  const facShop = ctex(512, 256, (g, w, h) => {   // workshops: ribbed cladding over a block plinth, high windows, roller door
    g.fillStyle = '#b9c1c8'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { g.fillStyle = x % 20 ? '#a9b2ba' : '#c8cfd5'; g.fillRect(x, 0, 6, 170); }
    g.fillStyle = '#8f8a80'; g.fillRect(0, 170, w, 86); for (let y = 170; y < h; y += 16) for (let x = (y / 16 % 2) * 20; x < w; x += 40) { g.strokeStyle = 'rgba(0,0,0,.18)'; g.strokeRect(x, y, 40, 16); }
    for (let c = 0; c < 6; c++) { g.fillStyle = '#2f4a62'; g.fillRect(c * 86 + 10, 26, 64, 30); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(c * 86 + 12, 28, 20, 26); }
    g.fillStyle = '#6f7880'; g.fillRect(190, 96, 132, 160); for (let y = 100; y < 256; y += 8) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(190, y, 132, 2); }
    g.fillStyle = '#F5B928'; g.fillRect(186, 92, 140, 6); g.fillStyle = '#1a1a1a'; for (let x = 190; x < 322; x += 22) g.fillRect(x, 248, 11, 8);
  });
  const facStore = ctex(512, 256, (g, w, h) => {  // services / stores: white two-storey, small windows
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); noise(g, w, h, 1200, ['rgba(0,0,0,.04)'], 3); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 124, w, 6);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) { g.fillStyle = '#c7d3dd'; g.fillRect(c * 64 + 16, r * 128 + 34, 34, 40); g.fillStyle = '#2f4a62'; g.fillRect(c * 64 + 19, r * 128 + 37, 28, 34); }
  });
  const facIn = ctex(512, 256, (g, w, h) => {     // inside the workshops / corridor: cream wall over a tiled dado, notice boards
    g.fillStyle = '#ece4d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#dfe8ee'; g.fillRect(0, 150, w, 106);
    for (let y = 150; y < h; y += 18) for (let x = 0; x < w; x += 26) { g.strokeStyle = 'rgba(80,100,120,.25)'; g.strokeRect(x, y, 26, 18); }
    g.fillStyle = '#2f6b8a'; g.fillRect(0, 146, w, 5);
    [[40, 'تعليمات الأمان'], [300, 'جدول الورش']].forEach(([x, t]) => { g.fillStyle = '#7a5a36'; g.fillRect(x, 40, 150, 90); g.fillStyle = '#f6f1e3'; g.fillRect(x + 6, 46, 138, 78); g.fillStyle = '#1d3f5f'; g.font = 'bold 20px ' + GAMEF; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText(t, x + 75, 70);
      g.fillStyle = 'rgba(30,40,60,.35)'; for (let i = 0; i < 4; i++) g.fillRect(x + 18, 82 + i * 9, 114 - i * 14, 4); });
    g.fillStyle = '#c62828'; g.fillRect(232, 70, 30, 44); g.fillStyle = '#fff'; g.fillRect(236, 74, 22, 8);
  });
  [facInst, facShop, facStore, facIn].forEach(t => { t.wrapS = t.wrapT = T.RepeatWrapping; });

  // names atlas: one canvas, one material for every name on the buildings
  const NAMES = ['ورشة الخراطة', 'ورشة الحدادة', 'ورشة الآلات', 'ورشة التجهيزات', 'ورشة الكهرباء', 'ورشة بدن السفينة', 'ورشة المعادن', 'ورشة النجارة',
    'ورشة اللحام', 'ورشة المواسير', 'ورشة التركيبات', 'صالة متعددة الأغراض', 'ورشة الإلكترونيات والكمبيوتر', 'ورشة النقش', 'البوفية', 'مخازن',
    'مبنى الإدارة والفصول النظرية', 'صالة ترقية', 'ورشة تصنيع الآلات', 'دورة مياه الطلبة', 'ممر دخول وخروج الطلبة', 'مكتب', 'مخزن', 'الفصول النظرية', 'ورشة لحام', 'دورة مياه'];
  const NW = 512, NH = 96, NC = 2, NR = Math.ceil(NAMES.length / NC);
  const names = ctex(NW * NC, NH * NR, g => { NAMES.forEach((n, i) => { const x = (i % NC) * NW, y = Math.floor(i / NC) * NH; g.fillStyle = '#0f4a3a'; g.fillRect(x + 4, y + 6, NW - 8, NH - 12); g.strokeStyle = '#e8c35a'; g.lineWidth = 4; g.strokeRect(x + 8, y + 10, NW - 16, NH - 20);
    g.fillStyle = '#f4f1e6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; let fs = 46; g.font = fs + 'px ' + GAMEF; while (g.measureText(n).width > NW - 40 && fs > 20) { fs -= 2; g.font = fs + 'px ' + GAMEF; } g.fillText(n, x + NW / 2, y + NH / 2 + 2); }); });
  names.wrapS = names.wrapT = T.ClampToEdgeWrapping;
  const nameUV = n => { const i = NAMES.indexOf(n), c = i % NC, r = Math.floor(i / NC); return { us: 1 / NC, vs: 1 / NR, uo: c / NC, vo: 1 - (r + 1) / NR }; };

  const fInst = new Merger(), fShop = new Merger(), fStore = new Merger(), fIn = new Merger(), signs = new Merger(), ground = new Merger(), pave = new Merger(), grass = new Merger(), lights = new Merger();
  const FAC = { inst: [fInst, 7.5, 6], shop: [fShop, 12, 8], store: [fStore, 14, 7] };
  const flat = (M, x0, x1, z0, z1, y, tile, color) => { const m = new T.Matrix4().compose(new T.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)), new T.Vector3(x1 - x0, z1 - z0, 1)); M.add(NI.plane, m, color || '#ffffff', (x1 - x0) / tile, (z1 - z0) / tile, 0, 0); };
  const sign = (n, x, z, ry, y, w) => { const uv = nameUV(n); signs.wall(x, z, w, y, w * NH / NW, ry, '#ffffff', uv.us, uv.vs, uv.uo, uv.vo); };
  // faces of a box: [centre x, centre z, length, ry] — each looks outward
  const faces = (x0, x1, z0, z1) => [[(x0 + x1) / 2, z1, x1 - x0, 0], [(x0 + x1) / 2, z0, x1 - x0, Math.PI], [x0, (z0 + z1) / 2, z1 - z0, -Math.PI / 2], [x1, (z0 + z1) / 2, z1 - z0, Math.PI / 2]];

  // ---------------------------------------------------------------- ground: concrete inside, paved roads and plaza, lawns along the wall
  flat(ground, TC.X0, TC.X1, TC.Z0, TC.Z1, .05, 6, '#d8d2c4');
  [[232, 520, 870, 985], [470, 520, 600, 985], [930, 1100, 440, 985], [470, 930, 500, 535], [135, 195, 140, 985], [330, 600, 125, 228], [515, 590, 228, 330]].forEach(r => flat(pave, ...rect(...r), .07, 4));
  { // paved path beside the tree belt (diagonal on the plan): a run of overlapping tiles
    const A = [800, 520], B = [600, 160]; for (let t = 0; t <= 1; t += .07) { const px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t; flat(pave, ...rect(px - 28, px + 28, py - 28, py + 28), .068, 4); } }
  [[60, 135, 100, 985], [1078, 1110, 440, 985], [60, 1110, 100, 125], [185, 232, 880, 975], [432, 470, 880, 975], [520, 915, 965, 985]].forEach(r => flat(grass, ...rect(...r), .06, 4, '#5f8f46'));
  // fountain court lawn
  flat(grass, ...rect(372, 455, 505, 605), .062, 4, '#6d9a4f');

  // ---------------------------------------------------------------- building helper (textured walls, parapet roof, collider, minimap footprint)
  function bldg(r, h, kind, roof, map) {
    const [x0, x1, z0, z1] = rect(...r); const [M, tw, th] = FAC[kind];
    faces(x0, x1, z0, z1).forEach(([cx, cz, len, ry]) => M.wall(cx, cz, len, 0, h, ry, '#ffffff', len / tw, h / th, 0, 0));
    S.box(x0 - .25, x1 + .25, h, h + .5, z0 - .25, z1 + .25, roof || '#c9c4b8'); S.box(x0 + .3, x1 - .3, h + .5, h + .62, z0 + .3, z1 - .3, '#8f8a80');
    col(x0, x1, z0, z1, h);
    out.buildings.push({ kind, x0, x1, z0, z1, h, map: map || roof });
    return [x0, x1, z0, z1];
  }
  const nameOn = (b, n, side, y, w) => {   // side: 'n' (+z) 's' (−z) 'e' (+x) 'w' (−x) in world terms
    const [x0, x1, z0, z1] = b;
    if (side === 's') sign(n, (x0 + x1) / 2, z0 - .06, Math.PI, y, w); else if (side === 'n') sign(n, (x0 + x1) / 2, z1 + .06, 0, y, w);
    else if (side === 'e') sign(n, x1 + .06, (z0 + z1) / 2, Math.PI / 2, y, w); else sign(n, x0 - .06, (z0 + z1) / 2, -Math.PI / 2, y, w);
  };

  // north-west group (back of the compound in the game): engraving, electronics & computer, promotion hall, buffet
  nameOn(bldg([198, 330, 140, 190], 5, 'shop', '#b8c2c8'), 'ورشة النقش', 's', 3.6, 4.6);
  nameOn(bldg([198, 330, 190, 285], 6.5, 'inst', '#2e9a4e'), 'ورشة الإلكترونيات والكمبيوتر', 's', 4.6, 8);
  nameOn(bldg([330, 512, 228, 288], 5.5, 'store', '#ead9a0'), 'صالة ترقية', 'n', 3.9, 6);
  nameOn(bldg([218, 325, 295, 338], 4.5, 'store', '#c9ccd2'), 'البوفية', 's', 3.3, 4);
  // classrooms (3 floors) along the promenade, the rooms block behind them, stair towers on the promenade side
  const cls = bldg([195, 282, 345, 735], 11, 'inst', '#f0a040');
  nameOn(cls, 'الفصول النظرية', 'e', 9.2, 8);
  bldg([290, 350, 460, 735], 7.5, 'store', '#c9ccd2');
  [[350, 400], [485, 530], [625, 670]].forEach(([a, b]) => { const r = pbox([178, 195, a, b], 0, 12.4, '#86b4d6', 12.4); S.box(r[0] - .2, r[1] + .2, 12.4, 12.8, r[2] - .2, r[3] + .2, '#5f7f99'); });
  // multi-purpose hall, the small block by the fountain court
  nameOn(bldg([355, 578, 330, 500], 9, 'store', '#e9dcc0'), 'صالة متعددة الأغراض', 's', 6.8, 9);
  bldg([385, 475, 640, 735], 6, 'store', '#cfd6dd');
  // admin building with the entrance (3 floors): wide front block, narrower top, entrance canopy on columns
  const adm = bldg([185, 470, 800, 870], 11.5, 'inst', '#f0a040');
  bldg([235, 425, 760, 800], 11.5, 'inst', '#f0a040');
  nameOn(adm, 'مبنى الإدارة والفصول النظرية', 's', 8.6, 15);
  { const [x0, x1, z0] = rect(300, 375, 870, 900); S.box(x0, x1, 4.2, 4.6, z0 - .2, wz(870), '#f7f1e2'); S.box(x0, x1, 4.6, 4.8, z0 - .3, wz(870), '#0f4a3a');
    [x0 + .3, x1 - .3].forEach(x => { S.cyl(.28, 4.2, x, 2.1, z0 + .2, '#efe7d6', 12); col(x - .3, x + .3, z0 - .1, z0 + .5, 4.2); });
    S.box(x0 + 1, x1 - 1, 0, .18, z0 - .6, wz(870), '#cfc6b4'); S.box(x0 + 1.4, x1 - 1.4, .18, .32, z0 - .2, wz(870), '#cfc6b4');
    S.box((x0 + x1) / 2 - 1.6, (x0 + x1) / 2 + 1.6, .32, 3.4, wz(870) - .05, wz(870) + .02, '#2f5272'); }

  // ---------------------------------------------------------------- the workshop block: rooms coloured as on the plan, a corridor through it
  const yR = y => 628 + (y - 605) * 337 / 360;    // the plan's rows, moved down to leave a 6 m corridor (plan y 572–628)
  const ROWS = [
    [533, 583, 605, 643, 'دورة مياه', '#a9c9e6'], [645, 905, 605, 643, 'ورشة النجارة', '#b9c0c8', 'open'],
    [533, 722, 645, 690, 'ورشة المعادن', '#8fd16a'], [725, 905, 645, 690, 'ورشة اللحام', '#ef6b6b'],
    [533, 752, 692, 755, 'ورشة بدن السفينة', '#8fd16a'], [755, 905, 692, 755, 'ورشة المواسير', '#8fd16a'],
    [533, 905, 758, 792, 'ورشة الكهرباء', '#3faa55'],
    [533, 745, 795, 835, 'ورشة التجهيزات', '#b9c0c8'], [748, 905, 795, 835, 'ورشة التركيبات', '#ef6b6b'],
    [533, 592, 838, 882, 'دورة مياه', '#a9c9e6'], [595, 905, 838, 882, 'مخازن', '#7fb8c8'],
    [533, 748, 885, 922, 'ورشة الخراطة', '#d98ac0'], [752, 905, 885, 922, 'ورشة الآلات', '#b9c0c8'],
  ].map(([a, b, c, d, n, m, o]) => [a, b, yR(c), yR(d), n, m, o]).concat([
    [520, 768, 925, 965, 'ورشة الحدادة', '#b9c0c8'], [771, 837, 925, 965, 'مخزن', '#a9c9e6'], [842, 915, 925, 965, 'مكتب', '#a9c9e6'],
    [530, 640, 535, 572, 'دورة مياه الطلبة', '#a9c9e6'], [640, 790, 535, 572, 'ورشة تصنيع الآلات', '#b9c0c8', 'open'], [790, 915, 535, 572, 'دورة مياه الطلبة', '#a9c9e6']]);
  const WB = { x0: wx(915), x1: wx(520), zN: wz(535), zCn: wz(572), zCs: wz(628), zS: wz(965) };   // world: x0 west face, zN back, corridor zCs..zCn
  const HB = 8, HC = 4.4;   // block height, corridor / open workshop ceiling
  // outer faces of the block (west face looks onto the exit road, east face onto the lane by the admin building)
  [[WB.x0, WB.x1, WB.zCn, WB.zN], [WB.x0, WB.x1, WB.zS, WB.zCs]].forEach(([x0, x1, z0, z1], i) => {
    faces(x0, x1, z0, z1).forEach(([cx, cz, len, ry], k) => { if ((i === 0 && k === 1) || (i === 1 && k === 0)) return; fShop.wall(cx, cz, len, 0, HB, ry, '#ffffff', len / 12, 1, 0, 0); });
    S.box(x0 - .25, x1 + .25, HB, HB + .3, z0 - .25, z1 + .25, '#8f969c');
  });
  // the corridor: ceiling slab with the block above it, tiled interior walls, light strips, signs at both mouths
  S.box(WB.x0, WB.x1, HC, HB, WB.zCs, WB.zCn, '#c9cdd0');
  fShop.wall((WB.x0 + WB.x1) / 2 - 0, WB.zCs, WB.x1 - WB.x0, HC, HB - HC, Math.PI, '#ffffff', (WB.x1 - WB.x0) / 12, .45, 0, .55);
  fShop.wall((WB.x0 + WB.x1) / 2, WB.zCn, WB.x1 - WB.x0, HC, HB - HC, 0, '#ffffff', (WB.x1 - WB.x0) / 12, .45, 0, .55);
  [[WB.x0, -Math.PI / 2], [WB.x1, Math.PI / 2]].forEach(([x, ry]) => { fShop.wall(x, (WB.zCs + WB.zCn) / 2, WB.zCn - WB.zCs, HC, HB - HC, ry, '#ffffff', .4, .45, 0, .55);
    sign('ممر دخول وخروج الطلبة', x + (ry > 0 ? .07 : -.07), (WB.zCs + WB.zCn) / 2, ry, HC + .5, 4.6); });
  // door openings of the two open workshops, so the corridor walls and their colliders leave them clear
  const DOORS = { s: [], n: [] };
  for (const [a, b, c, d, n, m, open] of ROWS) { if (!open) continue; const [x0, x1, z0] = rect(a, b, c, d); const dw = Math.min(5.5, (x1 - x0) * .4), dc = (x0 + x1) / 2; (z0 >= WB.zCn - .01 ? DOORS.n : DOORS.s).push([dc - dw / 2, dc + dw / 2]); }
  const runs = gaps => { const o = []; let x = WB.x0; gaps.slice().sort((p, q) => p[0] - q[0]).forEach(g => { o.push([x, g[0]]); x = g[1]; }); o.push([x, WB.x1]); return o; };
  runs(DOORS.s).forEach(([a, b]) => { fIn.wall((a + b) / 2, WB.zCs + .02, b - a, 0, HC, 0, '#ffffff', (b - a) / 8, 1, 0, 0); col(a, b, WB.zCs - .3, WB.zCs, HC); });
  runs(DOORS.n).forEach(([a, b]) => { fIn.wall((a + b) / 2, WB.zCn - .02, b - a, 0, HC, Math.PI, '#ffffff', (b - a) / 8, 1, 0, 0); col(a, b, WB.zCn, WB.zCn + .3, HC); });
  // thin colliders round the outside of the block (the rooms inside do not fill it edge to edge)
  col(WB.x0, WB.x1, WB.zN - .3, WB.zN, HB); col(WB.x0, WB.x1, WB.zS, WB.zS + .3, HB);
  [WB.x0, WB.x1 - .3].forEach(x => { col(x, x + .3, WB.zCn, WB.zN, HB); col(x, x + .3, WB.zS, WB.zCs, HB); });
  for (let x = WB.x0 + 3; x < WB.x1 - 2; x += 6) lights.box(x - 1.4, x + 1.4, HC - .06, HC - .02, (WB.zCs + WB.zCn) / 2 - .2, (WB.zCs + WB.zCn) / 2 + .2, '#fffaf0');
  // rooms: solid rooms are boxes; the two open workshops are hollow with a wide door onto the corridor and their machines inside
  for (const [a, b, c, d, n, m, open] of ROWS) {
    const [x0, x1, z0, z1] = rect(a, b, c, d);
    S.box(x0 + .05, x1 - .05, HB + .3, HB + .42, z0 + .05, z1 - .05, m);              // roof panel in the plan's colour
    out.buildings.push({ kind: 'ws', x0, x1, z0, z1, h: HB, map: m, n });
    const northRow = z0 >= WB.zCn - .01, doorZ = northRow ? z0 : z1;              // the face on the corridor
    if (!open) { col(x0, x1, z0, z1, HB); if (Math.abs(doorZ - (northRow ? WB.zCn : WB.zCs)) < .05 && x1 - x0 > 5) {
        // a closed door with its name on the corridor
        const cx = (x0 + x1) / 2, dz = northRow ? doorZ - .03 : doorZ + .03; S.box(cx - 1.1, cx + 1.1, 0, 2.4, Math.min(dz, doorZ), Math.max(dz, doorZ) + (northRow ? 0 : 0), '#6b4a2b');
        sign(n, cx, northRow ? doorZ - .05 : doorZ + .05, northRow ? Math.PI : 0, 2.75, Math.min(4.2, x1 - x0 - 1)); }
      continue; }
    // hollow workshop: walls (.3 thick), wide door on the corridor side, ceiling, solid volume above
    const t = .3, door = Math.min(5.5, (x1 - x0) * .4), dc = (x0 + x1) / 2;
    const back = northRow ? z1 : z0;
    S.box(x0, x1, 0, HC, Math.min(back, back + (northRow ? -t : t)), Math.max(back, back + (northRow ? -t : t)), '#e3ddd0'); col(x0, x1, Math.min(back, back + (northRow ? -t : t)), Math.max(back, back + (northRow ? -t : t)), HC);
    [x0, x1 - t].forEach(x => { S.box(x, x + t, 0, HC, z0, z1, '#e3ddd0'); col(x, x + t, z0, z1, HC); });
    const fz0 = Math.min(doorZ, doorZ + (northRow ? t : -t)), fz1 = Math.max(doorZ, doorZ + (northRow ? t : -t));
    [[x0, dc - door / 2], [dc + door / 2, x1]].forEach(([p, q]) => { S.box(p, q, 0, HC, fz0, fz1, '#e3ddd0'); col(p, q, fz0, fz1, HC); });
    S.box(dc - door / 2, dc + door / 2, HC - .7, HC, fz0, fz1, '#e3ddd0');
    S.box(dc - door / 2 - .15, dc - door / 2 + .05, 0, HC - .7, fz0 - .05, fz1 + .05, '#F5B928'); S.box(dc + door / 2 - .05, dc + door / 2 + .15, 0, HC - .7, fz0 - .05, fz1 + .05, '#F5B928');
    S.box(x0, x1, HC, HB, z0, z1, '#c9cdd0');
    sign(n, dc, northRow ? doorZ - .06 : doorZ + .06, northRow ? Math.PI : 0, HC - .62 + .05, Math.min(5, door));
    // interior: tiled walls, light strips, floor markings, machines
    const iz = northRow ? z1 - t - .02 : z0 + t + .02;
    fIn.wall((x0 + x1) / 2, iz, x1 - x0 - 2 * t, 0, HC, northRow ? Math.PI : 0, '#ffffff', (x1 - x0) / 8, 1, 0, 0);
    fIn.wall(x0 + t + .02, (z0 + z1) / 2, z1 - z0, 0, HC, Math.PI / 2, '#ffffff', (z1 - z0) / 8, 1, 0, 0);
    fIn.wall(x1 - t - .02, (z0 + z1) / 2, z1 - z0, 0, HC, -Math.PI / 2, '#ffffff', (z1 - z0) / 8, 1, 0, 0);
    for (let x = x0 + 2.5; x < x1 - 2; x += 5) lights.box(x - 1.2, x + 1.2, HC - .06, HC - .02, (z0 + z1) / 2 - .2, (z0 + z1) / 2 + .2, '#fffaf0');
    S.box(x0 + .6, x1 - .6, .06, .075, (z0 + z1) / 2 - .06, (z0 + z1) / 2 + .06, '#F5B928');
    const mz = northRow ? z1 - t - .9 : z0 + t + .9, face = northRow ? Math.PI : 0;
    for (let x = x0 + 1.6; x < x1 - 1.4; x += 3) {
      if (Math.abs(x - dc) < door / 2 - .2 && false) continue;
      if (n === 'ورشة النجارة') {   // carpentry benches with planks and a vice
        S.box(x - 1, x + 1, .85, .95, mz - .45, mz + .45, '#b98b5a'); [[-.9, -.38], [.9, -.38], [-.9, .38], [.9, .38]].forEach(([dx, dz]) => S.box(x + dx - .05, x + dx + .05, 0, .85, mz + dz - .05, mz + dz + .05, '#6b4a2b'));
        S.box(x - .8, x + .6, .95, 1.0, mz - .15, mz + .15, '#d8b27a'); S.box(x + .7, x + .9, .95, 1.15, mz - .1, mz + .1, '#4a4f55');
      } else {                       // machine shop: lathes / mills in machine green with a chuck
        S.box(x - 1.1, x + 1.1, 0, .8, mz - .35, mz + .35, '#3e6b55'); S.box(x - 1.1, x - .5, .8, 1.35, mz - .35, mz + .35, '#3e6b55');
        S.box(x - .4, x + 1.1, .8, .95, mz - .2, mz + .2, '#8d969c'); S.xf(NI.cyl12, x - .3, 1.12, mz, .34, .2, .34, 0, '#c7ccd0', 0, Math.PI / 2);
        S.box(x - .2, x + .1, .95, 1.2, mz - .12, mz + .12, '#d9483b');
      }
      col(x - 1.1, x + 1.1, mz - .45, mz + .45, 1.2);
    }
    if (person) { person({ shirt: '#1f4f86', pants: '#1f4f86', skin: '#9a6b4a', cap: '#1f4f86' }, x0 + 2.4, mz + (northRow ? -1.1 : 1.1), face); person({ shirt: '#f4f1ea', pants: '#3b4a63', skin: '#8a5a3b' }, x1 - 2.6, (z0 + z1) / 2, face + .6); }
    out.rooms.push({ n, x0, x1, z0, z1, door: [dc - door / 2, dc + door / 2], doorZ });
  }
  // the block's name signs outside: on the west face (exit road) and the east face (lane), one per row
  for (const [a, b, c, d, n] of ROWS) { const [x0, x1, z0, z1] = rect(a, b, c, d); if (z1 - z0 < 2.4 || n.startsWith('دورة')) continue;
    if (a <= 534) sign(n, WB.x1 + .07, (z0 + z1) / 2, Math.PI / 2, 5.4, Math.min(5.5, (z1 - z0) * 1.3));
    if (b >= 904) sign(n, WB.x0 - .07, (z0 + z1) / 2, -Math.PI / 2, 5.4, Math.min(5.5, (z1 - z0) * 1.3)); }
  out.buildings.push({ kind: 'corridor', x0: WB.x0, x1: WB.x1, z0: WB.zCs, z1: WB.zCn, h: HC, map: '#d8d2c4' });

  // ---------------------------------------------------------------- stores (two-storey) and the welding shops by the exit road
  const stA = bldg([818, 925, 125, 435], 7.5, 'store', '#a9c9e6'), stB = bldg([945, 1058, 125, 435], 7.5, 'store', '#a9c9e6');
  nameOn(stA, 'مخازن', 's', 5.4, 5); nameOn(stB, 'مخازن', 's', 5.4, 5);
  [stA, stB].forEach(b => { for (let x = b[0] + 3; x < b[1] - 2; x += 6.5) S.box(x - 1.2, x + 1.2, 0, 2.6, b[2] - .08, b[2], '#5c656d'); });
  const w1 = bldg([995, 1062, 640, 760], 6, 'shop', '#e3cfa6'), w2 = bldg([1000, 1078, 772, 900], 6, 'shop', '#e3cfa6');
  nameOn(w1, 'ورشة لحام', 'e', 4.6, 5); nameOn(w2, 'ورشة لحام', 'e', 4.6, 5);
  { const tr = pbox([935, 960, 445, 470], 0, 2.4, '#7c858c', 2.4); S.box(tr[0] + .3, tr[1] - .3, 2.4, 2.6, tr[2] + .3, tr[3] - .3, '#5c656d'); }   // transformer room

  // ---------------------------------------------------------------- yard props: steel, pipes, gas, a ship hull section, bike rack, benches
  { const x = wx(1088), z = wz(500); for (let k = 0; k < 6; k++) S.box(x - 1.3, x + 1.3, k * .12, k * .12 + .1, z - 3, z + 3, k % 2 ? '#7c8790' : '#6a747d'); col(x - 1.3, x + 1.3, z - 3, z + 3, .8); }
  { const x = wx(1086), z = wz(560); for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) S.xf(NI.cyl12, x - .9 + k * .55 + r * .27, .27 + r * .46, z, .5, 6, .5, 0, '#8a6a4a', Math.PI / 2, 0); col(x - 1.2, x + 1.2, z - 3, z + 3, 1.4); }
  for (let i = 0; i < 6; i++) S.cyl(.18, 1.4, wx(1060) - .45 * i, .7, wz(612), i % 2 ? '#2f6b4f' : '#c9302a');
  { // a ship hull block for the hull-shop trainees, in the yard behind the stores
    const x = wx(470), z = wz(140); S.box(x - 5, x + 5, 0, .4, z - 2, z + 2, '#5c656d');
    for (let k = 0; k < 6; k++) { const a = k / 5 * Math.PI / 2; S.xf(NI.box, x - 4 + k * 1.6, .4 + 2.2 * Math.sin(a) * .5 + .6, z, 1.4, 2.2, .1, 0, '#a0442f', 0, 0); }
    S.box(x - 4.5, x + 4.5, 2.4, 2.55, z - 1.8, z + 1.8, '#8a3a2a'); col(x - 5, x + 5, z - 2, z + 2, 2.6); }
  { const x = wx(125), z0 = wz(890); for (let i = 0; i < 6; i++) { S.box(x - .5, x + .5, .55, .6, z0 + i * .8 - .02, z0 + i * .8 + .02, '#2d2d2d'); S.xf(NI.cyl12, x, .35, z0 + i * .8, .7, .06, .7, 0, '#1d1d1d', 0, Math.PI / 2); } }
  const bench = (x, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry); S.xf(NI.box, x, .45, z, 1.8, .08, .45, ry, '#8a5a32'); S.xf(NI.box, x - s * .2, .75, z - c * .2, 1.8, .45, .06, ry, '#8a5a32'); S.xf(NI.box, x, .22, z, 1.6, .44, .3, ry, '#4a4f55'); col(x - 1, x + 1, z - 1, z + 1, .8); };
  [[125, 420, Math.PI / 2], [125, 560, Math.PI / 2], [125, 700, Math.PI / 2], [390, 520, 0], [440, 590, Math.PI]].forEach(([px, py, ry]) => bench(wx(px), wz(py), ry));

  // fountain court: low hedges, basin and a jet
  { const cx = wx(413), cz = wz(555); S.cyl(2.4, .5, cx, .3, cz, '#cfc6b4', 16); S.cyl(2, .52, cx, .32, cz, '#3f7fb0', 16); S.cyl(.25, 1.6, cx, .8, cz, '#e7e2d5', 8); col(cx - 2.4, cx + 2.4, cz - 2.4, cz + 2.4, .6);
    const [x0, x1, z0, z1] = rect(372, 455, 505, 605); [[x0, x1, z0, z0 + .5], [x0, x1, z1 - .5, z1], [x0, x0 + .5, z0, z1], [x1 - .5, x1, z0, z1]].forEach(([a, b, c, d]) => S.box(a, b, 0, .7, c, d, '#3f6f35')); }
  // flag at the entrance plaza
  if (flag) flag(wx(250), wz(950), 9);

  // ---------------------------------------------------------------- perimeter wall with its two gates
  const WALL = '#e9dfca', TOP = '#0f4a3a', H = 2.6, { X0: gx0, X1: gx1, Z0: gz0, Z1: gz1 } = TC;
  const mainG = [wx(385), wx(300)].sort((a, b) => a - b), exitG = [wx(1065), wx(995)].sort((a, b) => a - b);
  const runX = (z, a, b) => { S.box(a, b, 0, H, z - .3, z + .3, WALL); S.box(a, b, H, H + .25, z - .38, z + .38, TOP); for (let x = a + 3; x < b - 1; x += 3.2) S.box(x - .2, x + .2, 0, H + .4, z - .4, z + .4, '#e2d6bd'); col(a, b, z - .3, z + .3, H); };
  const runZ = (x, a, b) => { S.box(x - .3, x + .3, 0, H, a, b, WALL); S.box(x - .38, x + .38, H, H + .25, a, b, TOP); for (let z = a + 3; z < b - 1; z += 3.2) S.box(x - .4, x + .4, 0, H + .4, z - .2, z + .2, '#e2d6bd'); col(x - .3, x + .3, a, b, H); };
  [[gx0, exitG[0]], [exitG[1], mainG[0]], [mainG[1], gx1]].forEach(([a, b]) => { if (b - a > .2) runX(gz0, a, b); });
  runX(gz1, gx0, gx1); runZ(gx0, gz0, gz1); runZ(gx1, gz0, gz1);
  [mainG[0], mainG[1], exitG[0], exitG[1]].forEach(x => { S.box(x - .5, x + .5, 0, 4.2, gz0 - .5, gz0 + .5, '#efe7d6'); S.box(x - .6, x + .6, 4.2, 4.5, gz0 - .6, gz0 + .6, TOP); col(x - .5, x + .5, gz0 - .5, gz0 + .5, 4.2); });
  plainSign('مركز تدريب شركة ترسانة الإسكندرية', 12, 1.15, (mainG[0] + mainG[1]) / 2, 5.3, gz0 - .1, Math.PI, { bg: '#0f4a3a', border: '#e8c35a', glow: true });
  S.box(mainG[0] - .2, mainG[1] + .2, 4.5, 4.75, gz0 - .25, gz0 + .25, TOP);
  plainSign('بوابة الخروج', 5, .8, (exitG[0] + exitG[1]) / 2, 4.2, gz0 - .1, Math.PI, { bg: '#20334D', border: '#e8c35a' });
  plainSign('مدخل المبنى الإداري والفصول النظرية', 7, .7, (mainG[0] + mainG[1]) / 2, 3.4, gz0 + .1, 0, { bg: '#20334D', border: '#e8c35a' });
  // gate kiosk with a guard; barrier arm (raised) at the exit gate
  { const kx = wx(440), kz = wz(958); S.box(kx - 1.3, kx + 1.3, 0, 2.6, kz - 1.1, kz + 1.1, '#efe7d6'); S.box(kx - 1.5, kx + 1.5, 2.6, 2.9, kz - 1.3, kz + 1.3, TOP); S.box(kx - 1.32, kx + 1.32, 1.1, 2, kz - 1.12, kz - .9, '#2f4a62'); col(kx - 1.3, kx + 1.3, kz - 1.1, kz + 1.1, 2.6);
    if (person) person({ shirt: '#2d3b4f', pants: '#2d3b4f', skin: '#8f6446', cap: '#24303f' }, kx + 2, kz - .4, Math.PI); out.kiosk = [kx, kz]; }
  { const z = gz0 + .9, x = exitG[1] + .1; S.box(x, x + .3, 0, 1.1, z - .15, z + .15, '#d9483b'); for (let i = 0; i < 6; i++) S.box(x, x + .1, 1.1 + i * .9, 1.1 + (i + 1) * .9, z - .05, z + .05, i % 2 ? '#ffffff' : '#d9483b'); }

  // ---------------------------------------------------------------- trees, palms, the tree belt with its round planters, lamps
  const tree = (x, z, s) => { S.cyl(.18 * s, 2.4 * s, x, 1.2 * s, z, '#6b4a2b', 6); S.xf(NI.sph, x, 3 * s, z, 2.6 * s, 2.2 * s, 2.6 * s, 0, Math.random() < .5 ? '#3f6f35' : '#4d7f3c'); col(x - .3, x + .3, z - .3, z + .3, 3); };
  for (let py = 160; py < 960; py += 62) tree(wx(95), wz(py), 1);
  for (let py = 470; py < 960; py += 60) tree(wx(1095), wz(py), .85);
  for (let px = 160; px < 1060; px += 80) if (px < 560 || px > 1000) tree(wx(px), wz(112), .85);
  for (let px = 560; px < 915; px += 45) tree(wx(px), wz(975), .7);
  for (let t = 0; t <= 1.001; t += 1 / 7) { const px = 790 - 200 * t, py = 500 - 360 * t; const x = wx(px - 55), z = wz(py); S.cyl(1.3, .5, x, .25, z, '#cfc6b4', 12); S.cyl(1.1, .52, x, .27, z, '#5b4632', 12); tree(x, z, 1.15); }
  [[178, 790], [478, 790], [250, 880], [410, 880]].forEach(([px, py]) => { palmsList.push([wx(px), wz(py), 7]); col(wx(px) - .4, wx(px) + .4, wz(py) - .4, wz(py) + .4, 7); });
  if (lampsList) { [[918, 880], [918, 720], [918, 600], [470, 900], [470, 700], [190, 920], [130, 760], [130, 560], [130, 360], [880, 450], [640, 300]].forEach(([px, py]) => lampsList.push([wx(px), wz(py), Math.PI / 2])); }

  // trainees and staff moving around (added to the walkers after load), a few standing in groups
  out.walks = [['z', wx(165), wz(950), wz(380)], ['x', wz(510), wx(500), wx(880)], ['z', wx(955), wz(960), wz(480)], ['x', wz(140), wx(360), wx(560)], ['z', wx(495), wz(960), wz(620)]];
  if (person) [[600, 515, 0], [618, 515, Math.PI], [700, 512, .4], [960, 600, Math.PI / 2], [966, 606, -Math.PI / 2], [420, 620, 1.2]].forEach(([px, py, ry], i) =>
    person(i % 3 === 2 ? { shirt: '#f4f1ea', pants: '#3b4a63', skin: '#8a5a3b' } : { shirt: '#1f4f86', pants: '#1f4f86', skin: i % 2 ? '#b07a55' : '#8f6446', cap: i % 2 ? null : '#f2c218' }, wx(px), wz(py), ry));

  // ---------------------------------------------------------------- meshes (a handful of draw calls for the whole compound)
  const mk = (M, mat, cast) => { if (!M.p.length) return; const m = new T.Mesh(M.geo(), mat); m.castShadow = cast; m.receiveShadow = true; m.name = 'training'; scene.add(m); out.meshes.push(m); };
  mk(ground, new T.MeshStandardMaterial({ map: rep(texConc, 1, 1), vertexColors: true, roughness: .92 }), false);
  mk(pave, new T.MeshStandardMaterial({ map: texPave, roughness: .9 }), false);
  mk(grass, new T.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1 }), false);
  mk(fInst, new T.MeshStandardMaterial({ map: facInst, roughness: .85 }), true);
  mk(fShop, new T.MeshStandardMaterial({ map: facShop, roughness: .7, metalness: .15 }), true);
  mk(fStore, new T.MeshStandardMaterial({ map: facStore, roughness: .85 }), true);
  mk(fIn, new T.MeshStandardMaterial({ map: facIn, roughness: .8, emissive: '#ffffff', emissiveMap: facIn, emissiveIntensity: .45 }), false);
  mk(lights, new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), false);
  mk(signs, new T.MeshStandardMaterial({ map: names, roughness: .6, emissive: '#ffffff', emissiveMap: names, emissiveIntensity: .3 }), false);
  out.gates = { main: (mainG[0] + mainG[1]) / 2, exit: (exitG[0] + exitG[1]) / 2 };
  out.corridor = { x0: WB.x0, x1: WB.x1, z0: WB.zCs, z1: WB.zCn, h: HC };
  return out;
}
