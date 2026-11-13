// Alexandria Shipyard training centre (Phase 6 C), laid out from the site plan the user supplied
// ("مركز تدريب شركة ترسانة الإسكندرية"). The plan is drawn north-up with the main entrance and the exit gate
// on its south side (الشارع العام) and شارع ترسانة الإسكندرية on its west side.
// In the game the compound stands south of the port avenue, directly across from the shipyard gate (x = 170):
// the plan is turned 180° so the entrance and exit gate face the avenue and the shipyard gate, and the plan's
// west street becomes the city street on the east (x = 250). It fills one city block: x 158–242, z 15.5–110.
// Positions come from the plan's pixels (1 px ≈ 0.118 m) and are fitted to the block (scaled ×0.68 across, ×0.91 deep).

export const TC = { X0: 158, X1: 242, Z0: 15.5, Z1: 110 };
const PX = { x0: 60, x1: 1110, y0: 100, y1: 985 };   // compound edges in plan pixels

export function buildTraining(ctx) {
  const { T, scene, S, Merger, NI, col, ctex, rep, texPave, texConc, AR, GAMEF, plainSign, person, palmsList } = ctx;
  const out = { meshes: [], gates: {}, buildings: [] };
  // plan pixels → world (180° turn)
  const wx = px => TC.X1 - (px - PX.x0) / (PX.x1 - PX.x0) * (TC.X1 - TC.X0);
  const wz = py => TC.Z0 + (PX.y1 - py) / (PX.y1 - PX.y0) * (TC.Z1 - TC.Z0);
  const rect = (x0, x1, y0, y1) => { const a = wx(x0), b = wx(x1), c = wz(y0), d = wz(y1); return [Math.min(a, b), Math.max(a, b), Math.min(c, d), Math.max(c, d)]; };

  // ---------------------------------------------------------------- facade textures
  const facInst = ctex(512, 256, (g, w, h) => {   // admin / classrooms: cream render, long window bands, blue glass
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(' + (Math.random() < .5 ? '90,70,45' : '255,255,255') + ',' + Math.random() * .06 + ')'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    for (let c = 0; c < 4; c++) { const x = c * 128 + 18; g.fillStyle = '#c9b48d'; g.fillRect(x - 6, 58, 104, 140); const gr = g.createLinearGradient(0, 64, 0, 192); gr.addColorStop(0, '#7fa6c7'); gr.addColorStop(1, '#2f5272'); g.fillStyle = gr; g.fillRect(x, 64, 92, 128);
      g.fillStyle = '#e8eef3'; g.fillRect(x + 44, 64, 4, 128); g.fillRect(x, 126, 92, 4); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 6, 68, 30, 120); }
    g.fillStyle = '#20334D'; g.fillRect(0, 236, w, 20); g.fillStyle = '#C87938'; g.fillRect(0, 232, w, 4);
  });
  const facShop = ctex(512, 256, (g, w, h) => {   // workshops: ribbed metal cladding over a block plinth, high windows, roller door
    g.fillStyle = '#b9c1c8'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { g.fillStyle = x % 20 ? '#a9b2ba' : '#c8cfd5'; g.fillRect(x, 0, 6, 170); }
    g.fillStyle = '#8f8a80'; g.fillRect(0, 170, w, 86); for (let y = 170; y < h; y += 16) for (let x = (y / 16 % 2) * 20; x < w; x += 40) { g.strokeStyle = 'rgba(0,0,0,.18)'; g.strokeRect(x, y, 40, 16); }
    for (let c = 0; c < 6; c++) { g.fillStyle = '#2f4a62'; g.fillRect(c * 86 + 10, 26, 64, 30); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(c * 86 + 12, 28, 20, 26); }
    g.fillStyle = '#6f7880'; g.fillRect(190, 96, 132, 160); for (let y = 100; y < 256; y += 8) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(190, y, 132, 2); }
    g.fillStyle = '#F5B928'; g.fillRect(186, 92, 140, 6);
  });
  const facStore = ctex(512, 256, (g, w, h) => {  // storage / services: white two-storey, small windows
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 124, w, 6);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) { g.fillStyle = '#c7d3dd'; g.fillRect(c * 64 + 16, r * 128 + 34, 34, 40); g.fillStyle = '#2f4a62'; g.fillRect(c * 64 + 19, r * 128 + 37, 28, 34); }
  });
  [facInst, facShop, facStore].forEach(t => { t.wrapS = t.wrapT = T.RepeatWrapping; });
  // names atlas: one canvas, one material for every sign on the buildings
  const NAMES = ['ورشة الخراطة', 'ورشة الحدادة', 'ورشة الآلات', 'ورشة التجهيزات', 'ورشة الكهرباء', 'ورشة بدن السفينة', 'ورشة المعادن', 'ورشة النجارة',
    'ورشة اللحام', 'ورشة المواسير', 'ورشة التركيبات', 'صالة متعددة الأغراض', 'ورشة الإلكترونيات والكمبيوتر', 'ورشة النقش', 'البوفية', 'مخازن', 'مبنى الإدارة والفصول النظرية', 'صالة ترقية'];
  const NW = 512, NH = 96, NC = 2, NR = Math.ceil(NAMES.length / NC);
  const names = ctex(NW * NC, NH * NR, g => { NAMES.forEach((n, i) => { const x = (i % NC) * NW, y = Math.floor(i / NC) * NH; g.fillStyle = '#0f4a3a'; g.fillRect(x + 4, y + 6, NW - 8, NH - 12); g.strokeStyle = '#e8c35a'; g.lineWidth = 4; g.strokeRect(x + 8, y + 10, NW - 16, NH - 20);
    g.fillStyle = '#f4f1e6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; let fs = 46; g.font = fs + 'px ' + GAMEF; while (g.measureText(n).width > NW - 40 && fs > 22) { fs -= 2; g.font = fs + 'px ' + GAMEF; } g.fillText(n, x + NW / 2, y + NH / 2 + 2); }); });
  names.wrapS = names.wrapT = T.ClampToEdgeWrapping;
  const nameUV = n => { const i = NAMES.indexOf(n), c = i % NC, r = Math.floor(i / NC); return { us: 1 / NC, vs: 1 / NR, uo: c / NC, vo: 1 - (r + 1) / NR }; };

  const fInst = new Merger(), fShop = new Merger(), fStore = new Merger(), signs = new Merger(), ground = new Merger();
  const FAC = { inst: [fInst, 7.5, 6], shop: [fShop, 12, 8], store: [fStore, 14, 7] };
  // ---------------------------------------------------------------- ground: concrete inside, paved plaza and the inner road
  const [gx0, gx1, gz0, gz1] = [TC.X0, TC.X1, TC.Z0, TC.Z1];
  const flat = (M, x0, x1, z0, z1, y, tile, color) => { const m = new T.Matrix4().compose(new T.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)), new T.Vector3(x1 - x0, z1 - z0, 1)); M.add(NI.plane, m, color || '#ffffff', (x1 - x0) / tile, (z1 - z0) / tile, 0, 0); };
  flat(ground, gx0, gx1, gz0, gz1, .05, 6, '#d8d2c4');
  const pave = new Merger();
  flat(pave, ...rect(225, 475, 870, 985), .07, 4);           // front plaza at the main entrance
  flat(pave, ...rect(930, 1075, 470, 985), .07, 4);          // inner road from the exit gate
  flat(pave, ...rect(560, 960, 470, 530), .07, 4);
  flat(pave, ...rect(330, 820, 130, 330), .065, 4);          // back yard (north part of the plan)
  // green strips along the walls
  const grass = new Merger();
  [[60, 140, 100, 985], [1050, 1110, 100, 985], [60, 1110, 100, 125]].forEach(r => flat(grass, ...rect(...r), .06, 4, '#5f8f46'));

  // ---------------------------------------------------------------- buildings
  function bldg(r, h, kind, roof, nameSides) {
    const [x0, x1, z0, z1] = rect(...r); const [M, tw, th] = FAC[kind];
    const faces = [[(x0 + x1) / 2, z1, x1 - x0, 0], [(x0 + x1) / 2, z0, x1 - x0, Math.PI], [x0, (z0 + z1) / 2, z1 - z0, -Math.PI / 2], [x1, (z0 + z1) / 2, z1 - z0, Math.PI / 2]];
    faces.forEach(([cx, cz, len, ry]) => M.wall(cx, cz, len, 0, h, ry, '#ffffff', len / tw, h / th, 0, 0));
    S.box(x0 - .25, x1 + .25, h, h + .5, z0 - .25, z1 + .25, roof || '#c9c4b8'); S.box(x0 + .3, x1 - .3, h + .5, h + .65, z0 + .3, z1 - .3, '#8f8a80');
    col(x0, x1, z0, z1, h);
    out.buildings.push({ kind, x0, x1, z0, z1, h });
    return [x0, x1, z0, z1];
  }
  const sign = (n, x, z, ry, y, w) => { const uv = nameUV(n); signs.wall(x, z, w, y, w * NH / NW, ry, '#ffffff', uv.us, uv.vs, uv.uo, uv.vo); };
  // admin + theory classrooms (3 floors), front block with the entrance
  bldg([195, 282, 345, 735], 11, 'inst', '#d9a35a');
  bldg([283, 350, 460, 740], 7.5, 'inst', '#cfc6b4');
  const adm = bldg([185, 470, 760, 870], 11.5, 'inst', '#d9a35a');
  // north-west group: engraving, electronics & computer, promotion hall, buffet
  bldg([200, 330, 140, 190], 6, 'shop', '#b8c2c8'); bldg([200, 330, 190, 285], 6, 'inst', '#4caf6a'); bldg([330, 510, 228, 288], 6, 'store', '#e8d9a8'); bldg([218, 325, 295, 338], 5, 'store', '#e8d9a8');
  const mph = bldg([355, 578, 330, 500], 9, 'store', '#e2d6bd');
  bldg([385, 475, 640, 735], 6, 'store', '#cfd6dd');
  // the big workshop block
  const wb = bldg([520, 915, 540, 965], 8, 'shop', '#a7b0b8');
  // storage & services (two-storey), east welding workshops
  bldg([818, 930, 125, 435], 7, 'store', '#b9cfe0'); bldg([945, 1058, 125, 435], 7, 'store', '#b9cfe0');
  bldg([985, 1050, 640, 760], 6, 'shop', '#e3cfa6'); bldg([990, 1078, 770, 930], 6, 'shop', '#e3cfa6');
  // signs: entrance name over the admin block (faces the avenue), workshop rows on the block's courtyard side
  sign('مبنى الإدارة والفصول النظرية', (adm[0] + adm[1]) / 2, adm[2] - .06, Math.PI, 8.4, 14);
  const wbX = wb[1] + .06;   // the plan's west face of the block looks toward the admin building (world east)
  [['ورشة النجارة', 620], ['ورشة المعادن', 668], ['ورشة بدن السفينة', 722], ['ورشة الكهرباء', 775], ['ورشة التجهيزات', 815], ['ورشة الخراطة', 903], ['ورشة الحدادة', 945]].forEach(([n, py]) => sign(n, wbX, wz(py), Math.PI / 2, 5.6, 7));
  [['ورشة اللحام', 668], ['ورشة المواسير', 722], ['ورشة التركيبات', 815], ['ورشة الآلات', 903]].forEach(([n, py]) => sign(n, wb[0] - .06, wz(py), -Math.PI / 2, 5.6, 6.5));
  sign('صالة متعددة الأغراض', (mph[0] + mph[1]) / 2, mph[2] - .06, Math.PI, 7, 9);
  { const r = rect(200, 330, 190, 285); sign('ورشة الإلكترونيات والكمبيوتر', (r[0] + r[1]) / 2, r[2] - .06, Math.PI, 4.4, 8); }
  { const r = rect(200, 330, 140, 190); sign('ورشة النقش', r[1] + .06, (r[2] + r[3]) / 2, Math.PI / 2, 4.4, 4.5); }
  { const r = rect(218, 325, 295, 338); sign('البوفية', (r[0] + r[1]) / 2, r[2] - .06, Math.PI, 3.6, 4); }
  { const r = rect(330, 510, 228, 288); sign('صالة ترقية', (r[0] + r[1]) / 2, r[2] - .06, Math.PI, 4.4, 6); }
  [[818, 930], [945, 1058]].forEach(([a, b]) => { const r = rect(a, b, 125, 435); sign('مخازن', (r[0] + r[1]) / 2, r[2] - .06, Math.PI, 5, 5); });
  // fountain courtyard + planters
  { const cx = wx(413), cz = wz(555); S.cyl(2.2, .5, cx, .3, cz, '#cfc6b4', 16); S.cyl(1.8, .52, cx, .32, cz, '#3f7fb0', 16); S.cyl(.25, 1.6, cx, .8, cz, '#e7e2d5', 8); col(cx - 2.2, cx + 2.2, cz - 2.2, cz + 2.2, .6); }

  // ---------------------------------------------------------------- perimeter wall with its own gates
  const WALL = '#e9dfca', TOP = '#0f4a3a', H = 2.6;
  const mainG = [wx(385), wx(300)].sort((a, b) => a - b), exitG = [wx(1065), wx(995)].sort((a, b) => a - b);
  const runX = (z, a, b) => { S.box(a, b, 0, H, z - .3, z + .3, WALL); S.box(a, b, H, H + .25, z - .38, z + .38, TOP); col(a, b, z - .3, z + .3, H); };
  const runZ = (x, a, b) => { S.box(x - .3, x + .3, 0, H, a, b, WALL); S.box(x - .38, x + .38, H, H + .25, a, b, TOP); col(x - .3, x + .3, a, b, H); };
  // avenue side (plan south) with the main entrance and the exit gate
  [[gx0, exitG[0]], [exitG[1], mainG[0]], [mainG[1], gx1]].forEach(([a, b]) => { if (b - a > .2) runX(gz0, a, b); });
  runX(gz1, gx0, gx1); runZ(gx0, gz0, gz1); runZ(gx1, gz0, gz1);
  // gate pillars + the name over the main entrance
  [mainG[0], mainG[1], exitG[0], exitG[1]].forEach(x => { S.box(x - .5, x + .5, 0, 4.2, gz0 - .5, gz0 + .5, '#efe7d6'); S.box(x - .6, x + .6, 4.2, 4.5, gz0 - .6, gz0 + .6, TOP); col(x - .5, x + .5, gz0 - .5, gz0 + .5, 4.2); });
  plainSign('مركز تدريب شركة ترسانة الإسكندرية', 12, 1.15, (mainG[0] + mainG[1]) / 2, 5.3, gz0 - .1, Math.PI, { bg: '#0f4a3a', border: '#e8c35a', glow: true });
  S.box(mainG[0] - .2, mainG[1] + .2, 4.5, 4.75, gz0 - .25, gz0 + .25, TOP);
  plainSign('بوابة الخروج', 5, .8, (exitG[0] + exitG[1]) / 2, 4.2, gz0 - .1, Math.PI, { bg: '#20334D', border: '#e8c35a' });
  // gate kiosk with a guard, barrier arm at the exit gate
  { const kx = mainG[0] - 2.6, kz = gz0 + 3.2; S.box(kx - 1.3, kx + 1.3, 0, 2.6, kz - 1.1, kz + 1.1, '#efe7d6'); S.box(kx - 1.5, kx + 1.5, 2.6, 2.9, kz - 1.3, kz + 1.3, TOP); S.box(kx - 1.32, kx + 1.32, 1.1, 2, kz - 1.12, kz - .9, '#2f4a62'); col(kx - 1.3, kx + 1.3, kz - 1.1, kz + 1.1, 2.6);
    if (person) person({ shirt: '#2d3b4f', pants: '#2d3b4f', skin: '#8f6446', cap: '#24303f' }, kx + 2, kz - .4, Math.PI); out.kiosk = [kx, kz]; }
  { const z = gz0 + .9; S.box(exitG[0] + .2, exitG[0] + .45, 0, 1.1, z - .12, z + .12, '#d9483b'); for (let i = 0; i < 6; i++) S.box(exitG[0] + .4 + i * (exitG[1] - exitG[0] - .6) / 6, exitG[0] + .4 + (i + 1) * (exitG[1] - exitG[0] - .6) / 6, 1, 1.12, z - .05, z + .05, i % 2 ? '#ffffff' : '#d9483b'); }
  // trees inside the wall (merged trunks + crowns) and palms by the entrance
  const tree = (x, z, s) => { S.cyl(.18 * s, 2.4 * s, x, 1.2 * s, z, '#6b4a2b', 6); S.xf(NI.sph, x, 3 * s, z, 2.6 * s, 2.2 * s, 2.6 * s, 0, Math.random() < .5 ? '#3f6f35' : '#4d7f3c'); };
  for (let py = 160; py < 960; py += 70) { tree(wx(95), wz(py), 1); tree(wx(1085), wz(py), .9); }
  for (let px = 160; px < 1040; px += 90) tree(wx(px), wz(110), .9);
  [[600, 170], [650, 260], [700, 330], [745, 420], [790, 500]].forEach(([px, py]) => tree(wx(px), wz(py), 1.1));
  [[180, 800], [455, 800], [240, 905], [440, 905]].forEach(([px, py]) => palmsList.push([wx(px), wz(py), 7]));

  // ---------------------------------------------------------------- meshes (6 draw calls for the whole compound + the two gate signs)
  const mk = (M, mat, cast) => { if (!M.p.length) return; const m = new T.Mesh(M.geo(), mat); m.castShadow = cast; m.receiveShadow = true; m.name = 'training'; scene.add(m); out.meshes.push(m); };
  mk(ground, new T.MeshStandardMaterial({ map: rep(texConc, 1, 1), vertexColors: true, roughness: .92 }), false);
  mk(pave, new T.MeshStandardMaterial({ map: texPave, roughness: .9 }), false);
  mk(grass, new T.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1 }), false);
  mk(fInst, new T.MeshStandardMaterial({ map: facInst, roughness: .85 }), true);
  mk(fShop, new T.MeshStandardMaterial({ map: facShop, roughness: .7, metalness: .15 }), true);
  mk(fStore, new T.MeshStandardMaterial({ map: facStore, roughness: .85 }), true);
  mk(signs, new T.MeshStandardMaterial({ map: names, roughness: .6, emissive: '#ffffff', emissiveMap: names, emissiveIntensity: .25 }), false);
  out.gates = { main: (mainG[0] + mainG[1]) / 2, exit: (exitG[0] + exitG[1]) / 2 };
  return out;
}
