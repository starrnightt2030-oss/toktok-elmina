// People (Phase 8): rigged, animated figures from public/models/people.glb (built by tools/build_people.py).
// One GLB holds 7 figures (Man, Youth, Worker, Galabeya, Elder, Hijab, Abaya) on the same skeleton and 6 clips
// (Idle, Walk, Wave, Sit, Pay, Drive). Colours are painted per person: each vertex carries a region id
// (skin, hair, top, bottom, shoes, headwear, robe …) and a small palette uniform turns it into that person's clothes.
//
// person(look) returns a Group straight away (the world is built before the model has loaded); the figure is put inside
// it when the GLB arrives. look = { shirt, pants, skin, hair, hijab, cap, helmet, galabeya, variant } as used across the game.
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
const skClone = o => SkeletonUtils.clone(o);

const REG = { SKIN: 0, HAIR: 1, TOP: 2, BOTTOM: 3, SHOES: 4, HEADW: 5, ROBE: 6, DARK: 7, WHITE: 8, LIPS: 9, ACCENT: 10 };
const BONE = /^(Hips|Spine|Chest|Neck|Head|Thigh[LR]|Shin[LR]|Foot[LR]|Shoulder[LR]|UpperArm[LR]|Forearm[LR]|Hand[LR])_\d+$/;

