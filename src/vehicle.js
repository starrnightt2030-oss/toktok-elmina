// Tuk-tuk driving: a Rapier ray-cast vehicle (suspension per wheel, engine, gears,
// handbrake drift) with an arcade fallback when WebAssembly is unavailable.
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const TUNING = {
  mass: 380,
  vmax: 35 / 3.6,          // m/s, normal top speed
  vmaxTurbo: 55 / 3.6,
  vmaxRev: 12 / 3.6,
  force: 1250,             // N at the rear axle, low speed
  forceTurbo: 1900,
  brake: 12,
  coastBrake: 0.35,
  steerMax: 0.62,          // rad at walking pace
  steerMin: 0.16,          // rad at top speed
  gears: [0, 13, 25],      // km/h where gears 1, 2, 3 start
  fuelPerMeter: 100 / 12000,   // full tank ~ 12 km
  fuelIdlePerSec: 0.004,
};

const WHEELS = [
  { x: 0, z: -1.05, front: true },
  { x: -0.62, z: 0.88 },
  { x: 0.62, z: 0.88 },
];
const CONN_Y = 0.50, REST = 0.32, RADIUS = 0.25;

export async function createVehicle({ RAPIER, colliders, traffic, spawn }) {
  const car = {
    x: spawn.x, z: spawn.z, h: spawn.h, y: 0,
    vx: 0, vz: 0, v: 0, lat: 0,
    steer: 0, steerAng: 0, wheelRot: [0, 0, 0], susp: [REST, REST, REST],
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
    const t = clamp(speedAbs / TUNING.vmaxTurbo, 0, 1);
    car.steerAng = car.steer * lerp(TUNING.steerMax, TUNING.steerMin, t);
    // automatic 3-speed box, rpm for the engine sound
    const kmh = speedAbs * 3.6;
    let g = 1; for (let i = 0; i < TUNING.gears.length; i++) if (kmh >= TUNING.gears[i]) g = i + 1;
    if (car.v < -0.3) g = 0;
    car.gear = g;
    const lo = g <= 1 ? 0 : TUNING.gears[g - 1], hi = g === 0 ? 12 : (TUNING.gears[g] || 58);
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
      .setRotation(rot).setLinearDamping(0.04).setAngularDamping(0.9).setCcdEnabled(true).setCanSleep(false));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.62, 0.45, 1.33).setTranslation(0, 0.95, 0)
      .setMassProperties(TUNING.mass, { x: 0, y: 0.5, z: 0.15 }, { x: 300, y: 280, z: 130 }, { w: 1, x: 0, y: 0, z: 0 })
      .setFriction(0.25).setRestitution(0.2), body);
    const veh = world.createVehicleController(body);
    veh.indexUpAxis = 1; veh.setIndexForwardAxis = 2;
    WHEELS.forEach((w, i) => {
      veh.addWheel({ x: w.x, y: CONN_Y, z: w.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, RADIUS);
      veh.setWheelSuspensionStiffness(i, 40);
      veh.setWheelSuspensionCompression(i, 2.4);
      veh.setWheelSuspensionRelaxation(i, 3.0);
      veh.setWheelMaxSuspensionTravel(i, 0.18);
      veh.setWheelMaxSuspensionForce(i, 9000);
      veh.setWheelFrictionSlip(i, w.front ? 2.6 : 2.3);
      veh.setWheelSideFrictionStiffness(i, 1.0);
    });

    // moving traffic as kinematic boxes
    const SIZE = { sedan: [0.9, 0.8, 2.2, 0], taxi: [0.9, 0.8, 2.2, 0], micro: [1.0, 1.2, 2.65, 0], tuk: [0.68, 1.0, 1.35, 0], truck: [1.25, 1.95, 7.45, -0.25], bus: [1.25, 1.55, 5.2, 0] };
    for (const c of traffic) {
      const s = SIZE[c.kind] || SIZE.sedan;
      c.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(c.x, 0, c.z));
      world.createCollider(RAPIER.ColliderDesc.cuboid(s[0], s[1], s[2]).setTranslation(0, s[1] + 0.05, s[3]).setFriction(0.4), c.body);
    }

    const STEP = 1 / 60;
    let acc = 0, prevV = new THREE.Vector3(), flipT = 0;

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
          if (vF < -0.4) brake = TUNING.brake;      // rolling back: brake first
          else {
            const vmax = boost ? TUNING.vmaxTurbo : TUNING.vmax;
            const f = boost ? TUNING.forceTurbo : TUNING.force;
            F = f * Math.pow(clamp(1 - vF / vmax, 0, 1), 0.55);
          }
        }
        if (input.down) {
          if (vF > 0.6) brake = TUNING.brake;          // brake while rolling forward
          else F = -TUNING.force * 0.55 * clamp(1 - (-vF) / TUNING.vmaxRev, 0, 1);
        }
        if (!thr && !input.down) brake = TUNING.coastBrake;
        car.braking = brake >= TUNING.brake;
        // engine drives the rear axle; our forward is -Z so the force is negated
        veh.setWheelEngineForce(1, -F / 2); veh.setWheelEngineForce(2, -F / 2);
        veh.setWheelSteering(0, car.steerAng);
        const hand = input.drift && Math.abs(vF) > 3;
        for (let i = 0; i < 3; i++) veh.setWheelBrake(i, brake * (i === 0 ? 0.6 : 1) + (hand && i > 0 ? 2.2 : 0));
        veh.setWheelFrictionSlip(1, hand ? 0.75 : 2.3); veh.setWheelFrictionSlip(2, hand ? 0.75 : 2.3);
        veh.updateVehicle(STEP);
        // keep the three-wheeler from tipping over: gentle righting torque past ~20 degrees
        up.set(0, 1, 0).applyQuaternion(q);
        right.set(1, 0, 0).applyQuaternion(q);
        const roll = Math.asin(clamp(right.y, -1, 1));
        if (Math.abs(roll) > 0.33) body.applyTorqueImpulse({ x: fwd.x * roll * 30, y: 0, z: fwd.z * roll * 30 }, true);
        world.step();
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
      for (let i = 0; i < 3; i++) { car.wheelRot[i] -= car.v * dt / RADIUS; car.susp[i] = veh.wheelSuspensionLength(i) ?? REST; }
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
      const MAXF = boost ? TUNING.vmaxTurbo : TUNING.vmax;
      let a = 0;
      if (thr) a = vl < -0.3 ? 11 : (boost ? 6 : 3.6) * Math.max(0, 1 - vl / MAXF) + 0.2;
      if (input.down) a = vl > 0.6 ? -11 : -3 * (1 + vl / TUNING.vmaxRev);
      const drag = (0.5 + 0.012 * vl * vl) * Math.sign(vl); a -= (thr || input.down) ? drag * 0.45 : drag * 1.5;
      let nv = vl + a * dt; if (!thr && !input.down && vl !== 0 && Math.sign(nv) !== Math.sign(vl)) nv = 0;
      vl = clamp(nv, -TUNING.vmaxRev, MAXF + 1);
      common(dt, input, st, fuelOk, Math.abs(vl));
      const yaw = vl * Math.tan(car.steerAng) / 1.93 * (input.drift ? 1.5 : 1); car.h += yaw * dt;
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
      for (let i = 0; i < 3; i++) car.wheelRot[i] -= vl * dt / RADIUS;
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
export function syncModel(tuk, nodes, car) {
  tuk.position.set(car.x, car.mode === 'physics' ? car.y : 0, car.z);
  tuk.quaternion.copy(car.quat);
  if (nodes.steer) nodes.steer.rotation.y = car.steerAng;
  if (nodes.steer) nodes.steer.position.y = (CONN_Y - car.susp[0]) - RADIUS;
  if (nodes.wf) nodes.wf.rotation.x = car.wheelRot[0];
  if (nodes.wl) { nodes.wl.rotation.x = car.wheelRot[1]; nodes.wl.position.y = CONN_Y - car.susp[1]; }
  if (nodes.wr) { nodes.wr.rotation.x = car.wheelRot[2]; nodes.wr.position.y = CONN_Y - car.susp[2]; }
}
