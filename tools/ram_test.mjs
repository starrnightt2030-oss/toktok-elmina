import RAPIER from '@dimforge/rapier3d-compat';
import { createVehicle } from '../src/vehicle.js';
import * as THREE from 'three';
await RAPIER.init();
const m = new THREE.Object3D(); m.position.set(20, 0, 0); m.rotation.y = Math.PI / 2; // heading -X toward car
const traffic = [{ kind: 'truck', m, x: 20, z: 0 }];
const veh = await createVehicle({ RAPIER, colliders: [], traffic, spawn: { x: 0, z: 0, h: Math.PI / 2 } });
const c = veh.car; const inp = { up: 0, down: 0, steerKey: 0, joy: 0, drift: 0, turbo: 0 };
let maxY = 0, maxV = 0;
for (let i = 0; i < 300; i++) { m.position.x -= 14 / 60; veh.update(1 / 60, inp, true); maxY = Math.max(maxY, c.y); maxV = Math.max(maxV, Math.hypot(c.vx, c.vz) * 3.6); }
console.log('rammed: maxY', maxY.toFixed(2), 'maxV km/h', maxV.toFixed(0), 'final', c.x.toFixed(1), c.y.toFixed(2), c.z.toFixed(1));
