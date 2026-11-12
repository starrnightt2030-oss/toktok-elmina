// Turbo from standstill and while turning: the tuk-tuk must stay on its wheels.
import RAPIER from '@dimforge/rapier3d-compat';
import { createVehicle } from '../src/vehicle.js';
await RAPIER.init();
const veh = await createVehicle({ RAPIER, colliders: [], traffic: [], spawn: { x: 0, z: 0, h: 0 } });
const c = veh.car; const inp = { up: 1, down: 0, steerKey: 0, joy: 0, drift: 0, turbo: 1 }; veh.turbo = 1;
let maxY = -9, minUp = 1;
for (let i = 0; i < 600; i++) { if (i > 200) inp.steerKey = i % 240 < 120 ? 1 : -1; veh.update(1 / 60, inp, true); maxY = Math.max(maxY, c.y); }
console.log('turbo: maxY', maxY.toFixed(2), 'speed', (c.v * 3.6).toFixed(0), 'quat', c.quat.toArray().map(v => v.toFixed(2)).join(','));
