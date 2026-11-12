// Wardian district — the first playable Egyptian neighbourhood (Phase 3 vertical slice).
//
// It sits west of the port, at the end of the port avenue (world x -450..-300, z 0..215, about 150×210 m).
// Streets (names are fictional on purpose — no real street name is put on an invented road):
//   - main street   x = -375, from the avenue (z 0) south to a small square at z 185..205
//   - west street   x = -440, from the avenue to the cross street
//   - cross street  z = 120, from x -445 east to the city street at x -250 (second way in/out, no dead ends)
// Everything here is built by this file. main.js only calls the three hooks:
//   wardianGraph(edge)       road graph + GPS (before the world is built)
//   buildWardian(ctx)        ground, buildings, shops, street details, colliders (inside buildWorld)
//   buildWardianLate(ctx)    parked cars and walkers (needs the vehicle models, runs before physics starts)
// Future streaming: the slice lives inside the 200×200 m cells (ix -3..-2, iz 0..1) of WD.cell(); nothing is streamed yet.

export const WD = {
  x0: -450, x1: -300, z0: -16, z1: 215,
  MAIN_X: -375, WEST_X: -440, CROSS_Z: 120,
  cell: (x, z) => [Math.floor(x / 200), Math.floor(z / 200)],
  contains: (x, z) => x < -300 && x > -450 && z > -16 && z < 215,
};

export const WARDIAN_POI = {
  wshops: { n: 'سوق الورديان', x: -377.5, z: 62, sx: -4.6, sz: 0, area: 'wardian' },
  wplaza: { n: 'ساحة الورديان', x: -375, z: 199, sx: 0, sz: 6.4, area: 'wardian' },
};

/** openings the avenue needs in its south kerb and in the median, where the Wardian streets join it */
export const WARDIAN_GAPS = [[-380, -370], [-445, -435]];

export function wardianGraph(edge) {
  edge([-290, 0], [-375, 0], 'ave'); edge([-375, 0], [-440, 0], 'ave');
  edge([-375, 0], [-375, 120], 'st'); edge([-375, 120], [-375, 195], 'st');
  edge([-440, 0], [-440, 120], 'st'); edge([-440, 120], [-375, 120], 'st'); edge([-375, 120], [-250, 120], 'st');
}

/** world limits around the district (replace the old west wall at x = -298) */
export function wardianBounds(col) {
  col(-900, -450, -900, 900, 0);        // far west
  col(-450, -298, -900, -16.5, 0);      // port side, north of the avenue
  col(-450, -298, 215, 900, 0);         // south of the square
}

export const WARDIAN_AREA_TALK = [
  'الورديان حتة شعبية جدعة، الناس هنا بتعرف بعض بالاسم',
  'السوق ده فيه كل حاجة يا اسطى، من الإبرة للصاروخ',
  'خلي بالك من المطبات هنا، الشارع زحمة على طول',
  'القهوة اللي على الناصية دي قعدتها حلوة بالليل',
];

// ------------------------------------------------------------------ helpers
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const BAY = 3.6, FLOOR = 3, GF = 4.5;   // bay width, floor height, ground floor height (metres)