export function createPeople(T) {
  let ready = false, VAR = {}, CLIPS = {};
  const pending = [], live = new Set();
  const tmp = new T.Color(), _w = new T.Vector3();

  /* material: standard PBR with the palette lookup in place of the vertex colour */
  const base = new T.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0, skinning: true });
  function palMaterial(pal) {
    const m = base.clone(); m.userData.pal = pal;
    m.onBeforeCompile = sh => {
      sh.uniforms.uPal = { value: m.userData.pal };
      sh.fragmentShader = 'uniform vec3 uPal[11];\n' + sh.fragmentShader.replace('#include <color_fragment>',
        `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          int rid = int( floor( vColor.r * 16.0 ) );
          vec3 pc = uPal[0];
          for ( int i = 1; i < 11; i ++ ) { if ( i == rid ) pc = uPal[i]; }
          diffuseColor.rgb *= pc;
        #endif`);
    };
    m.customProgramCacheKey = () => 'people-pal';
    return m;
  }
  const C = h => new T.Color(h).convertSRGBToLinear();
  function shade(hex, k) { tmp.set(hex); tmp.multiplyScalar(k); return '#' + tmp.getHexString(); }
  function variantOf(lk) {
    if (lk.variant) return lk.variant;
    if (lk.hijab) return lk.galabeya ? 'Abaya' : 'Hijab';
    if (lk.helmet) return 'Worker';
    if (lk.galabeya) return lk.elder || (lk.cap && lk.cap === '#ffffff') ? 'Elder' : 'Galabeya';
    if (lk.cap) return 'Youth';
    return 'Man';
  }
  function palette(lk, v) {
    const skin = lk.skin || '#9a6b4a';
    const hair = lk.hair || (v === 'Elder' ? '#8a8580' : '#1d1712');
    const top = lk.shirt || '#3f6587', bottom = lk.pants || '#2a3550';
    const headw = lk.hijab || lk.helmet || lk.cap || (v === 'Elder' ? '#f2f0ea' : '#24303f');
    const robe = v === 'Abaya' ? (lk.shirt || '#2a2230') : (lk.shirt || '#e9e2d0');
    const shoes = lk.shoes || (v === 'Galabeya' || v === 'Elder' ? '#5a3e2a' : '#232020');
    return [skin, hair, top, bottom, shoes, headw, robe, '#141414', '#f2efe8', shade(skin, .72), lk.bag || '#6b4a2b'].map(C);
  }

  function build(g) {
    const lk = g.userData.look, v = variantOf(lk), tpl = VAR[v] || VAR.Man;
    const fig = skClone(tpl); fig.position.set(0, 0, 0); fig.rotation.set(0, 0, 0);
    const mat = palMaterial(palette(lk, v));
    fig.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = g.userData.shadow !== false; o.receiveShadow = false;
      /* culled by a sphere round the whole figure (the skinned pose stays inside it) */
      if (!o.geometry.userData.sph) { o.geometry.boundingSphere = new T.Sphere(new T.Vector3(0, .9, 0), 1.25); o.geometry.userData.sph = 1; }
      o.frustumCulled = true; g.userData.mesh = o; } });
    if (lk.scale) fig.scale.setScalar(lk.scale);
    g.add(fig);
    const mixer = new T.AnimationMixer(fig);
    g.userData.fig = fig; g.userData.mixer = mixer; g.userData.acts = {};
    play(g, g.userData.clip || 'Idle', 0);
    live.add(g);
  }
  function play(g, name, fade = .25, once) {
    g.userData.clip = name; const mx = g.userData.mixer; if (!mx) return;
    const A = g.userData.acts; const clip = CLIPS[name]; if (!clip) return;
    let a = A[name]; if (!a) { a = A[name] = mx.clipAction(clip); }
    if (g.userData.cur === a) return;
    a.reset(); a.enabled = true; a.setEffectiveWeight(1);
    if (once) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(T.LoopRepeat, Infinity);
    if (name === 'Idle' || name === 'Walk') a.time = Math.random() * clip.duration;
    a.play();
    if (g.userData.cur && fade > 0) g.userData.cur.crossFadeTo(a, fade, false); else if (g.userData.cur) g.userData.cur.stop();
    g.userData.cur = a;
  }

  return {
    REG,
    /** a person: returns a Group now, the figure arrives when the model is loaded. clip: Idle | Walk | Wave | Sit | Pay | Drive */
    make(look, clip, opts) {
      const g = new T.Group(); g.name = 'person'; g.userData.look = look || {}; g.userData.clip = clip || 'Idle';
      if (opts && opts.shadow === false) g.userData.shadow = false;
      if (ready) build(g); else pending.push(g);
      return g;
    },
    play,
    load(gltf) {
      gltf.scene.traverse(o => { const m = o.name.match(BONE); if (m) o.name = m[1]; });
      for (const n of ['Man', 'Youth', 'Worker', 'Galabeya', 'Elder', 'Hijab', 'Abaya']) { const o = gltf.scene.getObjectByName(n); if (o) VAR[n] = o; }
      for (const c of gltf.animations) { c.tracks.forEach(t => { t.name = t.name.replace(/^([A-Za-z]+)_\d+\./, '$1.'); });
        // keep only bone tracks that exist on every figure; drop scale tracks (none animated)
        c.tracks = c.tracks.filter(t => !/\.scale$/.test(t.name)); CLIPS[c.name] = c; }
      ready = true; pending.splice(0).forEach(build);
    },
    get ready() { return ready; },
    /** advance animations; people far from the camera update less often */
    update(dt, cam, frame) {
      for (const g of live) {
        if (!g.parent) { live.delete(g); g.userData.mixer && g.userData.mixer.stopAllAction(); continue; }
        if (!g.visible) continue;
        g.getWorldPosition(_w); const d = Math.hypot(_w.x - cam.x, _w.z - cam.z);
        /* far people are not drawn, only near ones cast shadows (keeps the frame light on phones) */
        const fig = g.userData.fig, on = d < 120; if (fig.visible !== on) fig.visible = on;
        const m = g.userData.mesh; if (m) { const sh = d < 35 && g.userData.shadow !== false; if (m.castShadow !== sh) m.castShadow = sh; }
        if (!on) continue;
        const k = d < 45 ? 1 : (d < 90 ? 2 : 4);
        g.userData.acc = (g.userData.acc || 0) + dt;
        if ((frame + (g.id % k)) % k === 0) { g.userData.mixer.update(g.userData.acc); g.userData.acc = 0; }
      }
    },
    count() { return live.size; },
  };
}
