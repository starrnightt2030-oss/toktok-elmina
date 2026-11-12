// Tuk-tuk driving: a Rapier ray-cast vehicle (suspension per wheel, engine, gears,
// handbrake drift) with an arcade fallback when WebAssembly is unavailable.
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const TUNING = {
  mass: 380,
  vmax: 60 / 3.6,          // m/s, normal top speed
  vmaxTurbo: 85 / 3.6,
  vmaxRev: 15 / 3.6,
  force: 2100,             // N at the rear axle, low speed
  forceTurbo: 3000,
  brake: 12,
  coastBrake: 0.35,
  steerMax: 0.62,          // rad at walking pace
  steerMin: 0.09,
  latMax: 20,             // m/s² lateral acceleration the steering allows          // rad at top speed
  gears: [0, 20, 40],      // km/h where gears 1, 2, 3 start
  fuelPerMeter: 100 / 12000,   // full tank ~ 12 km
  fuelIdlePerSec: 0.004,
};


// Per-vehicle geometry and handling. Wheel z is along the body (-Z = forward).
export const SPECS = {
  tuk: {
    wheels: [{ x: 0, z: -1.05, front: true }, { x: -0.62, z: 0.88 }, { x: 0.62, z: 0.88 }],
    drive: [1, 2], conn: 0.50, rest: 0.32, radius: 0.25, base: 1.93, stiffness: 40,
    box: [0.62, 0.45, 1.33, 0.95], com: { x: 0, y: 0.28, z: -0.05 }, inertia: { x: 300, y: 280, z: 160 },
    tuning: {},
  },
  van: {
    wheels: [{ x: -0.58, z: -1.05, front: true }, { x: 0.58, z: -1.05, front: true }, { x: -0.58, z: 1.02 }, { x: 0.58, z: 1.02 }],
    drive: [2, 3], conn: 0.52, rest: 0.32, radius: 0.27, base: 2.07, stiffness: 45,
    box: [0.72, 0.62, 1.7, 1.15], com: { x: 0, y: 0.3, z: 0 }, inertia: { x: 900, y: 1000, z: 380 },
    tuning: { mass: 950, vmax: 75 / 3.6, vmaxTurbo: 100 / 3.6, force: 5600, forceTurbo: 8000, brake: 30, coastBrake: 0.8,
      steerMax: 0.6, gears: [0, 18, 36, 56], fuelPerMeter: 100 / 15000 },
  },
};