export function buildWardian(ctx) {
  const { T, scene, S, Merger, NI, VC, col, ctex, rep, texStreet, texAsph, texPave, AR, GAMEF, lampsList, plainSign } = ctx;
  const R = rng(20261112), rr = (a, b) => a + R() * (b - a), rp = a => a[(R() * a.length) | 0];
  const out = { shops: [], buildings: [], meshes: [] };

  // ---------------------------------------------------------------- textures (drawn once)
  const tex = (w, h, draw) => { const t = ctex(w, h, draw); t.anisotropy = 4; return t; };
  const stain = (g, w, h, n, col, a) => { for (let i = 0; i < n; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
  const noise = (g, w, h, n, cols, s) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; const z = R() * s + .5; g.fillRect(R() * w, R() * h, z, z); } };
  // each facade texture = 2 bays × 2 floors (512 px = 7.2 m wide, 512 px = 6 m tall)
  const cells = (fn) => { for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) fn(c * 256, r * 256, c + r * 2); };
  const facOld = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#efe0bd'; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, ['#e3d2aa', '#f6e9c8', '#d8c59c'], 2.5);
    stain(g, w, h, 16, 'rgba(90,70,45,A)', .28); stain(g, w, h, 8, 'rgba(255,255,255,A)', .25);
    cells((x, y, k) => {
      g.fillStyle = 'rgba(255,250,235,.55)'; g.fillRect(x, y + 238, 256, 18);   // floor cornice
      g.fillStyle = 'rgba(120,95,60,.35)'; g.fillRect(x, y + 254, 256, 2);
      const wx = x + 80, wy = y + 52, ww = 96, wh = 150;
      g.fillStyle = '#d9c49b'; g.fillRect(wx - 12, wy - 16, ww + 24, wh + 26);  // surround
      g.fillStyle = '#2a241d'; g.fillRect(wx, wy, ww, wh);
      const open = k === 1 ? .55 : (k === 2 ? .2 : 0);
      [[wx, 1], [wx + ww / 2, -1]].forEach(([sx, dir]) => {     // green wooden shutters, slatted
        const sw = ww / 2 * (1 - open); const x0 = dir > 0 ? sx : sx + ww / 2 - sw;
        g.fillStyle = '#3f6b4f'; g.fillRect(x0, wy, sw, wh); g.fillStyle = 'rgba(0,0,0,.28)'; for (let s = wy + 6; s < wy + wh; s += 9) g.fillRect(x0 + 3, s, sw - 6, 3);
      });
      g.strokeStyle = 'rgba(60,45,30,.5)'; g.lineWidth = 1.4; g.beginPath(); let cx = x + 20 + R() * 200, cy = y + 10; g.moveTo(cx, cy); for (let i = 0; i < 6; i++) { cx += (R() - .5) * 30; cy += 12 + R() * 18; g.lineTo(cx, cy); } g.stroke();
    });
  });
  const facBalc = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#f4efe6'; g.fillRect(0, 0, w, h); noise(g, w, h, 3000, ['#ebe4d8', '#faf6ef', '#e2dacb'], 2); stain(g, w, h, 8, 'rgba(80,70,60,A)', .16);
    cells((x, y, k) => {
      const dx = x + 70, dy = y + 40, dw = 116, dh = 196;   // balcony door to the floor line
      g.fillStyle = '#7a5434'; g.fillRect(dx - 6, dy - 6, dw + 12, dh + 6);
      g.fillStyle = k === 3 ? '#41566a' : '#24303b'; g.fillRect(dx, dy, dw, dh);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(dx + 6, dy + 6, dw / 2 - 9, dh - 12);
      g.fillStyle = '#7a5434'; g.fillRect(dx + dw / 2 - 3, dy, 6, dh);
      if (k === 0 || k === 2) { g.fillStyle = 'rgba(205,90,60,.85)'; g.fillRect(dx - 10, dy - 22, dw + 20, 16); }   // sun blind
      g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x, y + 244, 256, 12);
    });
  });
  const facBrick = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#a4553d'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 14) for (let x = -((y / 14) % 2) * 15; x < w; x += 30) { const v = R(); g.fillStyle = v < .33 ? '#b4644a' : (v < .66 ? '#984a34' : '#a95b42'); g.fillRect(x + 1, y + 1, 28, 12); }
    noise(g, w, h, 2500, ['rgba(60,30,20,.4)', 'rgba(220,190,170,.25)'], 2);
    cells((x, y, k) => {
      g.fillStyle = '#9b958c'; g.fillRect(x, y + 232, 256, 24); g.fillRect(x, y, 20, 256);   // concrete frame: beam + column
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + 254, 256, 2);
      const wx = x + 78, wy = y + 66, ww = 110, wh = 120;
      g.fillStyle = '#211b18'; g.fillRect(wx, wy, ww, wh);
      if (k !== 3) { g.strokeStyle = '#c9cdd2'; g.lineWidth = 5; g.strokeRect(wx + 3, wy + 3, ww - 6, wh - 6); g.fillStyle = 'rgba(120,160,190,.35)'; g.fillRect(wx + 6, wy + 6, ww - 12, wh - 12); g.fillStyle = '#c9cdd2'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); }
      g.fillStyle = '#8e8a83'; g.fillRect(wx - 6, wy + wh, ww + 12, 8);
    });
  });
  const facNew = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, h); noise(g, w, h, 2000, ['#efe9de', '#fbf8f2'], 2);
    cells((x, y, k) => {
      g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(x, y + 230, 256, 26);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x, y + 226, 256, 6);
      const wx = x + 58, wy = y + 70, ww = 140, wh = 112;
      g.fillStyle = '#c5ccd3'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      const gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#6f97b8'); gr.addColorStop(1, '#2c4a66'); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#c5ccd3'; g.fillRect(wx + ww / 3 - 2, wy, 4, wh); g.fillRect(wx + 2 * ww / 3 - 2, wy, 4, wh);
      if (k === 1) { g.fillStyle = 'rgba(240,230,210,.9)'; g.fillRect(wx, wy, ww / 3, wh); }   // curtain
      g.fillStyle = '#d7dde2'; g.fillRect(wx - 10, wy + wh + 6, ww + 20, 8);
    });
  });
  const FAC = [
    { id: 'old', name: 'عمارة قديمة بواجهة متآكلة', t: facOld, tints: ['#ffffff', '#f3dfc0', '#eadcc8', '#f7e7c4'] },
    { id: 'balc', name: 'عمارة متوسطة ببلكونات', t: facBalc, tints: ['#ffffff', '#ffe0c2', '#e2efe0', '#fde7a6', '#e7dcf0', '#ffd0bf'] },
    { id: 'brick', name: 'عمارة طوب أحمر غير مكتملة', t: facBrick, tints: ['#ffffff', '#f2e3da', '#fff1e6'] },
    { id: 'new', name: 'عمارة أحدث بواجهة مدهونة', t: facNew, tints: ['#ffffff', '#ffe6b8', '#cfe5f0', '#f4cfc2', '#d9ecd0', '#efdcf6'] },
  ];
  // shop atlas: 4×2 shop fronts (512×320 px = 7.2 m × 4.5 m) + a kiosk sign strip
  const SHOPS = [
    { n: 'بقالة الأمانة', kind: 'بقالة', bg: '#1f6b3a', fg: '#fff', inside: 'grocery' },
    { n: 'فرن الهدى', sub: 'عيش بلدي وفينو', kind: 'فرن', bg: '#c4621c', fg: '#fff', inside: 'bakery' },
    { n: 'قهوة المعلم زكي', kind: 'قهوة شعبية', bg: '#6e1f1f', fg: '#ffd98a', inside: 'cafe' },
    { n: 'ورشة أبو حمادة', sub: 'صيانة تكاتك', kind: 'ورشة توكتوك', bg: '#1d4f86', fg: '#fff', inside: 'garage' },
    { n: 'قطع غيار النصر', kind: 'قطع غيار', bg: '#f2c218', fg: '#1a1a1a', inside: 'parts' },
    { n: 'خضار وفاكهة الحاج سعيد', kind: 'خضار', bg: '#2f7a2c', fg: '#fff7c8', inside: 'veg' },
    { n: 'مكوجي الفردوس', kind: 'مكوجي', bg: '#5b2f80', fg: '#fff', inside: 'laundry' },
    { n: 'محل للإيجار', kind: 'مقفول', bg: '#585858', fg: '#f0f0f0', inside: 'closed' },
  ];
  const AW = 2048, AH = 768, CW = 512, CH = 320;
  const atlas = tex(AW, AH, g => {
    g.fillStyle = '#2b2622'; g.fillRect(0, 0, AW, AH);
    SHOPS.forEach((s, i) => {
      const x = (i % 4) * CW, y = Math.floor(i / 4) * CH;
      g.save(); g.beginPath(); g.rect(x, y, CW, CH); g.clip();
      g.fillStyle = '#d8ccb6'; g.fillRect(x, y, CW, CH);
      // interior / shutter
      const ix = x + 26, iy = y + 104, iw = CW - 52, ih = CH - 110;
      if (s.inside === 'closed') { g.fillStyle = '#8d9196'; g.fillRect(ix, iy, iw, ih); g.fillStyle = 'rgba(0,0,0,.22)'; for (let k = iy; k < iy + ih; k += 8) g.fillRect(ix, k, iw, 3); g.fillStyle = '#5b5f63'; g.fillRect(ix + iw / 2 - 30, iy + ih - 16, 60, 10); }
      else {
        g.fillStyle = '#1b1715'; g.fillRect(ix, iy, iw, ih);
        const shelf = (cols, rows) => { for (let r = 0; r < rows; r++) { g.fillStyle = '#5a4430'; g.fillRect(ix + 10, iy + 20 + r * 44 + 30, iw - 20, 5); for (let c = 0; c < 18; c++) { g.fillStyle = cols[(R() * cols.length) | 0]; g.fillRect(ix + 14 + c * 24, iy + 20 + r * 44 + 6, 18, 24); } } };
        if (s.inside === 'grocery') shelf(['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00', '#f5f5f5'], 4);
        if (s.inside === 'parts') shelf(['#9e9e9e', '#616161', '#bdbdbd', '#424242', '#ef6c00'], 4);
        if (s.inside === 'bakery') { g.fillStyle = '#6d4c2f'; g.fillRect(ix, iy + ih - 60, iw, 60); for (let k = 0; k < 22; k++) { g.fillStyle = '#d9a05b'; g.beginPath(); g.ellipse(ix + 20 + (k % 11) * 40, iy + ih - 44 + Math.floor(k / 11) * 22, 17, 9, 0, 0, 7); g.fill(); } g.fillStyle = '#ff9a3c'; g.fillRect(ix + iw - 110, iy + 20, 80, 60); }
        if (s.inside === 'cafe') { for (let k = 0; k < 3; k++) { g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(ix + 80 + k * 150, iy + 30, 14, 0, 7); g.fill(); } g.fillStyle = '#7b5a3a'; g.fillRect(ix + 20, iy + ih - 70, iw - 40, 12); g.fillStyle = '#c8b28a'; g.fillRect(ix + 40, iy + 50, 120, 70); g.fillRect(ix + 280, iy + 50, 120, 70); }
        if (s.inside === 'garage') { g.fillStyle = '#2a2a2a'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(ix + 60, iy + ih - 26 - k * 30, 26, 0, 7); g.fill(); } g.fillStyle = '#c62828'; g.fillRect(ix + iw - 150, iy + 30, 110, 60); g.fillStyle = '#9e9e9e'; for (let k = 0; k < 8; k++) g.fillRect(ix + 140 + k * 22, iy + 30, 6, 50); }
        if (s.inside === 'veg') { const cs = ['#e53935', '#fb8c00', '#7cb342', '#fdd835', '#8e24aa', '#43a047']; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { g.fillStyle = '#8d6e47'; g.fillRect(ix + 10 + c * 76, iy + ih - 110 + r * 56, 68, 48); g.fillStyle = cs[(c + r * 2) % cs.length]; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(ix + 22 + c * 76 + (k % 3) * 20, iy + ih - 102 + r * 56 + Math.floor(k / 3) * 12, 9, 0, 7); g.fill(); } } }
        if (s.inside === 'laundry') { for (let k = 0; k < 9; k++) { g.fillStyle = ['#f5f5f5', '#1e3a5f', '#8d1f1f', '#e0c9a6'][k % 4]; g.fillRect(ix + 20 + k * 48, iy + 30, 36, 80 + (k % 3) * 14); } g.fillStyle = '#9e9e9e'; g.fillRect(ix + 10, iy + 26, iw - 20, 4); }
        g.fillStyle = 'rgba(255,220,150,.12)'; g.fillRect(ix, iy, iw, ih);
        g.fillStyle = '#8d9196'; g.fillRect(ix, iy, iw, 18); g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = iy; k < iy + 18; k += 6) g.fillRect(ix, k, iw, 2);   // rolled-up shutter
      }
      g.fillStyle = '#5d5146'; g.fillRect(x, y + 98, CW, 8); g.fillRect(x, y + 98, 26, CH); g.fillRect(x + CW - 26, y + 98, 26, CH);
      // sign band
      g.fillStyle = s.bg; g.fillRect(x + 8, y + 8, CW - 16, 86); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.strokeRect(x + 12, y + 12, CW - 24, 78);
      g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      let fs = s.sub ? 46 : 54; g.font = fs + 'px ' + GAMEF; while (g.measureText(s.n).width > CW - 60 && fs > 26) { fs -= 2; g.font = fs + 'px ' + GAMEF; }
      g.fillText(s.n, x + CW / 2, y + (s.sub ? 40 : 52));
      if (s.sub) { g.font = '600 22px ' + AR; g.fillText(s.sub, x + CW / 2, y + 76); }
      g.restore();
    });
    // kiosk sign strip
    const x = 0, y = 640; g.fillStyle = '#c62828'; g.fillRect(x, y, 512, 128); g.fillStyle = '#fff'; g.font = '64px ' + GAMEF; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText('كشك السعادة', x + 256, y + 66);
    // painted wall ad strip
    g.fillStyle = '#f3efe4'; g.fillRect(512, 640, 1024, 128); g.fillStyle = '#1d4f86'; g.font = '58px ' + GAMEF; g.fillText('الورديان', 512 + 512, 640 + 66);
  });
  atlas.wrapS = atlas.wrapT = T.ClampToEdgeWrapping;
  const cellUV = i => { const c = i % 4, r = Math.floor(i / 4); return { us: CW / AW, vs: CH / AH, uo: c * CW / AW, vo: 1 - (r + 1) * CH / AH }; };

  // ---------------------------------------------------------------- mergers (a handful of draw calls for the whole district)
  const roadM = new Merger(), asphM = new Merger(), paveM = new Merger(), shopM = new Merger();
  const facM = FAC.map(() => new Merger());
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
  const flat = (M, cx, cz, len, wid, y, ry, color, us, vs) => { _m.compose(_p.set(cx, y, cz), _q.setFromEuler(_e.set(-Math.PI / 2, ry, 0, 'YXZ')), _s.set(len, wid, 1)); M.add(NI.plane, _m, color, us, vs, 0, 0); };

  // ---------------------------------------------------------------- streets
  const ROADS = [   // [x0,x1,z0,z1]
    [-445, -435, 15, 125], [-445, -255, 115, 125], [-380, -370, 15, 185], [-385, -365, 185, 205]];
  const isRoad = (x, z) => ROADS.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]);
  // street surfaces, cut at junctions (junctions get plain asphalt so lane marks do not cross)
  const ns = (x, z0, z1) => flat(roadM, x, (z0 + z1) / 2, z1 - z0, 10, .035, Math.PI / 2, '#ffffff', (z1 - z0) / 16, 1);
  const ew = (z, x0, x1) => flat(roadM, (x0 + x1) / 2, z, x1 - x0, 10, .035, 0, '#ffffff', (x1 - x0) / 16, 1);
  ns(-375, 15, 115); ns(-375, 125, 185); ns(-440, 15, 115); ew(120, -435, -380); ew(120, -370, -255);
  const pad = (x0, x1, z0, z1, y) => flat(asphM, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y || .04, 0, '#ffffff', (x1 - x0) / 8, (z1 - z0) / 8);
  pad(-380, -370, 115, 125); pad(-445, -435, 115, 125); pad(-385, -365, 185, 205);
  pad(-380, -370, 9, 15, .125); pad(-445, -435, 9, 15, .125);   // cut through the avenue's south sidewalk
  // turning island in the square (painted ring + a small collider)
  S.cyl(2.2, .25, -375, .125, 195, '#d8d2c0', 12); S.cyl(1.9, .3, -375, .15, 195, '#4f7d3a', 12); col(-376.6, -373.4, 193.4, 196.6, .5);
  // pavement cells = everything that is not road, in a grid cut at every road edge
  const xs = [-450, -445, -435, -385, -380, -370, -365, -300], zs = [15, 115, 125, 185, 205, 215];
  const paveCells = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
    if (isRoad((x0 + x1) / 2, (z0 + z1) / 2)) continue; paveCells.push([x0, x1, z0, z1]);
  }
  paveCells.push([-300, -255, 109, 115], [-300, -255, 125, 131]);   // sidewalks of the cross street towards the city
  paveCells.forEach(c => flat(paveM, (c[0] + c[1]) / 2, (c[2] + c[3]) / 2, c[1] - c[0], c[3] - c[2], .12, 0, '#ffffff', (c[1] - c[0]) / 4, (c[3] - c[2]) / 4));
  // kerbs: every pavement edge that touches a road, painted yellow/black in 1 m blocks
  const kerbRun = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2)); for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const x0 = ax + (bx - ax) * t0, x1 = ax + (bx - ax) * t1, z0 = az + (bz - az) * t0, z1 = az + (bz - az) * t1; const w = .3; S.box(Math.min(x0, x1) - (ax === bx ? w / 2 : 0), Math.max(x0, x1) + (ax === bx ? w / 2 : 0), 0, .22, Math.min(z0, z1) - (az === bz ? w / 2 : 0), Math.max(z0, z1) + (az === bz ? w / 2 : 0), k % 2 ? '#f2c218' : '#1c1c20'); } };
  const ESP = .05;
  paveCells.forEach(([x0, x1, z0, z1]) => {
    if (z0 > 15.5 && isRoad((x0 + x1) / 2, z0 - ESP)) kerbRun(x0, z0, x1, z0);
    if (isRoad((x0 + x1) / 2, z1 + ESP)) kerbRun(x0, z1, x1, z1);
    if (isRoad(x0 - ESP, (z0 + z1) / 2)) kerbRun(x0, z0, x0, z1);
    if (isRoad(x1 + ESP, (z0 + z1) / 2)) kerbRun(x1, z0, x1, z1);
  });
  // continue the port wall west of the old map edge
  S.box(-450, -300, 0, 3.4, -16.5, -15.5, '#e7ddc8'); S.box(-450, -300, 3.4, 3.7, -16.7, -15.3, '#3b6e8c'); S.box(-450, -300, 0, .6, -16.6, -15.4, '#4c6a6a'); col(-450, -300, -16.5, -15.5, 3.7);

  // ---------------------------------------------------------------- buildings
  const shopSlots = [];   // filled below, named shops assigned afterwards
  function building(x0, x1, z0, z1, front, shopSides) {
    const type = rp(FAC), fi = FAC.indexOf(type), tint = rp(type.tints);
    const floors = type.id === 'new' ? 5 + ((R() * 5) | 0) : (type.id === 'old' ? 3 + ((R() * 3) | 0) : 4 + ((R() * 4) | 0));
    const h = GF + floors * FLOOR, up = h - GF, w = x1 - x0, d = z1 - z0;
    const faces = { s: [(x0 + x1) / 2, z1, w, 0], n: [(x0 + x1) / 2, z0, w, Math.PI], w: [x0, (z0 + z1) / 2, d, -Math.PI / 2], e: [x1, (z0 + z1) / 2, d, Math.PI / 2] };
    const M = facM[fi], uo = R() < .5 ? 0 : .5;
    Object.entries(faces).forEach(([side, [cx, cz, len, ry]]) => {
      M.wall(cx, cz, len, GF, up, ry, tint, len / (2 * BAY), up / (2 * FLOOR), uo, 0);
      const nx = Math.sin(ry), nz = Math.cos(ry), lx = Math.cos(ry), lz = -Math.sin(ry);
      const at = (u, o) => [cx + lx * (u - len / 2) + nx * o, cz + lz * (u - len / 2) + nz * o];
      const street = front.includes(side), bays = Math.floor(len / BAY + .01);
      if (street && shopSides.includes(side)) {   // shop ground floor in 7.2 m units
        let u = 0; while (u + BAY <= len + .01) { const two = u + 2 * BAY <= len + .01; const ww = two ? 2 * BAY : BAY; const [px, pz] = at(u + ww / 2, .02);
          shopSlots.push({ px, pz, ry, ww, side, x: px, z: pz, nx, nz, main: Math.abs(px - (-375)) < 12 }); u += ww; }
      } else {
        M.wall(cx, cz, len, 0, GF, ry, tint, len / (2 * BAY), GF / (2 * FLOOR), uo, .5);
        if (street) { const [px, pz] = at(len / 2 + (bays % 2 ? 0 : BAY / 2), .1); S.xf(NI.box, px, 1.3, pz, 1.5, 2.6, .14, ry, '#33393f'); S.xf(NI.box, px, 2.7, pz, 1.7, .16, .2, ry, '#1f2428'); }   // iron entrance door
      }
      if (!street) return;
      // balconies, ACs, laundry on street faces
      for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
        const u = (b + .5) * BAY; if (u > len - .5) continue; const y = GF + f * FLOOR;
        const balc = type.id === 'balc' || (type.id === 'old' && (b + f) % 3 === 0) || (type.id === 'new' && f % 2 === 1 && b % 2 === 0);
        if (balc) { const [bx, bz] = at(u, .45); S.xf(NI.box, bx, y + .08, bz, 2.7, .16, .9, ry, '#cfc6b6'); const [rx, rz] = at(u, .88); S.xf(NI.box, rx, y + .62, rz, 2.7, .95, .05, ry, type.id === 'old' ? '#2f3a33' : '#3e3a36');
          if (R() < .35) { const [lx2, lz2] = at(u, .8); S.xf(NI.box, lx2, y + 1.95, lz2, 2.5, .02, .02, ry, '#dddddd'); for (let k = 0; k < 4; k++) { const [cxx, czz] = at(u - 1 + k * .65, .8); S.xf(NI.box, cxx, y + 1.62, czz, .38, .6 + R() * .2, .03, ry, rp(['#d84343', '#3c6fb4', '#f2f2f2', '#f2c218', '#7e57c2', '#2e7d32'])); } } }
        if (R() < (type.id === 'new' ? .35 : .18)) { const [ax, az] = at(u + 1.15, .3); S.xf(NI.box, ax, y + 2.1, az, .8, .5, .55, ry, '#ecebe6'); const [gx, gz] = at(u + 1.15, .58); S.xf(NI.box, gx, y + 2.1, gz, .6, .32, .02, ry, '#5c6166'); }
      }
    });
    // roof: slab, parapet, water tanks, dishes, rebar on unfinished brick
    S.box(x0, x1, h - .05, h + .45, z0, z1, type.id === 'brick' ? '#9b958c' : '#c9b99c');
    for (let i = 0; i < 1 + ((R() * 3) | 0); i++) { const tx = rr(x0 + 1.5, x1 - 1.5), tz = rr(z0 + 1.5, z1 - 1.5); S.cyl(.65, 1.3, tx, h + 1.1, tz, rp(['#1d1d1d', '#e8e8e8', '#2f5f8c']), 12); }
    for (let i = 0; i < 1 + ((R() * 2) | 0); i++) { const dx = rr(x0 + 1, x1 - 1), dz = rr(z0 + 1, z1 - 1); S.xf(NI.hemi, dx, h + 1.2, dz, 1.1, .3, 1.1, R() * 6, '#eeeeee', .9); S.box(dx - .04, dx + .04, h + .45, h + 1.1, dz - .04, dz + .04, '#555555'); }
    if (type.id === 'brick') { [[x0 + .3, z0 + .3], [x1 - .3, z0 + .3], [x0 + .3, z1 - .3], [x1 - .3, z1 - .3]].forEach(([cx, cz]) => { S.box(cx - .25, cx + .25, h + .45, h + 1.4, cz - .25, cz + .25, '#9b958c'); for (let k = 0; k < 4; k++) S.box(cx - .2 + (k % 2) * .3, cx - .17 + (k % 2) * .3, h + 1.4, h + 2.3, cz - .2 + (k > 1) * .3, cz - .17 + (k > 1) * .3, '#6b3b26'); }); }
    else if (R() < .4) S.box(x0 + 1, x0 + 4, h + .45, h + 3, z0 + 1, z0 + 4, '#b9ab8f');   // roof room
    col(x0, x1, z0, z1, h);
    out.buildings.push({ type: type.id, floors, x0, x1, z0, z1 });
    return h;
  }
  // blocks: rect, which sides face a street, which sides get shops
  const BLOCKS = [
    { r: [-431, -384, 15.5, 111], front: 'nsew', shops: 'en' },
    { r: [-366, -301, 15.5, 111], front: 'nsw', shops: 'w' },
    { r: [-446, -384, 129, 181], front: 'ne', shops: 'e' },
    { r: [-446, -389, 181, 213], front: 'e', shops: 'e' },
    { r: [-366, -301, 129, 181], front: 'nw', shops: 'w' },
    { r: [-361, -301, 181, 213], front: 'w', shops: 'w' },
  ];
  const bandLots = (a, b) => { const lots = []; let p = a; while (b - p > 6) { let n = 3 + ((R() * 3) | 0), d = n * BAY; if (b - (p + d) < 3 * BAY) d = b - p; lots.push([p, p + d]); p += d; } if (lots.length && b - lots[lots.length - 1][1] > .01) lots[lots.length - 1][1] = b; return lots; };
  BLOCKS.forEach(B => {
    const [x0, x1, z0, z1] = B.r; const two = x1 - x0 > 34; const mid = two ? x0 + Math.round((x1 - x0) / 2 / BAY) * BAY : x1;
    const colsX = two ? [[x0, mid], [mid, x1]] : [[x0, x1]];
    colsX.forEach(([cx0, cx1], ci) => {
      bandLots(z0, z1).forEach(([lz0, lz1], li, arr) => {
        const front = [], shops = [];
        const sides = { n: li === 0, s: li === arr.length - 1, w: ci === 0, e: ci === colsX.length - 1 };
        for (const s of 'nsew') if (sides[s] && B.front.includes(s)) { front.push(s); if (B.shops.includes(s)) shops.push(s); }
        building(cx0 + .2, cx1 - .2, lz0 + .2, lz1 - .2, front, shops);
      });
    });
  });
  // backdrop rows that close the views (west of the west street, south of the square) — facades only, no detail
  const backdrop = (x0, x1, z0, z1, along) => { const lots = bandLots(along === 'z' ? z0 : x0, along === 'z' ? z1 : x1); lots.forEach(([a, b]) => { const t = rp(FAC), M = facM[FAC.indexOf(t)], tint = rp(t.tints), h = GF + (3 + ((R() * 5) | 0)) * FLOOR;
    const r = along === 'z' ? [x0, x1, a + .2, b - .2] : [a + .2, b - .2, z0, z1]; const w = r[1] - r[0], d = r[3] - r[2];
    [[(r[0] + r[1]) / 2, r[3], w, 0], [(r[0] + r[1]) / 2, r[2], w, Math.PI], [r[0], (r[2] + r[3]) / 2, d, -Math.PI / 2], [r[1], (r[2] + r[3]) / 2, d, Math.PI / 2]].forEach(([cx, cz, len, ry]) => M.wall(cx, cz, len, 0, h, ry, tint, len / (2 * BAY), h / (2 * FLOOR), 0, 0));
    S.box(r[0], r[1], h - .05, h + .45, r[2], r[3], '#c9b99c'); if (R() < .6) S.cyl(.65, 1.3, rr(r[0] + 2, r[1] - 2), h + 1.1, rr(r[2] + 2, r[3] - 2), '#1d1d1d', 12); }); };
  backdrop(-476, -451, -12, 215, 'z'); backdrop(-450, -300, 216, 236, 'x');

  // ---------------------------------------------------------------- shops: every named shop once on the main street / corners, the rest random
  const order = shopSlots.map((s, i) => i).sort((a, b) => (shopSlots[b].main - shopSlots[a].main) || (R() - .5));
  // every named shop appears once on the main street; the rest of the frontage mixes closed shutters with
  // at most one repeat of the everyday shops (grocery, veg, parts, ironing) so no sign is seen over and over
  const named = [0, 1, 2, 3, 4, 5, 6], used = {}, extra = [0, 5, 4, 6];
  order.forEach((si, k) => { const s = shopSlots[si]; let kind;
    if (k < named.length) kind = named[k];
    else { const free = extra.filter(e => (used[e] || 0) < 2); kind = (R() < .28 || !free.length) ? 7 : rp(free); }
    used[kind] = (used[kind] || 0) + 1; s.kind = kind; });
  shopSlots.forEach(s => {
    const c = cellUV(s.kind); const half = s.ww < 2 * BAY - .01; shopM.wall(s.px, s.pz, s.ww, 0, GF, s.ry, '#ffffff', half ? c.us / 2 : c.us, c.vs, c.uo + (half ? c.us / 4 : 0), c.vo);
    // awning on some open shops
    if (s.kind !== 7 && R() < .55) { const ax = s.px + s.nx * .7, az = s.pz + s.nz * .7; S.xf(NI.box, ax, 3.15, az, s.ww - .4, .08, 1.4, s.ry, rp(['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a']), -.35); }
    out.shops.push({ name: SHOPS[s.kind].n, kind: SHOPS[s.kind].kind, x: Math.round(s.px), z: Math.round(s.pz), ry: s.ry, nx: s.nx, nz: s.nz, ww: s.ww });
  });

  // ---------------------------------------------------------------- street life & details (visual only, no physics except poles/kiosk)
  const firstOf = k => out.shops.find(s => s.kind === k);
  const front = (s, d, along) => [s.x + s.nx * d - s.nz * (along || 0), s.z + s.nz * d + s.nx * (along || 0)];
  const cafe = firstOf('قهوة شعبية');
  if (cafe) for (let k = -1; k <= 1; k++) { const [tx, tz] = front(cafe, 2.2, k * 2); S.cyl(.38, .05, tx, .78, tz, '#e8e2d2', 12); S.cyl(.05, .7, tx, .4, tz, '#5a5a5a'); [[.7, 0], [-.7, 0]].forEach(([o]) => { const [chx, chz] = [tx - cafe.nz * o, tz + cafe.nx * o]; S.box(chx - .22, chx + .22, .42, .47, chz - .22, chz + .22, '#7a4b2a'); S.box(chx - .22, chx + .22, .47, .95, chz - .22, chz - .18, '#7a4b2a'); }); }
  const veg = firstOf('خضار');
  if (veg) for (let k = -1; k <= 1; k++) { const [cx, cz] = front(veg, 1.2, k * 1.4); S.box(cx - .5, cx + .5, 0, .55, cz - .35, cz + .35, '#8d6e47'); S.box(cx - .45, cx + .45, .55, .7, cz - .3, cz + .3, rp(['#e53935', '#fb8c00', '#7cb342', '#fdd835'])); }
  const shopGarage = firstOf('ورشة توكتوك');
  if (shopGarage) for (let k = 0; k < 4; k++) { const [tx, tz] = front(shopGarage, .9, 3 - k * .25); S.xf(NI.cyl12, tx, .3 + k * .02, tz, .9, .25, .9, 0, '#202020', 0, Math.PI / 2 * (k % 2)); }
  const bakery = firstOf('فرن');
  if (bakery) { const [bx, bz] = front(bakery, .8); S.xf(NI.box, bx, .9, bz, 2.2, .08, .7, bakery.ry, '#7a5434'); for (let k = 0; k < 6; k++) { const [rx, rz] = front(bakery, .8, -0.9 + k * .36); S.cyl(.16, .05, rx, .97, rz, '#d9a05b', 12); } }
  // kiosk at the main crossing (south-east corner of the north-east block)
  S.box(-368.6, -366.6, 0, 2.3, 111.4, 113.6, '#e9e2cf'); S.box(-368.9, -366.3, 2.3, 2.45, 111.1, 113.9, '#c62828'); S.box(-368.62, -366.58, .9, 1.9, 113.55, 113.62, '#2a2622'); col(-368.6, -366.6, 111.4, 113.6, 2.3);
  shopM.wall(-367.6, 113.66, 2.2, 2.45, .55, 0, '#ffffff', .25, 128 / AH, 0, 0);
  // painted name on the wall at the avenue corner
  shopM.wall(-365.86, 30, 9, 6, 1.6, -Math.PI / 2, '#ffffff', .5, 128 / AH, .25, 0);
  // speed bumps, manholes, asphalt patches
  const bump = (cx, cz, alongX) => { for (let k = 0; k < 10; k++) { const t = -4.5 + k; const c = k % 2 ? '#f2c218' : '#202020'; if (alongX) S.box(cx + t - .5, cx + t + .5, .03, .1, cz - .45, cz + .45, c); else S.box(cx - .45, cx + .45, .03, .1, cz + t - .5, cz + t + .5, c); } };
  bump(-375, 45, true); bump(-375, 150, true); bump(-330, 120, false); bump(-440, 70, true);
  [[-373, 30], [-377, 92], [-373.5, 170], [-410, 121.5], [-300, 118.5], [-441, 50], [-380, 200]].forEach(([x, z]) => { S.cyl(.42, .02, x, .05, z, '#34343a', 12); S.cyl(.34, .022, x, .051, z, '#52525a', 12); });
  for (let i = 0; i < 14; i++) { const onMain = R() < .6; const x = onMain ? rr(-379, -371) : rr(-430, -270), z = onMain ? rr(18, 182) : rr(116, 124); const w = rr(.8, 2.4), d = rr(.6, 1.8); S.box(x - w / 2, x + w / 2, .036, .045, z - d / 2, z + d / 2, rp(['#2c2c32', '#3a3a42', '#55555e'])); }
  // concrete electricity poles with sagging wires
  const poles = [];
  for (let z = 24; z <= 180; z += 26) poles.push([-367.5, z]);
  for (let x = -430; x <= -265; x += 26) if (!isRoad(x, 127.3) && Math.abs(x + 375) > 7) poles.push([x, 127.3]);
  poles.forEach(([x, z]) => { S.box(x - .14, x + .14, 0, 8.6, z - .14, z + .14, '#a9a59c'); S.box(x - .9, x + .9, 8.1, 8.25, z - .06, z + .06, '#8f8b82'); col(x - .2, x + .2, z - .2, z + .2, 8); });
  const _a = new T.Vector3(), _b = new T.Vector3();
  const wire = (ax, ay, az, bx, by, bz, sag) => { const n = 4; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; const y0 = ay + (by - ay) * t0 - sag * 4 * t0 * (1 - t0), y1 = ay + (by - ay) * t1 - sag * 4 * t1 * (1 - t1); _a.set(ax + (bx - ax) * t0, y0, az + (bz - az) * t0); _b.set(ax + (bx - ax) * t1, y1, az + (bz - az) * t1); S.beam(_a, _b, .03, '#1a1a1a'); } };
  const runWires = list => { for (let i = 0; i < list.length - 1; i++) { const [ax, az] = list[i], [bx, bz] = list[i + 1]; [-.75, .75].forEach(o => { const ox = ax === bx ? o : 0, oz = ax === bx ? 0 : o; wire(ax + ox, 8.2, az + oz, bx + ox, 8.2, bz + oz, .55); }); } };
  runWires(poles.filter(p => p[0] === -367.5)); runWires(poles.filter(p => p[1] === 127.3));
  poles.filter(p => p[0] === -367.5).forEach(([x, z], i) => { if (i % 2) wire(x, 8.1, z, -384, 10 + i, z + rr(-3, 3), .8); });   // wires over the street to the houses
  // traffic signs
  const sign = (x, z, ry, face, ring) => { S.box(x - .05, x + .05, 0, 2.5, z - .05, z + .05, '#8a8f94'); S.xf(NI.cyl12, x + Math.sin(ry) * .06, 2.55, z + Math.cos(ry) * .06, .7, .04, .7, ry, ring, Math.PI / 2); S.xf(NI.cyl12, x + Math.sin(ry) * .09, 2.55, z + Math.cos(ry) * .09, .52, .04, .52, ry, face, Math.PI / 2); };
  sign(-381.5, 108, 0, '#ffffff', '#c62828'); sign(-368.5, 132, Math.PI, '#ffffff', '#c62828'); sign(-381.5, 30, Math.PI, '#1565c0', '#c62828'); sign(-433.5, 108, 0, '#ffffff', '#c62828');
  // bins
  [[-382.7, 70], [-367.6, 95], [-382.5, 140], [-433.6, 40], [-362, 203]].forEach(([x, z]) => { S.box(x - .5, x + .5, 0, 1.15, z - .4, z + .4, '#2e6b3a'); S.box(x - .55, x + .55, 1.15, 1.25, z - .45, z + .45, '#245530'); });
  // lamps (the shared instanced street lamps)
  for (let z = 30; z <= 180; z += 30) if (z !== 120) lampsList.push([-382.2, z, Math.PI / 2]);
  for (let x = -420; x <= -270; x += 32) lampsList.push([x, 112.8, 0]);
  for (let x = -436; x <= -306; x += 26) { if (Math.abs(x + 440) > 8 && Math.abs(x + 375) > 8) lampsList.push([x, 10.2, Math.PI]); lampsList.push([x + 13, -10.2, 0]); }
  // direction boards
  plainSign('الورديان', 4.2, 1.1, -368.2, 4.2, 14.6, Math.PI, { bg: '#1e4d7a', glow: true });
  plainSign('الورديان ←', 4.2, 1.1, -262, 4.2, 112, Math.PI / 2, { bg: '#1e4d7a', glow: true });
  { const p = [[-368.2, 14.6], [-262, 112]]; p.forEach(([x, z]) => S.box(x - .08, x + .08, 0, 3.7, z - .08, z + .08, '#6c7178')); }

  // ---------------------------------------------------------------- meshes
  const mk = (M, mat, cast) => { if (!M.p.length) return null; const m = new T.Mesh(M.geo(), mat); m.castShadow = cast; m.receiveShadow = true; m.name = 'wardian'; scene.add(m); out.meshes.push(m); return m; };
  mk(roadM, new T.MeshStandardMaterial({ map: texStreet, roughness: .9 }), false);
  mk(asphM, new T.MeshStandardMaterial({ map: texAsph, roughness: .92 }), false);
  mk(paveM, new T.MeshStandardMaterial({ map: texPave, roughness: .9 }), false);
  FAC.forEach((f, i) => mk(facM[i], new T.MeshStandardMaterial({ map: f.t, vertexColors: true, roughness: .88 }), true));
  mk(shopM, new T.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: .75, emissive: '#ffffff', emissiveMap: atlas, emissiveIntensity: .18 }), false);
  out.facades = FAC.map(f => f.name); out.shopTypes = SHOPS.map(s => s.n + ' (' + s.kind + ')');
  return out;
}

