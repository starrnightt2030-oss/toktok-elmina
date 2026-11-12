// Offline check of the driving model: acceleration, top speed, braking, turning, roll-over safety.
import RAPIER from '@dimforge/rapier3d-compat';
import { createVehicle } from '../src/vehicle.js';
await RAPIER.init();
const traffic = [];
const veh = await createVehicle({ RAPIER, colliders: [{ x0: 900, x1: 910, z0: -50, z1: 50, h: 3 }], traffic, spawn: { x: 0, z: 0, h: -Math.PI / 2 } });
const c = veh.car; const inp = { up: 0, down: 0, steerKey: 0, joy: 0, drift: 0, turbo: 0 };
let impacts = 0; veh.onImpact(() => impacts++);
const run = (sec, f) => { for (let i = 0; i < sec * 60; i++) { f && f(i / 60); veh.update(1 / 60, inp, true); } };
const kmh = () => (c.v * 3.6).toFixed(1);
const t0 = [];
inp.up = 1; for (let s = 1; s <= 8; s++) { run(1); t0.push(kmh()); }
console.log('accel km/h per second:', t0.join(' '), 'gear', c.gear, 'y', c.y.toFixed(3));
inp.up = 0; inp.turbo = 1; veh.turbo = 1; run(5); console.log('turbo 5s:', kmh());
inp.turbo = 0; inp.down = 1; let bt = 0; while (c.v > 0.3 && bt < 600) { veh.update(1 / 60, inp, true); bt++; } console.log('brake from top to 0 in', (bt / 60).toFixed(2), 's');
run(3); console.log('reverse 3s:', kmh());
inp.down = 0; veh.teleport(0, 0, -Math.PI / 2); inp.up = 1; run(6); inp.steerKey = 1;
let maxRoll = 0; const h0 = c.h; const vs=[]; run(4, (t) => { if (Math.abs(t*4-Math.round(t*4))<1e-6) vs.push(kmh()+'/'+c.y.toFixed(2)); }); console.log('steer speeds', vs.join(' ')); 
console.log('full steer at speed: v', kmh(), 'turned', ((c.h - h0) * 57.3).toFixed(0), 'deg in 4s, up-y quat', c.quat.toArray().map(v => v.toFixed(2)).join(','));
inp.steerKey = 0; veh.teleport(850, 0, -Math.PI / 2); run(14); console.log('into wall: x', c.x.toFixed(1), 'impacts', impacts);