export async function createVehicle({ RAPIER, colliders, traffic, spawn, kind = 'tuk' }) {
  const S = SPECS[kind] || SPECS.tuk, TN = Object.assign({}, TUNING, S.tuning), NW = S.wheels.length;
  const car = {
    x: spawn.x, z: spawn.z, h: spawn.h, y: 0,
    vx: 0, vz: 0, v: 0, lat: 0,
    steer: 0, steerAng: 0, wheelRot: S.wheels.map(() => 0), susp: S.wheels.map(() => S.rest), kind, spec: S,
    rpm: 900, gear: 1, boost: false, thr: false, braking: false,
    quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.h),
    mode: RAPIER ? 'physics' : 'arcade',
  };
  let impactCb = () => {};
  const api = { car, onImpact(cb) { impactCb = cb; } };

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const q = new THREE.Quaternion();

  function common(dt, input, st, fuelOk, speedAbs) {
    // smooth steering, tighter at speed
    car.steer += (st - car.steer) * Math.min(1, dt * (st ? 4.5 : 6.5));
    const t = clamp(speedAbs / TN.vmaxTurbo, 0, 1);
    // cap the lateral grip demand so a three-wheeler doesn't tip in fast corners
    const grip = Math.atan(S.base * TN.latMax / Math.max(1, speedAbs * speedAbs));
    car.steerAng = car.steer * Math.min(lerp(TN.steerMax, TN.steerMin, t), Math.max(0.07, grip));
    // automatic 3-speed box, rpm for the engine sound
    const kmh = speedAbs * 3.6;
    let g = 1; for (let i = 0; i < TN.gears.length; i++) if (kmh >= TN.gears[i]) g = i + 1;
    if (car.v < -0.3) g = 0;
    car.gear = g;
    const lo = g <= 1 ? 0 : TN.gears[g - 1], hi = g === 0 ? 12 : (TN.gears[g] || 88);
    const target = (car.thr && fuelOk ? 1500 : 950) + clamp((kmh - lo) / (hi - lo), 0, 1.15) * 4200;
    car.rpm += (target - car.rpm) * Math.min(1, dt * 6);
  }

  // ------------------------------------------------------------------ physics mode
  if (RAPIER) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(2000, 0.5, 2000).setTranslation(0, -0.5, 0).setFriction(1));
    for (const b of colliders) {
      const tall = b.h <= 0.05 ? 4 : Math.max(b.h, 1.2);
      world.createCollider(RAPIER.ColliderDesc.cuboid((b.x1 - b.x0) / 2, tall / 2, (b.z1 - b.z0) / 2)
        .setTranslation((b.x0 + b.x1) / 2, tall / 2, (b.z0 + b.z1) / 2).setFriction(0.3).setRestitution(0.15));
    }
    const rot = { x: 0, y: Math.sin(spawn.h / 2), z: 0, w: Math.cos(spawn.h / 2) };
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, 0.15, spawn.z)
      .setRotation(rot).setLinearDamping(0.04).setAngularDamping(0.9).setCcdEnabled(true).setCanSleep(false)
      // a three-wheeler that never tips over: only yaw is free; body lean is drawn in syncModel
      .enabledRotations(false, true, false));
    world.createCollider(RAPIER.ColliderDesc.cuboid(S.box[0], S.box[1], S.box[2]).setTranslation(0, S.box[3], 0)
      .setMassProperties(TN.mass, S.com, S.inertia, { w: 1, x: 0, y: 0, z: 0 })
      .setFriction(0.25).setRestitution(0.2), body);
    const veh = world.createVehicleController(body);
    veh.indexUpAxis = 1; veh.setIndexForwardAxis = 2;
    S.wheels.forEach((w, i) => {
      veh.addWheel({ x: w.x, y: S.conn, z: w.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, S.rest, S.radius);
      veh.setWheelSuspensionStiffness(i, S.stiffness);
      veh.setWheelSuspensionCompression(i, 2.4);
      veh.setWheelSuspensionRelaxation(i, 3.0);
      veh.setWheelMaxSuspensionTravel(i, 0.18);
      veh.setWheelMaxSuspensionForce(i, 9000);
      veh.setWheelFrictionSlip(i, w.front ? 2.6 : 2.3);
      veh.setWheelSideFrictionStiffness(i, 1.0);
    });

    // moving traffic as kinematic boxes
    const SIZE = { sedan: [0.9, 0.8, 2.2, 0], taxi: [0.9, 0.8, 2.2, 0], micro: [1.0, 1.2, 2.65, 0], tuk: [0.68, 1.0, 1.35, 0], truck: [1.25, 1.95, 7.0, 0], classic: [0.85, 0.75, 2.05, 0], bus: [1.25, 1.55, 5.2, 0] };
    for (const c of traffic) {
      const s = SIZE[c.kind] || SIZE.sedan;
      c.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(c.x, 0, c.z));
      world.createCollider(RAPIER.ColliderDesc.cuboid(s[0], s[1], s[2]).setTranslation(0, s[1] + 0.05, s[3]).setFriction(0.4), c.body);
    }

    const STEP = 1 / 60;
    let acc = 0, prevV = new THREE.Vector3(), flipT = 0, safeT = 0;
    const safe = { x: spawn.x, z: spawn.z, h: spawn.h };

    api.update = (dt, input, fuelOk) => {
      const st = clamp(input.joy + input.steerKey, -1, 1);
      // keep traffic boxes where the traffic meshes are
      for (const c of traffic) {
        if (!c.body) continue;
        c.body.setNextKinematicTranslation({ x: c.m.position.x, y: 0, z: c.m.position.z });
        const a = c.m.rotation.y; c.body.setNextKinematicRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
      }
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        acc -= STEP; steps++;
        const lv = body.linvel();
        const r = body.rotation(); q.set(r.x, r.y, r.z, r.w);
        fwd.set(0, 0, -1).applyQuaternion(q);
        const vF = lv.x * fwd.x + lv.y * fwd.y + lv.z * fwd.z;
        const boost = !!(input.turbo && api.turbo > 0.02 && fuelOk && !input.down);
        const thr = (input.up || boost) && fuelOk;
        car.thr = thr; car.boost = boost;
        let F = 0, brake = 0;
        if (thr) {
          if (vF < -0.4) brake = TN.brake;      // rolling back: brake first
          else {
            const vmax = boost ? TN.vmaxTurbo : TN.vmax;
            const f = boost ? TN.forceTurbo : TN.force;
            F = f * Math.pow(clamp(1 - vF / vmax, 0, 1), 0.55);
          }
        }
        if (input.down) {
          if (vF > 0.6) brake = TN.brake;          // brake while rolling forward
          else F = -TN.force * 0.55 * clamp(1 - (-vF) / TN.vmaxRev, 0, 1);
        }
        if (!thr && !input.down) brake = TN.coastBrake;
        car.braking = brake >= TN.brake;
        // engine drives the rear axle; our forward is -Z so the force is negated
        S.drive.forEach(i => veh.setWheelEngineForce(i, -F / S.drive.length));
        S.wheels.forEach((w, i) => { if (w.front) veh.setWheelSteering(i, car.steerAng); });
        const hand = input.drift && Math.abs(vF) > 3;
        for (let i = 0; i < NW; i++) veh.setWheelBrake(i, brake * (S.wheels[i].front ? 0.6 : 1) + (hand && !S.wheels[i].front ? 2.2 : 0));
        S.drive.forEach(i => veh.setWheelFrictionSlip(i, hand ? 0.75 : 2.3));
        veh.updateVehicle(STEP);
        // keep the three-wheeler from tipping over: gentle righting torque past ~20 degrees
        up.set(0, 1, 0).applyQuaternion(q);
        right.set(1, 0, 0).applyQuaternion(q);
        const roll = Math.asin(clamp(right.y, -1, 1));
        if (Math.abs(roll) > 0.33) body.applyTorqueImpulse({ x: fwd.x * roll * 30, y: 0, z: fwd.z * roll * 30 }, true);
        world.step();
        // never let a shove from traffic launch the tuk-tuk
        {
          const v = body.linvel(); const hs = Math.hypot(v.x, v.z), cap = TN.vmaxTurbo * 1.12;
          const k = hs > cap ? cap / hs : 1;
          if (k < 1 || v.y > 2.5 || v.y < -15) body.setLinvel({ x: v.x * k, y: clamp(v.y, -15, 2.5), z: v.z * k }, true);
          const w = body.angvel(); if (Math.abs(w.y) > 3.5) body.setAngvel({ x: 0, y: clamp(w.y, -3.5, 3.5), z: 0 }, true);
          const p = body.translation();
          if (!(Math.abs(p.y) < 2.2) || !isFinite(p.x) || !isFinite(p.z)) { api.teleport(safe.x, safe.z, safe.h); }
          else if (p.y < 0.4) { safeT += STEP; if (safeT > 1) { safe.x = p.x; safe.z = p.z; safe.h = car.h; safeT = 0; } }
        }
        // collisions felt as a sudden loss of speed
        const nv = body.linvel();
        const dv = Math.hypot(nv.x - lv.x, nv.z - lv.z);
        if (dv > 2.4 && !car.braking) impactCb(dv * 1.6);
      }
      // read back for the rest of the game
      const t = body.translation(), r = body.rotation(), lv = body.linvel();
      car.quat.set(r.x, r.y, r.z, r.w);
      fwd.set(0, 0, -1).applyQuaternion(car.quat); right.set(1, 0, 0).applyQuaternion(car.quat); up.set(0, 1, 0).applyQuaternion(car.quat);
      car.x = t.x; car.y = t.y; car.z = t.z;
      car.h = Math.atan2(-fwd.x, -fwd.z);
      car.vx = lv.x; car.vz = lv.z;
      car.v = lv.x * fwd.x + lv.z * fwd.z;
      car.lat = lv.x * right.x + lv.z * right.z;
      for (let i = 0; i < NW; i++) { car.wheelRot[i] -= car.v * dt / S.radius; car.susp[i] = veh.wheelSuspensionLength(i) ?? S.rest; }
      common(dt, input, st, fuelOk, Math.abs(car.v));
      // flipped for 2 s -> stand it back up
      if (up.y < 0.35) { flipT += dt; if (flipT > 2) { api.teleport(car.x, car.z, car.h); flipT = 0; } } else flipT = 0;
      return Math.hypot(lv.x, lv.z);
    };
    api.teleport = (x, z, h) => {
      body.setTranslation({ x, y: 0.2, z }, true);
      body.setRotation({ x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      car.x = x; car.z = z; car.h = h; car.v = car.vx = car.vz = 0;
      car.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h);
    };
  }

  // ------------------------------------------------------------------ arcade fallback
  else {
    let hitCd = 0;
    api.update = (dt, input, fuelOk) => {
      const st = clamp(input.joy + input.steerKey, -1, 1);
      const fx = -Math.sin(car.h), fz = -Math.cos(car.h), rx = -fz, rz = fx;
      let vl = car.vx * fx + car.vz * fz, vlat = car.vx * rx + car.vz * rz;
      const boost = !!(input.turbo && api.turbo > 0.02 && fuelOk && !input.down);
      const thr = (input.up || boost) && fuelOk;
      const MAXF = boost ? TN.vmaxTurbo : TN.vmax;
      let a = 0;
      if (thr) a = vl < -0.3 ? 11 : (boost ? 6 : 3.6) * Math.max(0, 1 - vl / MAXF) + 0.2;
      if (input.down) a = vl > 0.6 ? -11 : -3 * (1 + vl / TN.vmaxRev);
      const drag = (0.5 + 0.012 * vl * vl) * Math.sign(vl); a -= (thr || input.down) ? drag * 0.45 : drag * 1.5;
      let nv = vl + a * dt; if (!thr && !input.down && vl !== 0 && Math.sign(nv) !== Math.sign(vl)) nv = 0;
      vl = clamp(nv, -TN.vmaxRev, MAXF + 1);
      common(dt, input, st, fuelOk, Math.abs(vl));
      const yaw = vl * Math.tan(car.steerAng) / S.base * (input.drift ? 1.5 : 1); car.h += yaw * dt;
      if (input.drift && Math.abs(vl) > 4) vlat -= yaw * vl * 0.6 * dt;
      vlat *= Math.exp(-(input.drift ? 1.6 : 12) * dt);
      const nfx = -Math.sin(car.h), nfz = -Math.cos(car.h);
      car.vx = nfx * vl - nfz * vlat; car.vz = nfz * vl + nfx * vlat;
      car.x += car.vx * dt; car.z += car.vz * dt; car.v = vl; car.lat = vlat; car.thr = thr; car.boost = boost;
      let imp = 0;
      for (let k = 0; k < 2; k++) {
        const off = k ? 0.88 : -1.0, r = 0.8;
        for (const b of colliders) {
          const cx = car.x + nfx * off, cz = car.z + nfz * off;
          if (cx + r < b.x0 || cx - r > b.x1 || cz + r < b.z0 || cz - r > b.z1) continue;
          const px = clamp(cx, b.x0, b.x1), pz = clamp(cz, b.z0, b.z1); let dx = cx - px, dz = cz - pz; const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          let nx, nz, pen;
          if (d2 < 1e-6) { const l = cx - b.x0, rr = b.x1 - cx, t = cz - b.z0, bb = b.z1 - cz, m = Math.min(l, rr, t, bb);
            if (m === l) { nx = -1; nz = 0; pen = l + r; } else if (m === rr) { nx = 1; nz = 0; pen = rr + r; } else if (m === t) { nx = 0; nz = -1; pen = t + r; } else { nx = 0; nz = 1; pen = bb + r; } }
          else { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
          car.x += nx * pen; car.z += nz * pen;
          const vn = car.vx * nx + car.vz * nz; if (vn < 0) { car.vx -= nx * vn * 1.25; car.vz -= nz * vn * 1.25; car.vx *= 0.7; car.vz *= 0.7; imp = Math.max(imp, -vn); }
        }
      }
      hitCd -= dt; if (imp > 3 && hitCd <= 0) { hitCd = 1; impactCb(imp); }
      for (let i = 0; i < NW; i++) car.wheelRot[i] -= vl * dt / S.radius;
      car.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), car.h);
      q.setFromEuler(new THREE.Euler(clamp(a * 0.004, -0.03, 0.03), 0, clamp(-yaw * vl * 0.012, -0.1, 0.1)));
      car.quat.multiply(q);
      return Math.abs(vl);
    };
    api.teleport = (x, z, h) => { car.x = x; car.z = z; car.h = h; car.v = car.vx = car.vz = 0; };
  }

  api.turbo = 1;
  return api;
}

