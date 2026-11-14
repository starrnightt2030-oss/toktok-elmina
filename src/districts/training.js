// Alexandria Shipyard training centre («مركز تدريب شركة ترسانة الإسكندرية»), built from the site plan the user supplied.
// Phase 7: approved as the game's training centre; the map was widened so it stands at near-real size (0.11 m per plan pixel,
// about 92% of the plan's 0–20 m scale bar) instead of being squeezed into one city block.
//
// The plan is drawn north-up, main entrance and exit gate on its south side (الشارع العام), شارع ترسانة الإسكندرية on its west.
// In the game the compound stands south of the port avenue across from the shipyard gate: the plan is turned 180° so both gates
// face the avenue and the exit gate lines up with the shipyard gate (x = 170). The plan's west street is the city street at x = 286.
//
// Inside it is one big paved yard (الحوش) you drive round, a garden island with a fountain in the middle; at the far end the
// theory building (admin + classrooms) on the east and the workshops section (four halls with roller doors) on the west.

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

// the compound is one big paved yard (الحوش): drive in at either gate, round the garden island in the middle;
// at the far end stand the theory building (admin + classrooms) on the east and the workshops section on the west
const YW = 175, YE = r1(TC.gateMain), YS = 28, YN = 74;      // the ring road round the yard
TC.yard = { x0: 166, x1: 272, z0: 17, z1: 78, ring: [YW, YE, YS, YN], island: [210, 51, 7] };
TC.graph = edge => {
  const gm = TC.gateMain, ge = TC.gateExit;
  edge([gm, 0], [gm, YS], 'tc'); edge([ge, 0], [ge, TC.Z0], 'tc'); edge([ge, TC.Z0], [YW, YS], 'tc');
  edge([YW, YS], [gm, YS], 'tc'); edge([gm, YS], [YE, YN], 'tc'); edge([YW, YS], [YW, YN], 'tc'); edge([YW, YN], [YE, YN], 'tc');
};
TC.POI = {
  tcmain: { n: 'مركز تدريب الترسانة — المدخل', x: TC.gateMain, z: 6.5, sx: 0, sz: 5.5, area: 'campus' },
  tcexit: { n: 'بوابة خروج مركز التدريب', x: TC.gateExit - 8, z: 6.5, sx: 0, sz: 5.5, area: 'campus' },
  tcadm: { n: 'مبنى الإدارة والفصول النظرية', x: 236, z: YN, sx: 0, sz: 4.5, area: 'campus' },
  tcweld: { n: 'سكشن الورش — مركز التدريب', x: 192, z: YN, sx: 0, sz: 4.5, area: 'campus' },
  tcyard: { n: 'حوش مركز التدريب', x: 212, z: YS, sx: 0, sz: -4.5, area: 'campus' },
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

  const tree = (x, z, s) => { S.cyl(.18 * s, 2.4 * s, x, 1.2 * s, z, '#6b4a2b', 6); S.xf(NI.sph, x, 3 * s, z, 2.6 * s, 2.2 * s, 2.6 * s, 0, Math.random() < .5 ? '#3f6f35' : '#4d7f3c'); col(x - .3, x + .3, z - .3, z + .3, 3); };
  // ---------------------------------------------------------------- ground: the yard paved edge to edge, lawn strips along the walls
  const Y = TC.yard;
  flat(ground, TC.X0, TC.X1, TC.Z0, TC.Z1, .05, 6, '#d8d2c4');
  flat(pave, Y.x0, Y.x1, Y.z0, Y.z1, .07, 4);
  [[TC.X0, Y.x0, TC.Z0, TC.Z1], [Y.x1, TC.X1, TC.Z0, TC.Z1], [TC.X0, TC.X1, TC.Z1 - 3, TC.Z1]].forEach(r => flat(grass, ...r, .06, 4, '#5f8f46'));
  // painted lane lines round the ring and parking bays in front of the buildings
  { const [w, e, sz, nz] = Y.ring; const L = (x0, x1, z0, z1) => S.box(x0, x1, .075, .09, z0, z1, '#f4f1e6');
    for (let x = w + 2; x < e - 2; x += 6) { L(x, x + 3, sz - .08, sz + .08); L(x, x + 3, nz - .08, nz + .08); }
    for (let z = sz + 2; z < nz - 2; z += 6) { L(w - .08, w + .08, z, z + 3); L(e - .08, e + .08, z, z + 3); }
    for (let x = 220; x <= 268; x += 4) L(x - .06, x + .06, 78.2, 81.5); }

  // ---------------------------------------------------------------- building helper (textured walls, parapet roof, collider, minimap footprint)
  function bldg(x0, x1, z0, z1, h, kind, roof, map) {
    const [M, tw, th] = FAC[kind];
    faces(x0, x1, z0, z1).forEach(([cx, cz, len, ry]) => M.wall(cx, cz, len, 0, h, ry, '#ffffff', len / tw, h / th, 0, 0));
    S.box(x0 - .25, x1 + .25, h, h + .5, z0 - .25, z1 + .25, roof || '#c9c4b8'); S.box(x0 + .3, x1 - .3, h + .5, h + .62, z0 + .3, z1 - .3, '#8f8a80');
    col(x0, x1, z0, z1, h);
    out.buildings.push({ kind, x0, x1, z0, z1, h, map: map || roof });
    return [x0, x1, z0, z1];
  }
  const nameOn = (b, n, side, y, w) => {
    const [x0, x1, z0, z1] = b;
    if (side === 's') sign(n, (x0 + x1) / 2, z0 - .06, Math.PI, y, w); else if (side === 'n') sign(n, (x0 + x1) / 2, z1 + .06, 0, y, w);
    else if (side === 'e') sign(n, x1 + .06, (z0 + z1) / 2, Math.PI / 2, y, w); else sign(n, x0 - .06, (z0 + z1) / 2, -Math.PI / 2, y, w);
  };

  // ---------------------------------------------------------------- the theory building at the far end (east): three floors, entrance canopy on columns
  const adm = bldg(214, 271, 84, 108, 11.5, 'inst', '#f0a040');
  nameOn(adm, 'مبنى الإدارة والفصول النظرية', 's', 9, 16);
  { const x0 = 234, x1 = 250, z0 = 80.5, zf = 84; S.box(x0, x1, 4.2, 4.6, z0, zf, '#f7f1e2'); S.box(x0, x1, 4.6, 4.8, z0 - .1, zf, '#0f4a3a');
    [x0 + .4, x1 - .4].forEach(x => { S.cyl(.3, 4.2, x, 2.1, z0 + .4, '#efe7d6', 12); col(x - .32, x + .32, z0 + .1, z0 + .7, 4.2); });
    S.box(x0 + 1, x1 - 1, 0, .18, z0 + .8, zf, '#cfc6b4'); S.box(x0 + 1.4, x1 - 1.4, .18, .32, z0 + 1.4, zf, '#cfc6b4');
    S.box((x0 + x1) / 2 - 1.8, (x0 + x1) / 2 + 1.8, .32, 3.4, zf - .05, zf + .02, '#2f5272'); }
  [[218, 82], [266, 82]].forEach(([x, z]) => { palmsList.push([x, z, 7]); col(x - .4, x + .4, z - .4, z + .4, 7); });

  // ---------------------------------------------------------------- the workshops section at the far end (west): four halls side by side, roller doors onto the yard
  const SHOPS = [['ورشة اللحام', '#ef6b6b'], ['ورشة النجارة', '#b9c0c8'], ['ورشة الخراطة', '#d98ac0'], ['ورشة الكهرباء', '#3faa55']];
  const sx0 = 167, sw = 11, sz0 = 84, sz1 = 108;
  SHOPS.forEach(([n, roof], i) => { const x0 = sx0 + i * sw, x1 = x0 + sw - .4; const b = bldg(x0, x1, sz0, sz1, 8, 'shop', roof); nameOn(b, n, 's', 6.6, Math.min(7, sw - 1.5));
    // the roller door, half open, with yellow posts and a warm light inside
    const dc = (x0 + x1) / 2; S.box(dc - 2.8, dc + 2.8, 2.6, 5.2, sz0 - .08, sz0, '#6f7880'); S.box(dc - 2.8, dc + 2.8, 0, 2.6, sz0 - .02, sz0, '#2a2016');
    lights.box(dc - 2.6, dc + 2.6, .05, 2.5, sz0 - .03, sz0 - .01, '#ffcf86');
    S.box(dc - 3, dc - 2.8, 0, 5.2, sz0 - .2, sz0, '#F5B928'); S.box(dc + 2.8, dc + 3, 0, 5.2, sz0 - .2, sz0, '#F5B928'); });
  plainSign('سكشن الورش', 9, 1.1, sx0 + 2 * sw, 9.2, sz0 - .3, Math.PI, { bg: '#0f4a3a', border: '#e8c35a', glow: true });
  // yard props by the workshops: steel plates, pipe stack, gas bottles
  { const x = 170, z = 79; for (let k = 0; k < 5; k++) S.box(x - 1.3, x + 1.3, k * .12, k * .12 + .1, z - 2.2, z + 2.2, k % 2 ? '#7c8790' : '#6a747d'); col(x - 1.3, x + 1.3, z - 2.2, z + 2.2, .7); }
  for (let i = 0; i < 6; i++) S.cyl(.18, 1.4, 206.5 + .45 * i, .7, 81.6, i % 2 ? '#2f6b4f' : '#c9302a');

  // ---------------------------------------------------------------- the garden island in the middle of the yard: lawn, low hedge, fountain
  { const [cx, cz, R] = Y.island; S.cyl(R, .35, cx, .18, cz, '#cfc6b4', 28); S.cyl(R - .5, .38, cx, .2, cz, '#5f8f46', 28);
    S.cyl(2.6, .55, cx, .3, cz, '#cfc6b4', 18); S.cyl(2.2, .57, cx, .32, cz, '#3f7fb0', 18); S.cyl(.25, 1.8, cx, .9, cz, '#e7e2d5', 8);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; tree(cx + Math.cos(a) * (R - 1.6), cz + Math.sin(a) * (R - 1.6), .7); }
    col(cx - R, cx + R, cz - R, cz + R, .6); }
  // benches along the sides of the yard
  const bench = (x, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry); S.xf(NI.box, x, .45, z, 1.8, .08, .45, ry, '#8a5a32'); S.xf(NI.box, x - s * .2, .75, z - c * .2, 1.8, .45, .06, ry, '#8a5a32'); S.xf(NI.box, x, .22, z, 1.6, .44, .3, ry, '#4a4f55'); col(x - 1, x + 1, z - 1, z + 1, .8); };
  [[167.5, 45, -Math.PI / 2], [167.5, 60, -Math.PI / 2], [270.5, 45, Math.PI / 2], [270.5, 60, Math.PI / 2]].forEach(([x, z, ry]) => bench(x, z, ry));
  // flag in front of the theory building
  if (flag) flag(258, 80, 9);

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
  plainSign('الحوش · المبنى النظري · الورش', 7, .7, (mainG[0] + mainG[1]) / 2, 3.4, gz0 + .1, 0, { bg: '#20334D', border: '#e8c35a' });
  // gate kiosk with a guard; barrier arm (raised) at the exit gate
  { const kx = 255, kz = 20; S.box(kx - 1.3, kx + 1.3, 0, 2.6, kz - 1.1, kz + 1.1, '#efe7d6'); S.box(kx - 1.5, kx + 1.5, 2.6, 2.9, kz - 1.3, kz + 1.3, TOP); S.box(kx - 1.32, kx + 1.32, 1.1, 2, kz - 1.12, kz - .9, '#2f4a62'); col(kx - 1.3, kx + 1.3, kz - 1.1, kz + 1.1, 2.6);
    if (person) person({ shirt: '#2d3b4f', pants: '#2d3b4f', skin: '#8f6446', cap: '#24303f' }, kx + 2, kz - .4, Math.PI); out.kiosk = [kx, kz]; }
  { const z = gz0 + .9, x = exitG[1] + .1; S.box(x, x + .3, 0, 1.1, z - .15, z + .15, '#d9483b'); for (let i = 0; i < 6; i++) S.box(x, x + .1, 1.1 + i * .9, 1.1 + (i + 1) * .9, z - .05, z + .05, i % 2 ? '#ffffff' : '#d9483b'); }

  // ---------------------------------------------------------------- trees along the walls, lamps round the yard
  for (let z = 22; z < TC.Z1 - 4; z += 9) { tree(TC.X0 + 2.4, z, .95); tree(TC.X1 - 2.4, z, .95); }
  for (let x = TC.X0 + 6; x < TC.X1 - 4; x += 9) tree(x, TC.Z1 - 1.6, .85);
  if (lampsList) [[166.5, 30], [166.5, 66], [271.5, 30], [271.5, 66], [200, 79.5], [228, 79.5]].forEach(([x, z]) => lampsList.push([x, z, Math.PI / 2]));

  // trainees and staff crossing the yard (added to the walkers after load), a few standing in groups
  out.walks = [['x', 79.6, 172, 262], ['z', 168.5, 22, 76], ['z', 269.5, 22, 76], ['x', 21, 180, 238]];
  if (person) [[200, 80, 0], [201.5, 80.4, Math.PI], [240, 79.8, .4], [252, 80, Math.PI / 2], [253, 80.6, -Math.PI / 2], [184, 80, 1.2]].forEach(([x, z, ry], i) =>
    person(i % 3 === 2 ? { shirt: '#f4f1ea', pants: '#3b4a63', skin: '#8a5a3b' } : { shirt: '#1f4f86', pants: '#1f4f86', skin: i % 2 ? '#b07a55' : '#8f6446', cap: i % 2 ? null : '#f2c218' }, x, z, ry));

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
  return out;
}