/** parked cars + a tuk-tuk at the workshop + people on the sidewalks. Must run before the physics world is created. */
export function buildWardianLate(ctx, info) {
  const { scene, col, makeTraffic, walkers, personGeo, VC, T } = ctx;
  const R = rng(777), rp = a => a[(R() * a.length) | 0];
  const park = (k, x, z, ry, len) => { const m = makeTraffic(k); m.position.set(x, 0, z); m.rotation.y = ry; m.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(m);
    const along = Math.abs(Math.sin(ry)) > .5; const hl = (len || 4.2) / 2, hw = .95; col(x - (along ? hl : hw), x + (along ? hl : hw), z - (along ? hw : hl), z + (along ? hw : hl), 1.5); return m; };
  park(['sedan', '#8f1f1a'], -371.7, 74, Math.PI); park(['classic', '#d8d2c0'], -371.7, 86, Math.PI); park(['taxi', '#f2c218'], -378.3, 160, 0);
  park(['sedan', '#2e5e8c'], -345, 123.6, -Math.PI / 2); park(['micro', '#f2f2f2'], -318, 116.7, Math.PI / 2, 5);
  park(['classic', '#3d6b4a'], -383, 191, 0);
  const g = info && info.shops.find(s => s.kind === 'ورشة توكتوك');
  if (g) park(['tuk', '#c9302a'], g.x + g.nx * 2.3, g.z + g.nz * 2.3, Math.atan2(g.nx, g.nz), 2.8);
  const looks = [{ shirt: '#e9e2d0', pants: '#e9e2d0', skin: '#8a5a3b', galabeya: true }, { shirt: '#3b2a4a', pants: '#3b2a4a', skin: '#c69472', hijab: '#1f1f2a', galabeya: true }, { shirt: '#2e5e8c', pants: '#2a2a2a', skin: '#b07a55' }, { shirt: '#c9302a', pants: '#2a3550', skin: '#9c6b48' }, { shirt: '#6b2fa0', pants: '#2a2a2a', skin: '#c69472', hijab: '#c9302a' }, { shirt: '#f2c218', pants: '#384a63', skin: '#8f6446' }];
  const paths = [[false, -382.5, 20, 105], [false, -367.8, 25, 100], [false, -367.8, 132, 178], [true, 112.6, -428, -390], [true, 126.2, -360, -280], [false, -432.6, 20, 100], [false, -382.6, 132, 178], [true, 208.5, -386, -364]];
  paths.forEach(([ax, f, a, b]) => { const m = new T.Mesh(personGeo(rp(looks), false), VC); m.castShadow = true; scene.add(m); walkers.push({ m, a, b, f, ax, t: R(), dir: R() < .5 ? 1 : -1, sp: (.9 + R() * .5) / (b - a) }); });
}