// Place the GLB nodes from the vehicle state.
const _e = new THREE.Euler(), _lq = new THREE.Quaternion();
export function syncModel(tuk, nodes, car) {
  const S = car.spec || SPECS.tuk;
  tuk.position.set(car.x, car.mode === 'physics' ? car.y : 0, car.z);
  tuk.quaternion.copy(car.quat);
  // body lean in corners and squat under throttle/brake (the physics keeps the chassis upright)
  const lean = clamp(car.steerAng * Math.abs(car.v) * (car.kind === 'van' ? 0.007 : 0.011), -0.07, 0.07);
  car._pitch = (car._pitch || 0) + (((car.braking ? -0.025 : 0) + (car.thr ? 0.015 : 0)) - (car._pitch || 0)) * 0.08;
  _e.set(car._pitch, 0, lean); _lq.setFromEuler(_e); tuk.quaternion.multiply(_lq);
  if (car.kind === 'van') {
    const hub = i => S.conn - car.susp[i];
    for (const [k, i] of [['sfl', 0], ['sfr', 1]]) if (nodes[k]) { nodes[k].rotation.y = car.steerAng; nodes[k].position.y = hub(i); }
    for (const [k, i] of [['wfl', 0], ['wfr', 1], ['wrl', 2], ['wrr', 3]]) if (nodes[k]) nodes[k].rotation.x = car.wheelRot[i];
    if (nodes.wrl) nodes.wrl.position.y = hub(2); if (nodes.wrr) nodes.wrr.position.y = hub(3);
    return;
  }
  if (nodes.steer) nodes.steer.rotation.y = car.steerAng;
  if (nodes.steer) nodes.steer.position.y = (S.conn - car.susp[0]) - S.radius;
  if (nodes.wf) nodes.wf.rotation.x = car.wheelRot[0];
  if (nodes.wl) { nodes.wl.rotation.x = car.wheelRot[1]; nodes.wl.position.y = S.conn - car.susp[1]; }
  if (nodes.wr) { nodes.wr.rotation.x = car.wheelRot[2]; nodes.wr.position.y = S.conn - car.susp[2]; }
}
