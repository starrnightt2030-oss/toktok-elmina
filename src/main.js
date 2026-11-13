import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createVehicle, syncModel, TUNING } from './vehicle.js';
import { createVoices } from './voices.js';
import { ls, loadSave, importMainSave, SAVE_KEY, IS_BETA, NS, CHANNEL } from './storage.js';
import { MISSIONS, MODS, REP_LEVELS, repLevel, repProgress, rideXP, LEVEL_REWARD, modOpt } from './career.js';
import { TC, buildTraining } from './districts/training.js';
import { createPeople } from './people.js';
import { WD, WARDIAN_POI, WARDIAN_GAPS, WARDIAN_AREA_TALK, wardianGraph, wardianBounds, buildWardian, buildWardianLate } from './districts/wardian.js';

(async function(){
'use strict';


const loadingText=document.getElementById('loadingText');
const T=THREE,$=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v),rand=(a,b)=>a+Math.random()*(b-a),pick=a=>a[(Math.random()*a.length)|0];
let seed=987654;const sr=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const V=(x,y,z)=>new T.Vector3(x,y,z);
const isTouch=(window.matchMedia&&matchMedia('(pointer: coarse)').matches)||('ontouchstart' in window);
if(isTouch)document.body.classList.add('is-touch');

/* ============ save ============ */
const SAVE_LOAD=loadSave();const save=SAVE_LOAD.save;let saveWritable=SAVE_LOAD.writable;
if(SAVE_LOAD.notes.length)console.warn('[save]',SAVE_LOAD.status,SAVE_LOAD.notes.join(' | '));
if(!save.owned.includes('orange'))save.owned.unshift('orange');if(!save.owned.includes('yellow')){save.owned.unshift('yellow');save.paint='yellow';}
function persist(){if(!saveWritable)return;ls.set(SAVE_KEY,JSON.stringify(save));}

/* ============ renderer ============ */
const canvas=$('game');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){loadingText.textContent='الجهاز ده مش بيدعم WebGL.';return;}
renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
let quality=(()=>{try{const q=localStorage.getItem((IS_BETA?'beta_':'')+'aps_quality');if(q==='low'||q==='med'||q==='high')return q;}catch(_){}return isTouch?'med':'high';})();
function applyPR(){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='high'?2:(quality==='med'?1.3:1)));}
applyPR();
const scene=new T.Scene();const camera=new T.PerspectiveCamera(62,1,.1,2600);let baseFov=62;
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;baseFov=w<h?76:60;camera.fov=baseFov;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
const ANI=Math.min(8,renderer.capabilities.getMaxAnisotropy());

/* ============ textures ============ */
function ctex(w,h,draw,srgb){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;if(srgb!==false)t.encoding=T.sRGBEncoding;t.anisotropy=ANI;return t;}
function rep(t,x,y){const n=t.clone();n.needsUpdate=true;n.repeat.set(x,y);return n;}
function speckle(g,w,h,n,cols,s){for(let i=0;i<n;i++){g.fillStyle=cols[(Math.random()*cols.length)|0];const z=Math.random()*s+.5;g.fillRect(Math.random()*w,Math.random()*h,z,z);}}
function blot(g,w,h,n,cols,a,r0,r1){g.globalAlpha=a;for(let i=0;i<n;i++){g.fillStyle=cols[(Math.random()*cols.length)|0];g.beginPath();g.ellipse(Math.random()*w,Math.random()*h,rand(r0,r1),rand(r0*.5,r1*.5),Math.random()*3,0,7);g.fill();}g.globalAlpha=1;}
const AR='"IBM Plex Sans Arabic","Noto Naskh Arabic",Tahoma,sans-serif',GAMEF='Lalezar,'+AR;

/* asphalt (Phase 6 F): finer aggregate, old patches, hairline cracks and oil stains — same single texture, more life */
const texAsph=ctex(512,512,(g,w,h)=>{g.fillStyle='#484852';g.fillRect(0,0,w,h);speckle(g,w,h,22000,['#3d3d47','#55555f','#4f4f59','#33333b','#5e5e66'],2);
  blot(g,w,h,18,['#2a2a30','#6a6a72'],.08,14,60);
  for(let i=0;i<5;i++){const x=Math.random()*w,y=Math.random()*h,pw=40+Math.random()*90,ph=30+Math.random()*70;g.fillStyle=Math.random()<.5?'rgba(30,30,36,.45)':'rgba(95,95,104,.25)';g.fillRect(x,y,pw,ph);g.strokeStyle='rgba(20,20,24,.5)';g.lineWidth=1.5;g.strokeRect(x,y,pw,ph);}
  g.strokeStyle='rgba(18,18,22,.55)';g.lineCap='round';for(let i=0;i<14;i++){let x=Math.random()*w,y=Math.random()*h;g.lineWidth=.8+Math.random()*1.2;g.beginPath();g.moveTo(x,y);for(let k=0;k<6;k++){x+=(Math.random()-.5)*40;y+=(Math.random()-.5)*40;g.lineTo(x,y);}g.stroke();}
  for(let i=0;i<6;i++){const x=Math.random()*w,y=Math.random()*h,r=8+Math.random()*22;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(15,15,20,.45)');gr.addColorStop(1,'rgba(15,15,20,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}});
/* 8m carriageway, 2 lanes: solid edges, dashed centre */
const texCarr=ctex(512,256,(g,w,h)=>{g.drawImage(texAsph.image,0,0);g.drawImage(texAsph.image,256,0);g.fillStyle='rgba(20,20,24,.22)';[.25,.75].forEach(v=>g.fillRect(0,v*h-10,w,20));
  g.fillStyle='#f0ebdc';g.fillRect(0,6,w,7);g.fillRect(0,h-13,w,7);g.fillRect(0,h/2-4,w*.4,8);});
/* 10m street, one lane each way: yellow edges, white dashes */
const texStreet=ctex(512,256,(g,w,h)=>{g.drawImage(texAsph.image,0,0,512,256,0,0,512,256);g.fillStyle='rgba(20,20,24,.2)';[.27,.73].forEach(v=>g.fillRect(0,v*h-9,w,18));
  g.fillStyle='#e7c23a';g.fillRect(0,8,w,5);g.fillRect(0,h-13,w,5);g.fillStyle='#f0ebdc';g.fillRect(0,h/2-3,w*.45,6);});
const texConc=ctex(512,512,(g,w,h)=>{g.fillStyle='#b4aa9b';g.fillRect(0,0,w,h);speckle(g,w,h,9000,['#a69d8f','#c1b8a8','#9a9285','#bbb2a2'],2.2);blot(g,w,h,30,['#3b3226','#fff','#5a4a32'],.07,20,90);
  g.strokeStyle='rgba(60,52,40,.3)';g.lineWidth=2;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*128,0);g.lineTo(i*128,h);g.stroke();g.beginPath();g.moveTo(0,i*128);g.lineTo(w,i*128);g.stroke();}});
/* sidewalk tiles: the red/grey Alexandrian checker, with worn, cracked and missing tiles */
const texPave=ctex(256,256,(g,w,h)=>{g.fillStyle='#5f5552';g.fillRect(0,0,w,h);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const r=Math.random();
    g.fillStyle=r<.05?'#6b625c':((x+y)%2?(r<.5?'#a1574a':'#99503f'):(r<.5?'#8f8781':'#857d77'));g.fillRect(x*32+1,y*32+1,30,30);
    if(r>.93){g.strokeStyle='rgba(40,30,25,.6)';g.lineWidth=1.2;g.beginPath();g.moveTo(x*32+4,y*32+6+Math.random()*20);g.lineTo(x*32+28,y*32+4+Math.random()*24);g.stroke();}}
  speckle(g,w,h,2400,['rgba(0,0,0,.16)','rgba(255,255,255,.07)','rgba(60,40,20,.12)'],2);blot(g,w,h,6,['#3b3028'],.08,10,30);});
const texCurb=ctex(128,16,(g,w,h)=>{for(let i=0;i<4;i++){g.fillStyle=i%2?'#f2c218':'#1c1c20';g.fillRect(i*32,0,32,h);}});
const texCorr=ctex(256,256,(g,w,h)=>{for(let x=0;x<w;x++){const v=Math.round(255*(.8+.2*Math.sin(x/w*Math.PI*32)));g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(x,0,1,h);}const gr=g.createLinearGradient(0,h*.55,0,h);gr.addColorStop(0,'rgba(90,60,30,0)');gr.addColorStop(1,'rgba(90,60,30,.32)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const texCont=ctex(256,64,(g,w,h)=>{for(let x=0;x<w;x++){const v=Math.round(255*(.74+.26*Math.abs(Math.sin(x/w*Math.PI*22))));g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(x,0,1,h);}g.fillStyle='rgba(0,0,0,.28)';g.fillRect(0,0,w,3);g.fillRect(0,h-3,w,3);speckle(g,w,h,300,['rgba(110,60,20,.32)'],3);});
const texRW=ctex(64,16,(g,w,h)=>{for(let i=0;i<4;i++){g.fillStyle=i%2?'#f2f0ea':'#c9302a';g.fillRect(i*16,0,16,h);}});
const texWater=ctex(256,256,(g,w,h)=>{g.fillStyle='#3c4f78';g.fillRect(0,0,w,h);for(let i=0;i<520;i++){g.strokeStyle=Math.random()<.5?'rgba(255,190,160,.16)':'rgba(10,20,50,.28)';g.lineWidth=rand(1,2.4);const x=Math.random()*w,y=Math.random()*h,l=rand(6,24);g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+l/2,y-2,x+l,y);g.stroke();}});
const texSky=ctex(4,512,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#2a2f66');gr.addColorStop(.28,'#5a4a92');gr.addColorStop(.42,'#a061a6');gr.addColorStop(.485,'#f0906a');gr.addColorStop(.5,'#ffc27a');gr.addColorStop(.52,'#d9867a');gr.addColorStop(1,'#4a3a5a');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const texGlow=ctex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,230,180,.6)');gr.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const texFlag=ctex(192,128,(g,w,h)=>{g.fillStyle='#ce1126';g.fillRect(0,0,w,h/3);g.fillStyle='#fff';g.fillRect(0,h/3,w,h/3);g.fillStyle='#111';g.fillRect(0,2*h/3,w,h/3+1);g.fillStyle='#c09300';g.beginPath();g.moveTo(w/2,h/3+6);g.lineTo(w/2+16,h/2+2);g.lineTo(w/2+9,2*h/3-5);g.lineTo(w/2-9,2*h/3-5);g.lineTo(w/2-16,h/2+2);g.closePath();g.fill();});

/* Alexandrian apartment facade: 12 m x 3 floors, with a matching lit-window mask */
const FAC_W=512,FAC_H=384;const facLit=[];
function drawFacade(g,lit){g.fillStyle=lit?'#000':'#e6d3b0';g.fillRect(0,0,FAC_W,FAC_H);if(!lit){speckle(g,FAC_W,FAC_H,5000,['#d9c49e','#eedcbd','#cdb894'],2);blot(g,FAC_W,FAC_H,10,['#6a5030'],.06,20,60);}
  const fh=FAC_H/3;
  for(let f=0;f<3;f++){const y0=f*fh;
    if(!lit){g.fillStyle='#cdb38a';g.fillRect(0,y0+fh-8,FAC_W,8);}
    for(let b=0;b<3;b++){const x=26+b*170,ww=118,wy=y0+18,wh=fh-50;const balcony=(b!==1);
      if(lit){const on=facLit[f*3+b];if(on){const gr=g.createLinearGradient(0,wy,0,wy+wh);gr.addColorStop(0,on===1?'#ffcf86':'#bfe0ff');gr.addColorStop(1,on===1?'#ff9e4a':'#7fb4e8');g.fillStyle=gr;g.fillRect(x+6,wy+4,ww-12,wh-6);}continue;}
      g.fillStyle='#f3e8d4';g.fillRect(x-6,wy-6,ww+12,wh+10);
      g.fillStyle='#2a3140';g.fillRect(x+6,wy+4,ww-12,wh-6);
      const sh=['#4f6b45','#7a5233','#3c5b6e'][(f+b)%3];g.fillStyle=sh;
      if((f+b)%2===0){g.fillRect(x+6,wy+4,26,wh-6);g.fillRect(x+ww-32,wy+4,26,wh-6);}else{g.fillRect(x+6,wy+4,ww-12,(wh-6)*.45);}
      g.fillStyle='rgba(0,0,0,.25)';for(let s=wy+6;s<wy+wh;s+=7)g.fillRect(x+6,s,ww-12,1.5);
      if(balcony){g.fillStyle='#c9b08a';g.fillRect(x-14,wy+wh-2,ww+28,10);g.strokeStyle='#5b4a3a';g.lineWidth=2;for(let s=x-12;s<x+ww+14;s+=8){g.beginPath();g.moveTo(s,wy+wh-24);g.lineTo(s,wy+wh-2);g.stroke();}g.fillRect(x-14,wy+wh-26,ww+28,3);
        if(Math.random()<.35){g.fillStyle=pick(['#d94a4a','#3d7fc2','#f2f2f2','#e3b13a']);for(let k=0;k<4;k++)g.fillRect(x+10+k*24,wy+wh-40,14,16);}}
      if(Math.random()<.45){g.fillStyle='#ecebe5';g.fillRect(x+ww-34,wy+wh+4,40,22);g.fillStyle='#aaa';for(let s=0;s<4;s++)g.fillRect(x+ww-30,wy+wh+8+s*4,32,1.5);}}}}
const texFacade=ctex(FAC_W,FAC_H,g=>drawFacade(g,false));
for(let i=0;i<9;i++)facLit.push(Math.random()<.38?(Math.random()<.8?1:2):0);
const texFacadeLit=ctex(FAC_W,FAC_H,g=>drawFacade(g,true));
/* shop fronts: 16 m x 4.5 m, four shops */
const SHOPS=[['بقالة','#2f7a4a'],['صيدلية','#2a6fb0'],['موبايلات','#c2412b'],['عصير قصب','#3e8a2a'],['حلاق','#7b3f9e'],['أدوات كهربا','#b8862b'],['مخبز','#a0522d'],['ملابس','#c2416b'],['مكتبة','#1f6f7a'],['كشري','#c9302a']];
function drawShops(g,w,h,lit){g.fillStyle=lit?'#000':'#cbb79a';g.fillRect(0,0,w,h);
  for(let i=0;i<4;i++){const s=SHOPS[(i*3+((Math.random()*10)|0))%SHOPS.length],x=i*256;
    if(lit){if(Math.random()<.85){g.fillStyle='#ffd9a0';g.fillRect(x+18,94,220,150);}g.fillStyle='#fff3c0';g.fillRect(x+16,22,224,52);continue;}
    g.fillStyle=s[1];g.fillRect(x+12,18,232,60);g.fillStyle='#fff';g.font='700 40px '+GAMEF;g.textAlign='center';g.textBaseline='middle';g.direction='rtl';g.fillText(s[0],x+128,50);
    g.fillStyle='#3b2f28';g.fillRect(x+18,94,220,152);g.fillStyle='#7d6a52';g.fillRect(x+24,100,96,140);g.fillStyle='#e8d7a8';g.fillRect(x+128,100,104,140);
    g.fillStyle='rgba(0,0,0,.2)';for(let k=0;k<5;k++)g.fillRect(x+130,108+k*26,100,10);
    g.fillStyle='#8a7a68';g.fillRect(x,0,10,h);}}
const texShops=ctex(1024,288,(g,w,h)=>drawShops(g,w,h,false));
const texShopsLit=ctex(1024,288,(g,w,h)=>drawShops(g,w,h,true));

function signTex(text,o){o=o||{};const w=1024,h=o.h||256;return ctex(w,h,g=>{g.fillStyle=o.bg||'#173f6b';g.fillRect(0,0,w,h);
  if(o.border!==false){g.strokeStyle=o.border||'rgba(255,255,255,.9)';g.lineWidth=h*.04;g.strokeRect(h*.07,h*.07,w-h*.14,h-h*.14);}
  g.fillStyle=o.fg||'#fff';g.textAlign='center';g.textBaseline='middle';g.direction='rtl';let size=o.size||Math.round(h*.5);g.font=size+'px '+GAMEF;while(g.measureText(text).width>w*.86&&size>20){size-=4;g.font=size+'px '+GAMEF;}
  g.fillText(text,w/2,o.sub?h*.42:h*.55);if(o.sub){g.direction='ltr';g.font='800 '+Math.round(h*.16)+'px "Big Shoulders Display","Arial Narrow",sans-serif';g.globalAlpha=.85;g.fillText(o.sub,w/2,h*.8);g.globalAlpha=1;}});}

/* ============ merge helper: one draw call per family of static props ============ */
const niG=g=>g.index?g.toNonIndexed():g;
const NI={box:niG(new T.BoxGeometry(1,1,1)),plane:niG(new T.PlaneGeometry(1,1)),cyl8:niG(new T.CylinderGeometry(.5,.5,1,8)),cyl12:niG(new T.CylinderGeometry(.5,.5,1,12)),sph:niG(new T.SphereGeometry(.5,12,8)),hemi:niG(new T.SphereGeometry(.5,12,6,0,Math.PI*2,0,Math.PI/2)),cone:niG(new T.ConeGeometry(.5,1,10))};
const _v=new T.Vector3(),_n=new T.Vector3(),_m3=new T.Matrix3(),_c=new T.Color(),_m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_s=new T.Vector3(),_p=new T.Vector3(),_dum=new T.Object3D();
class Merger{constructor(){this.p=[];this.n=[];this.c=[];this.u=[];}
  add(geo,m4,color,us,vs,uo,vo){us=us||1;vs=vs||1;uo=uo||0;vo=vo||0;const P=geo.attributes.position,N=geo.attributes.normal,U=geo.attributes.uv;_m3.getNormalMatrix(m4);_c.set(color).convertSRGBToLinear();
    for(let i=0;i<P.count;i++){_v.fromBufferAttribute(P,i).applyMatrix4(m4);this.p.push(_v.x,_v.y,_v.z);_n.fromBufferAttribute(N,i).applyMatrix3(_m3).normalize();this.n.push(_n.x,_n.y,_n.z);this.c.push(_c.r,_c.g,_c.b);if(U)this.u.push(U.getX(i)*us+uo,U.getY(i)*vs+vo);else this.u.push(0,0);}}
  xf(geo,x,y,z,sx,sy,sz,ry,color,rx,rz){_m4.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(rx||0,ry||0,rz||0,'YXZ')),_s.set(sx,sy,sz));this.add(geo,_m4,color);}
  box(x0,x1,y0,y1,z0,z1,color){this.xf(NI.box,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,x1-x0,y1-y0,z1-z0,0,color);}
  cyl(r,h,x,y,z,color,seg){this.xf(seg===12?NI.cyl12:NI.cyl8,x,y,z,r*2,h,r*2,0,color);}
  beam(a,b,t,color){_dum.position.copy(a).add(b).multiplyScalar(.5);_dum.lookAt(b);_dum.scale.set(t,t,a.distanceTo(b));_dum.updateMatrix();this.add(NI.box,_dum.matrix,color);}
  wall(x,z,len,y0,h,ry,color,us,vs,uo,vo){_m4.compose(_p.set(x,y0+h/2,z),_q.setFromEuler(_e.set(0,ry,0)),_s.set(len,h,1));this.add(NI.plane,_m4,color,us,vs,uo,vo);}
  geo(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.u,2));g.computeBoundingSphere();return g;}
  mesh(mat,cast){const m=new T.Mesh(this.geo(),mat);m.castShadow=cast!==false;m.receiveShadow=true;scene.add(m);return m;}}
const VC=new T.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.08});
const VCm=new T.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.35});

/* ============ colliders ============ */
const colliders=[];
function col(x0,x1,z0,z1,h){colliders.push({x0:x0,x1:x1,z0:z0,z1:z1,h:h===undefined?10:h});}

/* ============ world layout ============
   x: west→east (-300..300). z: sea (north, negative) → city (south, positive).
   Avenue (طريق الميناء) along z=0. Port wall z=-16 with three gates. Port west of x=115, shipyard east. City grid south. */
/* Phase 7: the map runs further east (to x 420). The street at x 250 moved to x 286 so the training centre sits at near-real size
   across from the shipyard gate; a new street at x 370 opens the eastern blocks. EX = east edge of the drivable city. */
const ST_X=[-250,-150,-50,50,150,286,370];const ST_Z=[120,235];const EX=420;
const GATES=[{x:-230,ar:'بوابة ١',en:'PORT GATE 1',c:'#173f6b'},{x:40,ar:'بوابة ٥٠',en:'PORT GATE 50',c:'#173f6b'},{x:170,ar:'ترسانة الإسكندرية',en:'ALEXANDRIA SHIPYARD',c:'#8a1f1a'}];
const RESERVE=[];
/* new training centre from the user's site plan, across from the shipyard gate (Phase 6 C). Preview with ?tc=new until the map is approved. */
const TC_NEW=true;   /* approved: the new training centre is the one in the game */
RESERVE.push([TC.X0-1,TC.X1+1,12,TC.Z1+1.5],[58,92,13,32]);
function reserved(x0,x1,z0,z1){for(const r of RESERVE)if(x1>r[0]&&x0<r[1]&&z1>r[2]&&z0<r[3])return true;return false;}

/* road graph (for GPS + roads) */
const NODES={};const EDGES=[];
function node(x,z){const k=x+','+z;if(!NODES[k])NODES[k]={x:x,z:z,k:k,adj:[]};return NODES[k];}
function edge(a,b,kind){const A=node(a[0],a[1]),B=node(b[0],b[1]);const d=Math.hypot(A.x-B.x,A.z-B.z);A.adj.push([B,d]);B.adj.push([A,d]);EDGES.push({a:A,b:B,kind:kind});}
(function(){const AX=[-290,-250,-230,-150,-50,40,50,150,170,TC.gateMain,286,370,410];for(let i=0;i<AX.length-1;i++)edge([AX[i],0],[AX[i+1],0],'ave');
  ST_X.forEach(x=>{edge([x,0],[x,120],'st');edge([x,120],[x,235],'st');});
  ST_Z.forEach(z=>{for(let i=0;i<ST_X.length-1;i++)edge([ST_X[i],z],[ST_X[i+1],z],'st');});
  const PX=[-280,-230,-120,-20,40,100];for(let i=0;i<PX.length-1;i++){edge([PX[i],-30],[PX[i+1],-30],'port');edge([PX[i],-112],[PX[i+1],-112],'port');}
  edge([-230,0],[-230,-30],'gate');edge([40,0],[40,-30],'gate');
  [-280,-120,-20,100].forEach(x=>edge([x,-30],[x,-112],'port'));
  edge([170,0],[170,-38],'gate');edge([170,-38],[170,-45],'port');edge([125,-45],[170,-45],'port');edge([170,-45],[170,-108],'port');edge([170,-38],[185,-38],'campus');edge([185,-38],[280,-38],'campus');
  TC.graph(edge);})();
wardianGraph(edge);   /* Wardian district streets join the graph (GPS, minimap, safe points) */

/* points of interest (stop spots on the kerb side of a lane) */
const POI={
  gate1:{n:'بوابة ١',x:-238,z:-6.5,sx:0,sz:-5,area:'port'},
  gate50:{n:'بوابة ٥٠',x:30,z:-6.5,sx:0,sz:-5,area:'port'},
  quay:{n:'رصيف الحاويات',x:-70,z:-109.5,sx:0,sz:5,area:'port'},
  store:{n:'مخازن الميناء',x:-200,z:-27.5,sx:0,sz:5,area:'port'},
  cruise:{n:'محطة الركاب البحرية',x:-252,z:-32.5,sx:0,sz:-5,area:'port'},
  tugs:{n:'مرسى القاطرات',x:60,z:-114.5,sx:0,sz:-5,area:'port'},
  gateS:{n:'بوابة الترسانة',x:180,z:-6.5,sx:0,sz:-5,area:'yard'},
  ws:{n:'ورشة الهياكل',x:166.5,z:-63,sx:-4,sz:0,area:'yard'},
  dock:{n:'الحوض الجاف',x:173.5,z:-100,sx:4.5,sz:0,area:'yard'},
  admin:{n:'هيئة الميناء',x:70,z:-32.5,sx:0,sz:-6,area:'port'},
  fish:{n:'سوق السمك',x:-215,z:6.5,sx:0,sz:5.5,area:'city'},
  cafe:{n:'قهوة البحّارة',x:175,z:6.5,sx:0,sz:5.5,area:'city'},
  mosque:{n:'الجامع',x:-215,z:122.5,sx:0,sz:5,area:'city'},
  school:{n:'المدرسة الصناعية',x:22,z:122.5,sx:0,sz:5,area:'city'},
  bakery:{n:'فرن العيش',x:147.5,z:70,sx:-4.5,sz:0,area:'city'},
  micro:{n:'موقف الميكروباص',x:281.5,z:180,sx:-4.5,sz:0,area:'city'},
  market:{n:'سوق الخضار',x:-52.5,z:60,sx:4.5,sz:0,area:'city'},
  clinic:{n:'المستوصف',x:-147.5,z:190,sx:-4.5,sz:0,area:'city'},
  qstop:{n:'موقف القباري',x:-200,z:232.5,sx:0,sz:-5,area:'qabbari'}};
Object.assign(POI,WARDIAN_POI);
POI.cafe.x=75;Object.assign(POI,TC.POI);
const STATIONS_F=[{n:'بنزينة الميناء',x:-121,z:26,sx:-122,sz:26},{n:'بنزينة الحي',x:79,z:138,sx:79,sz:138}];

let sky,sun,water,flags=[],trolleys=[],glowPts,gulls=[],headGlow,coneGlow;
const contData=[];const CONT=['#2e5e8c','#b23a2a','#d6802b','#3b7a4a','#8a8f94','#7a3b5a','#c9a227','#1f4e5f','#e0ddd5'];
const S=new Merger();   /* static vertex-coloured props */
const SM=new Merger();  /* metallic props */
const lampsList=[],palmsList=[];let WARDIAN=null,TRAINING=null;

function buildWorld(){
  sky=new T.Mesh(new T.SphereGeometry(1200,32,16),new T.MeshBasicMaterial({map:texSky,side:T.BackSide,fog:false,depthWrite:false}));scene.add(sky);
  const sunS=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#ffd08a',fog:false,depthWrite:false,transparent:true,blending:T.AdditiveBlending}));sunS.scale.set(260,260,1);sunS.userData.dir=V(-.86,.06,.5).normalize();scene.add(sunS);sky.userData.sun=sunS;
  scene.fog=new T.Fog('#c47f86',70,520);
  scene.add(new T.HemisphereLight('#a89adf','#5a4048',.42));
  sun=new T.DirectionalLight('#ffb27a',1.45);
  try{const pm=new T.PMREMGenerator(renderer);const es=new T.Scene();es.add(new T.Mesh(new T.SphereGeometry(100,32,16),new T.MeshBasicMaterial({map:texSky,side:T.BackSide})));const sg=new T.Mesh(new T.SphereGeometry(9,16,8),new T.MeshBasicMaterial({color:'#ffe2b0'}));sg.position.copy(V(-.86,.08,.5).normalize().multiplyScalar(90));es.add(sg);scene.environment=pm.fromScene(es,.02).texture;pm.dispose();}catch(e){}
  clouds();sun.castShadow=true;setShadowQ();const sc=sun.shadow.camera;sc.left=-55;sc.right=55;sc.top=55;sc.bottom=-55;sc.near=5;sc.far=320;sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;scene.add(sun);scene.add(sun.target);

  /* ground, sea */
  const gm=(x0,x1,z0,z1,tex,col,sc,y)=>{const m=new T.Mesh(new T.PlaneGeometry(x1-x0,z1-z0),new T.MeshStandardMaterial({map:rep(tex,(x1-x0)/sc,(z1-z0)/sc),color:col||'#fff',roughness:.95}));m.rotation.x=-Math.PI/2;m.position.set((x0+x1)/2,y||0,(z0+z1)/2);m.receiveShadow=true;scene.add(m);return m;};
  gm(-700,195,-125,700,texConc,'#a89c90',16);gm(265,700,-125,700,texConc,'#a89c90',16);gm(195,265,-62,700,texConc,'#a89c90',16);
  water=new T.Mesh(new T.PlaneGeometry(2400,1200),new T.MeshStandardMaterial({map:rep(texWater,80,40),roughness:.1,metalness:.6,color:'#b9c4ff'}));water.rotation.x=-Math.PI/2;water.position.set(0,-1.6,-725);scene.add(water);
  S.box(-700,195,-6,.02,-126,-125,'#857d72');S.box(265,700,-6,.02,-126,-125,'#857d72');S.box(-300,195,.01,.04,-124.9,-124.3,'#e8b923');
  for(let x=-290;x<195;x+=14){S.cyl(.32,.7,x,.35,-124,'#2a2b2e');}
  col(-900,900,-900,-124.3,0);
  /* breakwater + Qaitbay-ish fort silhouette far west + distant ships */
  S.box(-900,600,-1.6,1.6,-330,-322,'#5e5560');
  S.box(-560,-520,0,16,-348,-320,'#d9c6a0');S.box(-546,-534,16,24,-338,-330,'#d9c6a0');
  for(let i=0;i<5;i++){const x=-450+i*220+rand(-40,40),z=-420-rand(0,160),L=rand(90,160);S.box(x-L/2,x+L/2,-1.5,rand(8,13),z-10,z+10,'#3d3f58');S.box(x-L/2+4,x-L/2+20,0,rand(18,26),z-7,z+7,'#c9bfd2');}

  /* ===== avenue ===== */
  const plane=(w,h,mat,x,y,z,rotY)=>{const g=new T.PlaneGeometry(w,h);g.rotateX(-Math.PI/2);if(rotY)g.rotateY(rotY);const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);return m;};
  const carrM=len=>new T.MeshStandardMaterial({map:rep(texCarr,len/16,1),roughness:.9});
  plane(900,8,carrM(900),0,.03,5);plane(900,8,carrM(900),0,.03,-5);
  /* median: grass strip with gaps */
  const gaps=[-250,-230,-150,-50,45,150,170,TC.gateMain,286,370].concat(WARDIAN_GAPS.map(g=>(g[0]+g[1])/2));
  let mx=-450;const medSeg=(a,b)=>{if(b-a<2)return;S.box(a,b,0,.28,-1,1,'#3f6a3a');curb(a,b,-1.15,-1);curb(a,b,1,1.15);};
  gaps.slice().sort((a,b)=>a-b).forEach(g=>{const half=g===45?12:7;medSeg(mx,g-half);mx=g+half;});medSeg(mx,450);
  for(let x=-280;x<=280;x+=22){if(gaps.some(g=>Math.abs(x-g)<12))continue;palmsList.push([x,0,rand(7,9)]);col(x-.4,x+.4,-.4,.4,9);}
  /* sidewalks */
  plane(900,6,new T.MeshStandardMaterial({map:rep(texPave,225,1.5),roughness:.9}),0,.12,12);
  plane(900,7,new T.MeshStandardMaterial({map:rep(texPave,225,1.75),roughness:.9}),0,.12,-12.5);
  /* kerbs (yellow & black) */
  const southGaps=ST_X.map(x=>[x-5,x+5]).concat([[-139,-103]]).concat(WARDIAN_GAPS);segs(-450,450,southGaps).forEach(s=>curb(s[0],s[1],9,9.3));
  segs(-450,450,GATES.map(g=>[g.x-7,g.x+7])).forEach(s=>curb(s[0],s[1],-9.3,-9));

  /* ===== city streets ===== */
  const stM=len=>new T.MeshStandardMaterial({map:rep(texStreet,len/16,1),roughness:.9});
  const pAsph=new T.MeshStandardMaterial({map:rep(texAsph,2.5,2.5),roughness:.92});
  ST_X.forEach(x=>{[[9,115],[125,230]].forEach(r=>{const L=r[1]-r[0];plane(L,10,stM(L),x,.035,(r[0]+r[1])/2,Math.PI/2);curb2z(x-5.3,x-5,r[0]+(r[0]===9?0:0),r[1]);curb2z(x+5,x+5.3,r[0],r[1]);});
    ST_Z.forEach(z=>plane(10,10,pAsph,x,.04,z));plane(10,9,pAsph,x,.038,4.5+0.0);});
  ST_Z.forEach(z=>{for(let i=0;i<ST_X.length-1;i++){const a=ST_X[i]+5,b=ST_X[i+1]-5;plane(b-a,10,stM(b-a),(a+b)/2,.035,z);curb(a,b,z-5.3,z-5);curb(a,b,z+5,z+5.3);}});
  /* ===== port & shipyard roads ===== */
  EDGES.forEach(e=>{if(e.kind!=='port'&&e.kind!=='gate'&&e.kind!=='campus')return;const ax=e.a.x,az=e.a.z,bx=e.b.x,bz=e.b.z;
    if(az===bz){const a=Math.min(ax,bx)+5,b=Math.max(ax,bx)-5;plane(b-a,10,stM(b-a),(a+b)/2,.035,az);}
    else{let a=Math.min(az,bz)+5,b=Math.max(az,bz)-5;if(e.kind==='gate')b=-9;plane(b-a,10,stM(b-a),ax,.035,(a+b)/2,Math.PI/2);}});
  Object.values(NODES).forEach(n=>{if(n.z<0)plane(10,10,pAsph,n.x,.04,n.z);});
  [-230,40,170].forEach(x=>plane(10,8,pAsph,x,.039,-12.5));

  /* ===== port wall + gates ===== */
  segs(-300,EX,GATES.map(g=>[g.x-7,g.x+7])).forEach(s=>{S.box(s[0],s[1],0,3.4,-16.5,-15.5,'#e7ddc8');S.box(s[0],s[1],3.4,3.7,-16.7,-15.3,'#3b6e8c');S.box(s[0],s[1],0,.6,-16.6,-15.4,'#4c6a6a');col(s[0],s[1],-16.5,-15.5,3.7);});
  S.box(114.5,115.5,0,3.4,-125,-16.5,'#e7ddc8');col(114.5,115.5,-125,-16.5,3.4);
  GATES.forEach(g=>g.x===-230?mainGate(g):gate(g));
  /* boundaries */
  wardianBounds(col);col(EX-2,900,-900,900,0);col(-900,900,244,900,0);

  /* ===== city blocks ===== */
  RESERVE.push([-139,-102,13,50],[58,100,126,162],[-242,-200,13,40],[-244,-221,127,150],[4,44,127,172],[262,279,166,196],[140,146,62,78]);
  const BX=[-300].concat(ST_X).concat([EX]);
  const facM=new T.MeshStandardMaterial({map:texFacade,emissiveMap:texFacadeLit,emissive:'#ffffff',emissiveIntensity:.95,vertexColors:true,roughness:.85});
  const shopM=new T.MeshStandardMaterial({map:texShops,emissiveMap:texShopsLit,emissive:'#ffffff',emissiveIntensity:.8,vertexColors:true,roughness:.8});
  const FAC=new Merger(),SHP=new Merger(),ROOF=new Merger();
  const QAB_TINTS=['#f0d9b5','#e8c9a0','#f5e6c8','#d9b48a','#ecd2b0','#c9d8c0'];   /* القباري: older, lower houses in warm plaster */
  const tints=['#ffffff','#ffd9a8','#ffe9c9','#ffc8b4','#d6e6f2','#fff0b0','#ead6ff','#d4ecd4','#f6c99a','#ffffff'];
  const zBands=[[15,111],[129,226],[244,300]];
  for(let i=0;i<BX.length-1;i++){const xa=BX[i]+(i===0?0:9),xb=BX[i+1]-(i===BX.length-2?0:9);
    zBands.forEach((zb,bi)=>{let x=xa;while(x<xb-6){let w=rand(16,26);if(xb-(x+w)<10)w=xb-x;let z=zb[0];
        while(z<zb[1]-6){let d=rand(20,30);if(zb[1]-(z+d)<12)d=zb[1]-z;
          const x0=x+.6,x1=x+w-.6,z0=z+.6,z1=z+d-.6;
          if(!reserved(x0,x1,z0,z1)){const qab=x1<-150&&bi<2;const fl=qab?2+((sr()*4)|0):3+((sr()*8)|0)+(bi===2?3:0),h=4.5+fl*3;building(FAC,SHP,ROOF,x0,x1,z0,z1,h,qab?pick(QAB_TINTS):pick(tints),bi===2,{n:z===zb[0],s:z+d>=zb[1]-.01,w:x===xa,e:x+w>=xb-.01});if(bi<2)col(x0,x1,z0,z1,h);}
          z+=d;}
        x+=w;}});}
  FAC.mesh(facM);SHP.mesh(shopM);ROOF.mesh(VC);
  RESERVE.length=0;
  /* ===== landmarks in the city ===== */
  fuelStation(-139,-103,14,48,'بنزينة الميناء',1);fuelStation(60,98,128,160,'بنزينة الحي',-1);
  fishMarket();mosque(-243,129);school(5,128);cafe(58,14);microStand(36);
  TRAINING=buildTraining({T,scene,S,SM,Merger,NI,VC,col,ctex,rep,texPave,texConc,AR,GAMEF,plainSign,person,palmsList,lampsList,flag});
  signBoard('فرن العيش',143,6,72,Math.PI/2);signBoard('موقف القباري',-200,4.6,226.15,0);S.box(-206,-194,3.2,3.4,226,229.2,'#2a6fb0');[-205.6,-194.4].forEach(x=>S.box(x-.08,x+.08,0,3.2,228.9,229.1,'#888'));
  /* القباري: district signs where you drive in */
  [[-200,13.2,Math.PI],[-156.2,112,Math.PI/2],[-296,125,-Math.PI/2]].forEach(([x,z,ry])=>{S.cyl(.08,4.2,x,2.1,z,'#5a6066');plainSign('حي القباري',3.2,.8,x+Math.sin(ry)*.1,4,z+Math.cos(ry)*.1,ry,{bg:'#1e4d7a',border:'#ffffff',glow:true});});signBoard('سوق الخضار',-46,6,62,-Math.PI/2);signBoard('المستوصف',-141,6,192,Math.PI/2);
  billboards();trafficLights();

  /* ===== port ===== */
  const blk=(x0,x1,z0,z1,mh)=>{for(let x=x0+6.1;x+6.1<=x1+.01;x+=12.6)for(let z=z0+1.22;z+1.22<=z1+.01;z+=2.72){const n=1+Math.floor(sr()*mh);for(let k=0;k<n;k++)contData.push([x,1.3+k*2.6,z,CONT[(sr()*CONT.length)|0]]);}col(x0,x1,z0,z1,mh*2.6);};
  blk(-268,-133,-104,-77,4);blk(-108,-33,-104,-40,4);blk(-8,86,-104,-77,3);blk(-8,36,-66,-40,2);
  archWarehouse(-224,-188,-70,-38,'#d3c09e','مخازن الميناء');archWarehouse(-180,-140,-70,-38,'#b9c7b2','مخزن رقم ٣');
  ship({x:-90,z:-150,L:150,B:24,y0:-7,hB:6.5,hT:7.5,bottom:'#7d2a22',top:'#22374a',deck:'#46525a',sup:'#e8e5dc',funnel:'#c9302a'});
  for(let x=-150;x<=-45;x+=12.6)for(let z=-160;z<=-141;z+=2.72){const n=1+Math.floor(sr()*3);for(let k=0;k<n;k++)contData.push([x,7+1.3+k*2.6,z,CONT[(sr()*CONT.length)|0]]);}
  ship({x:60,z:-146,L:110,B:18,y0:-6,hB:5,hT:6,bottom:'#9a2a22',top:'#1b1d22',deck:'#2f7a52',sup:'#efece4',funnel:'#1b1d22'});deckCranes(60,-146,110,5);
  [-230,-160,-60,30,90].forEach(x=>sts(x));
  rtg(-200,-105.6,-75.4);rtg(-160,-105.6,-75.4);rtg(40,-105.6,-75.4);portAdmin();customs();harbourLife();

  /* ===== shipyard ===== */
  shipyard();
  /* ===== landmarks from the reference photos ===== */
  cruiseTerminal();cruiseShip(-215,-152);floatingDock(312,-185);[[182,-118,0],[278,-118,Math.PI],[278,-70,Math.PI]].forEach(c=>luffCrane(c[0],c[1],c[2]));
  tugboat(30,-131,0);tugboat(48,-131.5,.15);tugboat(66,-131,-.1);lighthouse(-430,-326);shipLabel(-90,-150,150,24,'CMA CGM','#1d3f7a');
  /* containers (instanced) */
  const cm=new T.MeshStandardMaterial({map:texCont,color:'#ffffff',roughness:.7,metalness:.25});
  const inst=new T.InstancedMesh(new T.BoxGeometry(1,1,1),cm,contData.length);inst.castShadow=true;inst.receiveShadow=true;const cc=new T.Color();
  contData.forEach((c,i)=>{_dum.position.set(c[0],c[1],c[2]);_dum.rotation.set(0,0,0);_dum.scale.set(12.2,2.6,2.44);_dum.updateMatrix();inst.setMatrixAt(i,_dum.matrix);cc.set(c[3]);inst.setColorAt(i,cc);});scene.add(inst);

  /* lamps along avenue + streets */
  for(let x=-290;x<=EX-10;x+=26){if(Math.abs(x-TC.gateMain)<8||Math.abs(x-TC.gateExit)<8)continue;if(GATES.some(g=>Math.abs(x-g.x)<10)||ST_X.some(s=>Math.abs(x-s)<8))continue;lampsList.push([x,10.2,Math.PI]);lampsList.push([x+13,-10.2,0]);}
  ST_X.forEach(x=>{for(let z=30;z<230;z+=34){if(Math.abs(z-120)<10)continue;lampsList.push([x+5.8,z,-Math.PI/2]);}});
  WARDIAN=buildWardian({T,scene,S,Merger,NI,VC,col,ctex,rep,texStreet,texAsph,texPave,AR,GAMEF,lampsList,plainSign});
  {const g=WARDIAN&&WARDIAN.shops.find(q=>q.kind==='ورشة توكتوك');if(g&&Math.abs(g.nx)>.5)POI.wgarage={n:g.name,x:g.x+g.nx*6.3,z:g.z,sx:-g.nx*4.6,sz:0,area:'wardian'};}
  buildLamps();buildPalms();buildTrees();
  /* gulls */
  for(let i=0;i<10;i++){const g=new T.Group();const m=new T.MeshStandardMaterial({color:'#f2eef0'});const body=new T.Mesh(new T.BoxGeometry(.24,.16,.75),m);g.add(body);const l=new T.Group(),r=new T.Group();const wg=new T.BoxGeometry(.9,.04,.3);wg.translate(-.45,0,0);const wl=new T.Mesh(wg,m);l.add(wl);const wg2=wg.clone();wg2.translate(.9,0,0);r.add(new T.Mesh(wg2,m));g.add(l,r);scene.add(g);gulls.push({g:g,l:l,r:r,cx:rand(-250,150),cz:rand(-200,-130),rad:rand(18,45),y:rand(14,30),sp:rand(.15,.3)*(Math.random()<.5?-1:1),ph:rand(0,6.28)});}
  streetSigns();
  S.mesh(VC);SM.mesh(VCm);
  /* the merged meshes now own their typed arrays: drop the big JS build arrays so they can be garbage-collected */
  for(const M of [S,SM]){M.p=[];M.n=[];M.c=[];M.u=[];}
}

function clouds(){const ct=ctex(256,128,g=>{for(let i=0;i<18;i++){const x=rand(40,216),y=rand(50,90),r=rand(18,40);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}});
  const tints=['#ffc9a8','#f5a3b8','#ffd8b0','#d9a8e0','#ffb08a'];
  for(let i=0;i<16;i++){const a=rand(-Math.PI,Math.PI),R=rand(700,950);const sp=new T.Sprite(new T.SpriteMaterial({map:ct,color:pick(tints),transparent:true,opacity:rand(.55,.85),fog:false,depthWrite:false}));sp.position.set(Math.cos(a)*R,rand(110,260),Math.sin(a)*R);const s=rand(220,420);sp.scale.set(s,s*.45,1);scene.add(sp);}}
function buildTrees(){const pts=[];ST_X.forEach(x=>{[[18,110],[132,226]].forEach(r=>{for(let z=r[0];z<r[1];z+=17){[-7.3,7.3].forEach(o=>{const px=x+o,pz=z+(o>0?8:0);if(Object.values(POI).some(p=>Math.hypot(p.x-px,p.z-pz)<7))return;pts.push([px,pz]);});}});});
  ST_Z.forEach(zz=>{for(let i=0;i<ST_X.length-1;i++)for(let x=ST_X[i]+16;x<ST_X[i+1]-12;x+=19){[-7.3,7.3].forEach(o=>{const px=x+(o>0?9:0),pz=zz+o;if(Object.values(POI).some(p=>Math.hypot(p.x-px,p.z-pz)<7)||(zz===235&&o>0))return;pts.push([px,pz]);});}});
  const tr=new T.InstancedMesh(new T.CylinderGeometry(.14,.22,1,6),new T.MeshStandardMaterial({color:'#5e4632',roughness:.9}),pts.length);
  const M=new Merger();[[0,0,0,1.9],[.9,-.3,.3,1.4],[-.8,-.2,-.4,1.5],[.2,.6,-.8,1.3]].forEach(b=>M.xf(niG(new T.IcosahedronGeometry(.5,1)),b[0],b[1],b[2],b[3]*1.6,b[3]*1.4,b[3]*1.6,0,'#ffffff'));
  const cr=new T.InstancedMesh(M.geo(),new T.MeshStandardMaterial({vertexColors:true,roughness:.85,flatShading:true}),pts.length);tr.castShadow=cr.castShadow=true;const cc=new T.Color();
  pts.forEach((p,i)=>{const h=rand(3.2,4.4);_dum.position.set(p[0],h/2,p[1]);_dum.rotation.set(0,0,0);_dum.scale.set(1,h,1);_dum.updateMatrix();tr.setMatrixAt(i,_dum.matrix);_dum.position.set(p[0],h+.9,p[1]);_dum.rotation.set(0,rand(0,6),0);const s=rand(.85,1.2);_dum.scale.set(s,s,s);_dum.updateMatrix();cr.setMatrixAt(i,_dum.matrix);cc.set(pick(['#4f8a3a','#5f9a41','#3f7a35','#6aa04a','#7a9a3a']));cr.setColorAt(i,cc);col(p[0]-.3,p[0]+.3,p[1]-.3,p[1]+.3,5);});
  scene.add(tr,cr);}
/* quality profiles change the real rendering cost: resolution, shadow pass and its size, view distance */
const QUAL={low:{n:'خفيفة',shadow:0,box:55,fog:[55,300],far:700},med:{n:'متوسطة',shadow:1024,box:55,fog:[70,520],far:2600},high:{n:'عالية',shadow:2048,box:75,fog:[80,700],far:2600}};
function setQuality(q){quality=q;ls.set('aps_quality',q);applyPR();const Q=QUAL[q];if(sun){sun.castShadow=!!Q.shadow;setShadowQ();const sc=sun.shadow.camera;sc.left=sc.bottom=-Q.box;sc.right=sc.top=Q.box;sc.updateProjectionMatrix();}
  if(scene.fog){scene.fog.near=Q.fog[0];scene.fog.far=Q.fog[1];}camera.far=Q.far;camera.updateProjectionMatrix();const b=$('btnQuality');if(b)b.textContent='الرسوم: '+Q.n;resize();}
function setShadowQ(){if(!sun)return;const s=quality==='high'?2048:1024;sun.shadow.mapSize.set(s,s);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
function segs(a,b,gaps){const out=[];let x=a;gaps.slice().sort((p,q)=>p[0]-q[0]).forEach(g=>{if(g[0]>x)out.push([x,g[0]]);x=Math.max(x,g[1]);});if(b>x)out.push([x,b]);return out;}
const curbMats={};
function curb(x0,x1,z0,z1){const len=Math.max(x1-x0,z1-z0);const k=Math.round(len);const m=curbMats[k]||(curbMats[k]=new T.MeshStandardMaterial({map:rep(texCurb,len/4,1),roughness:.7}));const o=new T.Mesh(NI.box,m);o.position.set((x0+x1)/2,.11,(z0+z1)/2);o.scale.set(x1-x0,.22,z1-z0);o.receiveShadow=true;scene.add(o);}
function curb2z(x0,x1,z0,z1){const len=z1-z0;const k='z'+Math.round(len);const m=curbMats[k]||(curbMats[k]=new T.MeshStandardMaterial({map:rep(texCurb,len/4,1),roughness:.7}));const o=new T.Mesh(NI.box,m);o.position.set((x0+x1)/2,.11,(z0+z1)/2);o.scale.set(x1-x0,.22,z1-z0);scene.add(o);}
function plainSign(text,w,h,x,y,z,ry,o){const m=new T.MeshStandardMaterial({map:signTex(text,Object.assign({h:Math.max(128,Math.round(1024*h/w/32)*32)},o)),roughness:.55,emissive:'#ffffff',emissiveIntensity:o&&o.glow?.35:0});m.emissiveMap=m.map;const p=new T.Mesh(new T.PlaneGeometry(w,h),m);p.position.set(x,y,z);p.rotation.y=ry||0;scene.add(p);return p;}
function signBoard(text,x,y,z,ry){plainSign(text,5,1.3,x,y,z,ry,{bg:'#1e4d7a',glow:true});}

function building(F,SH,R,x0,x1,z0,z1,h,tint,far,per){const w=x1-x0,d=z1-z0,up=h-4.5;const uo=0,vo=0;
  const faces=[[(x0+x1)/2,z1,w,0],[(x0+x1)/2,z0,w,Math.PI],[x0,(z0+z1)/2,d,-Math.PI/2],[x1,(z0+z1)/2,d,Math.PI/2]];
  faces.forEach(f=>{F.wall(f[0],f[1],f[2],4.5,up,f[3],tint,f[2]/12,up/9,uo,vo);SH.wall(f[0],f[1],f[2],0,4.5,f[3],'#ffffff',f[2]/16,1,Math.random(),0);});
  R.box(x0,x1,h-.05,h+.5,z0,z1,'#b9a88d');R.box(x0+.4,x1-.4,h+.5,h+.52,z0+.4,z1-.4,'#8c8172');
  if(!far){for(let i=0;i<2;i++){const tx=rand(x0+2,x1-2),tz=rand(z0+2,z1-2);R.cyl(.6,1.2,tx,h+1.2,tz,i?'#2a2a2a':'#e6e6e6');}
    if(Math.random()<.7){const dx=rand(x0+1.5,x1-1.5),dz=rand(z0+1.5,z1-1.5);R.xf(NI.cyl12,dx,h+1.3,dz,1.4,.08,1.4,0,'#e9e9e9',.9);R.box(dx-.05,dx+.05,h+.5,h+1.2,dz-.05,dz+.05,'#555');}
    R.box(x0,x1,4.5,4.8,z0-.8,z0,'#cdb38a');R.box(x0,x1,4.5,4.8,z1,z1+.8,'#cdb38a');
    if(per){const flg=[per.s,per.n,per.w,per.e],rail=pick(['#3d3a36','#efe9dc','#4f7480','#7a4a2e']);const floors=Math.floor(up/3);
      faces.forEach((f,fi)=>{if(!flg[fi])return;const th=f[3],ax=Math.cos(th),az=-Math.sin(th),nx=Math.sin(th),nz=Math.cos(th),len=f[2];
        for(let k=0;k*12<len;k++)[1.99,9.96].forEach(c=>{const sp=k*12+c;if(sp-1.75<.3||sp+1.75>len-.3)return;const lx=f[0]+ax*(sp-len/2),lz=f[1]+az*(sp-len/2);
          for(let i=0;i<Math.min(floors,7);i++){const y=4.5+i*3+.62;R.xf(NI.box,lx+nx*.5,y,lz+nz*.5,3.3,.14,1.0,th,'#d2b994');R.xf(NI.box,lx+nx*.98,y+.48,lz+nz*.98,3.3,.82,.05,th,rail);}});});}}}

function gate(g){const x=g.x;
  [-1,1].forEach(s=>{S.box(x+s*8.2-1.2,x+s*8.2+1.2,0,9,-17.2,-14.8,'#e9e1cf');S.box(x+s*8.2-1.35,x+s*8.2+1.35,0,1.1,-17.35,-14.65,'#3d3a35');col(x+s*8.2-1.2,x+s*8.2+1.2,-17.2,-14.8,9);});
  S.box(x-9.4,x+9.4,8.3,11,-16.8,-15.2,g.c);S.box(x-9.6,x+9.6,11,11.3,-17,-15,'#e9e1cf');
  plainSign(g.ar,16.5,2.5,x,9.65,-14.78,0,{bg:g.c,sub:g.en,glow:true});plainSign(g.ar,16.5,2.5,x,9.65,-17.22,Math.PI,{bg:g.c,sub:g.en});
  S.box(x+10,x+13.6,0,2.8,-24,-19.5,'#e9e1cf');S.box(x+9.7,x+13.9,2.8,3.1,-24.3,-19.2,'#3d3a35');S.box(x+9.99,x+13.61,1.3,2.2,-19.51,-19.49,'#1f3340');col(x+10,x+13.6,-24,-19.5,3);
  [-1,1].forEach(s=>{S.box(x+s*6.6-.25,x+s*6.6+.25,0,1.2,-18.5,-18,'#333333');const arm=new T.Mesh(NI.box,new T.MeshStandardMaterial({map:rep(texRW,5,1)}));arm.scale.set(6,.2,.2);arm.position.set(x+s*(6.6-1.4),3.6,-18.25);arm.rotation.z=s*1.05;scene.add(arm);});
  flag(x+15,-18,10);person({shirt:'#2d3b4f',pants:'#2d3b4f',skin:'#8f6446',cap:'#24303f'},x+11.8,-18.8,0);}
function flag(x,z,h){S.cyl(.07,h,x,h/2,z,'#c8ccd0');const geo=new T.PlaneGeometry(3,2,10,6);geo.translate(1.5,0,0);const f=new T.Mesh(geo,new T.MeshStandardMaterial({map:texFlag,side:T.DoubleSide,roughness:.8}));f.position.set(x,h-1.1,z);f.castShadow=true;scene.add(f);flags.push({geo:geo,base:Float32Array.from(geo.attributes.position.array),ph:Math.random()*6});}

function fuelStation(x0,x1,z0,z1,name,face){const cx=(x0+x1)/2,cz=(z0+z1)/2;
  const pm=new T.Mesh(new T.PlaneGeometry(x1-x0,z1-z0),new T.MeshStandardMaterial({map:rep(texConc,2,2),color:'#9aa0a6',roughness:.9}));pm.rotation.x=-Math.PI/2;pm.position.set(cx,.06,cz);pm.receiveShadow=true;scene.add(pm);
  const cz2=face>0?z0+12:z1-12;
  [[-9,-5],[9,-5],[-9,5],[9,5]].forEach(p=>{S.box(cx+p[0]-.3,cx+p[0]+.3,0,5.4,cz2+p[1]-.3,cz2+p[1]+.3,'#e8e8e8');col(cx+p[0]-.35,cx+p[0]+.35,cz2+p[1]-.35,cz2+p[1]+.35,5.4);});
  S.box(cx-11,cx+11,5.4,6.4,cz2-7,cz2+7,'#f2f2f2');S.box(cx-11.05,cx+11.05,5.6,6.2,cz2-7.05,cz2+7.05,'#1f8a4c');
  [-4,4].forEach(dx=>{S.box(cx+dx-.6,cx+dx+.6,0,1.7,cz2-.4,cz2+.4,'#1f8a4c');S.box(cx+dx-.5,cx+dx+.5,1.2,1.6,cz2-.42,cz2+.42,'#f2f2f2');col(cx+dx-.7,cx+dx+.7,cz2-.5,cz2+.5,1.7);});
  const kz=face>0?[z1-8,z1-1]:[z0+1,z0+8];S.box(x0+4,x1-4,0,4,kz[0],kz[1],'#efe7d6');col(x0+4,x1-4,kz[0],kz[1],4);
  plainSign(name,12,1.6,cx,6,face>0?cz2-7.06:cz2+7.06,face>0?Math.PI:0,{bg:'#1f8a4c',glow:true});
  const pole=face>0?[x0+1,z0+1.5]:[x1-1,z1-1.5];S.box(pole[0]-.2,pole[0]+.2,0,8,pole[1]-.2,pole[1]+.2,'#ddd');plainSign('بنزين',3,3,pole[0],8.5,pole[1]+(face>0?-.25:.25),face>0?Math.PI:0,{bg:'#f2b705',fg:'#1b1b1b',h:1024,glow:true});
  const st=STATIONS_F.find(s=>s.n===name);st.sx=cx;st.sz=cz2;}
function fishMarket(){const x0=-242,x1=-202;for(let i=0;i<4;i++){const x=x0+2+i*10;S.box(x,x+8,0,.9,24,28,'#8a6a4a');S.box(x-.3,x+8.3,2.8,3,22,30,pick(['#2a6fb0','#c9302a','#e7c23a','#2f7a4a']));[x,x+8].forEach(px=>[22.3,29.7].forEach(pz=>S.box(px-.08,px+.08,0,2.8,pz-.08,pz+.08,'#777')));S.box(x+.3,x+7.7,.9,1.0,24.2,27.8,'#c8d7e0');col(x,x+8,24,28,1);}
  plainSign('سوق السمك',10,1.6,-222,4.2,19.5,Math.PI,{bg:'#1f6f7a',glow:true});S.box(-227.2,-226.8,0,4,19.6,20,'#666');S.box(-217.2,-216.8,0,4,19.6,20,'#666');
  person({shirt:'#e9e2d0',pants:'#e9e2d0',skin:'#8a5a3b',cap:'#ffffff',galabeya:true},-230,22,Math.PI);person({shirt:'#3a5f8f',pants:'#2b2b2b',skin:'#9c6b48'},-210,21.5,Math.PI);}
function mosque(x,z){S.box(x,x+17,0,7,z,z+14,'#efe8d8');S.box(x-.2,x+17.2,7,7.5,z-.2,z+14.2,'#d9cfb9');S.xf(NI.hemi,x+8.5,7.5,z+7,8.6,7,8.6,0,'#2f6b4f');S.cyl(.12,1.4,x+8.5,11.6,z+7,'#c8a43a');
  const mx=x+15.5,mz=z+1.5;S.cyl(1.05,16,mx,8,mz,'#efe8d8',12);S.cyl(1.7,.5,mx,14.8,mz,'#d9cfb9',12);S.cyl(.75,3.6,mx,17,mz,'#efe8d8',12);S.xf(NI.cone,mx,20,mz,1.9,2.6,1.9,0,'#2f6b4f');
  for(let i=0;i<4;i++)S.box(x+1.5+i*4,x+3.3+i*4,1.4,4.8,z-.05,z,'#3d6a76');col(x,x+17,z,z+14,7.5);col(mx-1.2,mx+1.2,mz-1.2,mz+1.2,20);}
function school(x,z){const tex=rep(texFacade,3,1.6);S.box(x,x+38,0,2.6,z,z+.6,'#c9b08a');col(x,x+38,z,z+.6,2.6);
  const m=new T.Mesh(new T.BoxGeometry(34,12,14),new T.MeshStandardMaterial({map:tex,color:'#f2dfb8',roughness:.85}));m.position.set(x+19,6,z+30);m.castShadow=m.receiveShadow=true;scene.add(m);col(x+2,x+36,z+23,z+37,12);
  plainSign('المدرسة الثانوية الصناعية',16,2,x+19,10.8,z+22.98,Math.PI,{bg:'#0f4a3a',glow:true});flag(x+4,z+4,9);
  S.box(x+15,x+23,0,3.2,z-.05,z+.65,'#0f4a3a');
  [[x+10,z+12],[x+13,z+13],[x+26,z+12]].forEach((p,i)=>person([{shirt:'#2e5e8c',pants:'#2e5e8c',skin:'#b07a55'},{shirt:'#e9e2d0',pants:'#384a63',skin:'#9c6b48'},{shirt:'#2e5e8c',pants:'#2e5e8c',skin:'#8f6446'}][i],p[0],p[1],rand(0,6)));}
function cafe(x,z){S.box(x,x+34,2.6,2.8,z,z+6,'#7a2f2a');for(let i=0;i<6;i++){const tx=x+3+i*5.5;S.cyl(.5,.08,tx,.8,z+3,'#ddd');S.cyl(.05,.8,tx,.4,z+3,'#888');S.box(tx-1.1,tx-.7,0,.5,z+2.7,z+3.3,'#c9302a');S.box(tx+.7,tx+1.1,0,.5,z+2.7,z+3.3,'#c9302a');}
  plainSign('قهوة البحّارة',9,1.4,x+17,3.6,z-.02,Math.PI,{bg:'#5b2a1c',glow:true});
  [[x+6,z+3.4],[x+17,z+3.2]].forEach(p=>person({shirt:'#e9e2d0',pants:'#e9e2d0',skin:'#8a5a3b',galabeya:true},p[0],p[1],Math.PI));}
/* ============ street names (Phase 8) ============
   Real names the player asked for, placed on the game's streets in the real west-to-east order (Wardian → Qabbari → port /
   shipyard). The game's street layout is a simplified version of the area, so a name sits on the street that plays its part,
   not on its surveyed line. Sources: the training-centre site plan (الشارع العام، شارع ترسانة الإسكندرية), the player
   (Qabbari: الإسناوي، الأمير لؤلؤ، أم السلطان، مسجد سيدي القباري) and listings of Wardian streets (حافظ حسين، الطيبي،
   الشهيد مصطفى عواد، المكس). */
const STREETS=[
  {n:'شارع المكس',d:'الورديان',a:[-445,0],b:[-300,0]},
  {n:'شارع المكس',d:'القباري',a:[-300,0],b:[-150,0]},
  {n:'الشارع العام',d:'الميناء والترسانة',a:[-150,0],b:[EX,0]},
  {n:'شارع حافظ حسين',d:'الورديان',a:[-375,0],b:[-375,195]},
  {n:'شارع الطيبي',d:'الورديان',a:[-440,0],b:[-440,120]},
  {n:'شارع الشهيد مصطفى عواد',d:'الورديان',a:[-440,120],b:[-300,120]},
  {n:'شارع الإسناوي',d:'القباري',a:[-250,0],b:[-250,235]},
  {n:'شارع أم السلطان',d:'القباري',a:[-300,120],b:[-150,120]},
  {n:'شارع الأمير لؤلؤ',d:'القباري',a:[-250,235],b:[-150,235]},
  {n:'شارع مسجد سيدي القباري',d:'القباري',a:[-150,0],b:[-150,235]},
  {n:'شارع ترسانة الإسكندرية',d:'مركز التدريب',a:[286,0],b:[286,235]}];
function streetSigns(){const names=[...new Set(STREETS.map(q=>q.n+'|'+q.d))];const CW=512,CH=150,NC=2,NR=Math.ceil(names.length/NC);
  const tex=ctex(CW*NC,CH*NR,g=>{names.forEach((k,i)=>{const [n,d]=k.split('|'),x=(i%NC)*CW,y=Math.floor(i/NC)*CH;g.fillStyle='#ffffff';g.fillRect(x+4,y+4,CW-8,CH-8);g.fillStyle='#1d4f9a';g.fillRect(x+12,y+12,CW-24,CH-24);
    g.strokeStyle='#ffffff';g.lineWidth=4;g.strokeRect(x+20,y+20,CW-40,CH-40);g.fillStyle='#ffffff';g.textAlign='center';g.textBaseline='middle';g.direction='rtl';let fs=52;g.font='bold '+fs+'px '+AR;while(g.measureText(n).width>CW-70&&fs>26){fs-=2;g.font='bold '+fs+'px '+AR;}
    g.fillText(n,x+CW/2,y+64);g.font='24px '+AR;g.fillStyle='rgba(255,255,255,.85)';g.fillText('حي '+d.replace('الميناء والترسانة','الجمرك').replace('مركز التدريب','الترسانة'),x+CW/2,y+112);});});
  const M=new Merger();const uv=k=>{const i=names.indexOf(k);return [1/NC,1/NR,(i%NC)/NC,1-(Math.floor(i/NC)+1)/NR];};
  const put=(k,x,z,ry)=>{const [us,vs,uo,vo]=uv(k);S.cyl(.06,3.4,x,1.7,z,'#5a6066',8);M.wall(x+Math.sin(ry)*.03,z+Math.cos(ry)*.03,1.6,2.75,.47,ry,'#ffffff',us,vs,uo,vo);M.wall(x-Math.sin(ry)*.03,z-Math.cos(ry)*.03,1.6,2.75,.47,ry+Math.PI,'#ffffff',us,vs,uo,vo);};
  for(const q of STREETS){const k=q.n+'|'+q.d,dx=q.b[0]-q.a[0],dz=q.b[1]-q.a[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,px=-uz,pz=ux,w=q.a[1]===0&&q.b[1]===0?13:7.4;
    /* a sign near each end and every ~120 m, on the kerb corner, plate facing along the street */
    const n=Math.max(2,Math.round(L/120));for(let i=0;i<n;i++){const t=n===1?.5:(i/(n-1));const along=12+t*(L-24);const side=i%2?1:-1;
      const x=q.a[0]+ux*along+px*w*side,z=q.a[1]+uz*along+pz*w*side;if(blockedAt(x,z))continue;put(k,x,z,Math.atan2(ux,uz));}}
  const m=new T.Mesh(M.geo(),new T.MeshStandardMaterial({map:tex,roughness:.5,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.25,side:T.FrontSide}));m.name='streetSigns';scene.add(m);}
function blockedAt(x,z){return colliders.some(q=>q.h>.05&&x>q.x0-.4&&x<q.x1+.4&&z>q.z0-.4&&z<q.z1+.4);}
/* parked vehicles placed while the world is built; the detailed models are fitted once they have loaded */
const PARKED=[];function parked(k,x,z,ry){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry||0;scene.add(g);PARKED.push([g,k]);return g;}
function microStand(o){S.box(229+o,241+o,3.4,3.6,172,192,'#2a6fb0');[[229.2,172.2],[240.8,172.2],[229.2,191.8],[240.8,191.8]].forEach(p=>S.box(p[0]+o-.1,p[0]+o+.1,0,3.4,p[1]-.1,p[1]+.1,'#888'));
  [176,183,189].forEach(z=>{parked(['micro','#f2f2f2'],235+o,z,Math.PI/2);col(231.5+o,238.5+o,z-1.2,z+1.2,2.5);});
  plainSign('موقف الميكروباص',8,1.3,241.3+o,4.4,182,-Math.PI/2,{bg:'#2a6fb0',glow:true});}
function billboards(){const ads=[['حلواني البحر','كنافة وبسبوسة من ١٩٦٠','#7a2f2a'],['زيت المحرّك','غيّر كل ٥٠٠٠ كم','#1f4e8c'],['مكتبة الطلبة','كل كتب الصنايع','#2f6b4f'],['سيراميك المتوسط','لمسة بحرية لبيتك','#6a3f8a'],['فول وطعمية الإسكندراني','من الفجر للضهر','#a0522d'],['شحن سريع','موبايلات وإكسسوارات','#c9302a']];
  ads.forEach((a,i)=>{const x=-270+i*100+rand(-10,10),z=i%2?-13.5:13.6,ry=i%2?0:Math.PI;S.box(x-.15,x+.15,0,4.5,z-.15,z+.15,'#3a3a3a');
    const tex=ctex(512,768,g=>{g.fillStyle=a[2];g.fillRect(0,0,512,768);g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.arc(256,300,200,0,7);g.fill();g.fillStyle='#fff';g.textAlign='center';g.direction='rtl';g.font='96px '+GAMEF;let s=96;while(g.measureText(a[0]).width>460){s-=6;g.font=s+'px '+GAMEF;}g.fillText(a[0],256,300);g.font='700 44px '+AR;g.fillStyle='#ffe9b0';g.fillText(a[1],256,560);g.strokeStyle='#fff';g.lineWidth=14;g.strokeRect(14,14,484,740);});
    const m=new T.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:.55});const p=new T.Mesh(new T.PlaneGeometry(2.6,3.9),m);p.position.set(x,6,z+(i%2?.18:-.18));p.rotation.y=ry;scene.add(p);S.box(x-1.4,x+1.4,4.0,8.05,z-.12,z+.12,'#2a2a2a');col(x-.3,x+.3,z-.3,z+.3,8);});}
const tlights=[];
function trafficLights(){[-150,-50,50,150].forEach(x=>{const p=[x+6.5,10.5];S.box(p[0]-.12,p[0]+.12,0,5,p[1]-.12,p[1]+.12,'#2d2d2d');S.box(p[0]-.35,p[0]+.35,3.4,5.2,p[1]-.25,p[1]+.25,'#1e1e1e');
  const r=new T.Mesh(NI.sph,new T.MeshBasicMaterial({color:'#ff3b2a'}));r.scale.setScalar(.36);r.position.set(p[0],4.75,p[1]-.27);scene.add(r);const gr=new T.Mesh(NI.sph,new T.MeshBasicMaterial({color:'#38ff6a'}));gr.scale.setScalar(.36);gr.position.set(p[0],3.85,p[1]-.27);scene.add(gr);tlights.push({r:r,g:gr,ph:Math.random()*10});});}
function archWarehouse(x0,x1,z0,z1,color,label){const L=x1-x0,D=z1-z0,h=7;const m=new T.Mesh(new T.BoxGeometry(L,h,D),new T.MeshStandardMaterial({map:rep(texConc,L/14,1),color:color}));m.position.set((x0+x1)/2,h/2,(z0+z1)/2);m.castShadow=m.receiveShadow=true;scene.add(m);
  const g=new T.CylinderGeometry(D/2,D/2,L,24,1,false,0,Math.PI);g.rotateZ(Math.PI/2);g.scale(1,.42,1);const r=new T.Mesh(g,new T.MeshStandardMaterial({map:rep(texCorr,L/4,2),color:'#8c979b',metalness:.3,roughness:.55}));r.position.set((x0+x1)/2,h,(z0+z1)/2);r.castShadow=true;scene.add(r);
  for(let i=0;i<2;i++){const dx=x0+L*(i?.7:.3);S.box(dx-4,dx+4,0,5.5,z1,z1+.06,'#8e979b');}
  plainSign(label,10,1.5,(x0+x1)/2,6.2,z1+.08,0,{bg:'#f1ead8',fg:'#173f6b',border:'#173f6b'});col(x0,x1,z0,z1,h+D*.21);}
function sts(x){const b='#2c6ea6',dk='#30343a';const z1=-123.6,z2=-119.4;
  [[-7.5,z1],[7.5,z1],[-7.5,z2],[7.5,z2]].forEach(p=>{SM.box(x+p[0]-.7,x+p[0]+.7,0,30,p[1]-.7,p[1]+.7,b);SM.box(x+p[0]-1,x+p[0]+1,0,1,p[1]-1.3,p[1]+1.3,dk);col(x+p[0]-1,x+p[0]+1,p[1]-1.3,p[1]+1.3,30);});
  [z1,z2].forEach(z=>SM.box(x-8.2,x+8.2,28,30,z-.6,z+.6,b));[-7.5,7.5].forEach(dx=>{SM.box(x+dx-.6,x+dx+.6,12,13.2,z1,z2,b);SM.box(x+dx-.6,x+dx+.6,28,30,z1,z2,b);});
  SM.box(x-1.6,x+1.6,31,33.2,-180,-108,b);SM.box(x-1.5,x+1.5,33.2,33.5,-180,-108,'#e9e7e1');SM.box(x-3,x+3,33.5,37,-114,-108,'#e9e7e1');
  [-7.5,7.5].forEach(d=>{SM.beam(V(x+d,30,z1),V(x+d*.3,50,-118),1,b);SM.beam(V(x+d,30,z2),V(x+d*.3,50,-118),1,b);});SM.box(x-2.6,x+2.6,49,51,-119,-117,b);
  SM.beam(V(x,50.5,-118),V(x-1.4,33.2,-178),.25,dk);SM.beam(V(x,50.5,-118),V(x+1.4,33.2,-178),.25,dk);
  const tg=new T.Group();const tm=new T.MeshStandardMaterial({color:'#30343a'});const t1=new T.Mesh(NI.box,tm);t1.scale.set(3.6,1,4);t1.position.y=30.5;tg.add(t1);const cb=new T.Mesh(NI.box,tm);cb.scale.set(.1,21,.1);cb.position.y=19.5;tg.add(cb);const sp=new T.Mesh(NI.box,new T.MeshStandardMaterial({color:'#e2a21c'}));sp.scale.set(2.6,.8,12.4);sp.position.y=8.6;tg.add(sp);
  tg.position.set(x,0,-140);scene.add(tg);trolleys.push({g:tg,a:-170,b:-122,sp:rand(.1,.18),ph:rand(0,6),axis:'z'});}
function ship(o){const L=o.L,B=o.B;const s=new T.Shape();s.moveTo(-L/2,-B*.42);s.lineTo(L/2-B*1.4,-B/2);s.quadraticCurveTo(L/2-B*.15,-B/2,L/2,0);s.quadraticCurveTo(L/2-B*.15,B/2,L/2-B*1.4,B/2);s.lineTo(-L/2,B*.42);s.closePath();
  const mk=(depth,y,color)=>{const g=new T.ExtrudeGeometry(s,{depth:depth,bevelEnabled:false});g.rotateX(-Math.PI/2);const m=new T.Mesh(g,new T.MeshStandardMaterial({color:color,roughness:.6,metalness:.15}));m.position.set(o.x,y,o.z);m.castShadow=m.receiveShadow=true;scene.add(m);};
  mk(o.hB,o.y0,o.bottom);mk(o.hT,o.y0+o.hB,o.top);const dg=new T.ShapeGeometry(s);dg.rotateX(-Math.PI/2);const dm=new T.Mesh(dg,new T.MeshStandardMaterial({color:o.deck}));dm.position.set(o.x,o.y0+o.hB+o.hT+.02,o.z);scene.add(dm);
  const top=o.y0+o.hB+o.hT,sx=o.x-L/2+B*.1,sw=B*.62;
  S.box(sx,sx+sw,top,top+4.5,o.z-B*.38,o.z+B*.38,o.sup);S.box(sx+1,sx+sw-.5,top+4.5,top+8.5,o.z-B*.34,o.z+B*.34,o.sup);S.box(sx+2,sx+sw-1.5,top+8.5,top+11.5,o.z-B*.5,o.z+B*.5,o.sup);
  S.box(sx+sw-1.52,sx+sw-1.48,top+9,top+10.8,o.z-B*.5,o.z+B*.5,'#1f3340');S.box(sx+B*.05,sx+B*.2,top+4,top+13.5,o.z-B*.12,o.z+B*.12,o.funnel);S.cyl(.18,9,o.x+L/2-B*.9,top+4.5,o.z,'#d0d0d0');}

function shipyard(){
  /* dry dock */
  const fl=new T.Mesh(new T.PlaneGeometry(70,63),new T.MeshStandardMaterial({map:rep(texConc,4,4),color:'#8a8478'}));fl.rotation.x=-Math.PI/2;fl.position.set(230,-9,-93.5);fl.receiveShadow=true;scene.add(fl);
  for(let i=0;i<3;i++){const s=i*1.3;S.box(193,195+s,-9,-6+i*3,-126,-62,'#6d675d');S.box(265-s,267,-9,-6+i*3,-126,-62,'#6d675d');S.box(193,267,-9,-6+i*3,-62-s,-61,'#6d675d');}
  SM.box(193,267,-9,.4,-127.2,-125.4,'#4b5258');for(let x=206;x<=254;x+=4)S.box(x-.6,x+.6,-9,-8.3,-93.2,-90.8,'#5b4a35');
  ship({x:230,z:-92,L:58,B:12,y0:-8.3,hB:4.6,hT:5.2,bottom:'#9a2f25',top:'#3a4a58',deck:'#6b5a4a',sup:'#efece4',funnel:'#173f6b'});
  col(195,265,-200,-61,0);
  for(let x=196;x<264;x+=3.2)S.box(x,x+2.9,0,.85,-61.6,-61,'#c9302a');col(193,267,-61.8,-61,1);
  /* goliath gantry */
  const red='#f39212',wh='#ece9e1',zc=-92;
  [189,271].forEach(x=>{SM.beam(V(x,0,zc-9),V(x,55,zc-1.6),1.9,red);SM.beam(V(x,0,zc+9),V(x,55,zc+1.6),1.9,red);SM.beam(V(x,20,zc-6),V(x,20,zc+6),.9,red);SM.box(x-2,x+2,0,1.3,zc-10,zc+10,'#3a3a3a');col(x-2.2,x+2.2,zc-10.2,zc+10.2,55);});
  SM.box(185,275,55,60.5,zc-3.2,zc+3.2,red);SM.box(185,275,60.5,61.1,zc-3.4,zc+3.4,wh);
  plainSign('شركة ترسانة الإسكندرية',34,4,230,57.8,zc+3.26,0,{bg:red,border:false,sub:'Alexandria Shipyard · 300 Ton',glow:true});plainSign('ترسانة الإسكندرية',34,4,230,57.8,zc-3.26,Math.PI,{bg:red,border:false,sub:'ALEXANDRIA SHIPYARD'});
  const tg=new T.Group();const tm=new T.MeshStandardMaterial({color:wh});const tt=new T.Mesh(NI.box,tm);tt.scale.set(6,3,7.2);tt.position.y=62.6;tg.add(tt);const cbl=new T.Mesh(NI.box,new T.MeshStandardMaterial({color:'#222'}));cbl.scale.set(.12,52,.12);cbl.position.y=35;tg.add(cbl);const hk=new T.Mesh(NI.box,new T.MeshStandardMaterial({color:'#e2a21c'}));hk.scale.set(1.6,1.6,1.6);hk.position.y=8.4;tg.add(hk);
  tg.position.set(230,0,zc);scene.add(tg);trolleys.push({g:tg,a:205,b:255,sp:.06,ph:0,axis:'x'});
  /* hull workshop (drive-in through east door) */
  hall(122,160,-90,-52,15,'#eef0ea','ورشة الهياكل',{z0:-70,z1:-56},'#9cc79a');
  /* machine shop */
  hall(122,160,-122,-96,13,'#eef0ea','ورشة الماكينات',null,'#9cc79a');
  /* yard props */
  [[126,142,-36,-24]].forEach(b=>{S.box(b[0],b[1],0,6,b[2],b[3],'#c4602b');S.box(b[0]+.4,b[1]-.4,6,6.4,b[2]+.4,b[3]-.4,'#7a858c');col(b[0],b[1],b[2],b[3],6);});
  for(let i=0;i<8;i++)S.cyl(.22,1.6,125+i*.55,.8,-36,i%2?'#2f6b4f':'#c9302a');
  person({shirt:'#e86a1c',pants:'#2b3a52',skin:'#9a6b4a',helmet:'#f2c230'},178,-103,0);
  yardSheds();}
/* with the training centre moved out, its old plot inside the shipyard holds plain shipyard sheds */
function yardSheds(){[[188,228,-60,-45],[236,292,-60,-45],[188,228,-31,-19],[236,292,-31,-19]].forEach(([x0,x1,z0,z1],i)=>{S.box(x0,x1,0,9,z0,z1,i?'#9aa5ae':'#a9b2ba');S.box(x0-.3,x1+.3,9,9.6,z0-.3,z1+.3,'#6f7880');for(let x=x0+3;x<x1-3;x+=9)S.box(x,x+5,0,6,z1,z1+.15,'#5c656d');col(x0,x1,z0,z1,9.6);});}
/* ============ landmarks modelled on the Alexandria Port / Shipyard photos ============ */
function mainGate(g){const x=g.x,z0=-21,z1=-13.5,gl='#4f8f95',st='#e7e1d2',gold='#c9a23a';
  [-1,1].forEach(s=>{const a=x+s*9,b=x+s*17;const xa=Math.min(a,b),xb=Math.max(a,b);
    S.box(xa,xb,0,16,z0,z1,st);S.box(xa+.6,xb-.6,1.4,15,z1-.01,z1+.05,gl);for(let y=4;y<15;y+=3.2)S.box(xa+.6,xb-.6,y,y+.25,z1+.05,z1+.12,gold);
    for(let k=0;k<3;k++){const cx=xa+1.4+k*(xb-xa-2.8)/2;S.cyl(.55,10,cx,5,z1+1.2,st,12);S.box(cx-.8,cx+.8,0,.6,z1+.4,z1+2,st);S.box(cx-.75,cx+.75,10,10.6,z1+.45,z1+1.95,st);}
    S.box(xa-.3,xb+.3,16,17,z0-.3,z1+.3,st);S.box(xa+1,xb-1,17,18.6,z0+.8,z1-.6,st);col(xa,xb,z0,z1+2,16);});
  S.box(x-17,x+17,12.4,15.6,z1-1.2,z1+1.6,st);S.box(x-17.3,x+17.3,15.6,16.2,z1-1.4,z1+1.8,gold);
  plainSign('ميناء الإسكندرية',26,2.6,x,14,z1+1.62,0,{bg:'#efe9da',fg:'#23324a',border:false,sub:'PORT OF ALEXANDRIA'});
  plainSign('ميناء الإسكندرية',26,2.6,x,14,z1-1.22,Math.PI,{bg:'#efe9da',fg:'#23324a',border:false,sub:'PORT OF ALEXANDRIA'});
  [-1,1].forEach(s=>{S.box(x+s*6.6-.25,x+s*6.6+.25,0,1.2,-18.5,-18,'#333333');const arm=new T.Mesh(NI.box,new T.MeshStandardMaterial({map:rep(texRW,5,1)}));arm.scale.set(6,.2,.2);arm.position.set(x+s*(6.6-1.4),3.6,-18.25);arm.rotation.z=s*1.05;scene.add(arm);});
  S.box(x+18,x+21,0,2.8,-25,-21.5,'#e9e1cf');S.box(x+17.7,x+21.3,2.8,3.1,-25.3,-21.2,'#3d3a35');col(x+18,x+21,-25,-21.5,3);
  flag(x+23,-18,12);person({shirt:'#2d3b4f',pants:'#2d3b4f',skin:'#8f6446',cap:'#24303f'},x+11.8,-18.8,0);}
function cruiseTerminal(){const x0=-272,x1=-236,z0=-70,z1=-42,cx=(x0+x1)/2,cr='#ece6d6',bl='#2c5f9e';
  S.box(x0,x1,0,9,z0,z1,cr);S.box(x0-.4,x1+.4,9,9.8,z0-.4,z1+.4,'#d8cfba');col(x0,x1,z0,z1,10);
  for(let x=x0+1.5;x<x1-1;x+=3){S.box(x,x+2,1,7.4,z1-.02,z1+.06,bl);S.cyl(.35,8.4,x-.5,4.2,z1+.9,cr,12);}
  S.box(x0,x1,8.4,9,z1,z1+1.6,cr);for(let x=x0+.5;x<x1;x+=3)S.cyl(.35,8.4,x,4.2,z1+.9,cr,12);
  S.cyl(5.5,2.2,cx,10.9,(z0+z1)/2,cr,12);S.xf(NI.hemi,cx,12,(z0+z1)/2,11,9,11,0,'#bcd3ea');S.cyl(.4,2,cx,17.5,(z0+z1)/2,'#c9a23a');
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;S.box(cx+Math.cos(a)*5.45-.15,cx+Math.cos(a)*5.45+.15,9.8,12.1,(z0+z1)/2+Math.sin(a)*5.45-.15,(z0+z1)/2+Math.sin(a)*5.45+.15,'#2c5f9e');}
  plainSign('محطة الركاب البحرية',16,2,cx,7.9,z1+1.62,0,{bg:'#2c5f9e',sub:'ALEXANDRIA CRUISE TERMINAL',glow:true});
  /* fountain roundabout + palms + lamp posts like the photo */
  const fx=-252,fz=-38;S.cyl(3.2,.5,fx-30,.25,fz+0,'#d8d2c2',12);
  [[-264,-37],[-240,-37],[-268,-74],[-236,-74]].forEach(p=>{palmsList.push([p[0],p[1],rand(8,10)]);});
  for(let x=x0+2;x<x1;x+=8)for(const dz of [-.3]){S.box(x-.08,x+.08,0,6,z1+3.6+dz,z1+3.76+dz,'#2a2a2a');S.cyl(.32,.5,x,6.2,z1+3.7,'#fff3c4');}}
function cruiseShip(x,z){const L=170,B=26;ship({x:x,z:z,L:L,B:B,y0:-6,hB:5,hT:8,bottom:'#1f3f7a',top:'#f4f4f2',deck:'#e9e6df',sup:'#f4f4f2',funnel:'#f2c218'});
  const top=7;for(let k=0;k<6;k++){const a=x-L*.42+k*4,b=x+L*.32-k*7;S.box(a,b,top+k*3,top+k*3+3,z-B*.45+k*.6,z+B*.45-k*.6,'#f6f6f4');S.box(a+1,b-1,top+k*3+1.1,top+k*3+2.1,z+B*.45-k*.6,z+B*.45-k*.6+.08,'#2c4f7a');S.box(a+1,b-1,top+k*3+1.1,top+k*3+2.1,z-B*.45+k*.6-.08,z-B*.45+k*.6,'#2c4f7a');}
  for(let i=0;i<8;i++){const lx=x-L*.3+i*14;S.box(lx,lx+6,top+3.2,top+5,z+B*.47,z+B*.5+1,'#ff8a1a');}
  S.box(x-L*.3,x-L*.3+9,top+18,top+25,z-3,z+3,'#f2c218');S.box(x-L*.3-.2,x-L*.3+9.2,top+24,top+25.4,z-3.2,z+3.2,'#1b1d22');
  plainSign('ALEXANDRIA',30,3,x+10,1.2,z+B*.5+.05,0,{bg:'#1f3f7a',border:false,fg:'#fff'});}
function shipLabel(x,z,L,B,text,bg){plainSign(text,34,4.5,x+L*.12,-2.2,z+B*.5+.08,0,{bg:bg,border:false,fg:'#fff'});}
function deckCranes(x,z,L,top){[-.18,.08,.32].forEach(f=>{const cx=x+L*f;S.cyl(.9,6,cx,top+3,z,'#f2c218');SM.beam(V(cx,top+6,z),V(cx+9,top+18,z+2),.8,'#f2c218');SM.beam(V(cx,top+6.5,z),V(cx-1.5,top+9,z),.6,'#f2c218');
  S.box(cx-5,cx-1,top,top+2.2,z-6,z+6,'#2f7a52');S.box(cx+1,cx+5,top,top+2.2,z-6,z+6,'#2f7a52');});}
function luffCrane(x,z,ry){const o='#f2750c',d='#2f2f33';const c=Math.cos(ry),sn=Math.sin(ry);const P=(lx,y,lz)=>V(x+lx*c+lz*sn,y,z-lx*sn+lz*c);
  [[-3.5,-3.5],[3.5,-3.5],[-3.5,3.5],[3.5,3.5]].forEach(q=>SM.beam(P(q[0],0,q[1]),P(q[0]*.4,9,q[1]*.4),1,o));col(x-4,x+4,z-4,z+4,10);
  S.box(x-2.2,x+2.2,9,10.2,z-2.2,z+2.2,o);SM.beam(P(0,10,0),P(0,22,0),1.6,o);SM.beam(P(-1.5,10,0),P(-1.2,21,0),.5,o);
  const cab=P(1.2,13,1.6);S.box(cab.x-1.2,cab.x+1.2,12,15,cab.z-1.2,cab.z+1.2,'#f6f3ea');
  SM.beam(P(.5,12,0),P(24,30,0),1.1,o);SM.beam(P(0,22,0),P(24,30,0),.4,d);SM.beam(P(0,22,0),P(-7,15,0),.9,o);const cw=P(-7.5,13.5,0);S.box(cw.x-1.8,cw.x+1.8,12,15.5,cw.z-1.8,cw.z+1.8,d);
  const tip=P(24,30,0);SM.beam(tip,V(tip.x,14,tip.z),.12,d);S.box(tip.x-.6,tip.x+.6,13,14,tip.z-.6,tip.z+.6,d);}
function floatingDock(x,z){const L=110,blu='#1f5fa8',grn='#2e8b57';const z0=z-L/2,z1=z+L/2;
  [[-14,-8],[8,14]].forEach(w=>{S.box(x+w[0],x+w[1],-1.6,9,z0,z1,blu);S.box(x+w[0]-.05,x+w[1]+.05,9,9.6,z0,z1,grn);for(let zz=z0+6;zz<z1;zz+=9)S.box(x+w[0]-.1,x+w[1]+.1,9.6,10.6,zz,zz+.4,'#e9e6df');});
  S.box(x-8,x+8,-1.6,1.4,z0,z1,'#7d8288');for(let zz=z0+8;zz<z1-8;zz+=7)S.box(x-1,x+1,1.4,2.4,zz,zz+1.2,'#c0502a');S.box(x-3,x+3,1.41,1.45,z0+20,z0+40,'#a8432a');
  SM.beam(V(x-14,9.6,z0+4),V(x+14,9.6,z0+4),.6,blu);SM.beam(V(x-14,9.6,z0+4),V(x-14,14,z0+4),.5,blu);SM.beam(V(x+14,9.6,z0+4),V(x+14,14,z0+4),.5,blu);SM.beam(V(x-14,14,z0+4),V(x+14,14,z0+4),.6,blu);
  [[x-11,z0+30],[x+11,z1-26]].forEach(p=>{SM.beam(V(p[0],9.6,p[1]),V(p[0],32,p[1]),1.1,blu);SM.beam(V(p[0],30,p[1]),V(p[0]+(p[0]<x?16:-16),36,p[1]),.7,blu);S.box(p[0]-1.4,p[0]+1.4,24,27,p[1]-1.4,p[1]+1.4,'#f2750c');});}
function tugboat(x,z,ry){const g=new Merger();const P=(a,b,c,d,e,f,col)=>g.box(a,b,c,d,e,f,col);
  P(-7,7,-1.6,1.2,-3,3,'#0f6f8f');P(-7.2,7.2,1.2,1.6,-3.1,3.1,'#e9e6df');P(-2.5,3.5,1.6,4.2,-2,2,'#f4f4f2');P(-1.5,3,4.2,6,-1.6,1.6,'#f4f4f2');P(-1.4,2.9,4.6,5.4,-1.62,1.62,'#1f3340');
  P(-4.5,-3.5,1.6,5,-.6,.6,'#c9302a');P(5,7.2,1.2,2.2,-1,1,'#3a3a3a');for(let i=-6;i<=6;i+=2)P(i-.4,i+.4,-.4,.6,3,3.5,'#1b1b1b');
  const m=g.mesh(VC);m.position.set(x,0,z);m.rotation.y=ry;bobbers.push({m:m,ph:rand(0,6)});}
const bobbers=[];
function lighthouse(x,z){for(let k=0;k<8;k++){const r=3-k*.18;S.cyl(r,3,x,1.6+k*3+1.5,z,k%2?'#c9302a':'#f4f1ea',12);}S.cyl(2.2,.6,x,26.4,z,'#2a2a2a',12);S.cyl(1.4,2.2,x,27.8,z,'#fff3c4',12);S.xf(NI.cone,x,30,z,3.2,1.8,3.2,0,'#c9302a');
  const l=new T.PointLight('#fff1c0',2.2,120,1.4);l.position.set(x,28,z);scene.add(l);}

/* ===== port extras ===== */
function rtg(x,z0,z1){const w='#e9e7e1',b='#2c6ea6';[[x-6,z0],[x+6,z0],[x-6,z1],[x+6,z1]].forEach(p=>{SM.box(p[0]-.45,p[0]+.45,1,18,p[1]-.45,p[1]+.45,w);SM.box(p[0]-.6,p[0]+.6,0,1.2,p[1]-1.1,p[1]+1.1,'#30343a');});
  [z0,z1].forEach(z=>SM.box(x-6.5,x+6.5,16.5,18,z-.55,z+.55,w));[x-6,x+6].forEach(xx=>SM.box(xx-.6,xx+.6,18,19.4,z0-.6,z1+.6,b));SM.box(x-1.6,x+1.6,19.4,21.2,(z0+z1)/2-1.8,(z0+z1)/2+1.8,w);SM.box(x-6.2,x-4.4,10,12,z1-1.6,z1,'#1f3340');SM.box(x-.06,x+.06,8,19.4,(z0+z1)/2-.06,(z0+z1)/2+.06,'#222');SM.box(x-1.3,x+1.3,7.4,8,(z0+z1)/2-6.1,(z0+z1)/2+6.1,'#e2a21c');}
const texGlassF=ctex(256,256,g=>{const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#6f9cc4');gr.addColorStop(1,'#2d4f72');g.fillStyle=gr;g.fillRect(0,0,256,256);g.fillStyle='#e9eef2';for(let i=0;i<=4;i++){g.fillRect(i*64-3,0,6,256);g.fillRect(0,i*64-4,256,8);}g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(0,256);g.lineTo(256,0);g.lineTo(256,60);g.lineTo(60,256);g.fill();});
const texGlassFLit=ctex(256,256,g=>{g.fillStyle='#000';g.fillRect(0,0,256,256);for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(Math.random()<.45){g.fillStyle=Math.random()<.7?'#ffd59a':'#cfe6ff';g.fillRect(c*64+4,r*64+5,56,54);}});
function portAdmin(){const x0=48,x1=92,z0=-68,z1=-42,h=18;const m=new T.Mesh(new T.BoxGeometry(x1-x0,h,z1-z0),new T.MeshStandardMaterial({map:rep(texGlassF,(x1-x0)/11,h/9),emissiveMap:rep(texGlassFLit,(x1-x0)/11,h/9),emissive:'#ffffff',emissiveIntensity:.7,roughness:.2,metalness:.45,color:'#e6eef5'}));
  m.position.set((x0+x1)/2,h/2,(z0+z1)/2);m.castShadow=m.receiveShadow=true;scene.add(m);col(x0,x1,z0,z1,h);S.box(x0-.4,x1+.4,h,h+.8,z0-.4,z1+.4,'#d9d4c8');S.box(x0-.2,x1+.2,0,1.2,z0-.2,z1+.2,'#8c8478');
  S.box(62,78,4,4.5,z1,z1+4,'#173f6b');[62.5,77.5].forEach(x=>{S.cyl(.2,4,x,2,z1+3.6,'#e9e9e9');col(x-.3,x+.3,z1+3.3,z1+3.9,4);});
  S.box(64,76,h+.8,h+4.4,-55.3,-54.7,'#173f6b');plainSign('هيئة ميناء الإسكندرية',12,3.2,70,h+2.6,-54.68,0,{bg:'#173f6b',sub:'ALEXANDRIA PORT AUTHORITY',glow:true});plainSign('هيئة ميناء الإسكندرية',20,2.4,70,h-2,z1+.06,0,{bg:'#173f6b',sub:'ALEXANDRIA PORT AUTHORITY',glow:true});
  [58,70,82].forEach(x=>flag(x,z1+6.5,11));}
function customs(){[[33,-24],[47,-24],[33,-19.6],[47,-19.6]].forEach(p=>{S.box(p[0]-.3,p[0]+.3,0,6,p[1]-.3,p[1]+.3,'#e9e9e9');col(p[0]-.35,p[0]+.35,p[1]-.35,p[1]+.35,6);});
  S.box(31.5,48.5,6,6.7,-25.2,-18.4,'#f2f2f2');S.box(31.45,48.55,6.1,6.6,-25.25,-18.35,'#173f6b');plainSign('الجمارك – التفتيش',12,1.2,40,7.4,-18.35,0,{bg:'#173f6b',glow:true});}
const boats=[];
function harbourLife(){S.box(-334,-326,-1.6,1.4,-330,-322,'#5e5560');for(let i=0;i<6;i++)S.cyl(2.2-i*.15,4,-330,1.4+2+i*4,-326,i%2?'#f2f2f2':'#c9302a',12);S.cyl(1.6,2.5,-330,27.6,-326,'#2a2a2a',12);
  const lg=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#fff2b0',transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false}));lg.scale.set(14,14,1);lg.position.set(-330,27.6,-326);scene.add(lg);
  const tug=()=>{const g=new T.Group();const s=new T.Shape();s.moveTo(-6,-2.2);s.lineTo(4,-2.4);s.quadraticCurveTo(7,0,4,2.4);s.lineTo(-6,2.2);s.closePath();const hg=new T.ExtrudeGeometry(s,{depth:2.4,bevelEnabled:false});hg.rotateX(-Math.PI/2);
    const h=new T.Mesh(hg,new T.MeshStandardMaterial({color:'#b23a2a',roughness:.6}));h.position.y=-1.6;g.add(h);const c=new T.Mesh(NI.box,new T.MeshStandardMaterial({color:'#f2f2f2'}));c.scale.set(4,2.4,3);c.position.set(-1,1.9,0);g.add(c);const f=new T.Mesh(NI.box,new T.MeshStandardMaterial({color:'#1b1b1b'}));f.scale.set(1,1.6,1);f.position.set(-2.5,3.8,0);g.add(f);
    g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);return g;};
  boats.push({g:tug(),cx:-40,cz:-215,r:55,sp:.05,ph:0},{g:tug(),cx:120,cz:-240,r:70,sp:-.035,ph:2});}
function hall(x0,x1,z0,z1,h,color,label,door,roofC){const t=.6;const wm=len=>new T.MeshStandardMaterial({map:rep(texCorr,len/5,1),color:color,metalness:.25,roughness:.6});
  const w=(a,b,c,d,e,f,m)=>{const o=new T.Mesh(NI.box,m);o.position.set((a+b)/2,(c+d)/2,(e+f)/2);o.scale.set(b-a,d-c,f-e);o.castShadow=o.receiveShadow=true;scene.add(o);};
  const mx=wm(x1-x0),mz=wm(z1-z0);
  w(x0,x1,0,h,z0,z0+t,mx);w(x0,x1,0,h,z1-t,z1,mx);w(x0,x0+t,0,h,z0,z1,mz);col(x0,x1,z0,z0+t,h);col(x0,x1,z1-t,z1,h);col(x0,x0+t,z0,z1,h);
  if(door){w(x1-t,x1,0,h,z0,door.z0,mz);w(x1-t,x1,0,h,door.z1,z1,mz);w(x1-t,x1,11,h,door.z0,door.z1,mz);col(x1-t,x1,z0,door.z0,h);col(x1-t,x1,door.z1,z1,h);
    S.box(x1-.1,x1+.3,0,11,door.z0-.6,door.z0,'#f2b705');S.box(x1-.1,x1+.3,0,11,door.z1,door.z1+.6,'#f2b705');
    const fl=new T.Mesh(new T.PlaneGeometry(x1-x0-1.2,z1-z0-1.2),new T.MeshStandardMaterial({map:rep(texConc,3,3),color:'#9a9284'}));fl.rotation.x=-Math.PI/2;fl.position.set((x0+x1)/2,.03,(z0+z1)/2);fl.receiveShadow=true;scene.add(fl);
    S.box(126,138,0,7,-86,-74,'#c4602b');col(126,138,-86,-74,7);for(let i=0;i<6;i++)S.box(126,136,.1+i*.25,.33+i*.25,-66,-58,'#56646c');col(126,136,-66,-58,1.6);
    const pl=new T.PointLight('#ffcf9a',1.2,60,1.6);pl.position.set(141,12,-71);scene.add(pl);
    sparksAt(138.4,2,-80);person({shirt:'#2e5e8c',pants:'#2e5e8c',skin:'#7f5538',helmet:'#2b2b2b'},139.2,-80,Math.PI/2);}
  else{w(x1-t,x1,0,h,z0,z1,mz);col(x1-t,x1,z0,z1,h);}
  const D=x1-x0;const s=new T.Shape();s.moveTo(-D/2-1,0);s.lineTo(D/2+1,0);s.lineTo(0,6);s.closePath();const rg=new T.ExtrudeGeometry(s,{depth:z1-z0+2,bevelEnabled:false});
  const r=new T.Mesh(rg,new T.MeshStandardMaterial({map:rep(texCorr,D/4,(z1-z0)/14),color:roofC||'#7b8a92',metalness:.35,roughness:.5}));if(roofC){S.box(x0-.05,x1+.05,h-1.6,h-.8,z0-.05,z0+.05,'#1f9a6a');S.box(x0-.05,x1+.05,h-1.6,h-.8,z1-.05,z1+.05,'#1f9a6a');S.box(x0-.05,x0+.05,h-1.6,h-.8,z0,z1,'#1f9a6a');S.box(x1-.05,x1+.05,h-1.6,h-.8,z0,z1,'#1f9a6a');for(let k=1;k<4;k++){const zz=z0+(z1-z0)*k/4;S.box((x0+x1)/2-D*.3,(x0+x1)/2+D*.3,h+3.2,h+3.9,zz-1.2,zz+1.2,'#d8efe0');}}r.position.set((x0+x1)/2,h,z0-1);r.castShadow=r.receiveShadow=true;scene.add(r);
  plainSign(label,14,2,x1+.06,h-2.4,(z0+z1)/2,Math.PI/2,{bg:'#f1ead8',fg:'#7a1f1a',border:'#7a1f1a'});}
const emitters=[];
function sparksAt(x,y,z,dx){const w=new T.PointLight('#a9d8ff',0,14,2);w.position.set(x,y+.3,z);scene.add(w);const N=50,pos=new Float32Array(N*3);for(let i=1;i<N*3;i+=3)pos[i]=-50;const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));const pts=new T.Points(g,new T.PointsMaterial({color:'#ffd27a',size:.1,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));pts.frustumCulled=false;scene.add(pts);emitters.push({pts:pts,pos:pos,vel:new Float32Array(N*3),life:new Float32Array(N),N:N,o:[x,y,z],w:w,dx:dx===undefined?1:dx,ph:Math.random()*6});}

/* lamps & palms: instanced */
function buildLamps(){const M=new Merger();M.cyl(.13,9,0,4.5,0,'#6c7178');M.box(-.08,.08,8.8,8.95,0,2,'#6c7178');M.box(-.3,.3,8.55,8.85,1.6,2.5,'#4a4f55');
  const g=M.geo();const im=new T.InstancedMesh(g,VC,lampsList.length);im.castShadow=true;
  const gpos=new Float32Array(lampsList.length*3);
  lampsList.forEach((l,i)=>{_dum.position.set(l[0],0,l[1]);_dum.rotation.set(0,l[2],0);_dum.scale.set(1,1,1);_dum.updateMatrix();im.setMatrixAt(i,_dum.matrix);const s=Math.sin(l[2]),c=Math.cos(l[2]);gpos[i*3]=l[0]+2*s;gpos[i*3+1]=8.45;gpos[i*3+2]=l[1]+2*c;col(l[0]-.25,l[0]+.25,l[1]-.25,l[1]+.25,9);});
  scene.add(im);const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(gpos,3));
  glowPts=new T.Points(pg,new T.PointsMaterial({map:texGlow,color:'#ffd9a0',size:3.4,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:true}));scene.add(glowPts);}
function buildPalms(){const tr=new T.InstancedMesh(new T.CylinderGeometry(.2,.32,1,7),new T.MeshStandardMaterial({color:'#6e5440',roughness:.9}),palmsList.length);
  const L=new T.PlaneGeometry(1.1,4.4,1,4);L.rotateX(-Math.PI/2);L.translate(0,0,2.2);const p=L.attributes.position;for(let i=0;i<p.count;i++){const zz=p.getZ(i);p.setY(i,-zz*zz*.05);p.setX(i,p.getX(i)*(1-zz/5));}
  const M=new Merger();const LN=niG(L);LN.computeVertexNormals();for(let i=0;i<9;i++){_m4.makeRotationFromEuler(_e.set(rand(.25,.5),i/9*Math.PI*2,0,'YXZ'));M.add(LN,_m4,'#3f6e33');}M.xf(NI.sph,0,0,0,.8,1,.8,0,'#5a4430');
  const cm=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.8});const cr=new T.InstancedMesh(M.geo(),cm,palmsList.length);tr.castShadow=cr.castShadow=true;
  palmsList.forEach((q,i)=>{_dum.position.set(q[0],q[2]/2,q[1]);_dum.rotation.set(0,0,0);_dum.scale.set(1,q[2],1);_dum.updateMatrix();tr.setMatrixAt(i,_dum.matrix);_dum.position.set(q[0],q[2],q[1]);_dum.rotation.set(0,rand(0,6),0);_dum.scale.set(1,1,1);_dum.updateMatrix();cr.setMatrixAt(i,_dum.matrix);});
  scene.add(tr,cr);}

/* people (merged per look) */
const personCache={};
function personGeo(lk,seated){const k=JSON.stringify(lk)+(seated?'s':'');if(personCache[k])return personCache[k];const M=new Merger();const by=seated?0:.9;
  if(!seated){if(lk.galabeya)M.xf(NI.cyl8,0,.45,0,.55,.9,.5,0,lk.shirt);else{M.box(-.2,-.03,0,.9,-.08,.08,lk.pants||'#2a2a2a');M.box(.03,.2,0,.9,-.08,.08,lk.pants||'#2a2a2a');}}
  M.box(-.22,.22,by,by+.62,-.13,.13,lk.shirt);M.box(-.32,-.22,by+.05,by+.58,-.07,.07,lk.shirt);M.box(.22,.32,by+.05,by+.58,-.07,.07,lk.shirt);
  M.xf(NI.sph,0,by+.8,0,.26,.3,.28,0,lk.skin||'#9a6b4a');
  if(lk.hijab){M.xf(NI.sph,0,by+.8,.012,.31,.34,.32,0,lk.hijab);M.box(-.17,.17,by+.55,by+.72,-.15,.15,lk.hijab);}
  if(lk.helmet){M.xf(NI.hemi,0,by+.86,0,.34,.28,.36,0,lk.helmet);M.box(-.18,.18,by+.85,by+.875,-.24,-.1,lk.helmet);}
  else if(lk.cap)M.xf(NI.cyl12,0,by+.93,0,.29,.08,.29,0,lk.cap);
  else if(!lk.hijab)M.xf(NI.hemi,0,by+.84,0,.28,.2,.3,0,'#1d1712');
  return personCache[k]=M.geo();}
/* people (Phase 8): rigged, animated figures; person() places one in the world, human() makes one to place yourself */
/* inside the Android app the download section is not needed */
try{if(/[?&]app=android\b/.test(location.search))localStorage.setItem('aps_app','android');if(localStorage.getItem('aps_app')==='android'){document.documentElement.classList.add('in-app');const e=document.getElementById('apkSec');if(e)e.hidden=true;}}catch(_){}
const PEOPLE=createPeople(T);let peopleFrame=0;
function human(lk,clip){return PEOPLE.make(lk||{},clip||'Idle');}
function person(lk,x,z,ry,seated){const m=human(lk,seated?'Sit':'Idle');m.position.set(x,0,z);m.rotation.y=ry||0;scene.add(m);return m;}
/* a rider sitting on a seat anchor of the tuk / van (anchor = seat surface), facing forward */
function seated(lk){const g=human(lk,'Sit');g.position.set(0,-.5,.06);g.rotation.y=Math.PI;return g;}

/* vehicles (merged per type+colour) */
const vehCache={};
function wheelsAt(M,pts,r){pts.forEach(p=>{M.xf(NI.cyl12,p[0],r,p[1],r*2,.3,r*2,0,'#151515',0,Math.PI/2);M.xf(NI.cyl8,p[0]*1.04,r,p[1],r*.9,.32,r*.9,0,'#9a9a9a',0,Math.PI/2);});}
function vehicleGeo(type,c,c2){const k=type+c+(c2||'');if(vehCache[k])return vehCache[k];const M=new Merger();
  if(type==='sedan'||type==='taxi'){M.box(-.86,.86,.35,1.0,-2.15,2.15,c);M.box(-.8,.8,1.0,1.52,-1.0,.95,'#26343e');M.box(-.82,.82,1.5,1.58,-.95,.85,type==='taxi'?'#1a1a1a':c);
    M.box(-.86,.86,.55,.66,-2.16,2.16,type==='taxi'?'#1a1a1a':'#2a2a2a');M.box(-.65,-.35,.62,.8,-2.17,-2.15,'#fff7d0');M.box(.35,.65,.62,.8,-2.17,-2.15,'#fff7d0');M.box(-.7,-.4,.62,.8,2.15,2.17,'#ff3a2a');M.box(.4,.7,.62,.8,2.15,2.17,'#ff3a2a');
    if(type==='taxi')M.box(-.35,.35,1.58,1.85,-.3,.1,'#f2c218');wheelsAt(M,[[-.84,-1.35],[.84,-1.35],[-.84,1.35],[.84,1.35]],.33);}
  else if(type==='micro'){M.box(-1,1,.4,2.35,-2.6,2.6,c);M.box(-1.01,1.01,1.3,2.0,-1.9,2.4,'#24323c');M.box(-.95,.95,1.3,2.0,-2.62,-2.58,'#24323c');M.box(-1.02,1.02,.85,1.05,-2.6,2.6,'#2a6fb0');M.box(-.75,-.45,.7,.85,-2.62,-2.6,'#fff7d0');M.box(.45,.75,.7,.85,-2.62,-2.6,'#fff7d0');wheelsAt(M,[[-.92,-1.7],[.92,-1.7],[-.92,1.7],[.92,1.7]],.36);}
  else if(type==='truck'){M.box(-1.25,1.25,.9,3.3,-7.6,-5.3,c);M.box(-1.2,1.2,2.1,3.1,-7.62,-7.6,'#1f2d36');M.box(-1.1,1.1,.5,.9,-7.7,7,'#2b2d30');M.box(-1.25,1.25,.9,1.25,-5,7.2,'#2b2d30');M.box(-1.22,1.22,1.25,3.85,-4.9,7.1,c2||'#2e5e8c');
    M.box(-.9,-.6,1.1,1.3,-7.62,-7.6,'#fff7d0');M.box(.6,.9,1.1,1.3,-7.62,-7.6,'#fff7d0');wheelsAt(M,[[-1.1,-6.6],[1.1,-6.6],[-1.1,3.6],[1.1,3.6],[-1.1,5],[1.1,5],[-1.1,6.3],[1.1,6.3]],.5);}
  else if(type==='tuk'){M.box(-.6,.6,.45,1.2,-1.36,-.75,'#1d1e22');M.box(-.63,.63,1.2,1.4,-1.34,-.95,c);M.box(-.57,.57,1.4,1.96,-1.2,-1.17,'#7aa2b4');M.box(-.62,-.55,1.4,1.98,-1.22,-1.15,c);M.box(.55,.62,1.4,1.98,-1.22,-1.15,c);
    M.box(-.65,.65,.45,1.2,-.8,1.28,'#2c2e33');M.box(-.69,.69,1.98,2.07,-1.24,1.29,'#3a3d42');M.box(-.68,-.65,1.2,1.98,.45,1.27,'#4a4d52');M.box(.65,.68,1.2,1.98,.45,1.27,'#4a4d52');M.box(-.68,.68,1.2,1.98,1.25,1.29,'#4a4d52');
    M.box(-.44,-.24,.88,1.08,-1.38,-1.36,'#fff7d0');M.box(.24,.44,.88,1.08,-1.38,-1.36,'#fff7d0');wheelsAt(M,[[0,-1.1],[-.66,.9],[.66,.9]],.3);}
  else if(type==='bus'){M.box(-1.25,1.25,.45,3.0,-5.2,5.2,c);M.box(-1.26,1.26,1.6,2.5,-4.6,5.0,'#24323c');M.box(-1.2,1.2,1.4,2.6,-5.22,-5.18,'#24323c');M.box(-1.27,1.27,.9,1.2,-5.2,5.2,'#0f4a3a');M.box(-1.25,1.25,3.0,3.1,-5.1,5.1,'#d9d9d9');wheelsAt(M,[[-1.1,-3.4],[1.1,-3.4],[-1.1,3.4],[1.1,3.4]],.45);}
  return vehCache[k]=M.geo();}

/* ============ tuk-tuk (player) ============ */
let tuk,tukBody,fwPivot,wheels=[],paxSeat,isVan=false,vanSeats=[],TUK_TRAFFIC=null,arrow3D,paintMat,headLight;
const PAINTS=[{id:'yellow',n:'أصفر أصلي',c:'#ffc400',p:0},{id:'orange',n:'برتقالي أصلي',c:'#f09a1a',p:0},{id:'red',n:'أحمر كلاسيك',c:'#b3161d',p:0},{id:'blue',n:'أزرق بحري',c:'#1f5fa8',p:250},{id:'green',n:'أخضر زيتوني',c:'#4d6b2f',p:500},{id:'purple',n:'بنفسجي مغرب',c:'#6b2fa0',p:800},{id:'black',n:'أسود ملكي',c:'#1b1b1f',p:1200},{id:'gold',n:'دهبي',c:'#c9a227',p:2000}];
const SLOGANS=['ماشي بدعا الوالدين','يا مسهّل يا رب','عيني عليك باردة','كله بأوانه','الصبر مفتاح الفرج','اللي يحبنا يفوّت'];
let sloganMat,flame;
function sloganTex(t){return ctex(1024,256,g=>{g.fillStyle='#111';g.fillRect(0,0,1024,256);g.strokeStyle='#f2c218';g.lineWidth=10;g.strokeRect(10,10,1004,236);g.fillStyle='#ffd23a';g.textAlign='center';g.textBaseline='middle';g.direction='rtl';let s=150;g.font=s+'px '+GAMEF;while(g.measureText(t).width>940){s-=6;g.font=s+'px '+GAMEF;}g.fillText(t,512,140);});}
function setSlogan(t){if(!sloganMat)return;const old=sloganMat.map;sloganMat.map=sloganTex(t);sloganMat.needsUpdate=true;if(old)old.dispose();}
const tukNodes={};
function sloganStrip(t){return ctex(1024,128,g=>{g.fillStyle='#111';g.fillRect(0,0,1024,128);g.fillStyle='#ffd23a';g.textAlign='center';g.textBaseline='middle';g.direction='rtl';let s=96;g.font=s+'px '+GAMEF;while(g.measureText(t).width>960){s-=4;g.font=s+'px '+GAMEF;}g.fillText(t,512,70);});}
function loadTuk(gltf){tuk=gltf.scene;
  tuk.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const m=o.material;if(!m)return;
    if(m.name==='Paint')paintMat=m;
    if(m.name==='Glass'||m.name==='Tint'){o.castShadow=false;m.depthWrite=false;}
    if(m.name==='Chrome'||m.name==='Paint'||m.name==='Rim'){m.envMapIntensity=1.2;}});
  tukBody=tuk.getObjectByName('Body')||tuk;isVan=!!tuk.getObjectByName('Seat1');document.body.classList.toggle('veh-van',isVan);
  if(isVan){const g=n=>tuk.getObjectByName(n);Object.assign(tukNodes,{sfl:g('SteerFL'),sfr:g('SteerFR'),wfl:g('WheelFL'),wfr:g('WheelFR'),wrl:g('WheelRL'),wrr:g('WheelRR')});vanSeats=[1,2,3,4,5,6].map(i=>g('Seat'+i));}
  else{tukNodes.steer=tuk.getObjectByName('SteerF');tukNodes.wf=tuk.getObjectByName('WheelF');tukNodes.wl=tuk.getObjectByName('WheelRL');tukNodes.wr=tuk.getObjectByName('WheelRR');}
  setPaint(save.paint);
  sloganMat=new T.MeshStandardMaterial({map:sloganStrip(save.slogan||SLOGANS[0]),roughness:.5});
  const sp=new T.Mesh(new T.PlaneGeometry(isVan?1.1:.8,isVan?.14:.1),sloganMat);if(isVan){const q=tuk.getObjectByName('SloganPt').position;sp.position.set(q.x,q.y,q.z+.03);tuk.add(sp);}else{sp.position.set(0,.79,1.402);tukBody.add(sp);}
  const plate=new T.Mesh(new T.PlaneGeometry(.34,.14),new T.MeshStandardMaterial({map:ctex(256,104,g=>{g.fillStyle='#f4f4f0';g.fillRect(0,0,256,104);g.fillStyle='#1f5fb0';g.fillRect(0,0,256,28);g.fillStyle='#fff';g.font='700 20px '+AR;g.textAlign='center';g.textBaseline='middle';g.fillText('مصر  EGYPT',128,15);g.fillStyle='#111';g.font='48px '+GAMEF;g.direction='rtl';g.fillText('ت ك س  ٥٢٧',128,70);}),roughness:.5}));
  if(isVan){const q=tuk.getObjectByName('PlateR').position;plate.position.set(q.x,q.y,q.z+.02);tuk.add(plate);}else{plate.position.set(0,.63,1.412);tukBody.add(plate);}
  paxSeat=tuk.getObjectByName('PaxSeatPt')||tuk.getObjectByName('Seat2')||new T.Group();
  /* headlight glow on the road + lamp halos + turbo flame */
  const cg=new T.PlaneGeometry(3.6,8);cg.rotateX(-Math.PI/2);cg.translate(0,.06,-5.6);
  const ct=ctex(64,128,g=>{const gr=g.createLinearGradient(0,128,0,0);gr.addColorStop(0,'rgba(255,236,190,.5)');gr.addColorStop(1,'rgba(255,236,190,0)');g.fillStyle=gr;g.beginPath();g.moveTo(20,128);g.lineTo(44,128);g.lineTo(64,0);g.lineTo(0,0);g.closePath();g.fill();});
  coneGlow=new T.Mesh(cg,new T.MeshBasicMaterial({map:ct,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));tuk.add(coneGlow);
  headGlow=new T.Group();[-.27,.27].forEach(x=>{const s=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#fff0c8',transparent:true,depthWrite:false,blending:T.AdditiveBlending}));s.scale.set(.6,.6,1);s.position.set(x,.86,-1.47);headGlow.add(s);});tukBody.add(headGlow);
  flame=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#ff7a1a',transparent:true,depthWrite:false,blending:T.AdditiveBlending}));flame.position.set(.46,.33,1.52);flame.visible=false;tukBody.add(flame);
  if(!isVan)buildDial();buildBrakeLights();modsHook();applyMods();tukNodes.driver=tuk.getObjectByName('Driver');if(tukNodes.driver&&!isVan){tukNodes.driver.children.forEach(o=>{if(o.isMesh)o.visible=false;});const dv=human({variant:'Man',shirt:'#3f6587',pants:'#2a3550',skin:'#8f6446'},'Drive');dv.position.set(0,-.5,.05);dv.rotation.y=Math.PI;tukNodes.driver.add(dv);tukNodes.driverH=dv;}tukNodes.charm=null;tuk.traverse(o=>{if(o.isMesh&&o.material&&o.material.name==='EvilEye')tukNodes.charm=o;});
  scene.add(tuk);arrow3D=new T.Object3D();buildChev();}
/* --- cockpit speedometer (Phase 2 F): static dial texture + rotating needle mesh, shown only in the inside camera --- */
let dial=null,dialNeedle=null;const DIAL_MAX=80;
function buildDial(){const tex=ctex(256,256,g=>{g.fillStyle='#0d1420';g.beginPath();g.arc(128,128,126,0,7);g.fill();g.strokeStyle='#C87938';g.lineWidth=8;g.beginPath();g.arc(128,128,118,0,7);g.stroke();
    g.lineWidth=10;g.strokeStyle='#F5B928';g.beginPath();g.arc(128,128,100,Math.PI*.75,Math.PI*.75+Math.PI*1.5*(60/DIAL_MAX));g.stroke();g.strokeStyle='#D9483B';g.beginPath();g.arc(128,128,100,Math.PI*.75+Math.PI*1.5*(60/DIAL_MAX),Math.PI*2.25);g.stroke();
    g.fillStyle='#F5F1E8';g.font='700 26px '+AR;g.textAlign='center';g.textBaseline='middle';
    for(let v=0;v<=DIAL_MAX;v+=10){const a=Math.PI*.75+Math.PI*1.5*v/DIAL_MAX;g.strokeStyle='#F5F1E8';g.lineWidth=v%20?3:5;g.beginPath();g.moveTo(128+Math.cos(a)*86,128+Math.sin(a)*86);g.lineTo(128+Math.cos(a)*(v%20?76:70),128+Math.sin(a)*(v%20?76:70));g.stroke();
      if(v%20===0)g.fillText(String(v),128+Math.cos(a)*54,128+Math.sin(a)*54);}
    g.fillStyle='#AAB5C3';g.font='600 18px '+AR;g.fillText('كم/س',128,184);});
  dial=new T.Mesh(new T.CircleGeometry(.052,32),new T.MeshBasicMaterial({map:tex,toneMapped:false}));
  dialNeedle=new T.Mesh(new T.PlaneGeometry(.0045,.043).translate(0,.018,0),new T.MeshBasicMaterial({color:'#ff3b2a',toneMapped:false}));dialNeedle.position.z=.002;dial.add(dialNeedle);
  const hub=new T.Mesh(new T.CircleGeometry(.0065,12),new T.MeshBasicMaterial({color:'#F5B928',toneMapped:false}));hub.position.z=.003;dial.add(hub);
  dial.position.set(0,1.345,-.96);const eye=new T.Vector3(0,1.6,-.42);dial.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),eye.sub(dial.position).normalize());dial.visible=false;tukBody.add(dial);}
function updateCockpit(){const inside=camMode===2&&state==='play';if(HC.camIn!==inside){HC.camIn=inside;document.body.classList.toggle('cam-in',inside);}if(dial){if(dial.visible!==inside)dial.visible=inside;if(inside){const v=Math.min(DIAL_MAX,Math.abs(car.v)*3.6);dialNeedle.rotation.z=Math.PI*.75-Math.PI*1.5*v/DIAL_MAX;}}
  if(tukNodes.driver&&tukNodes.driver.visible===inside)tukNodes.driver.visible=!inside;
  if(tukNodes.charm&&tukNodes.charm.visible===inside)tukNodes.charm.visible=!inside;   /* the hanging evil-eye charm sits right in front of the driver's eye */}
function setSlogan(t){if(!sloganMat)return;const old=sloganMat.map;sloganMat.map=sloganStrip(t);sloganMat.needsUpdate=true;if(old)old.dispose();}
let chev;const CH_N=18;const _cp=[];
function buildChev(){const s=new T.Shape();s.moveTo(0,-.75);s.lineTo(.85,.2);s.lineTo(.5,.2);s.lineTo(0,-.25);s.lineTo(-.5,.2);s.lineTo(-.85,.2);s.closePath();const g=new T.ShapeGeometry(s);g.rotateX(-Math.PI/2);g.rotateY(Math.PI);
  chev=new T.InstancedMesh(g,new T.MeshBasicMaterial({color:'#4cff5e',transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending}),CH_N);chev.frustumCulled=false;chev.renderOrder=2;chev.count=0;scene.add(chev);}
function updateChev(tx){if(!gpsRoute||tx===null){chev.count=0;return;}
  _cp.length=0;_cp.push([car.x,car.z,0]);for(let i=gpsIdx;i<gpsRoute.pts.length;i++){const p=gpsRoute.pts[i];_cp.push([p[0],p[1],1]);}
  const ph=(clock*6)%5;let n=0,acc=0;
  for(let i=1;i<_cp.length&&n<CH_N;i++){const a=_cp[i-1],b=_cp[i];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.01)continue;const ux=dx/L,uz=dz/L;
    const onAve=Math.abs(a[1])<.5&&Math.abs(b[1])<.5;const off=(i===1)?0:(onAve?5:2.5);
    for(;;){const d=3+n*5+ph-acc;if(d>L||n>=CH_N)break;if(d>=0){const px=a[0]+ux*d+(-uz)*off,pz=a[1]+uz*d+ux*off;_dum.position.set(px,.12,pz);_dum.rotation.set(0,Math.atan2(-ux,-uz),0);const sc=n>CH_N-4?(CH_N-n)/4:1;_dum.scale.set(sc,1,sc);_dum.updateMatrix();chev.setMatrixAt(n,_dum.matrix);}n++;}
    acc+=L;}
  chev.count=n;chev.instanceMatrix.needsUpdate=true;chev.material.color.set(fare?'#4cff5e':(fuel<25?'#ffb347':'#ffe066'));}
/* ---- customisations: preview on the vehicle, buy once, saved in save.mods / save.modsOwned ---- */
const MODP={};   // option being previewed per item (not bought yet)
function modsSaved(){return save.mods||{};}
function ownedMod(item,id){return !modOpt(item,id).p||(save.modsOwned||[]).includes(item+':'+id);}
function renderMods(){const box=$('mods');if(!box)return;box.innerHTML='';const lv=repLevel((save.rep&&save.rep.xp)||0);
  MODS.forEach(M=>{const fitted=modsSaved()[M.id]||M.opts[0].id,prev=MODP[M.id];const locked=lv<M.lvl;const d=document.createElement('div');d.className='mod';
    d.innerHTML='<h3></h3><div class="mopts"></div><div class="mbuy" hidden><button class="ui-btn primary"></button><button class="ui-btn ghost">إلغاء المعاينة</button><small class="pgnote"></small></div>';
    d.querySelector('h3').innerHTML=M.n+(locked?' <small>🔒 تتفتح في «'+REP_LEVELS[M.lvl].n+'»</small>':'');
    const opts=d.querySelector('.mopts');M.opts.forEach(o=>{const b=document.createElement('button');const own=ownedMod(M.id,o.id);
      b.className='mopt'+(fitted===o.id?' sel':'')+(prev===o.id?' prev':'')+(locked&&o.p?' lock':'');
      b.innerHTML=(o.c?'<i style="background:'+o.c+'"></i>':'')+'<span></span><small></small>';b.querySelector('span').textContent=o.n;b.querySelector('small').textContent=fitted===o.id?'متركّب':(own?'عندك':o.p+' ج.م');
      b.addEventListener('click',()=>{if(locked&&o.p)return;if(own){MODP[M.id]=null;save.mods=Object.assign({},save.mods,{[M.id]:o.id});persist();applyMods();renderMods();return;}MODP[M.id]=o.id;applyMods();renderMods();});opts.appendChild(b);});
    if(prev&&!ownedMod(M.id,prev)){const o=modOpt(M.id,prev);const bb=d.querySelector('.mbuy');bb.hidden=false;const buy=bb.querySelector('.primary');buy.textContent='اشتري «'+o.n+'» بـ '+o.p+' ج.م';
      bb.querySelector('small').textContent='بتتفرّج عليه دلوقتي على العربية';
      buy.addEventListener('click',()=>{if(save.wallet<o.p){bb.querySelector('small').textContent='محتاج '+Math.round(o.p-save.wallet)+' ج.م كمان';return;}
        save.wallet-=o.p;save.modsOwned=(save.modsOwned||[]).concat([M.id+':'+o.id]);save.mods=Object.assign({},save.mods,{[M.id]:o.id});MODP[M.id]=null;persist();applyMods();renderGarage();menuWallet();blip('cash');});
      bb.querySelector('.ghost').addEventListener('click',()=>{MODP[M.id]=null;applyMods();renderMods();});}
    box.appendChild(d);});}
const MODV={rimMats:[],seatMats:[],glow:null,roof:null};
function modsHook(){MODV.rimMats=[];MODV.seatMats=[];const seen=new Set();tuk.traverse(o=>{if(!o.isMesh)return;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!m||seen.has(m))return;seen.add(m);
    if(/^rim$/i.test(m.name)){m.userData.c0=m.color.clone();m.userData.m0=m.metalness;m.userData.r0=m.roughness;MODV.rimMats.push(m);}
    if(/^(vinyl|seatfabric)$/i.test(m.name)){m.userData.c0=m.color.clone();m.userData.map0=m.map;MODV.seatMats.push(m);}});});
  if(MODV.glow&&MODV.glow.parent)MODV.glow.parent.remove(MODV.glow);if(MODV.roof&&MODV.roof.parent)MODV.roof.parent.remove(MODV.roof);
  const L=isVan?4.2:2.7,Wd=isVan?1.9:1.35;MODV.glow=new T.Mesh(new T.PlaneGeometry(Wd*1.5,L*1.25).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:texGlow,transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));MODV.glow.position.set(0,.06,0);MODV.glow.visible=false;tuk.add(MODV.glow);
  MODV.roof=new T.Group();for(let i=0;i<4;i++){const sp=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#ffc44a',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));sp.scale.set(.32,.32,1);sp.position.set(-.45+i*.3,isVan?2.05:1.98,isVan?-1.9:-.95);MODV.roof.add(sp);}MODV.roof.visible=false;tukBody.add(MODV.roof);}
const seatTex={};function patTex(kind){if(seatTex[kind])return seatTex[kind];seatTex[kind]=ctex(128,128,g=>{g.fillStyle='#ffffff';g.fillRect(0,0,128,128);
  if(kind==='leopard'){for(let i=0;i<26;i++){const x=Math.random()*128,y=Math.random()*128,r=5+Math.random()*7;g.fillStyle='#3a2410';g.beginPath();g.ellipse(x,y,r,r*.7,Math.random()*3,0,7);g.fill();g.fillStyle='#8a5a22';g.beginPath();g.ellipse(x,y,r*.5,r*.35,0,0,7);g.fill();}}
  else{for(let y=0;y<128;y+=4){g.fillStyle='rgba(0,0,0,'+(y%8?.08:.16)+')';g.fillRect(0,y,128,2);}}});seatTex[kind].repeat.set(3,3);return seatTex[kind];}
function applyMods(){if(!tuk)return;const cur=Object.assign({},modsSaved());for(const k in MODP)if(MODP[k])cur[k]=MODP[k];
  const r=modOpt('rims',cur.rims);MODV.rimMats.forEach(m=>{if(r.c){m.color.set(r.c).convertSRGBToLinear();m.metalness=r.metal;m.roughness=r.rough;}else{m.color.copy(m.userData.c0);m.metalness=m.userData.m0;m.roughness=m.userData.r0;}m.needsUpdate=true;});
  const st=modOpt('seats',cur.seats);MODV.seatMats.forEach(m=>{if(st.c){m.color.set(st.c).convertSRGBToLinear();m.map=st.pattern?patTex(st.pattern):m.userData.map0;}else{m.color.copy(m.userData.c0);m.map=m.userData.map0;}m.needsUpdate=true;});
  const li=modOpt('lights',cur.lights);if(MODV.glow){MODV.glow.visible=!!(li.c&&!li.roof);if(li.c)MODV.glow.material.color.set(li.c);}if(MODV.roof){MODV.roof.visible=!!li.roof;}}
function setPaint(id){const p=PAINTS.find(q=>q.id===id);if(p&&paintMat)paintMat.color.set(p.c).convertSRGBToLinear();}

/* ============ vehicle (see vehicle.js) ============ */
const input={up:0,down:0,steerKey:0,joy:0,drift:0,turbo:0,horn:0};
let fuel=100,turbo=1,shake=0,dead=0,skidT=0;
let veh=null,car=null;
const ctl={mode:'touch',sens:1,tilt:0};try{const c=JSON.parse(ls.get('aps_ctl')||'null');if(c)Object.assign(ctl,c);}catch(e){}
function saveCtl(){try{ls.set('aps_ctl',JSON.stringify({mode:ctl.mode,sens:ctl.sens}));}catch(e){}}
addEventListener('deviceorientation',e=>{if(e.gamma==null)return;const land=Math.abs((screen.orientation&&screen.orientation.angle)||window.orientation||0)===90;const a=land?(e.beta||0)*((screen.orientation&&screen.orientation.angle)===270||window.orientation===-90?-1:1):(e.gamma||0);ctl.tilt=clamp(-a/22,-1,1);});
let padUsed=false;
function readPad(){const gp=navigator.getGamepads?navigator.getGamepads():[];for(const g of gp){if(!g)continue;const ax=g.axes[0]||0,rt=g.buttons[7]?g.buttons[7].value:0,lt=g.buttons[6]?g.buttons[6].value:0;
  if(Math.abs(ax)>.12||rt>.1||lt>.1||g.buttons[0]?.pressed)padUsed=true;if(!padUsed)return;
  input.joy=Math.abs(ax)>.12?-ax:0;input.up=rt>.15?1:0;input.down=lt>.15?1:0;input.drift=g.buttons[0]?.pressed?1:0;input.turbo=(g.buttons[1]?.pressed||g.buttons[5]?.pressed)?1:0;input.horn=g.buttons[3]?.pressed?1:0;return;}}
function updateCar(dt){const fuelOk=fuel>0;veh.turbo=turbo;readPad();wheelReturn(dt);
  const joySave=input.joy;if(ctl.mode==='tilt'&&!padUsed){input.joy=ctl.tilt;knob.style.transform='rotate('+(-ctl.tilt*WMAX)+'deg)';}input.joy*=ctl.sens;input.steerKey*=1;
  veh.update(dt,input,fuelOk);input.joy=joySave;
  const dist=Math.abs(car.v)*dt;fuel=Math.max(0,fuel-dist*TUNING.fuelPerMeter*(car.boost?2:1)-(car.thr?dt*TUNING.fuelIdlePerSec:0));
  turbo=car.boost?Math.max(0,turbo-dt*.16):Math.min(1,turbo+dt*.07);}
/* brake lights: the model's red tail lenses light up and a soft red glow appears while braking */
const BL={mats:[],glow:null,on:false};
function buildBrakeLights(){BL.mats=[];const seen=new Set(),pts=[];tuk.updateMatrixWorld(true);const inv=new T.Matrix4().copy(tukBody.matrixWorld).invert();
  tuk.traverse(o=>{if(!o.isMesh)return;const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach((m,mi)=>{if(!m||!/tail/i.test(m.name||''))return;if(!seen.has(m)){seen.add(m);m.userData.e0=m.emissiveIntensity;BL.mats.push(m);}
    const g=o.geometry;const grp=Array.isArray(o.material)&&g.groups?g.groups.filter(x=>x.materialIndex===mi):null;const pos=g.attributes.position;const box=new T.Box3(),v=new T.Vector3();
    const idx=g.index;const add=i=>{v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);box.expandByPoint(v);};
    if(grp&&grp.length&&idx){grp.forEach(gr=>{for(let k=gr.start;k<gr.start+gr.count;k++)add(idx.getX(k));});}else for(let i=0;i<pos.count;i++)add(i);
    if(!box.isEmpty()){/* split left/right lenses into separate glow points */const c=box.getCenter(new T.Vector3());const w=box.max.x-box.min.x;if(w>.5){pts.push(new T.Vector3(box.min.x+.08,c.y,box.max.z),new T.Vector3(box.max.x-.08,c.y,box.max.z));}else pts.push(new T.Vector3(c.x,c.y,box.max.z));}});});
  if(BL.glow)BL.glow.parent&&BL.glow.parent.remove(BL.glow);BL.glow=new T.Group();
  pts.forEach(p=>{const sp=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#ff1408',transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));sp.scale.set(.6,.6,1);sp.position.copy(p).add(new T.Vector3(0,0,.06));BL.glow.add(sp);});
  BL.glow.visible=false;tukBody.add(BL.glow);BL.on=false;}
function brakeLights(on){if(BL.on===on)return;BL.on=on;BL.mats.forEach(m=>{m.emissiveIntensity=on?(m.userData.e0||1)*2.4:(m.userData.e0||1);});if(BL.glow)BL.glow.visible=on;}
function syncTuk(){if(!tuk||!car)return;syncModel(tuk,tukNodes,car);brakeLights(!!car.braking);if(tukBody&&tukBody!==tuk)tukBody.position.y=Math.sin(clock*38)*.004*(1+Math.abs(car.v)*.06);}
const SAFE=[];Object.values(NODES).forEach(n=>SAFE.push(n));
function resetToRoad(){let best=null,bd=1e9;for(const n of SAFE){const d=Math.hypot(n.x-car.x,n.z-car.z);if(d<bd){bd=d;best=n;}}veh.teleport(best.x,best.z,car.h);snapCam=true;}

/* ============ traffic ============ */
const traffic=[];let CARS=null;const paintCache={};
function tintMat(m,hex){const k=m.uuid+hex;if(!paintCache[k]){const c=m.clone();c.color.set(hex).convertSRGBToLinear();paintCache[k]=c;}return paintCache[k];}
function makeTraffic(k){const NM={taxi:'Taxi',sedan:'Sedan',classic:'Classic',micro:'Micro',truck:'Truck'};
  let src=k[0]==='tuk'?TUK_TRAFFIC:(CARS&&CARS.getObjectByName(NM[k[0]]));if(!src){const m=new T.Mesh(vehicleGeo(k[0],k[1],k[2]),VC);m.castShadow=true;return m;}
  const col=k[0]==='truck'?k[2]:k[1];
  if(!OLD_TRAFFIC){const m=new T.Mesh(bakeVehicle(src,col,k[0]+'|'+col),TRAFFIC_MAT);m.castShadow=true;m.receiveShadow=true;const g=new T.Group();g.add(m);return g;}
  const m=src.clone(true);m.position.set(0,0,0);m.quaternion.identity();
  m.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;if(o.material&&o.material.name==='Paint')o.material=tintMat(o.material,col);});
  if(k[0]==='tuk'){const ps=m.getObjectByName('PaxSeatPt');if(ps)ps.clear();}
  const g=new T.Group();g.add(m);return g;}
/* Traffic cars are baked once per model + colour into ONE mesh with vertex colours:
   one draw call (+ one for its shadow) instead of one per material. ?traffic=old shows the previous version for comparison. */
const OLD_TRAFFIC=new URLSearchParams(location.search).get('traffic')==='old';
const TRAFFIC_MAT=new T.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.22});
const bakeCache={};
function bakeVehicle(src,paint,key){if(bakeCache[key])return bakeCache[key];
  src.updateMatrixWorld(true);const inv=new T.Matrix4().copy(src.matrixWorld).invert();
  const m4=new T.Matrix4(),nm=new T.Matrix3(),v=new T.Vector3(),c=new T.Color(),paintC=new T.Color(paint).convertSRGBToLinear(),glassC=new T.Color('#24323c').convertSRGBToLinear(),darkC=new T.Color('#1d1d1f').convertSRGBToLinear();
  const parts=[];src.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==src;p=p.parent)if(!p.visible)return;if(o.name==='PaxSeatPt')return;
    const mat=Array.isArray(o.material)?o.material[0]:o.material;if(!mat||mat.blending===T.AdditiveBlending||mat.isMeshBasicMaterial)return;parts.push(o);});
  let nv=0,ni=0;for(const o of parts){nv+=o.geometry.attributes.position.count;ni+=o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count;}
  /* typed arrays sized up front, indices kept: no big temporary JS arrays, no vertex duplication */
  const P=new Float32Array(nv*3),N=new Float32Array(nv*3),C=new Float32Array(nv*3),I=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
  for(const o of parts){const mat=Array.isArray(o.material)?o.material[0]:o.material;
    if(mat.name==='Paint')c.copy(paintC);else if(mat.name==='Glass'||mat.name==='Tint'||(mat.transparent&&mat.opacity<.7))c.copy(glassC);else if(mat.map)c.copy(darkC);
    else{c.copy(mat.color);if(mat.emissive&&(mat.emissiveIntensity||1)>0){c.r=Math.min(1,c.r+mat.emissive.r*.6);c.g=Math.min(1,c.g+mat.emissive.g*.6);c.b=Math.min(1,c.b+mat.emissive.b*.6);}}
    m4.multiplyMatrices(inv,o.matrixWorld);nm.getNormalMatrix(m4);const g=o.geometry,pos=g.attributes.position,nor=g.attributes.normal,idx=g.index;
    for(let j=0;j<pos.count;j++){v.fromBufferAttribute(pos,j).applyMatrix4(m4);P[(vo+j)*3]=v.x;P[(vo+j)*3+1]=v.y;P[(vo+j)*3+2]=v.z;
      if(nor)v.fromBufferAttribute(nor,j).applyMatrix3(nm).normalize();else v.set(0,1,0);N[(vo+j)*3]=v.x;N[(vo+j)*3+1]=v.y;N[(vo+j)*3+2]=v.z;C[(vo+j)*3]=c.r;C[(vo+j)*3+1]=c.g;C[(vo+j)*3+2]=c.b;}
    if(idx)for(let i=0;i<idx.count;i++)I[io++]=idx.getX(i)+vo;else for(let i=0;i<pos.count;i++)I[io++]=i+vo;vo+=pos.count;}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(P,3));geo.setAttribute('normal',new T.BufferAttribute(N,3));geo.setAttribute('color',new T.BufferAttribute(C,3));geo.setIndex(new T.BufferAttribute(I,1));geo.computeBoundingSphere();
  return bakeCache[key]=geo;}
function laneLoop(pts,off){const out=[];const n=pts.length;for(let i=0;i<n;i++){const p=pts[i],a=pts[(i-1+n)%n],b=pts[(i+1)%n];const d1x=Math.sign(p[0]-a[0]),d1z=Math.sign(p[1]-a[1]),d2x=Math.sign(b[0]-p[0]),d2z=Math.sign(b[1]-p[1]);out.push([p[0]+(-d1z-d2z)*off,p[1]+(d1x+d2x)*off]);}return out;}
function mkPath(pts){const L=[];let tot=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];const l=Math.hypot(b[0]-a[0],b[1]-a[1]);L.push(l);tot+=l;}return {pts:pts,L:L,tot:tot};}
function pathAt(P,s,o){s=((s%P.tot)+P.tot)%P.tot;for(let i=0;i<P.pts.length;i++){if(s<=P.L[i]){const a=P.pts[i],b=P.pts[(i+1)%P.pts.length],t=s/P.L[i];o.x=a[0]+(b[0]-a[0])*t;o.z=a[1]+(b[1]-a[1])*t;o.dx=(b[0]-a[0])/P.L[i];o.dz=(b[1]-a[1])/P.L[i];return o;}s-=P.L[i];}return o;}
function initTraffic(){
  const loops=[
    {p:mkPath([[-444,7],[292,7],[292,-7],[-444,-7]]),n:8,sp:11},
    {p:mkPath([[-434,3],[282,3],[282,-3],[-434,-3]]),n:7,sp:12.5},
    {p:mkPath(laneLoop([[-50,0],[50,0],[50,120],[-50,120]],3)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[150,0],[286,0],[286,120],[150,120]],3)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[-250,0],[-150,0],[-150,120],[-250,120]],3)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[-250,120],[-50,120],[-50,235],[-250,235]],2.5)),n:3,sp:8.5},
    {p:mkPath(laneLoop([[50,120],[286,120],[286,235],[50,235]],2.5)),n:3,sp:8.5},
    {p:mkPath(laneLoop([[286,0],[370,0],[370,235],[286,235]],3)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[-150,120],[150,120],[150,235],[-150,235]],2.5)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[-230,-30],[40,-30],[40,0],[-230,0]],2.5)),n:3,sp:7,truck:true},
    {p:mkPath(laneLoop([[-120,-30],[-20,-30],[-20,-112],[-120,-112]],2.5)),n:2,sp:6.5,truck:true}];
  /* avenue loops drive on the outer lanes, fix their offsets: they already include lane z */
  const kinds=[['taxi','#f2c218'],['taxi','#f2c218'],['taxi','#f2c218'],['sedan','#e9e9e9'],['sedan','#2e5e8c'],['sedan','#8f1f1a'],['sedan','#3a3a3a'],['sedan','#b9bec4'],['classic','#d8d2c0'],['classic','#3d6b4a'],['classic','#6e2a22'],['micro','#f2f2f2'],['micro','#f2f2f2'],['tuk','#2a6fb0'],['tuk','#c9302a'],['tuk','#ffc400'],['tuk','#1f7a4a']];
  loops.forEach(L=>{for(let i=0;i<L.n;i++){let k=L.truck?['truck',pick(['#e9e6dd','#c9302a','#2e5e8c']),pick(CONT)]:pick(kinds);const m=makeTraffic(k);scene.add(m);
    const big=k[0]==='truck'||k[0]==='micro';const nc=k[0]==='truck'?4:(k[0]==='tuk'?1:2);const circ=[];for(let j=0;j<nc;j++)circ.push({x:0,z:0,o:k[0]==='truck'?-6.5+j*4.3:(nc===1?0:(j?1.3:-1.3))});
    traffic.push({kind:k[0],m:m,P:L.p,s:L.p.tot*(i/L.n)+rand(0,20),v:L.sp,sp:L.sp*rand(.85,1.1),circ:circ,r:big?1.4:(k[0]==='tuk'?.9:1.1),len:k[0]==='truck'?9:(k[0]==='micro'?4:3),hx:0,hz:-1,x:0,z:0});}});
  updateTraffic(0);}
const tp={x:0,z:0,dx:0,dz:0};
function updateTraffic(dt){for(const c of traffic){pathAt(c.P,c.s,tp);const fx=tp.dx,fz=tp.dz;let target=c.sp;
    const rx=(car?car.x:1e9)-tp.x,rz=(car?car.z:1e9)-tp.z,al=rx*fx+rz*fz,la=Math.abs(rx*fz-rz*fx);if(al>-1&&al<c.len+9&&la<2.4)target=0;
    for(const o of traffic){if(o===c)continue;const ox=o.x-tp.x,oz=o.z-tp.z;if(ox*ox+oz*oz>900)continue;const a2=ox*fx+oz*fz,l2=Math.abs(ox*fz-oz*fx);if(a2>.5&&a2<c.len+o.len/2+5&&l2<2.2&&(o.hx*fx+o.hz*fz)>.3){target=0;break;}}
    c.v+=(target-c.v)*Math.min(1,dt*(target<c.v?4:.9));c.s+=c.v*dt;
    c.x=tp.x;c.z=tp.z;c.hx+=(fx-c.hx)*Math.min(1,dt*7+(dt===0?1:0));c.hz+=(fz-c.hz)*Math.min(1,dt*7+(dt===0?1:0));const hl=Math.hypot(c.hx,c.hz)||1;
    c.m.position.set(tp.x,0,tp.z);c.m.rotation.y=Math.atan2(-c.hx/hl,-c.hz/hl);
    for(const q of c.circ){q.x=tp.x+c.hx/hl*q.o;q.z=tp.z+c.hz/hl*q.o;}}}

/* walkers on sidewalks */
const walkers=[];
function initWalkers(){const looks=[{shirt:'#c9302a',pants:'#2a3550',skin:'#9c6b48'},{shirt:'#3b2a4a',pants:'#3b2a4a',skin:'#c69472',hijab:'#1f1f2a',galabeya:true},{shirt:'#e9e2d0',pants:'#e9e2d0',skin:'#8a5a3b',galabeya:true},{shirt:'#2e5e8c',pants:'#2e5e8c',skin:'#b07a55'},{shirt:'#f2c218',pants:'#384a63',skin:'#8f6446'},{shirt:'#6b2fa0',pants:'#2a2a2a',skin:'#c69472',hijab:'#c9302a'}];
  for(let i=0;i<22;i++){let a,b,fixed,alongX;const r=Math.random();
    if(r<.45){alongX=true;fixed=rand(10.6,14.2);a=rand(-280,200);b=a+rand(30,80);}else if(r<.6){alongX=true;fixed=-rand(10.6,15);a=rand(-280,200);b=a+rand(30,70);}
    else{alongX=false;const sx=pick(ST_X);fixed=sx+(Math.random()<.5?-1:1)*rand(6,8);a=rand(20,90);b=a+rand(20,90);}
    const m=human(pick(looks),'Walk');scene.add(m);walkers.push({m:m,a:a,b:b,f:fixed,ax:alongX,t:Math.random(),dir:1,sp:rand(.9,1.4)/(b-a)});}}
/* trainees and staff walking inside the training centre */
function trainingWalkers(){if(!TRAINING)return;const looks=[{shirt:'#1f4f86',pants:'#1f4f86',skin:'#9a6b4a',cap:'#f2c218'},{shirt:'#1f4f86',pants:'#1f4f86',skin:'#c69472'},{shirt:'#f4f1ea',pants:'#3b4a63',skin:'#8a5a3b'},{shirt:'#2f5f8c',pants:'#2f5f8c',skin:'#b07a55',helmet:'#f2c230'}];
  TRAINING.walks.forEach(([ax,f,a,b],i)=>{for(let k=0;k<2;k++){const lo=Math.min(a,b),hi=Math.max(a,b);const m=human(looks[(i+k)%looks.length],'Walk');scene.add(m);walkers.push({m:m,a:lo,b:hi,f:f+(k?.8:0),ax:ax==='x',t:Math.random(),dir:k?-1:1,sp:rand(.9,1.3)/(hi-lo)});}});}
function updateWalkers(dt){for(const w of walkers){w.t+=w.dir*w.sp*dt;if(w.t>1){w.t=1;w.dir=-1;}if(w.t<0){w.t=0;w.dir=1;}const p=w.a+(w.b-w.a)*w.t;
  if(w.ax){w.m.position.set(p,0,w.f);w.m.rotation.y=w.dir>0?Math.PI/2:-Math.PI/2;}else{w.m.position.set(w.f,0,p);w.m.rotation.y=w.dir>0?0:Math.PI;}}}

/* ============ GPS (Dijkstra over the road graph) ============ */
const NL=Object.values(NODES);
function nearestNode(x,z){let b=null,bd=1e9;for(const n of NL){const d=(n.x-x)**2+(n.z-z)**2;if(d<bd){bd=d;b=n;}}return b;}
function route(x,z,tx,tz){const s=nearestNode(x,z),t=nearestNode(tx,tz);const dist=new Map(),prev=new Map(),open=new Set(NL);NL.forEach(n=>dist.set(n,1e9));dist.set(s,0);
  while(open.size){let u=null,ud=1e9;open.forEach(n=>{const d=dist.get(n);if(d<ud){ud=d;u=n;}});if(!u||u===t)break;open.delete(u);for(const e of u.adj){const nd=ud+e[1];if(nd<dist.get(e[0])){dist.set(e[0],nd);prev.set(e[0],u);}}}
  const path=[];let c=t;while(c){path.unshift([c.x,c.z]);c=prev.get(c);}
  if(path.length>1){const a=path[0],b=path[1];if(Math.hypot(b[0]-x,b[1]-z)<Math.hypot(b[0]-a[0],b[1]-a[1]))path.shift();}
  path.push([tx,tz]);let len=Math.hypot(path[0][0]-x,path[0][1]-z);for(let i=1;i<path.length;i++)len+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);return {pts:path,len:len};}
let gpsRoute=null,gpsT=0,gpsIdx=0;
function gpsUpdate(dt,tx,tz){gpsT-=dt;if(!gpsRoute||gpsT<=0){gpsRoute=route(car.x,car.z,tx,tz);gpsIdx=0;gpsT=1.2;}
  while(gpsIdx<gpsRoute.pts.length-1&&Math.hypot(gpsRoute.pts[gpsIdx][0]-car.x,gpsRoute.pts[gpsIdx][1]-car.z)<9)gpsIdx++;
  let rem=Math.hypot(gpsRoute.pts[gpsIdx][0]-car.x,gpsRoute.pts[gpsIdx][1]-car.z);for(let i=gpsIdx+1;i<gpsRoute.pts.length;i++)rem+=Math.hypot(gpsRoute.pts[i][0]-gpsRoute.pts[i-1][0],gpsRoute.pts[i][1]-gpsRoute.pts[i-1][1]);
  return {nx:gpsRoute.pts[gpsIdx][0],nz:gpsRoute.pts[gpsIdx][1],rem:rem};}

/* ============ camera ============ */
let camMode=0;const CAMS=['قريبة','بعيدة','من جوه'];const camPos=V(-170,4,7),camLook=V(-150,1,7),tv=V(0,0,0),tl=V(0,0,0);let snapCam=true,camYaw=0,dragging=false,dragX=0;
function insideTall(x,y,z){for(const b of colliders){if(b.h>y&&x>b.x0-.3&&x<b.x1+.3&&z>b.z0-.3&&z<b.z1+.3)return true;}return false;}
let debugCam=null;
function updateCam(dt){updateCockpit();if(debugCam){camera.position.set(debugCam[0],debugCam[1],debugCam[2]);camera.lookAt(debugCam[3],debugCam[4],debugCam[5]);return;}const vh=Math.atan2(-car.vx,-car.vz);const spd=Math.hypot(car.vx,car.vz);const hh=(spd>3&&car.v>0?lerpAng(car.h,vh,.35):car.h)+camYaw;const fx=-Math.sin(hh),fz=-Math.cos(hh);
  if(camMode===2){const cf=-Math.sin(car.h),cz=-Math.cos(car.h);tv.set(car.x+cf*.45,car.y+(isVan?1.74:1.6),car.z+cz*.45);tl.set(car.x+fx*12,car.y+(isVan?1.3:.55),car.z+fz*12);camPos.copy(tv);camLook.lerp(tl,snapCam?1:1-Math.exp(-dt*14));}
  else{/* framing follows the screen shape: a tall phone sees more road ahead and the vehicle sits lower, a bigger vehicle gets more room */
    const port=camera.aspect<1,big=isVan?1.1:0;const dist=(camMode===1?10.5:(port?7.1:6.3))+big+(car.boost?1.2:0),hgt=(camMode===1?4.8:(port?3.25:2.75))+big*.35;let t=1;for(let i=0;i<8;i++){tv.set(car.x-fx*dist*t,hgt*(.75+.25*t),car.z-fz*dist*t);if(!insideTall(tv.x,tv.y,tv.z))break;t-=.12;}
    const ahead=port?7:4;tl.set(car.x+fx*ahead,port?1.0:1.2,car.z+fz*ahead);if(snapCam){camPos.copy(tv);camLook.copy(tl);}else{camPos.lerp(tv,1-Math.exp(-dt*5));camLook.lerp(tl,1-Math.exp(-dt*10));}}
  snapCam=false;if(!dragging)camYaw*=Math.exp(-dt*1.8);camera.position.copy(camPos);
  if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.25;camera.position.y+=(Math.random()-.5)*shake*.2;shake=Math.max(0,shake-dt*2.5);}
  camera.lookAt(camLook);const tf=baseFov+(car.boost?9:0)+Math.min(6,spd*.25);camera.fov+=(tf-camera.fov)*Math.min(1,dt*4);camera.updateProjectionMatrix();}
function lerpAng(a,b,t){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*t;}

/* ============ audio ============ */
const A={ctx:null,muted:false};
function initAudio(){if(A.ctx){if(A.ctx.state!=='running')A.ctx.resume().catch(()=>{});return;}const C=window.AudioContext||window.webkitAudioContext;if(!C){A.fail=true;return;}let ctx;try{ctx=new C();}catch(e){A.fail=true;return;}A.ctx=ctx;
  A.master=ctx.createGain();A.master.gain.value=.9*VOL.master;A.master.connect(ctx.destination);
  const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;A.noise=nb;
  const eg=ctx.createGain();eg.gain.value=0;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=650;lp.Q.value=2.2;const o1=ctx.createOscillator();o1.type='sawtooth';const o2=ctx.createOscillator();o2.type='square';const o2g=ctx.createGain();o2g.gain.value=.35;
  const amp=ctx.createGain();amp.gain.value=.55;const lfo=ctx.createOscillator();lfo.type='square';const lfoG=ctx.createGain();lfoG.gain.value=.45;lfo.connect(lfoG);lfoG.connect(amp.gain);o1.connect(lp);o2.connect(o2g);o2g.connect(lp);lp.connect(amp);amp.connect(eg);eg.connect(A.master);o1.start();o2.start();lfo.start();A.eng={o1:o1,o2:o2,lfo:lfo,lp:lp,eg:eg};
  const hg=ctx.createGain();hg.gain.value=0;const h1=ctx.createOscillator(),h2=ctx.createOscillator();h1.type=h2.type='square';h1.frequency.value=392;h2.frequency.value=494;const hf=ctx.createBiquadFilter();hf.type='lowpass';hf.frequency.value=2400;h1.connect(hf);h2.connect(hf);hf.connect(hg);hg.connect(A.master);h1.start();h2.start();A.hornG=hg;
  const sk=ctx.createBufferSource();sk.buffer=nb;sk.loop=true;const skf=ctx.createBiquadFilter();skf.type='bandpass';skf.frequency.value=1100;skf.Q.value=3;A.skidG=ctx.createGain();A.skidG.gain.value=0;sk.connect(skf);skf.connect(A.skidG);A.skidG.connect(A.master);sk.start();
  const tb=ctx.createBufferSource();tb.buffer=nb;tb.loop=true;const tbf=ctx.createBiquadFilter();tbf.type='highpass';tbf.frequency.value=2500;A.turboG=ctx.createGain();A.turboG.gain.value=0;tb.connect(tbf);tbf.connect(A.turboG);A.turboG.connect(A.master);tb.start();
  A.radioIn=ctx.createGain();const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=240;const lp2=ctx.createBiquadFilter();lp2.type='lowpass';lp2.frequency.value=3900;const sh=ctx.createWaveShaper();const cv=new Float32Array(512);for(let i=0;i<512;i++){const x=i/255.5-1;cv[i]=Math.tanh(x*1.6)/Math.tanh(1.6);}sh.curve=cv;
  A.radioVol=ctx.createGain();A.radioVol.gain.value=0;A.radioIn.connect(hp);hp.connect(lp2);lp2.connect(sh);sh.connect(A.radioVol);A.radioVol.connect(A.master);
  A.fileIn=ctx.createGain();const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=8000;A.fileIn.connect(fl);fl.connect(A.radioVol);
  const ns=ctx.createBufferSource();ns.buffer=nb;ns.loop=true;A.staticG=ctx.createGain();A.staticG.gain.value=0;const sbp=ctx.createBiquadFilter();sbp.type='bandpass';sbp.frequency.value=1700;sbp.Q.value=.6;ns.connect(sbp);sbp.connect(A.staticG);A.staticG.connect(A.radioIn);ns.start();
  A.musicBus=ctx.createGain();A.musicBus.gain.value=.55;A.musicBus.connect(A.radioIn);A.sfx=ctx.createGain();A.sfx.gain.value=.8;A.sfx.connect(A.master);}
function audioTick(){if(!A.ctx)return;const t=A.ctx.currentTime,sp=Math.abs(car.v),thr=car.thr||input.down;const f=28+car.rpm*.0165+(car.boost?8:0);
  A.eng.o1.frequency.setTargetAtTime(f,t,.08);A.eng.o2.frequency.setTargetAtTime(f*.5,t,.08);A.eng.lfo.frequency.setTargetAtTime(10+sp*1.7+(thr?3:0),t,.08);A.eng.lp.frequency.setTargetAtTime(520+sp*45+(thr?220:0),t,.1);
  A.eng.eg.gain.setTargetAtTime(fuel<=0?0:.075+(thr?.05:0)+sp*.004,t,.1);A.hornG.gain.setTargetAtTime(0,t,.015);if(input.horn&&!A.hornPrev)playSiren();A.hornPrev=input.horn;
  const sq=car.braking&&car.brakeHold<.9&&Math.abs(car.v)>7?.09*(1-car.brakeHold):0;A.skidG.gain.setTargetAtTime(Math.max(sq,Math.min(.25,Math.max(0,Math.abs(car.lat)-1.5)*.05)),t,.05);A.turboG.gain.setTargetAtTime(car.boost?.05:0,t,.08);}
/* Egyptian truck musical air-horn ("سرينة النقل"): brassy twin reeds playing the classic jingle */
let sirenUntil=0;
function playSiren(){if(!A.ctx)return;const ctx=A.ctx,t0=ctx.currentTime;if(t0<sirenUntil-.1)return;
  const N={G4:392,C5:523.25,E5:659.25,F5:698.46,D5:587.33,B4:493.88};
  const tune=[['G4',.13],['G4',.13],['G4',.13],['C5',.32],['E5',.36],[null,.1],['G4',.13],['G4',.13],['G4',.13],['C5',.32],['E5',.5]];
  const out=ctx.createGain();out.gain.value=.22;const shp=ctx.createWaveShaper();const c=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*2.6);}shp.curve=c;
  const bp=ctx.createBiquadFilter();bp.type='peaking';bp.frequency.value=1400;bp.gain.value=8;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3800;
  shp.connect(bp);bp.connect(lp);lp.connect(out);out.connect(A.sfx);
  let t=t0+.01;for(const [n,d] of tune){if(n){for(const det of [0,7,-5]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=N[n];o.detune.value=det;const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.28,t+.025);g.gain.setValueAtTime(.28,t+d-.03);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(shp);o.start(t);o.stop(t+d+.02);}}t+=d+.015;}
  sirenUntil=t;}
function blip(kind,s){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;
  if(kind==='thud'){const src=ctx.createBufferSource();src.buffer=A.noise;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=380;const g=ctx.createGain();g.gain.setValueAtTime(Math.min(1,.25+s*.08),t);g.gain.exponentialRampToValueAtTime(.001,t+.35);src.connect(f);f.connect(g);g.connect(A.sfx);src.start(t);src.stop(t+.4);}
  else{const notes=kind==='cash'?[880,1174.7,1568]:[660,880];notes.forEach((fq,i)=>{const o=ctx.createOscillator();o.type='triangle';o.frequency.value=fq;const g=ctx.createGain();g.gain.setValueAtTime(.0001,t+i*.09);g.gain.exponentialRampToValueAtTime(.2,t+i*.09+.01);g.gain.exponentialRampToValueAtTime(.0001,t+i*.09+.5);o.connect(g);g.connect(A.sfx);o.start(t+i*.09);o.stop(t+i*.09+.55);});}}
function setMute(m){A.muted=m;if(A.ctx)A.master.gain.setTargetAtTime(m?0:.9*VOL.master,A.ctx.currentTime,.05);$('bMute').classList.toggle('off',m);if(m&&Speech.ok)try{speechSynthesis.cancel();}catch(e){}}

/* radio music (maqam synth) */
const SCALES={hijaz:{root:146.83,c:[0,100,400,500,700,800,1000]},rast:{root:130.81,c:[0,200,350,500,700,900,1050]},bayati:{root:146.83,c:[0,150,300,500,700,800,1000]}};
const RHY={maqsum:['D','T','','T','D','','T',''],wahda:['D','','','T','','T','','']};
function degFreq(sc,deg){const o=Math.floor(deg/7),i=((deg%7)+7)%7;return sc.root*Math.pow(2,(sc.c[i]+1200*o)/1200);}
function pluck(t,f,vel){const ctx=A.ctx;const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;const o2=ctx.createOscillator();o2.type='triangle';o2.frequency.value=f*2.004;const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.setValueAtTime(3000,t);fl.frequency.exponentialRampToValueAtTime(480,t+.4);
  const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3*vel,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.95);const g2=ctx.createGain();g2.gain.value=.28;o.connect(fl);o2.connect(g2);g2.connect(fl);fl.connect(g);g.connect(A.musicBus);o.start(t);o2.start(t);o.stop(t+1);o2.stop(t+1);}
function ney(t,f,dur){const ctx=A.ctx;const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;const o2=ctx.createOscillator();o2.type='triangle';o2.frequency.value=f;const vib=ctx.createOscillator();vib.frequency.value=5.3;const vg=ctx.createGain();vg.gain.setValueAtTime(0,t);vg.gain.linearRampToValueAtTime(f*.007,t+.3);vib.connect(vg);vg.connect(o.frequency);vg.connect(o2.frequency);
  const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.16,t+.09);g.gain.setValueAtTime(.14,t+dur*.8);g.gain.linearRampToValueAtTime(.0001,t+dur+.12);const m=ctx.createGain();m.gain.value=.4;o.connect(g);o2.connect(m);m.connect(g);g.connect(A.musicBus);[o,o2,vib].forEach(x=>{x.start(t);x.stop(t+dur+.2);});}
function drum(t,k){const ctx=A.ctx;if(k==='D'){const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(125,t);o.frequency.exponentialRampToValueAtTime(52,t+.16);const g=ctx.createGain();g.gain.setValueAtTime(.75,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);o.connect(g);g.connect(A.musicBus);o.start(t);o.stop(t+.35);}
  else{const s=ctx.createBufferSource();s.buffer=A.noise;const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=2600;const g=ctx.createGain();g.gain.setValueAtTime(.32,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);s.connect(f);f.connect(g);g.connect(A.musicBus);s.start(t,Math.random()*1.5);s.stop(t+.08);}}
const Mus={next:0,step:0,phr:null,phrB:null,order:0};
function genPhrase(){const p=[];let d=7+((Math.random()*3)|0);for(let i=0;i<16;i++){if(i%2===1&&Math.random()<.45){p.push(null);continue;}d+=[-2,-1,-1,0,1,1,2][(Math.random()*7)|0];d=clamp(d,3,13);p.push(d);}p[14]=Math.random()<.5?7:4;p[15]=null;return p;}
function musicTick(){const st=RST[radio.idx];if(!A.ctx||!radio.on||radio.live||st.kind!=='synth'||radio.buffers[st.id])return;const ctx=A.ctx,now=ctx.currentTime;if(Mus.next<now)Mus.next=now+.06;const spb=60/st.tempo/2,sc=SCALES[st.maqam],rh=RHY[st.rhythm];
  while(Mus.next<now+.3){const s=Mus.step,t=Mus.next,i=s%16;if(i===0){if(!Mus.phrB||Mus.order%4===2)Mus.phrB=genPhrase();if(!Mus.phr||Mus.order%8===0)Mus.phr=genPhrase();Mus.order++;}
    const ph=(Mus.order%4===3)?Mus.phrB:Mus.phr;const k=rh[s%8];if(k)drum(t,k);const dg=ph[i];
    if(dg!==null&&dg!==undefined){if(st.voice==='ney'){if(i%2===0)ney(t,degFreq(sc,dg),spb*1.8);if(i%4===0)pluck(t,degFreq(sc,dg-7),.5);}else{pluck(t,degFreq(sc,dg),.85);if(Math.random()<.25)pluck(t+spb*.5,degFreq(sc,dg+1),.45);}}
    if(i%8===0)pluck(t,degFreq(sc,0)/2,.55);Mus.next+=spb;Mus.step++;}}

/* speech */
const Speech={ok:'speechSynthesis' in window,enabled:true,voice:null,voiceF:null,voiceM:null};
function pickVoices(){if(!Speech.ok)return;let vs=[];try{vs=speechSynthesis.getVoices()||[];}catch(e){}const ar=vs.filter(v=>/^ar/i.test(v.lang));Speech.voice=ar.find(v=>/EG/i.test(v.lang)&&/natural|online|neural/i.test(v.name))||ar.find(v=>/EG/i.test(v.lang))||ar.find(v=>/natural|online|neural/i.test(v.name))||ar[0]||null;
  Speech.voiceF=ar.find(v=>/salma|zariyah|hoda|laila|amina|mariam|female|rana|yasmin|sana/i.test(v.name))||Speech.voice;Speech.voiceM=ar.find(v=>/shakir|hamed|naayf|maged|majed|tarik|omar|fahed/i.test(v.name))||Speech.voice;
  const n=$('voiceNote');if(!Speech.ok||!Speech.voice){n.hidden=false;n.textContent='جهازك مفيهوش صوت عربي جاهز، فالحوار هيظهر مكتوب. على Edge أو Chrome أندرويد غالبًا هتسمع الحوار.';}else{n.hidden=false;n.textContent='صوت الحوار: '+Speech.voice.name+(/EG/i.test(Speech.voice.lang)?' (مصري)':'');}}
if(Speech.ok){pickVoices();try{speechSynthesis.addEventListener('voiceschanged',pickVoices);}catch(e){}}
const VO=createVoices(()=>A.ctx,()=>A.sfx);
/* the browser's speech engine reads Egyptian lines in a foreign accent and mispronounces them, so it is no longer offered:
   characters use real recordings when they exist, otherwise the game voice */
Speech.mode=(()=>{try{const m=ls.get('aps_voice');return m==='off'?'off':'game';}catch(e){return 'game';}})();Speech.enabled=Speech.mode!=='off';
function say(text,o){if(A.muted||Speech.mode==='off')return false;if(Speech.mode==='game'){if(!A.ctx)return false;VO.speak(text,o);return true;}
  if(!Speech.ok)return false;try{speechSynthesis.cancel();if(speechSynthesis.paused)speechSynthesis.resume();const u=new SpeechSynthesisUtterance(text);const v=o.female?Speech.voiceF:Speech.voiceM;if(v||Speech.voice){u.voice=v||Speech.voice;u.lang=u.voice.lang;}else u.lang='ar-EG';u.pitch=o.pitch||1;u.rate=o.rate||1;u.onend=u.onerror=()=>{o.onend&&o.onend();};speechSynthesis.speak(u);return true;}catch(e){return false;}}

/* radio */
const RST=[{id:'quran',name:'إذاعة القرآن الكريم',kind:'file',idents:['إذاعة القرآن الكريم من القاهرة']},
  {id:'sharq',name:'إذاعة الشرق الأوسط',kind:'synth',maqam:'hijaz',tempo:104,rhythm:'maqsum',voice:'oud',idents:['إذاعة الشرق الأوسط من القاهرة','معاكم إذاعة الشرق الأوسط']},
  {id:'nogoum',name:'نجوم إف إم',kind:'synth',maqam:'rast',tempo:112,rhythm:'maqsum',voice:'oud',idents:['نجوم إف إم','معاكم نجوم إف إم، مية وستة من عشرة',arTime]},
  {id:'aghani',name:'إذاعة الأغاني',kind:'synth',maqam:'bayati',tempo:92,rhythm:'maqsum',voice:'oud',idents:['إذاعة الأغاني من القاهرة','معاكم إذاعة الأغاني، أغاني زمان الجميل']}];
const NEEDLE=['12%','37%','63%','88%'];const radio={on:false,idx:2,vol:.7,buffers:{},src:null,nextIdent:0,identSpeaking:false};
function arTime(){const d=new Date();let h=d.getHours(),m=d.getMinutes();const H=['الثانية عشرة','الواحدة','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة','الحادية عشرة'];let part;const per=h<12?'صباحًا':(h<15?'ظهرًا':'مساءً');
  if(m<8)part='تمامًا';else if(m<23)part='والربع';else if(m<38)part='والنصف';else if(m<53){part='إلا ربعًا';h++;}else{part='تقريبًا';h++;}return 'الساعة دلوقتي '+H[h%12]+' '+part+' '+per;}
function buildRadioUI(){const box=$('stations');RST.forEach((s,i)=>{const b=document.createElement('button');b.className='st';b.textContent=s.name;b.id='st'+i;b.addEventListener('click',()=>{if(!radio.on)radioPower(true);tuneTo(i);});box.appendChild(b);});
  $('rPower').addEventListener('click',()=>radioPower(!radio.on));$('rClose').addEventListener('click',()=>{$('radio').hidden=true;$('bRadio').classList.remove('on');});
  $('rVol').addEventListener('input',e=>{radio.vol=e.target.value/100;radioLevel();});$('rLoad').addEventListener('click',()=>$('rFile').click());
  $('rUrlSave').addEventListener('click',()=>{const v=$('rUrl').value.trim(),id=RST[radio.idx].id;try{if(v)ls.set('aps_custom_'+id,v);else ls.del('aps_custom_'+id);}catch(e){}if(!radio.on)radioPower(true);tuneTo(radio.idx);});
  $('rFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;initAudio();const st=RST[radio.idx];$('rNote').textContent='بيحمّل '+f.name+'…';const fr=new FileReader();fr.onload=()=>{A.ctx.decodeAudioData(fr.result.slice(0),buf=>{radio.buffers[st.id]={buf:buf,name:f.name};if(!radio.on)radioPower(true);tuneTo(radio.idx);},()=>{$('rNote').textContent='الملف ده مش مدعوم. جرّب MP3 أو M4A.';});};fr.readAsArrayBuffer(f);e.target.value='';});}
function radioUI(){$('rPower').setAttribute('aria-pressed',radio.on);$('rPower').textContent=radio.on?'شغّال':'مقفول';RST.forEach((s,i)=>$('st'+i).classList.toggle('on',radio.on&&i===radio.idx));$('needle').style.left=NEEDLE[radio.idx];
  const st=RST[radio.idx],b=radio.buffers[st.id];let note;
  if(b)note='شغّال من جهازك: '+b.name;
  else if(radio.live)note='🔴 بث مباشر الآن: '+radio.liveName;
  else if(radio.liveState)note=radio.liveState+(radio.liveBusy?'':(st.kind==='file'?' — تقدر تحمّل تلاوة من جهازك.':' — شغالين مؤقتًا على محاكاة المحطة.'));
  else note=st.kind==='file'?'حمّل تلاوة من جهازك.':'محاكاة لروح المحطة.';
  if(A.fail)note='المتصفح ده مش بيدعم الصوت. افتح اللعبة في Chrome أو Edge.';
  $('rNote').textContent=note;let cu='';try{cu=ls.get('aps_custom_'+st.id)||'';}catch(e){}$('rUrl').value=cu;
  $('rLoad').textContent=st.kind==='file'?'حمّل تلاوة من جهازك':'شغّل تسجيل من جهازك';if(onairT<=0){const oa=$('onair');if(radio.on&&state==='play'){oa.hidden=false;oa.textContent=(radio.live?'🔴 مباشر • ':'')+(b?st.name+' • '+b.name:st.name);}else oa.hidden=true;}}
function radioLevel(){const duck=(Dlg.cur?.32:1)*(radio.identSpeaking?.45:1);if(liveEl)liveEl.volume=radio.on&&radio.live?clamp(radio.vol*(Dlg.cur?.4:1),0,1):0;if(!A.ctx)return;A.radioVol.gain.setTargetAtTime(radio.on&&!radio.live?radio.vol*duck:0,A.ctx.currentTime,.12);}
const LIVEQ={quran:['القرآن الكريم من القاهرة','القرآن الكريم','Quran Cairo'],sharq:['الشرق الأوسط','الشرق الاوسط','Middle East','Sharq','El Sharq','Al Sharq Al Awsat','Sharq Al Awsat'],nogoum:['نجوم','Nogoum','Nogoom','Nojoom'],aghani:['اذاعة الاغاني','إذاعة الأغاني','Aghani','El Aghany','Elaghany','أم كلثوم','ام كلثوم','Kalthoum','Kolthoum','طرب','Tarab','عبد الحليم','Halim','زمان']};
const RB=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
let liveEl=null,liveTok=0;
function liveAudio(){if(!liveEl){liveEl=new Audio();liveEl.preload='none';liveEl.addEventListener('playing',()=>{if(liveEl._tok!==liveTok)return;radio.live=true;radio.liveName=liveEl._name;if(A.ctx)A.staticG.gain.setTargetAtTime(0,A.ctx.currentTime,.1);radioLevel();radioUI();});
  liveEl.addEventListener('error',()=>{if(liveEl._tok===liveTok&&radio.live)liveFail('البث اتقطع، اضغط على المحطة تاني');});}return liveEl;}
async function fetchJ(u,ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(u,{signal:c.signal});return await r.json();}finally{clearTimeout(t);}}
async function findStreams(id){const out=[],seen=new Set();try{const m=ls.get('aps_custom_'+id);if(m){out.push({url:m,name:'رابط مخصص'});seen.add(m);}}catch(e){}
  try{const okU=ls.get('aps_ok_'+id);if(okU&&!seen.has(okU)){seen.add(okU);out.push({url:okU,name:'آخر بث اشتغل'});}}catch(e){}
  const hls=!!document.createElement('audio').canPlayType('application/vnd.apple.mpegurl');
  const add=arr=>{(arr||[]).forEach(x=>{const u=x.url_resolved||x.url;if(u&&!seen.has(u)&&x.lastcheckok!==0&&(hls||!(x.hls||/\.m3u8/i.test(u)))){seen.add(u);out.push({url:u,name:x.name});}});};
  for(const srv of RB){let dead=false;
    for(const q of LIVEQ[id]){try{add(await fetchJ(srv+'/json/stations/search?countrycode=EG&hidebroken=true&order=clickcount&reverse=true&limit=8&name='+encodeURIComponent(q),6000));}catch(e){dead=true;break;}if(out.length>=10)break;}
    if(!dead&&out.length<4){for(const q of LIVEQ[id].slice(0,6)){try{add(await fetchJ(srv+'/json/stations/search?hidebroken=true&order=clickcount&reverse=true&limit=5&name='+encodeURIComponent(q),6000));}catch(e){}}}
    if(out.length>0&&!dead)return out;if(dead&&location.protocol==='https:')return out;}
  return out;}
async function liveTry(i){const tok=++liveTok;radio.live=false;radio.liveBusy=true;radio.liveState='بيدوّر على البث المباشر…';radioUI();const st=RST[i];let list=[];try{list=await findStreams(st.id);}catch(e){}
  if(tok!==liveTok||!radio.on||radio.idx!==i)return;
  if(!list.length){radio.liveBusy=false;liveFail(location.protocol==='https:'?'البث المباشر مش متاح جوه Claude؛ افتح ملف اللعبة في Chrome':'مش لاقي بث للمحطة دي دلوقتي');return;}
  const a=liveAudio();
  for(let k=0;k<list.length;k++){if(tok!==liveTok)return;const c=list[k];a._tok=tok;a._name=c.name;radio.liveState='بيجرّب بث '+(k+1)+' من '+list.length+': '+c.name;radioUI();
    const ok=await new Promise(res=>{let done=false;const fin=v=>{if(done)return;done=true;a.removeEventListener('playing',onP);a.removeEventListener('error',onE);clearTimeout(t);res(v);};
      const onP=()=>fin(true),onE=()=>fin(false);a.addEventListener('playing',onP);a.addEventListener('error',onE);const t=setTimeout(()=>fin(false),8000);
      try{a.src=c.url;a.volume=radio.vol;const pr=a.play();if(pr)pr.catch(()=>fin(false));}catch(e){fin(false);}});
    if(tok!==liveTok)return;if(ok){try{ls.set('aps_ok_'+st.id,c.url);}catch(e){}return;}}
  radio.liveBusy=false;liveFail('كل روابط البث للمحطة دي واقفة دلوقتي');}
function liveFail(msg){radio.live=false;radio.liveBusy=false;radio.liveState=msg;if(liveEl){liveEl.pause();liveEl.removeAttribute('src');}radioLevel();radioUI();}
function liveStop(){liveTok++;radio.live=false;radio.liveBusy=false;radio.liveState='';if(liveEl){liveEl.pause();liveEl.removeAttribute('src');}}
function stopFile(){if(radio.src){try{radio.src.stop();}catch(e){}radio.src.disconnect();radio.src=null;}}
function radioPower(on){initAudio();radio.on=on;if(!A.ctx)return;if(on)tuneTo(radio.idx);else{stopFile();liveStop();A.staticG.gain.setTargetAtTime(0,A.ctx.currentTime,.05);if(radio.identSpeaking&&Speech.ok)speechSynthesis.cancel();radio.identSpeaking=false;}radioLevel();radioUI();}
function tuneTo(i){radio.idx=i;stopFile();liveStop();if(!A.ctx){radioUI();return;}const t=A.ctx.currentTime,st=RST[i];A.staticG.gain.cancelScheduledValues(t);A.staticG.gain.setValueAtTime(.38,t);A.staticG.gain.setTargetAtTime(st.kind==='file'&&!radio.buffers[st.id]?.035:0,t+.45,.12);
  Mus.next=t+.6;Mus.phr=null;Mus.order=0;Mus.step=0;const b=radio.buffers[st.id];if(b){const s=A.ctx.createBufferSource();s.buffer=b.buf;s.loop=true;s.connect(A.fileIn);s.start(t+.5);radio.src=s;}radio.nextIdent=clock+(b?1e9:1.6);if(!b)liveTry(i);radioLevel();radioUI();}
let onairT=0;
function radioUpdate(dt){musicTick();if(onairT>0){onairT-=dt;if(onairT<=0)radioUI();}if(!radio.on)return;const st=RST[radio.idx];
  if(!radio.live&&clock>=radio.nextIdent&&!Dlg.cur&&!radio.identSpeaking){let txt=pick(st.idents);if(typeof txt==='function')txt=txt();const oa=$('onair');oa.hidden=false;oa.textContent='على الهوا: '+txt;onairT=6;
    radio.identSpeaking=say(txt,{pitch:.82,rate:.88,babble:false,onend:()=>{radio.identSpeaking=false;radioLevel();}});radioLevel();radio.nextIdent=clock+rand(40,75);}}

/* dialogue */
const Dlg={q:[],cur:null,t:0,minT:0,maxT:0,done:false,gap:0};
function dlgPush(lines,pax){lines.forEach(l=>Dlg.q.push({who:l[0],text:l[1],pax:pax}));}
function dlgStart(it){Dlg.cur=it;Dlg.t=0;Dlg.done=false;const len=it.text.length;Dlg.minT=1.3+len*.05;Dlg.maxT=Math.max(Dlg.minT,len*.12+2.4);$('dialog').hidden=false;const w=$('dWho');w.className='who'+(it.who==='d'?' d':'');w.textContent=it.who==='d'?'الاسطى':it.pax.name;$('dText').textContent=it.text;radio.identSpeaking=false;
  const pr=it.who==='d'?{pitch:.95,rate:1.05}:{pitch:it.pax.pitch,rate:it.pax.rate||1,female:it.pax.female};if(!say(it.text,Object.assign(pr,{onend:()=>{Dlg.done=true;}})))Dlg.done=true;radioLevel();}
function dlgUpdate(dt){if(Dlg.cur){Dlg.t+=dt;if((Dlg.done&&Dlg.t>=Dlg.minT)||Dlg.t>=Dlg.maxT){Dlg.cur=null;Dlg.gap=.25;if(!Dlg.q.length){$('dialog').hidden=true;radioLevel();}}}else if(Dlg.q.length){Dlg.gap-=dt;if(Dlg.gap<=0)dlgStart(Dlg.q.shift());}}
function dlgClear(){Dlg.q.length=0;Dlg.cur=null;$('dialog').hidden=true;VO.stop();if(Speech.ok)try{speechSynthesis.cancel();}catch(e){}}


/* ============ Suzuki "مشروع": a fixed line with stops, up to 6 riders who pay on boarding ============ */
let line=null;
const L_BOARD=['على {d} يا اسطى؟','السلام عليكم، رايح {d}؟','ينفع {d} يا اسطى؟','فيه مكان؟ رايح {d}'];
const L_YES=['اركب يا باشا، فيه مكان','اتفضل، اتكل على الله','أيوه رايحين، اركب'];
const L_DOWN=['على جنب يا اسطى!','هنا يا اسطى، الله يكرمك','نزّلني هنا يا معلم','على اليمين لو سمحت'];
const L_PASS=['حد يوصّل الأجرة دي للاسطى','الأجرة يا اسطى، معاك فكة؟','اتفضل يا اسطى، اتنين من ورا'];
const L_FULL=['كامل يا جماعة، اللي بعدي!','مفيش مكان، العربية كاملة'];
function lineStops(){const keys=Object.keys(POI);const st=[];let cur=keys.reduce((a,b)=>Math.hypot(POI[a].x-car.x,POI[a].z-car.z)<Math.hypot(POI[b].x-car.x,POI[b].z-car.z)?a:b);
  while(st.length<9){st.push(cur);const rest=keys.filter(k=>!st.includes(k)&&Math.hypot(POI[k].x-POI[cur].x,POI[k].z-POI[cur].z)>70);if(!rest.length)break;cur=rest.reduce((a,b)=>Math.hypot(POI[a].x-POI[cur].x,POI[a].z-POI[cur].z)<Math.hypot(POI[b].x-POI[cur].x,POI[b].z-POI[cur].z)?a:b);}
  return st;}
function lineInit(){line={stops:lineStops(),idx:0,riders:[],queue:[],phase:'drive',crowd:[],wait:0,announced:false};lineCrowd(true);lineUI();}   /* first stop = the nearest one, with riders already waiting */
function lineCrowd(first){line.crowd.forEach(c=>{scene.remove(c.m);});line.crowd=[];const k=line.stops[line.idx],p=POI[k];const n=first?2+Math.floor(Math.random()*2):1+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++){const ty=pick(PT);const ox=(i-1)*0.8;const m=person(ty.look,p.x+p.sx+ox*Math.cos(Math.atan2(p.sx,p.sz)),p.z+p.sz-ox*Math.sin(Math.atan2(p.sx,p.sz)),0);line.crowd.push({type:ty,name:pick(ty.names),m:m});}}
function seatRider(r,i){const s=vanSeats[i];if(!s)return;s.clear();s.add(seated(r.pax.look));r.seat=i;}
function lineUI(){const el=$('lineBar');if(!line){el.hidden=true;return;}el.hidden=false;const n=line.stops.length;
  let dots='';for(let i=0;i<n;i++){const done=(i-line.idx+n)%n>n/2;dots+='<i class="'+(i===line.idx?'nx':(i===(line.idx-1+n)%n?'cur':''))+'" style="right:'+(i/(n-1)*100)+'%" title="'+POI[line.stops[i]].n+'"></i>';}
  el.querySelector('.track').innerHTML=dots+'<b class="van" style="right:'+(((line.idx-1+n)%n)/(n-1)*100)+'%">🚐</b>';
  $('lineNext').textContent='المحطة الجاية: '+POI[line.stops[line.idx]].n;$('lineSeats').textContent='الركاب '+arNum(line.riders.length)+'/٦';}
function linePrice(hops){return [5,5,7,7,10][Math.min(4,hops)];}
function lineNextPay(){if(!line.queue.length){line.phase='leave';line.wait=.6;return;}const r=line.queue.shift();
  dlgPush([['p',pick(L_PASS)]],r.pax);startPay({price:r.price,pax:r.pax,hits:0,fast:0,t:0,budget:999},lost=>{const tip=Math.random()<.15?5:0;const pay=r.price-lost+tip;save.wallet+=pay;save.total+=pay;persist();updateMoney();
    toast('+'+pay+' ج.م'+(tip?' • بقشيش':'')+(lost?' • ضاع منك '+lost:''),lost?'bad':'good');blip('cash');lineNextPay();});}
function updateLine(dt){if(!line)lineInit();const k=line.stops[line.idx],p=POI[k],d=Math.hypot(p.x-car.x,p.z-car.z);
  for(const c of line.crowd)c.m.rotation.y=Math.atan2(-(car.x-c.m.position.x),-(car.z-c.m.position.z))+Math.PI;
  if(destBeam){const on=line.phase==='drive';if(destBeam.visible!==on)destBeam.visible=destRing.visible=on;if(on){destBeam.position.set(p.x+p.sx,0,p.z+p.sz);destRing.position.set(p.x+p.sx,.15,p.z+p.sz);}}
  if(line.phase==='drive'){
    if(!line.announced&&d<90){line.announced=true;const down=line.riders.filter(r=>r.dest===line.idx);if(down.length)dlgPush([['p',pick(L_DOWN)]],down[0].pax);}
    if(Math.min(d,Math.hypot(p.x+p.sx-car.x,p.z+p.sz-car.z))<PICK_R+1){if(Math.abs(car.v)<2.2){line.phase='stop';line.wait=.8;}else if(stopHint<=0){toast('هدّي ووقّف في المحطة');stopHint=3;}}
    return;}
  if(line.phase==='stop'){line.wait-=dt;if(line.wait>0)return;
    const down=line.riders.filter(r=>r.dest===line.idx);down.forEach(r=>{if(vanSeats[r.seat])vanSeats[r.seat].clear();save.trips++;});line.riders=line.riders.filter(r=>r.dest!==line.idx);
    if(down.length)dlgPush([['d',down.length>1?'مع السلامة يا جماعة':'مع السلامة يا باشا']],down[0].pax);
    const free=[0,1,2,3,4,5].filter(i=>!line.riders.some(r=>r.seat===i));const n=line.stops.length;
    line.crowd.forEach((c,ci)=>{const pax=Object.assign({name:c.name},c.type);if(!free.length){if(ci===0)dlgPush([['d',pick(L_FULL)]],pax);return;}
      const hops=1+Math.floor(Math.random()*4),dest=(line.idx+hops)%n,price=linePrice(hops);
      if(ci<2)dlgPush([['p',pick(L_BOARD).replace('{d}',POI[line.stops[dest]].n)],['d',pick(L_YES)]],pax);
      const r={pax:pax,dest:dest,price:price};seatRider(r,free.shift());line.riders.push(r);line.queue.push(r);scene.remove(c.m);c.gone=true;});
    line.crowd=line.crowd.filter(c=>!c.gone);line.phase='pay';line.wait=1.4;lineUI();return;}
  if(line.phase==='pay'){if(line.wait>0){line.wait-=dt;if(line.wait<=0)lineNextPay();}return;}
  if(line.phase==='leave'){line.wait-=dt;if(line.wait>0)return;line.crowd.forEach(c=>scene.remove(c.m));line.idx=(line.idx+1)%line.stops.length;line.announced=false;line.phase='drive';lineCrowd();gpsRoute=null;lineUI();}}

/* ============ fares ============ */
const PT=[
 {names:['عم سيد','عم محمود','عم رجب'],title:'يا حاج',pitch:.8,look:{shirt:'#2f4f7a',pants:'#2b2b2b',helmet:'#f2c230',skin:'#9a6b4a'},likes:['ws','dock','gate50','quay','store','gateS','weld'],ride:['الوردية النهارده طويلة أوي','النهارده عندنا لحام بدن مركب كبيرة','المهندس قال لازم نخلّص قبل الضهر','ربنا يعين الواحد على المعيشة']},
 {names:['الباشمهندسة منى','الباشمهندسة سارة'],female:true,title:'يا باشمهندسة',pitch:1.25,look:{shirt:'#f4f1ea',pants:'#3b4a63',helmet:'#ffffff',hijab:'#6d3b5a',skin:'#c69472'},likes:['theory','elec','tcadmin','ws','dock','admin'],ride:['عندي محاضرة للدفعة الجديدة في مبنى النظري','النهارده هشرح للمتدربين قراءة الرسومات','الالتزام بمهمات الوقاية مش رفاهية، دي حياة']},
 {names:['كريم','يوسف','مازن'],title:'يا بطل',pitch:1.12,rate:1.08,look:{shirt:'#1f6f5c',pants:'#2a3550',skin:'#b07a55'},likes:['elec','weld','lathe','theory','school','micro'],ride:['أول يوم تدريب عملي، متوتر شوية','المدرب قال اللي يلتزم بالسلامة هيبقى أشطر فني','نفسي أشتغل على الونش الكبير ده','أبويا كان شغال في الميناء من زمان']},
 {names:['الريّس حسن','الريّس عبده'],title:'يا ريّس',pitch:.68,rate:.92,look:{shirt:'#ffffff',pants:'#1c2a44',cap:'#1c2a44',skin:'#8a5a3b'},likes:['quay','dock','fish','cafe','admin'],ride:['البحر ده ياما شاف حكايات','الموج النهارده هادي، الحمد لله','كنا بنسمع الست في المركب أول خميس في الشهر']},
 {names:['الحاجة أم أحمد','مدام نادية'],female:true,title:'يا حاجة',pitch:1.15,rate:.95,look:{shirt:'#3b2a4a',pants:'#3b2a4a',hijab:'#1f1f2a',skin:'#c69472',galabeya:true},likes:['market','bakery','clinic','mosque','fish'],ride:['الأسعار ولّعت يا ابني','هجيب سمك للعيال من السوق','العيش لازم يبقى سخن، الولاد مستنيين']},
 {names:['عم بيومي'],title:'يا عم الحاج',pitch:.72,look:{shirt:'#e9e2d0',pants:'#e9e2d0',cap:'#ffffff',skin:'#8a5a3b',galabeya:true},likes:['mosque','cafe','fish','gate1'],ride:['زمان الكورنيش كان فاضي ونضيف','هنا القاهرة… الإذاعة دي ربّتنا','اشتغلت في الترسانة أربعين سنة، كل حتة فيها أعرفها']},
 {names:['زياد','عمر'],title:'يا كابتن',pitch:1.15,rate:1.1,look:{shirt:'#2e5e8c',pants:'#2e5e8c',skin:'#b07a55'},likes:['school','micro','cafe','market','lathe'],ride:['متأخر على الحصة الأولى','عندنا امتحان عملي في الورشة النهارده','الأستاذ هيطلّعني برّه لو اتأخرت']}];
const INTRO_P=['السلام عليكم يا اسطى، {d} لو سمحت','مساء الخير يا اسطى، توصّلني {d}؟','يا اسطى، {d} الله يخليك، ومستعجل شوية','ممكن {d} يا معلم؟'];
const INTRO_D=['وعليكم السلام، اتفضل {t}','اتفضل {t}، اركب ومتشيلش هم','حاضر {t}، دقايق ونكون هناك','نوّرت {t}، اتكل على الله'];
const INTRO_D2=['امسك نفسك كويس، الطريق فيه مطبات','لو عايز أعلّي الراديو قولّي'];
const END_SEQ=[[['p','الحساب كام يا اسطى؟'],['d','خليها علينا {t}'],['p','لا والله ما يحصل، اتفضل'],['d','تسلم إيدك، في رعاية الله']],[['p','وصلنا الحمد لله، تسلم إيدك يا اسطى'],['d','الله يسلمك {t}، نوّرتني']],[['p','اتفضل يا اسطى، والباقي علشانك'],['d','ربنا يكرمك {t}']]];
const END_LATE=[[['p','اتأخرنا كتير يا اسطى، المرة الجاية شد حيلك شوية'],['d','حقك عليّا {t}، الطريق كان واقف']],[['p','الحمد لله وصلنا، بس الوقت راح علينا'],['d','معلش {t}، المرة الجاية أحسن']]];
const HIT_L=['حاسب يا اسطى! هتودّينا في داهية','إيه يا عم ده؟ إحنا راكبين توكتوك ولا لعبة الملاهي؟','يا أسطى ده مطب ولا جبل؟ ضهري اتقسم نصين','الخبطة دي هتتحسب عليك في الأجرة يا معلم','براحة يا معلم، إحنا مش في سباق','يا ساتر يا رب! خلّي بالك من الطريق'];
const FAST_L=['بالراحة يا اسطى، مش مستعجلين على آخرتنا','إيه يا عم الطيارة دي؟ إحنا رايحين المطار؟','اللي يستعجل يتأخر يا اسطى، ده كلام الكبار','هدّي يا فورمولا، التوكتوك مش فيراري','هدّي شوية الله يخليك، قلبي وقع','إيه ده يا اسطى! التوكتوك ده فيه موتور طيارة؟'];
/* إفيهات: light Egyptian humour that comes up by itself during rides (shared tuk, traffic, waiting, rush hour) */
const IFEH_L=['يا اسطى إنت سايق ولا بتحلم؟ صحصح معانا','التوكتوك ده فيه تكييف؟ آه، تكييف طبيعي من الشباك','الدنيا زحمة ليه كده؟ هو النهارده العيد ولا إيه؟',
  'أنا لو كنت أعرف إن المشوار ده كله كده كنت جيت ماشي','يا عم الحاج، الحاجات الحلوة بتيجي متأخر، زي التوكتوك ده بالظبط','اللي اختشوا ماتوا يا اسطى، زمّر وعدّي',
  'يا بني الصبر مفتاح الفرج، بس مش للدرجة دي','ده أنا لو ركبت الطيارة كنت وصلت أسرع','عارف يا اسطى؟ أحلى حاجة في إسكندرية الهوا… وأوحش حاجة الزحمة',
  'شغّل لنا حاجة نسمعها يا معلم، الطريق طويل','إنت منين يا اسطى؟ باين عليك إسكندراني أصلي','كل ما أركب توكتوك أفتكر أيام الجامعة'];
const JAM_L=['يا ساتر على الزحمة، هو كل إسكندرية نازلة النهارده؟','ما تدخل من الشارع اللي جنب يا اسطى، اختصر','لو فضلنا واقفين كده هنعيّد هنا'];
const RADIO_L=['الله! صوت الراديو ده بيفكرني بأيام زمان','علّي الراديو شوية يا اسطى، الإذاعة دي حلوة','هنا القاهرة… ياه، أيام ما كنا بنسمعها مع أبويا'];
const GUARD={name:'أمن البوابة',pitch:.72,rate:.95},WALKER={name:'واحد ماشي',pitch:1.05,rate:1.1};
const GUARD_IN=[[['p','مساء الخير يا اسطى، التصريح معاك؟'],['d','أيوه يا باشا، اتفضل'],['p','تمام، اتفضل. وخلّي سرعتك هادية جوه']],[['p','على فين يا اسطى؟'],['d','موصّل زبون جوه يا فندم'],['p','ماشي، بالراحة على الرصيف']],[['p','صباح الفل يا اسطى، اتفضل عدّي']]];
const GUARD_OUT=[[['p','مع السلامة يا اسطى']],[['p','في رعاية الله، وخلّي بالك من الزحمة برّه']]];
const CAMPUS_IN=[[['p','أهلاً يا اسطى، المتدربين كتير جوه، هدّي السرعة'],['d','حاضر يا باشمهندس']],[['p','اتفضل، بس متقرّبش من الورش وهي شغالة'],['d','تحت أمرك']]];
const WALK_L=['حاسب يا اسطى!','براحة يا عم، كنت هتخبطني!','يا جدع بص قدامك!'];
const HAIL_L=['يا توكتوك! يا اسطى!','اسطى! استنى عندك!','يا اسطى، فاضي؟'];
const AREA_C={wardian:WARDIAN_AREA_TALK,campus:['مركز التدريب ده خرّج أجيال من أشطر الفنيين','الورش هنا فيها مكن حديث، والمدربين على أعلى مستوى'],yard:['الترسانة دي تاريخ، ياما بنت وصلّحت مراكب','شايف الونش الأحمر ده؟ بيرفع بلوكات المراكب كلها'],port:['الميناء النهارده زحمة حاويات','المراكب دي جاية من آخر الدنيا'],city:['الحمد لله طلعنا من الزحمة','الشارع ده كان كله جناين زمان'],qabbari:['دخلنا القباري، الحتة دي كلها ناس طيبين','القباري زحمة الصبح، بس بعد الضهر بتروق']};
function areaOf(x,z){if(z<-16){if(x>115)return 'yard';return 'port';}if(x>TC.X0&&x<TC.X1&&z<TC.Z1)return 'campus';if(x>-300&&x<-150&&z>-16)return 'qabbari';return WD.contains(x,z)?'wardian':'city';}
const guardCd={};let walkCd=0,hailCd=0;
function interactions(dt){walkCd-=dt;hailCd-=dt;const quiet=!Dlg.cur&&!Dlg.q.length;
  for(const g of GATES){if(Math.abs(car.x-g.x)<6&&car.z>-21&&car.z<-11&&(guardCd[g.x]||0)<clock&&quiet){if(car.vz<-1.2){dlgPush(pick(GUARD_IN),GUARD);guardCd[g.x]=clock+45;}else if(car.vz>1.2){dlgPush(pick(GUARD_OUT),GUARD);guardCd[g.x]=clock+45;}}}
  if(Math.abs(car.x-TC.gateMain)<5&&car.z>TC.Z0-1&&car.z<TC.Z0+6&&car.vz>1.2&&(guardCd.c||0)<clock&&quiet){dlgPush(pick(CAMPUS_IN),GUARD);guardCd.c=clock+45;}
  if(walkCd<=0&&Math.abs(car.v)>5&&Dlg.q.length<2){for(const w of walkers){if(Math.hypot(w.m.position.x-car.x,w.m.position.z-car.z)<2.6){dlgPush([['p',pick(WALK_L)]],WALKER);walkCd=10;break;}}}
  if(riders.length<SEATS_TUK&&!boarding&&hailCd<=0&&quiet){for(const w of waiting){const p=POI[w.poi],d=Math.hypot(p.x-car.x,p.z-car.z);if(!w.hailed&&d>12&&d<35){w.hailed=true;PEOPLE.play(w.m,'Wave',.25);w.waveT=3.5;dlgPush([['p',pick(HAIL_L)]],{name:w.name,pitch:w.type.pitch,female:w.type.female});hailCd=12;break;}}}
  if(fare&&fare.phase==='ride'){const a=areaOf(car.x,car.z);if(a!==fare.area){fare.area=a;if(AREA_C[a]&&Math.random()<.6&&quiet)dlgPush([['p',pick(AREA_C[a])]],fare.pax);}}}
const PICK_R=12;const waiting=[];let fare=null;const MAXW=6;
const beamMat=new T.MeshBasicMaterial({color:'#fff1c8',transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
const vipBeamMat=new T.MeshBasicMaterial({color:'#ffcc33',transparent:true,opacity:.42,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
const beamGeo=new T.CylinderGeometry(1.6,1.6,60,20,1,true);beamGeo.translate(0,30,0);
let destBeam,destRing;
/* one coloured beam + ring + order number per rider in the tuk */
const RMK=[];
function numTex(n,col){return ctex(128,128,g=>{g.fillStyle=col;g.beginPath();g.arc(64,64,58,0,7);g.fill();g.lineWidth=8;g.strokeStyle='#101B2D';g.stroke();g.fillStyle='#101B2D';g.font='bold 76px '+GAMEF;g.textAlign='center';g.textBaseline='middle';g.fillText(arNum(n),64,70);});}
function riderMarks(){if(!RMK.length&&scene){RIDER_COLS.forEach(c=>{const b=new T.Mesh(beamGeo,new T.MeshBasicMaterial({color:c,transparent:true,opacity:.3,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));
    const r=new T.Mesh(new T.TorusGeometry(3,.16,8,40),new T.MeshBasicMaterial({color:c}));r.rotation.x=Math.PI/2;const sp=new T.Sprite(new T.SpriteMaterial({depthTest:false,toneMapped:false}));sp.scale.set(4,4,1);sp.renderOrder=6;
    [b,r,sp].forEach(o=>{o.visible=false;scene.add(o);});RMK.push({b,r,sp,n:-1});});}
  RMK.forEach(m=>{m.b.visible=m.r.visible=m.sp.visible=false;});
  riders.forEach((rd,i)=>{const m=RMK[rd.col],p=POI[rd.to];m.b.position.set(p.x,0,p.z);m.r.position.set(p.x,.15,p.z);m.sp.position.set(p.x,14,p.z);m.b.visible=m.r.visible=m.sp.visible=true;
    if(m.n!==i){m.n=i;if(m.sp.material.map)m.sp.material.map.dispose();m.sp.material.map=numTex(i+1,RIDER_COLS[rd.col]);m.sp.material.needsUpdate=true;}});}
function riderList(){const el=$('riders');if(!el)return;if(!riders.length){el.hidden=true;return;}el.hidden=false;
  el.innerHTML=riders.map((r,i)=>'<div class="rd"><i style="background:'+RIDER_COLS[r.col]+'">'+arNum(i+1)+'</i><b>'+r.pax.name+'</b><span>'+POI[r.to].n+'</span></div>').join('');}
/* ============ mission «مشوار الورديان»: one scripted rider on the normal fare + change system ============ */
/* ============ missions (Phase 6): scripted riders on the normal fare + change system, one at a time ============ */
const missionBeamMat=new T.MeshBasicMaterial({color:'#ffb12a',transparent:true,opacity:.32,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
let missionCd=5,missionFails={};
const missionById=id=>MISSIONS.find(m=>m.id===id);
function missionTo(m){return m.to==='@wgarage'?(POI.wgarage?'wgarage':'wshops'):m.to;}
function missionState(m){if(m.soon)return 'soon';if(save.missions&&save.missions[m.id])return 'done';if(repLevel((save.rep&&save.rep.xp)||0)<m.lvl)return 'locked';return 'open';}
function nextMission(){return MISSIONS.find(m=>missionState(m)==='open'&&POI[m.from]&&POI[missionTo(m)]);}
function missionDone(){return !nextMission();}
function spawnMission(dt){missionCd-=dt;if(missionCd>0||isVan||riders.length>=SEATS_TUK||waiting.some(w=>w.mission))return;const M=nextMission();if(!M)return;
  const k=M.from,p=POI[k];const old=waiting.find(w=>w.poi===k);if(old){scene.remove(old.m);scene.remove(old.b);dropTag(old);waiting.splice(waiting.indexOf(old),1);}
  const m=person(M.pax.look,p.x+p.sx,p.z+p.sz,Math.atan2(p.sx,p.sz));const b=new T.Mesh(beamGeo,missionBeamMat);b.position.set(p.x,0,p.z);addSpot(b,p,true);scene.add(b);
  const w={poi:k,type:M.pax,name:M.pax.names[0],m:m,b:b,mission:M.id};chooseDest(w);addTag(w);waiting.push(w);toast('مهمة جديدة: «'+M.n+'» — '+M.pax.names[0]+' مستني عند '+p.n,'good');}
/* dotted square on the pavement where a rider waits (child of the stop beam, so it goes away with it) */
const spotTex=ctex(128,128,g=>{g.fillStyle='rgba(245,185,40,.26)';g.fillRect(8,8,112,112);g.strokeStyle='#FFD24A';g.lineWidth=10;g.setLineDash([16,10]);g.lineCap='round';g.strokeRect(9,9,110,110);});
const spotGeo=new T.PlaneGeometry(2.1,2.1).rotateX(-Math.PI/2);
const spotMat=new T.MeshBasicMaterial({map:spotTex,toneMapped:false,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
const spotMatM=new T.MeshBasicMaterial({map:spotTex,color:'#ff9a3c',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
function addSpot(b,p,mission){const q=new T.Mesh(spotGeo,mission?spotMatM:spotMat);q.position.set(p.sx,.14,p.sz);q.renderOrder=2;b.add(q);
  /* the stop bay on the road: a dotted vehicle-sized box where the driver pulls in, long side along the kerb */
  const bay=new T.Mesh(bayGeo,mission?bayMatM:bayMat);bay.position.set(0,.06,0);bay.rotation.y=Math.atan2(p.sx,p.sz);bay.renderOrder=2;b.add(bay);}
const bayTex=ctex(256,160,g=>{g.fillStyle='rgba(255,210,74,.13)';g.fillRect(8,8,240,144);g.strokeStyle='#FFD24A';g.lineWidth=9;g.setLineDash([18,12]);g.lineCap='round';g.strokeRect(9,9,238,142);g.setLineDash([]);
  g.strokeStyle='rgba(255,226,140,.55)';g.lineWidth=7;[[96,80],[160,80]].forEach(([x,y])=>{g.beginPath();g.moveTo(x-12,y-26);g.lineTo(x+12,y);g.lineTo(x-12,y+26);g.stroke();});});
const bayGeo=new T.PlaneGeometry(4.8,3).rotateX(-Math.PI/2);
const bayMat=new T.MeshBasicMaterial({map:bayTex,toneMapped:false,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});
const bayMatM=new T.MeshBasicMaterial({map:bayTex,color:'#ff9a3c',toneMapped:false,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});
/* where a waiting rider is going and the fare, decided when they appear so it can be shown over their head */
function chooseDest(w){const M=w.mission&&missionById(w.mission);let to;
  if(M)to=missionTo(M);else{const opts=Object.keys(POI).filter(k=>k!==w.poi&&Math.hypot(POI[k].x-POI[w.poi].x,POI[k].z-POI[w.poi].z)>110);to=opts.filter(k=>w.type.likes.includes(k));to=to.length&&Math.random()<.75?pick(to):pick(opts);}
  const r=route(POI[w.poi].x,POI[w.poi].z,POI[to].x,POI[to].z);w.to=to;w.len=r.len;w.price=clamp(Math.round((10+r.len/1000*12)/5)*5,10,60);
  const mul=(w.vip?2:1)*(EV.kind==='rush'?1.5:1);if(mul>1)w.price=Math.round(w.price*mul/5)*5;}
/* floating destination card over a waiting rider: destination, name and fare, a pointer down to them */
function tagTex(w){const c=document.createElement('canvas');c.width=640;c.height=210;const g=c.getContext('2d');const gold=w.mission?'#ff9a3c':(w.vip?'#ffd700':'#F5B928');
  const r=(x,y,W,H,R)=>{g.beginPath();g.moveTo(x+R,y);g.arcTo(x+W,y,x+W,y+H,R);g.arcTo(x+W,y+H,x,y+H,R);g.arcTo(x,y+H,x,y,R);g.arcTo(x,y,x+W,y,R);g.closePath();};
  g.shadowColor='rgba(0,0,0,.45)';g.shadowBlur=14;g.shadowOffsetY=4;r(14,10,612,150,30);g.fillStyle='rgba(17,26,40,.92)';g.fill();g.shadowColor='transparent';
  g.lineWidth=6;g.strokeStyle=gold;g.stroke();g.beginPath();g.moveTo(296,158);g.lineTo(320,196);g.lineTo(344,158);g.closePath();g.fillStyle=gold;g.fill();
  r(28,26,132,118,22);g.fillStyle=gold;g.fill();g.fillStyle='#1a1408';g.textAlign='center';g.textBaseline='middle';g.font='bold 54px '+GAMEF;g.fillText(arNum(w.price),94,74);g.font='bold 26px '+GAMEF;g.fillText('جنيه',94,118);
  g.direction='rtl';g.textAlign='right';g.fillStyle='#ffffff';let fs=50;const dn=POI[w.to].n;g.font='bold '+fs+'px '+GAMEF;while(g.measureText(dn).width>420&&fs>26){fs-=2;g.font='bold '+fs+'px '+GAMEF;}
  g.fillText(dn,598,66);g.font='30px '+GAMEF;g.fillStyle=w.mission?'#ffc48a':'#ffe08a';g.fillText((w.mission?'مهمة · ':(w.vip?'⭐ VIP · ':'رايح · '))+w.name,598,122);
  const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;}
function addTag(w){const sp=new T.Sprite(new T.SpriteMaterial({map:tagTex(w),transparent:true,depthWrite:false,toneMapped:false,fog:false}));sp.center.set(.5,0);sp.scale.set(3.9,1.28,1);sp.position.set(w.m.position.x,2.15,w.m.position.z);sp.renderOrder=5;scene.add(sp);w.tag=sp;}
function dropTag(w){if(w.tag){scene.remove(w.tag);w.tag.material.map.dispose();w.tag.material.dispose();w.tag=null;}}
function spawnWaiting(){const keys=Object.keys(POI).filter(k=>!waiting.some(w=>w.poi===k)&&!riders.some(r=>r.to===k)&&Math.hypot(POI[k].x-car.x,POI[k].z-car.z)>40);if(!keys.length)return;
  const k=pick(keys),p=POI[k];const ty=pick(PT);const lk=ty.look;const m=person(lk,p.x+p.sx,p.z+p.sz,Math.atan2(-(p.x-(p.x+p.sx)),-(p.z-(p.z+p.sz))));const b=new T.Mesh(beamGeo,beamMat);b.position.set(p.x,0,p.z);addSpot(b,p);scene.add(b);
  const w={poi:k,type:ty,name:pick(ty.names),m:m,b:b};chooseDest(w);addTag(w);waiting.push(w);return w;}
/* ============ riders (Phase 8): up to 3 in the tuk, each pays when they get in, dropped in the order they got in ============ */
/* ============ daily goals, events, streaks (Phase 8): something new to chase every session ============ */
const DAILY_POOL=[
  {id:'rides5',n:'وصّل ٥ زباين',goal:5,ev:'ride',rw:60},{id:'rides8',n:'وصّل ٨ زباين',goal:8,ev:'ride',rw:100},
  {id:'earn150',n:'اكسب ١٥٠ جنيه أجرة',goal:150,ev:'earn',rw:50},{id:'full',n:'شيل ٣ زباين في نفس الوقت',goal:1,ev:'full',rw:70},
  {id:'exact4',n:'رجّع الباقي مظبوط ٤ مرات',goal:4,ev:'exact',rw:40},{id:'clean3',n:'٣ مشاوير من غير ولا خبطة',goal:3,ev:'clean',rw:50},
  {id:'tc2',n:'وصّل زبونين لمركز التدريب',goal:2,ev:'tc',rw:60},{id:'west2',n:'وصّل زبونين للورديان أو القباري',goal:2,ev:'west',rw:60},
  {id:'mission1',n:'خلّص مهمة',goal:1,ev:'mission',rw:50},{id:'ontime3',n:'٣ مشاوير قبل الوقت',goal:3,ev:'ontime',rw:45},
  {id:'lost1',n:'رجّع حاجة نسيها زبون',goal:1,ev:'lost',rw:40},{id:'vip1',n:'وصّل زبون VIP',goal:1,ev:'vip',rw:50}];
let streak=0;
function today(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function daily(){const d=today();if(!save.daily||save.daily.d!==d){let h=0;for(const c of d)h=(h*31+c.charCodeAt(0))>>>0;const pool=DAILY_POOL.slice(),g=[];
    while(g.length<3){h=(h*1103515245+12345)>>>0;const i=h%pool.length;g.push({id:pool[i].id,p:0,done:0});pool.splice(i,1);}save.daily={d:d,g:g};persist();}return save.daily;}
function dailyEv(ev,n){const D=daily();let ch=false;for(const q of D.g){const G=DAILY_POOL.find(x=>x.id===q.id);if(!G||q.done||G.ev!==ev)continue;q.p=Math.min(G.goal,q.p+n);ch=true;
  if(q.p>=G.goal){q.done=1;save.wallet+=G.rw;save.total+=G.rw;save.rep={xp:((save.rep&&save.rep.xp)||0)+10};setTimeout(()=>{toast('🎯 خلّصت هدف النهارده «'+G.n+'» — مكافأة '+G.rw+' ج.م','good');blip('cash');updateMoney();},1800);}}
  if(ch)persist();}
/* events: rush hour (fares ×1.5), a VIP rider (double fare, tip if no knocks), a rider who forgot something */
const EV={kind:null,t:0,next:rand(70,120)};
function eventsTick(dt){if(isVan)return;daily();
  if(EV.kind){EV.t-=dt;if(EV.kind==='lost'){const p=POI[EV.poi];if(Math.hypot(p.x-car.x,p.z-car.z)<PICK_R&&Math.abs(car.v)<2.2){const rw=30;save.wallet+=rw;save.total+=rw;save.rep={xp:((save.rep&&save.rep.xp)||0)+12};persist();updateMoney();blip('cash');
        dlgPush([['p','ربنا يخليك يا اسطى! ده أنا كنت هتجنن عليه'],['d','ولا يهمك، الأمانة أمانة']],{name:EV.name,pitch:1});toast('🤝 رجّعت الأمانة لـ'+EV.name+'  • +'+rw+' ج.م  • +١٢ سمعة','good');dailyEv('lost',1);endEvent();return;}}
    if(EV.t<=0){if(EV.kind==='lost')toast('الوقت خلص… '+EV.name+' مشي','bad');endEvent();}evBadge();return;}
  EV.next-=dt;if(EV.next>0)return;const k=Math.random()<.55?'rush':'vip';
  if(k==='rush'){EV.kind='rush';EV.t=80;toast('🔥 ساعة الذروة! الأجرة ×١٫٥ لمدة دقيقة ونص','good');waiting.forEach(w=>{if(!w.mission){chooseDest(w);dropTag(w);addTag(w);}});}
  else{const w=spawnWaiting();if(w){w.vip=true;w.name='الباشا '+pick(['رأفت','ممدوح','شريف','عادل']);chooseDest(w);dropTag(w);addTag(w);w.b.material=vipBeamMat;EV.kind='vip';EV.t=70;EV.w=w;toast('⭐ زبون VIP مستنيك عند '+POI[w.poi].n+' — الأجرة الضعف','good');}else EV.next=20;}
  evBadge();}
function endEvent(){EV.kind=null;EV.w=null;EV.next=rand(110,190);evBadge();}
function forgotItem(f){if(EV.kind)return;EV.kind='lost';EV.t=75;EV.poi=f.to;EV.name=f.pax.name;setTimeout(()=>{toast('📱 '+f.pax.name+' نسي موبايله في التوكتوك! رجّعهوله عند '+POI[f.to].n,'bad');dlgPush([['d','يا نهار أبيض، الزبون نسي موبايله! لازم أرجّعهوله']],null);},2600);evBadge();}
function evBadge(){const b=$('evBadge');if(!b)return;const show=EV.kind||streak>=2;b.hidden=!show;if(!show)return;
  const tt=EV.kind?Math.max(0,Math.ceil(EV.t))+'s':'';
  b.innerHTML=(EV.kind==='rush'?'🔥 ساعة الذروة ×١٫٥ '+tt:EV.kind==='vip'?'⭐ زبون VIP مستني '+tt:EV.kind==='lost'?'📱 رجّع موبايل '+EV.name+' '+tt:'')+(streak>=2?'<span>سلسلة ×'+arNum(streak)+'</span>':'');}
const SEATS_TUK=3,RIDER_COLS=['#3ec6ff','#ff5fd2','#ffd23f'],SEAT_X=[-.33,.33,0];let riders=[],boarding=null;
function syncFare(){fare=riders[0]||null;riderMarks();riderList();gpsRoute=null;}
function freeSlot(){const used=riders.concat(boarding?[boarding]:[]).map(r=>r.slot);for(let i=0;i<SEATS_TUK;i++)if(!used.includes(i))return i;return -1;}
function freeCol(){const used=riders.map(r=>r.col);for(let i=0;i<RIDER_COLS.length;i++)if(!used.includes(i))return i;return 0;}
function seatAnchor(slot){let a=paxSeat.getObjectByName('slot'+slot);if(!a){a=new T.Group();a.name='slot'+slot;a.position.x=SEAT_X[slot];paxSeat.add(a);}return a;}
function startFare(w){const M=w.mission&&missionById(w.mission);if(!w.to)chooseDest(w);const to=w.to,r={len:w.len};
  const f={pax:Object.assign({name:w.name},w.type),from:w.poi,to:to,len:r.len,t:0,budget:M&&M.urgent?Math.round(r.len/9+8):Math.round(r.len/7.5+22),hits:0,fast:0,chat:rand(9,13),fastCd:0,phase:'board',wait:1.2,mission:w.mission||null,vip:!!w.vip,slot:freeSlot()};
  /* the rider walks from the pavement to the side of the vehicle, gets in, and pays straight away (see boardTick) */
  if(w.vip&&EV.kind==='vip'){endEvent();dailyEv('vip',1);}
  scene.remove(w.b);dropTag(w);waiting.splice(waiting.indexOf(w),1);f.walker={m:w.m,look:w.type.look,t:0};
  f.price=w.price;const d=POI[to].n;const intro=[['p',M?M.intro.replace('{d}',d):pick(INTRO_P).replace('{d}',d)],['d',pick(INTRO_D).replace('{t}',w.type.title)],['p',pick(PRICE_P)],['d',pick(PRICE_D).replace('{n}',arNum(f.price))]];
  if(riders.length)intro.push(['d',pick(ORDER_D).replace('{n}',arNum(riders.length+1))]);else if(Math.random()<.4)intro.push(['d',pick(INTRO_D2)]);
  dlgPush(intro,f.pax);f.area=areaOf(car.x,car.z);boarding=f;blip('ok');}
const ORDER_P=['يا اسطى أنا الأول! أنا اللي ركبت قبله','لا يا معلم، وصّلني أنا الأول، أنا راكب من بدري'];
const SHARE_L=['إنتوا رايحين فين؟ أنا نازل قبلكم','معلش يا جماعة زحمة شوية، التوكتوك ضيق','ربنا يسهّل لكل واحد مشواره'];
const ORDER_D=['هنوصّلك بعد اللي قبلك، إنت رقم {n}','إنت التالت في الدور… لا قصدي رقم {n}، معلش استحملني','اركب، هنوصل الأول اللي ركب قبلك وبعدين إنت'];
const PRICE_P=['هتاخد كام يا اسطى؟','الأجرة كام يا معلم؟','بكام المشوار ده يا اسطى؟'];
const PRICE_D=['{n} جنيه بس، عشان خاطرك','هات {n} جنيه وخلاص','{n} جنيه يا باشا، ده سعره'];
const PAY_GIVE=['اتفضل يا اسطى، معاك فكة؟','خد يا اسطى، رجّعلي الباقي','اتفضل، معلش مش معايا فكة'];
const PAY_OK=['تمام كده، تسلم إيدك','مظبوط، شكراً يا اسطى','كده تمام، ربنا يباركلك'];
const PAY_SHORT=['لا يا اسطى، كده ناقص','استنى، الباقي مش مظبوط، ناقص شوية','عدّها تاني يا اسطى، ناقصة'];
const PAY_OVER_HONEST=['لا يا اسطى، إنت ادّتني زيادة، خد دول','ده كتير يا اسطى، الأمانة بتقول خد الزيادة'];
const PAY_KEEP=['خلّي الباقي علشانك يا اسطى','الباقي حلاوة ليك'];
const NOTES=[[1,'coin'],[5,'#2f7fb5'],[10,'#d0533b'],[20,'#3f8f5a'],[50,'#8a5a3a'],[100,'#2f6f6f'],[200,'#6b6b2f']];
const NOTE_COL=Object.fromEntries(NOTES);
function arNum(n){return String(n).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);}
function noteEl(v,mini){const b=document.createElement('button');b.className='note'+(NOTE_COL[v]==='coin'?' coin':'')+(mini?' mini':'');if(NOTE_COL[v]!=='coin')b.style.background=NOTE_COL[v];b.innerHTML=arNum(v)+(NOTE_COL[v]==='coin'||mini?'':'<small>جنيه</small>');return b;}
const payS={tray:[]};
function payRender(){const tr=$('pTray');tr.querySelectorAll('.note').forEach(e=>e.remove());const sum=payS.tray.reduce((a,b)=>a+b,0);
  payS.tray.forEach((v,i)=>{const e=noteEl(v,true);e.title='رجّعها';e.onclick=()=>{payS.tray.splice(i,1);blip('ok');payRender();};tr.insertBefore(e,tr.lastElementChild);});$('pSum').textContent=arNum(sum);}
function startPay(f,done){f=f||fare;payS.f=f;payS.done=done||(lost=>finishFare(lost));f.phase='pay';input.up=input.down=0;
  const opts=[20,50,100,200].filter(n=>n>f.price);let given=Math.random()<.15?f.price:(Math.random()<.55?opts[0]:pick(opts.slice(0,3)));
  if(given===f.price&&f.price%5){given=opts[0];}
  const bills=given===f.price?[f.price]:[given];f.given=given;f.change=given-f.price;
  $('pFare').textContent=arNum(f.price);$('pName').textContent=f.pax.name;const g=$('pGiven');g.innerHTML='';bills.forEach(v=>{const e=noteEl(v,true);e.disabled=true;g.appendChild(e);});
  g.insertAdjacentHTML('beforeend',' <b>'+arNum(given)+' ج</b>');
  const nn=$('pNotes');if(!nn.childElementCount){NOTES.slice(0,6).forEach(([v])=>{const e=noteEl(v);e.onclick=()=>{if(payS.f&&payS.f.phase==='pay'){payS.tray.push(v);blip('ok');payRender();payAuto();}};nn.appendChild(e);});
    $('pClr').onclick=()=>{payS.tray=[];payRender();};$('pOk').onclick=payConfirm;}
  $('eGiven').textContent=arNum(given);$('eFare').textContent=arNum(f.price);$('eChange').textContent=f.change?'؟':arNum(0);
  payS.tray=[];payRender();
  if(f.change===0){$('pMsg').className='msg good';$('pMsg').textContent='الأجرة مظبوطة، مفيش باقي';dlgPush([['p','اتفضل يا اسطى، الأجرة مظبوطة']],f.pax);clearTimeout(payS.at);payS.at=setTimeout(()=>{if(payS.f===f&&f.phase==='pay')payConfirm();},1300);}
  else{$('pMsg').className='msg';$('pMsg').textContent='رجّعله '+'الباقي من الفكة';dlgPush([['p',pick(PAY_GIVE)]],f.pax);}
  $('pay').hidden=false;}
/* the change is handed over by itself as soon as what you picked covers it (no confirm button) */
function payAuto(){const f=payS.f;if(!f||f.phase!=='pay')return;const sum=payS.tray.reduce((a,b)=>a+b,0);if(sum>=f.change){clearTimeout(payS.at);payS.at=setTimeout(()=>{if(payS.f===f&&f.phase==='pay')payConfirm();},450);}
  else{$('pMsg').className='msg';$('pMsg').textContent='باقي '+arNum(f.change-sum)+' ج';}}
function payConfirm(){const f=payS.f;if(!f||f.phase!=='pay')return;const sum=payS.tray.reduce((a,b)=>a+b,0);const m=$('pMsg');
  if(sum<f.change){m.className='msg bad';m.textContent='ناقص '+arNum(f.change-sum)+' ج';dlgPush([['p',pick(PAY_SHORT)]],f.pax);blip('thud',2);f.short=(f.short||0)+1;return;}
  let lost=0;if(sum>f.change){if(Math.random()<.65){dlgPush([['p',pick(PAY_OVER_HONEST)]],f.pax);}else{lost=sum-f.change;}}
  else{dlgPush([['p',pick(PAY_OK)]],f.pax);if(f.change>0)f.exact=true;}
  $('pay').hidden=true;f.phase='paid';payS.done(lost);}
/* paid when getting in: the fare goes in the wallet now; the drop-off adds tip, mission bonus and reputation */
function paidAtBoard(f,lost){lost=lost||0;f.lost=lost;const got=f.price-lost;save.wallet+=got;save.total+=got;persist();updateMoney();blip('cash');
  toast('+'+got+' ج.م الأجرة من '+f.pax.name+(lost?'  • ضاع منك '+lost:''),lost?'bad':'good');
  f.phase='ride';f.col=freeCol();riders.push(f);boarding=null;dailyEv('earn',got);if(f.exact)dailyEv('exact',1);if(riders.length>=SEATS_TUK)dailyEv('full',1);
  const sp=paxSeat&&paxSeat.getObjectByName('slot'+f.slot);if(sp&&sp.children[0])PEOPLE.play(sp.children[0],'Sit',.3);syncFare();}
function finishFare(){const f=fare;if(!f)return;const lost=f.lost||0;let r=5-f.hits*.6-Math.min(2,f.fast)*.3-(f.short||0)*.4;const late=f.t>f.budget;if(late)r-=1.2;r=clamp(r,1,5);
  const bonus=late?0:Math.round((f.budget-f.t)*.2/5)*5;const tip=Math.min(15,(r>=4.5?5:0)+Math.max(0,bonus));const FM=f.mission&&missionById(f.mission);const mFail=!!(FM&&FM.urgent&&late);const mb=FM&&!mFail?FM.bonus:0;
  /* streak of clean rides, VIP tip */
  streak=f.hits?0:streak+1;const sb=Math.min(5,streak)*2;const vipb=f.vip&&!f.hits?20:0;const pay=tip+mb+sb+vipb;
  dailyEv('ride',1);if(!f.hits)dailyEv('clean',1);if(!late)dailyEv('ontime',1);if(FM&&!mFail)dailyEv('mission',1);const da=POI[f.to].area;if(da==='campus')dailyEv('tc',1);if(da==='wardian'||da==='qabbari')dailyEv('west',1);
  save.wallet+=pay;save.total+=pay;save.trips++;if(FM&&!mFail)save.missions=Object.assign({},save.missions,{[f.mission]:1});if(FM)missionCd=mFail?40:25;
  const lv0=repLevel((save.rep&&save.rep.xp)||0);const gx=rideXP({rating:r,short:f.short,lost,hits:f.hits,mission:!!FM,failed:mFail});save.rep={xp:((save.rep&&save.rep.xp)||0)+gx};const lv1=repLevel(save.rep.xp);
  if(lv1>lv0){const rw=LEVEL_REWARD(lv1);save.wallet+=rw;save.total+=rw;setTimeout(()=>toast('⭐ ترقية! بقيت «'+REP_LEVELS[lv1].n+'» — مكافأة '+rw+' ج.م'+(MISSIONS.some(m=>m.lvl===lv1)||MODS.some(m=>m.lvl===lv1)?' وفتحت حاجات جديدة':''),'good'),2600);}
  if(window.onRideDone)window.onRideDone(f,{rating:r,late,tip,mFail});
  persist();dlgPush((late?pick(END_LATE):pick(END_SEQ)).map(l=>[l[0],l[1].replace('{t}',f.pax.title)]),f.pax);blip('cash');
  toast((mFail?'المهمة فشلت، اتأخرت! تقدر تعيدها بعدين  • ':'')+'وصّلت '+f.pax.name+(pay?'  • +'+pay+' ج.م':'')+(mb?'  • مكافأة «'+FM.n+'» '+mb:'')+'  • +'+gx+' سمعة'+(tip?'  • بقشيش '+tip:'')+(sb?'  • سلسلة ×'+arNum(streak)+' +'+sb:'')+(vipb?'  • VIP +'+vipb:'')+(late?'  • متأخر':''),mFail?'bad':'good');
  if(!FM&&!f.vip&&Math.random()<.14)forgotItem(f);
  const sa=paxSeat.getObjectByName('slot'+f.slot);if(sa)sa.clear();alight(f);riders.shift();syncFare();updateMoney();}
function onImpact(s){blip('thud',s);if(riders.length){riders.forEach(r=>r.hits++);if(Dlg.q.length<2)dlgPush([['p',pick(HIT_L)]],pick(riders).pax);}}
let nearMsgT=0,stopHint=0;
/* boarding / getting out: the rider walks between the kerb and the vehicle's side door */
const _sp=new T.Vector3();
function doorPoint(fromX,fromZ){(boarding&&!isVan?seatAnchor(boarding.slot):paxSeat).getWorldPosition(_sp);const rx=Math.cos(car.h),rz=-Math.sin(car.h);const side=((fromX-_sp.x)*rx+(fromZ-_sp.z)*rz)>=0?1:-1;const o=isVan?1.35:.95;return [_sp.x+rx*side*o,_sp.z+rz*side*o];}
function stepWalk(m,tx,tz,sp,dt,t){const dx=tx-m.position.x,dz=tz-m.position.z,d=Math.hypot(dx,dz);if(d>.05){const s=Math.min(d,sp*dt);m.position.x+=dx/d*s;m.position.z+=dz/d*s;m.rotation.y=Math.atan2(dx,dz);PEOPLE.play(m,'Walk',.2);}
  else PEOPLE.play(m,'Idle',.3);return d;}
function boardTick(dt){const f=boarding,W=f.walker;W.t+=dt;const [tx,tz]=doorPoint(W.m.position.x,W.m.position.z);const moving=Math.abs(car.v)>2.5;
  const d=stepWalk(W.m,tx,tz,moving?3.4:1.7,dt,W.t);
  if(moving&&stopHint<=0){toast('استنى الزبون لما يركب');stopHint=3;}
  if(d<.3||W.t>7){scene.remove(W.m);f.walker=null;const a=seatAnchor(f.slot);a.clear();const sm=seated(W.look);a.add(sm);PEOPLE.play(sm,'Pay',.2,true);blip('ok');
    /* pays as soon as they sit down */
    setTimeout(()=>{if(boarding===f)startPay(f,lost=>paidAtBoard(f,lost));},350);f.phase='seated';}}
const leavers=[];
function alight(f){if(f&&f.walker){scene.remove(f.walker.m);f.walker=null;}if(!f||isVan)return;const lk=f.pax.look;if(!lk)return;seatAnchor(f.slot).getWorldPosition(_sp);const p=POI[f.to];const [dx,dz]=doorPoint(p.x+p.sx,p.z+p.sz);
  const m=person(lk,dx,dz,0);leavers.push({m:m,t:0,tx:p.x+p.sx*1.15,tz:p.z+p.sz*1.15});}
function leaversTick(dt){for(let i=leavers.length-1;i>=0;i--){const L=leavers[i];L.t+=dt;const d=stepWalk(L.m,L.tx,L.tz,1.5,dt,L.t);
  if(d<.15){L.m.position.y=0;L.m.rotation.z=0;}if(L.t>9){scene.remove(L.m);leavers.splice(i,1);}}}
function updateFares(dt){interactions(dt);if(!isVan)eventsTick(dt);spotMat.opacity=spotMatM.opacity=.7+.3*Math.sin(clock*3.2);if(isVan){updateLine(dt);return;}spawnMission(dt);for(let i=0;i<3&&waiting.length<MAXW;i++)spawnWaiting();
  for(const w of waiting){w.m.rotation.y=Math.atan2(-(car.x-w.m.position.x),-(car.z-w.m.position.z))+Math.PI;if(w.waveT>0){w.waveT-=dt;if(w.waveT<=0)PEOPLE.play(w.m,'Idle',.4);}
    if(w.tag){const d=Math.hypot(camera.position.x-w.m.position.x,camera.position.z-w.m.position.z);w.tag.visible=d<110;const k=clamp(d/20,1,2.4);w.tag.scale.set(3.9*k,1.28*k,1);w.tag.position.y=2.1+(Math.sin(clock*2+w.m.position.x)*.04);}}
  leaversTick(dt);
  if(boarding){boarding.t+=dt;if(boarding.phase==='board')boardTick(dt);}
  for(const r of riders)r.t+=dt;
  if(fare&&!boarding){const p=POI[fare.to],d=Math.min(Math.hypot(p.x-car.x,p.z-car.z),Math.hypot(p.x+p.sx-car.x,p.z+p.sz-car.z));
    if(d<PICK_R){if(Math.abs(car.v)<2.2){finishFare();return;}else if(stopHint<=0){toast('هدّي ووقّف عند العمود');stopHint=3;}}
    else if(stopHint<=0&&Math.abs(car.v)<1.2){const o=riders.slice(1).find(r=>{const q=POI[r.to];return Math.hypot(q.x-car.x,q.z-car.z)<PICK_R;});
      if(o){toast('لازم توصّل '+fare.pax.name+' الأول، ركب قبل '+o.pax.name);stopHint=4;if(!Dlg.cur&&!Dlg.q.length)dlgPush([['p',pick(ORDER_P)]],fare.pax);}}}
  if(riders.length){const rr=pick(riders);rr.chat-=dt*riders.length;if(rr.chat<=0&&!Dlg.cur&&!Dlg.q.length){const jam=Math.abs(car.v)<1.2&&rr.t>20;dlgPush([['p',jam&&Math.random()<.6?pick(JAM_L):radio.on&&Math.random()<.3?pick(RADIO_L):(riders.length>1&&Math.random()<.35?pick(SHARE_L):(Math.random()<.3?pick(IFEH_L):pick(rr.pax.ride)))]],rr.pax);rr.chat=rand(14,22);}
    fare.fastCd-=dt;if(Math.abs(car.v)*3.6>70&&fare.fastCd<=0){fare.fastCd=10;riders.forEach(r=>r.fast++);dlgPush([['p',pick(FAST_L)]],pick(riders).pax);}}
  if(!boarding&&riders.length<SEATS_TUK){for(const w of waiting){const p=POI[w.poi];const d=Math.min(Math.hypot(p.x-car.x,p.z-car.z),Math.hypot(p.x+p.sx-car.x,p.z+p.sz-car.z));if(d<PICK_R){if(Math.abs(car.v)<2.2){startFare(w);break;}else if(stopHint<=0){toast('هدّي ووقّف جنب الزبون');stopHint=3;}}else if(d<PICK_R+14&&stopHint<=0&&Math.abs(car.v)>2.2){toast('الزبون قدامك، هدّي');stopHint=4;}}}
  stopHint-=dt;
  /* fuel stations */
  let near=null;for(const s of STATIONS_F){if(Math.hypot(s.sx-car.x,s.sz-car.z)<8)near=s;}
  if(near&&Math.abs(car.v)<1&&fuel<99.5){if(save.wallet>0){const add=Math.min(dt*14,100-fuel,save.wallet);fuel+=add;save.wallet=Math.max(0,save.wallet-add);fuelCost+=add;if(fuelT<=0){toast('بنفوّل… ⛽');fuelT=2;}updateMoney();}else if(stopHint<=0){toast('مفيش فلوس للبنزين!','bad');stopHint=3;}}
  else if(fuelCost>0){toast('فوّلت بـ '+Math.round(fuelCost)+' ج.م');persist();fuelCost=0;}
  fuelT-=dt;
  if(fuel<=0&&Math.abs(car.v)<.5){dead+=dt;if(dead>2.5){dead=0;const s=nearestStation();veh.teleport(s.sx+6,s.sz,car.h);fuel=25;save.wallet=Math.max(0,save.wallet-80);persist();updateMoney();toast('البنزين خلص! الونش سحبك للبنزينة (٨٠ ج.م)','bad');snapCam=true;}}else dead=0;
  if(fuel<20&&fuel>0){lowFuelT-=dt;if(lowFuelT<=0){toast('البنزين قرّب يخلص!','bad');lowFuelT=15;}}}
let fuelCost=0,fuelT=0,lowFuelT=0;
function nearestStation(){let b=STATIONS_F[0],bd=1e9;for(const s of STATIONS_F){const d=Math.hypot(s.sx-car.x,s.sz-car.z);if(d<bd){bd=d;b=s;}}return b;}
let toastT=0;function toast(t,kind){const el=$('toast');el.textContent=t;el.className=kind||'';el.hidden=false;toastT=2.4;}
function updateMoney(){$('wallet').textContent=Math.round(save.wallet);$('total').textContent=Math.round(save.total);}

/* ============ HUD ============ */
const gps=$('gps'),gg=gps.getContext('2d');let gpsDpr=1;
function gpsSize(){const r=gps.getBoundingClientRect();gpsDpr=Math.min(2,devicePixelRatio||1);gps.width=Math.max(1,Math.round(r.width*gpsDpr));gps.height=Math.max(1,Math.round(r.height*gpsDpr));}
const ROADSEG=[];EDGES.forEach(e=>ROADSEG.push([e.a.x,e.a.z,e.b.x,e.b.z,e.kind==='ave'?22:10]));ROADSEG.push([-300,0,-290,0,22],[410,0,EX,0,22]);
let navTarget=null,hudT=0,lastSpd=-1;
function drawGPS(){const W=gps.width,H=gps.height;if(!W)return;const sc=W/2/95;gg.save();gg.clearRect(0,0,W,H);gg.beginPath();gg.arc(W/2,H/2,W/2,0,7);gg.clip();gg.fillStyle='#0f2433';gg.fillRect(0,0,W,H);
  gg.translate(W/2,H/2+W*.12);const fx=-Math.sin(car.h),fz=-Math.cos(car.h);gg.rotate(-Math.PI/2-Math.atan2(fz,fx));gg.scale(sc,sc);gg.translate(-car.x,-car.z);
  gg.fillStyle='#2b4f7a';gg.fillRect(-900,-900,1800,775);
  gg.lineCap='round';gg.strokeStyle='#5c7184';for(const r of ROADSEG){gg.lineWidth=r[4];gg.beginPath();gg.moveTo(r[0],r[1]);gg.lineTo(r[2],r[3]);gg.stroke();}
  gg.strokeStyle='#e7c23a';gg.lineWidth=4;gg.beginPath();gg.moveTo(-300,0);gg.lineTo(EX,0);gg.stroke();
  if(gpsRoute){gg.strokeStyle=fare?RIDER_COLS[fare.col]:'#ffb347';gg.lineWidth=5;gg.beginPath();gg.moveTo(car.x,car.z);for(let i=gpsIdx;i<gpsRoute.pts.length;i++)gg.lineTo(gpsRoute.pts[i][0],gpsRoute.pts[i][1]);gg.stroke();}
  for(const w of waiting){const p=POI[w.poi];gg.fillStyle='#ff4a4a';gg.beginPath();gg.arc(p.x,p.z,6,0,7);gg.fill();}
  for(const s of STATIONS_F){gg.fillStyle='#f2b705';gg.fillRect(s.sx-6,s.sz-6,12,12);}
  riders.slice().reverse().forEach((r,k)=>{const i=riders.length-1-k,p=POI[r.to];gg.fillStyle=RIDER_COLS[r.col];gg.strokeStyle='#0f2433';gg.lineWidth=2;gg.beginPath();gg.arc(p.x,p.z,i?7:9,0,7);gg.fill();gg.stroke();});
  gg.restore();gg.save();gg.translate(W/2,H/2+W*.12);gg.fillStyle='#ffffff';gg.strokeStyle='#0f2433';gg.lineWidth=2*gpsDpr;gg.beginPath();gg.moveTo(0,-9*gpsDpr);gg.lineTo(7*gpsDpr,7*gpsDpr);gg.lineTo(0,3*gpsDpr);gg.lineTo(-7*gpsDpr,7*gpsDpr);gg.closePath();gg.fill();gg.stroke();gg.restore();}
const HC={tb:-1,sf:-1,fu:-1,g:-9,_el:null,get el(){return this._el||(this._el={turbo:$('turboBar'),fx:$('speedfx'),fuel:$('fuelBar'),gear:$('revTag')});}};
function updateHUD(dt){const sp=Math.round(Math.abs(car.v)*3.6);if(sp!==lastSpd){$('speed').textContent=sp;lastSpd=sp;}
  /* write to the DOM only when the shown value changes (no per-frame style churn) */
  {const tb=Math.round(turbo*100);if(tb!==HC.tb){HC.tb=tb;HC.el.turbo.style.width=tb+'%';}
   const sf=car.boost?Math.round(Math.min(1,Math.abs(car.v)/14)*20)/20:0;if(sf!==HC.sf){HC.sf=sf;HC.el.fx.style.opacity=sf;}
   const fu=Math.round(fuel);if(fu!==HC.fu){HC.fu=fu;HC.el.fuel.style.width=fu+'%';}
   const g=car.gear;if(g!==HC.g){HC.g=g;HC.el.gear.hidden=false;HC.el.gear.textContent=g===0?'رجوع':'غيار '+'٠١٢٣٤٥'[g];}}
  flame.visible=!!car.boost;if(car.boost){const f=.5+Math.random()*.5;flame.scale.set(f,f,1);}
  const bp=$('brakePad');const rev=Math.abs(car.v)<.6;if(bp.classList.contains('revmode')!==rev){bp.classList.toggle('revmode',rev);bp.textContent=rev?'رجوع':'فرامل';}
  if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').hidden=true;}
  /* navigation target */
  let tx=null,tz=null,name='',showTime=false;
  if(isVan&&line&&fuel>=15){const p=POI[line.stops[line.idx]];tx=p.x;tz=p.z;name='المحطة الجاية: '+p.n;}
  else if(!fare&&EV.kind==='lost'){const p=POI[EV.poi];tx=p.x;tz=p.z;name='📱 رجّع الموبايل: '+p.n;}
  else if(fare){const p=POI[fare.to];tx=p.x;tz=p.z;name=(riders.length>1?'١ ← ':'')+p.n+' ('+fare.pax.name+')';showTime=true;}
  else if(!fare&&fuel<25){const s=nearestStation();tx=s.sx;tz=s.sz;name='أقرب بنزينة';}
  else if(!fare&&waiting.length){let b=waiting.find(w=>w.mission)||null,bd=b?-1:1e9;for(const w of waiting){if(bd<0)break;const p=POI[w.poi],d=Math.hypot(p.x-car.x,p.z-car.z);if(d<bd){bd=d;b=w;}}if(b){const p=POI[b.poi];tx=p.x;tz=p.z;name=(b.mission?'مهمة «'+missionById(b.mission).n+'»: '+b.name+' عند ':'زبون عند ')+p.n;}}
  const nav=$('nav');
  if(tx!==null){if(navTarget!==name){navTarget=name;gpsRoute=null;}const g=gpsUpdate(dt,tx,tz);const dx=g.nx-car.x,dz=g.nz-car.z;
    updateChev(tx);
    hudT-=dt;if(hudT<=0){hudT=.2;nav.hidden=false;$('navName').textContent=name;$('navDist').textContent=(g.rem/1000).toFixed(1)+' كم'+(fare&&fare.mission&&(missionById(fare.mission)||{}).urgent&&fare.phase==='ride'?' · ⏱ '+Math.max(0,Math.round(fare.budget-fare.t))+' ث':'');
      const nt=$('navTime');if(showTime){const left=fare.budget-fare.t;nt.hidden=false;nt.textContent=Math.max(0,Math.round(left))+'s';nt.classList.toggle('late',left<0);}else nt.hidden=true;
      const rel=Math.atan2(-dx,-dz)-car.h;$('navArrow').style.transform='rotate('+(-rel*180/Math.PI)+'deg)';drawGPS();}}
  else{updateChev(null);nav.hidden=true;gpsRoute=null;hudT-=dt;if(hudT<=0){hudT=.2;drawGPS();}}}

/* ============ world animation ============ */
let clock=0;
function animWorld(dt){clock+=dt;water.material.map.offset.x=clock*.004;water.material.map.offset.y=clock*.0025;
  for(const f of flags){const p=f.geo.attributes.position.array,b=f.base;for(let i=0;i<p.length;i+=3){p[i+2]=Math.sin(b[i]*1.9-clock*5.2+f.ph+b[i+1]*.6)*.16*(b[i]/3);}f.geo.attributes.position.needsUpdate=true;}
  for(const b of bobbers){b.m.position.y=Math.sin(clock*.9+b.ph)*.18;b.m.rotation.z=Math.sin(clock*.7+b.ph)*.03;}
  for(const t of trolleys){const k=.5+.5*Math.sin(clock*t.sp*Math.PI+t.ph);if(t.axis==='x')t.g.position.x=t.a+(t.b-t.a)*k;else t.g.position.z=t.a+(t.b-t.a)*k;}
  for(const g of gulls){const a=clock*g.sp+g.ph;g.g.position.set(g.cx+Math.cos(a)*g.rad,g.y+Math.sin(a*2)*1.2,g.cz+Math.sin(a)*g.rad);g.g.rotation.y=-a+(g.sp>0?Math.PI:0);const fl=Math.sin(clock*9+g.ph)*.5;g.l.rotation.z=fl;g.r.rotation.z=-fl;}
  for(const l of tlights){const red=((clock+l.ph)%16)<8;l.r.material.color.set(red?'#ff3b2a':'#3a1410');l.g.material.color.set(red?'#123a1a':'#38ff6a');}
  for(const S2 of emitters){const on=Math.sin(clock*.9+S2.ph)>-.2&&Math.sin(clock*13+S2.ph)>-.6;S2.w.intensity=on?1.2+Math.random()*1.6:0;
    for(let i=0;i<S2.N;i++){S2.life[i]-=dt;const j=i*3;if(S2.life[i]<=0){if(on&&Math.random()<.5){S2.pos[j]=S2.o[0];S2.pos[j+1]=S2.o[1];S2.pos[j+2]=S2.o[2];S2.vel[j]=S2.dx?rand(.4,2.6)*S2.dx:rand(-1.6,1.6);S2.vel[j+1]=rand(.5,3.2);S2.vel[j+2]=rand(-1.6,1.6);S2.life[i]=rand(.3,.8);}else{S2.pos[j+1]=-50;S2.life[i]=.05;}continue;}
      S2.vel[j+1]-=9.8*dt;S2.pos[j]+=S2.vel[j]*dt;S2.pos[j+1]+=S2.vel[j+1]*dt;S2.pos[j+2]+=S2.vel[j+2]*dt;if(S2.pos[j+1]<.03){S2.pos[j+1]=.03;S2.vel[j+1]*=-.3;}}S2.pts.geometry.attributes.position.needsUpdate=true;}
  for(const b of boats){const a=clock*b.sp+b.ph;b.g.position.set(b.cx+Math.cos(a)*b.r,0,b.cz+Math.sin(a)*b.r);b.g.rotation.y=-a+(b.sp>0?-Math.PI/2:Math.PI/2);b.g.rotation.z=Math.sin(clock*1.3+b.ph)*.03;}
  const pulse=1+Math.sin(clock*4)*.06;if(destRing)destRing.scale.set(pulse,pulse,pulse);RMK.forEach(m=>{if(m.r.visible)m.r.scale.set(pulse,pulse,pulse);});beamMat.opacity=.18+Math.sin(clock*3)*.05;}
function placeSun(){const fx=state==='play'?car.x:-120,fz=state==='play'?car.z:-30;sun.position.set(fx-110,55,fz+45);sun.target.position.set(fx,0,fz);sun.target.updateMatrixWorld();
  sky.position.copy(camera.position);const ss=sky.userData.sun;ss.position.copy(camera.position).addScaledVector(ss.userData.dir,900);}

/* ============ input ============ */
const KEY={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',ShiftLeft:'turbo',ShiftRight:'turbo',Space:'drift',KeyH:'horn'};
const steerKeys={left:0,right:0};
addEventListener('keydown',e=>{if(state==='play'){const k=KEY[e.code];if(k){input[k]=1;e.preventDefault();return;}
    if(e.code==='KeyA'||e.code==='ArrowLeft'){steerKeys.left=1;input.steerKey=steerKeys.left-steerKeys.right;e.preventDefault();return;}
    if(e.code==='KeyD'||e.code==='ArrowRight'){steerKeys.right=1;input.steerKey=steerKeys.left-steerKeys.right;e.preventDefault();return;}
    if(e.code==='KeyC')cycleCam();else if(e.code==='KeyR'&&!e.repeat)toggleRadio();else if(e.code==='KeyN'){if(!radio.on)radioPower(true);tuneTo((radio.idx+1)%RST.length);}else if(e.code==='Escape'||e.code==='KeyP')pauseGame();else if(e.code==='KeyM')setMute(!A.muted);}
  else if(state==='pause'&&(e.code==='Escape'||e.code==='KeyP'))resumeGame();else if(state==='menu'&&e.code==='Enter')startGame();});
addEventListener('keyup',e=>{const k=KEY[e.code];if(k)input[k]=0;if(e.code==='KeyA'||e.code==='ArrowLeft')steerKeys.left=0;if(e.code==='KeyD'||e.code==='ArrowRight')steerKeys.right=0;input.steerKey=steerKeys.left-steerKeys.right;});
addEventListener('blur',releaseAll);
['pointerdown','touchend','keydown'].forEach(ev=>addEventListener(ev,()=>{if(A.ctx&&A.ctx.state!=='running'&&state==='play')A.ctx.resume().catch(()=>{});},{passive:true}));
setInterval(()=>{if(state==='play'&&A.ctx&&A.ctx.state!=='running'&&radio.on){toast('المس الشاشة مرة عشان الصوت يشتغل');}},6000);
['arrL','arrR'].forEach(id=>{const b=$(id),k=id==='arrL'?'left':'right';const on=e=>{e.preventDefault();steerKeys[k]=1;input.steerKey=steerKeys.left-steerKeys.right;b.classList.add('on');try{b.setPointerCapture(e.pointerId);}catch(_){}};
  const off=()=>{steerKeys[k]=0;input.steerKey=steerKeys.left-steerKeys.right;b.classList.remove('on');};b.addEventListener('pointerdown',on);['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,off));b.addEventListener('contextmenu',e=>e.preventDefault());});
function releaseAll(){for(const k in input)input[k]=0;steerKeys.left=steerKeys.right=0;document.querySelectorAll('.pad.on').forEach(b=>b.classList.remove('on'));wheelAng=0;$('knob').style.transform='';}
document.querySelectorAll('[data-in]').forEach(b=>{const k=b.dataset.in;const on=e=>{e.preventDefault();input[k]=1;b.classList.add('on');if(navigator.vibrate)try{navigator.vibrate(k==='down'?14:8);}catch(_){}try{b.setPointerCapture(e.pointerId);}catch(_){}};const off=()=>{input[k]=0;b.classList.remove('on');};
  b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);b.addEventListener('contextmenu',e=>e.preventDefault());});
const joy=$('joy'),knob=$('knob');let joyId=null,wheelAng=0,lastA=0;const WMAX=120;
/* Steering wheel: the finger's angle around the wheel centre is tracked frame to frame,
   so the wheel turns exactly as much as the finger does (no jumps past 180°). Near the hub the angle is
   unreliable, so movement there is ignored. */
function ptrInfo(e){const r=joy.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);return {a:Math.atan2(dx,-dy)*180/Math.PI,d:Math.hypot(dx,dy)/(r.width/2)};}
function setWheel(a){wheelAng=clamp(a,-WMAX,WMAX);input.joy=Math.abs(wheelAng)<2?0:-wheelAng/WMAX;input.wheel=1;knob.style.transform='rotate('+wheelAng.toFixed(1)+'deg)';}
function joyMove(e){const p=ptrInfo(e);if(p.d<.22){lastA=p.a;return;}let d=p.a-lastA;if(d>180)d-=360;if(d<-180)d+=360;lastA=p.a;setWheel(wheelAng+d);}
joy.addEventListener('pointerdown',e=>{e.preventDefault();if(joyId!==null)return;joyId=e.pointerId;joy.classList.add('held');try{joy.setPointerCapture(e.pointerId);}catch(_){}lastA=ptrInfo(e).a;});
joy.addEventListener('pointermove',e=>{if(e.pointerId!==joyId)return;e.preventDefault();const ev=e.getCoalescedEvents?e.getCoalescedEvents():[];if(ev.length)ev.forEach(joyMove);else joyMove(e);});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joy.addEventListener(ev,e=>{if(e.pointerId!==joyId)return;joyId=null;joy.classList.remove('held');}));
function wheelReturn(dt){if(joyId===null&&wheelAng!==0){const k=Math.min(1,dt*7);const a=Math.abs(wheelAng)<1.5?0:wheelAng*(1-k);setWheel(a);if(!a)input.wheel=0;}}
const hb=$('bHorn');hb.addEventListener('pointerdown',e=>{e.preventDefault();input.horn=1;try{hb.setPointerCapture(e.pointerId);}catch(_){}});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>hb.addEventListener(ev,()=>{input.horn=0;}));
$('bCam').addEventListener('click',cycleCam);$('bRadio').addEventListener('click',toggleRadio);$('bPause').addEventListener('click',pauseGame);$('bMute').addEventListener('click',()=>{initAudio();setMute(!A.muted);});
function toggleRadio(){const r=$('radio');r.hidden=!r.hidden;$('bRadio').classList.toggle('on',!r.hidden);if(!r.hidden&&!radio.on)radioPower(true);}
function cycleCam(){camMode=(camMode+1)%3;snapCam=true;toast('الكاميرا: '+CAMS[camMode]);}
canvas.addEventListener('pointerdown',e=>{dragging=true;dragX=e.clientX;try{canvas.setPointerCapture(e.pointerId);}catch(_){}});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-dragX;dragX=e.clientX;if(state==='play')camYaw=clamp(camYaw-dx*.006,-2.6,2.6);else if(GAR.open){GAR.yaw-=dx*.009;GAR.spin=0;}});
['pointerup','pointercancel'].forEach(ev=>canvas.addEventListener(ev,()=>{dragging=false;}));canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pauseGame();});

/* ============ menus / state ============ */
let state='loading';
function menuWallet(){$('menuWallet').textContent=Math.round(save.wallet)+' ج.م · '+save.trips+' مشوار · ⭐ '+repProgress((save.rep&&save.rep.xp)||0).name;const st=$('btnStartLbl');if(st)st.textContent=save.trips>0?'كمّل الوردية':'ابدأ الوردية';}
function startGame(){closeGarageView();$('garage').hidden=true;initAudio();if(A.ctx){if(A.ctx.state==='suspended')A.ctx.resume();try{const b=A.ctx.createBuffer(1,1,22050),src=A.ctx.createBufferSource();src.buffer=b;src.connect(A.ctx.destination);src.start(0);}catch(e){}}
  if(Speech.ok){try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u);}catch(e){}}pickVoices();$('menu').hidden=true;$('hud').hidden=false;state='play';snapCam=true;gpsSize();updateMoney();
  if(!startGame.done){startGame.done=true;radioPower(true);toast(isVan?'روح المحطة اللي عليها العمود المنوّر، الركاب مستنيينك':'دوّر على الزباين… العمود المنوّر',"good");}else radioUI();canvas.focus({preventScroll:true});}
function pauseGame(){if(state!=='play')return;state='pause';if(liveEl)liveEl.pause();releaseAll();$('pause').hidden=false;if(A.ctx)A.ctx.suspend();if(Speech.ok)try{speechSynthesis.pause();}catch(e){}persist();}
function resumeGame(){$('pause').hidden=true;state='play';if(liveEl&&radio.live)liveEl.play().catch(()=>{});if(A.ctx)A.ctx.resume();if(Speech.ok)try{speechSynthesis.resume();}catch(e){}canvas.focus({preventScroll:true});}
$('pResume').addEventListener('click',resumeGame);$('pReset').addEventListener('click',()=>{resetToRoad();resumeGame();toast('رجعناك للطريق');});
$('pMenu').addEventListener('click',()=>{if(liveEl)liveEl.pause();$('pause').hidden=true;$('hud').hidden=true;$('menu').hidden=false;state='menu';dlgClear();menuWallet();$('btnStart').textContent='كمّل الوردية';});
$('btnStart').addEventListener('click',startGame);
function ctlUI(){document.body.classList.toggle('ctl-arrows',ctl.mode==='arrows');$('btnCtl').textContent='التحكم: '+({tilt:'إمالة الموبايل',arrows:'الأسهم'}[ctl.mode]||'الدركسيون');$('btnSens').textContent='الدركسيون: '+({0.7:'تقيل',1:'عادي',1.35:'خفيف'}[ctl.sens]||'عادي');}
async function setCtl(m){if(m==='tilt'){try{if(window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission){const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted'){toast('الموبايل رفض الإمالة');return;}}}catch(e){}}ctl.mode=m;saveCtl();ctlUI();}
$('btnCtl').addEventListener('click',()=>setCtl(ctl.mode==='touch'?'arrows':(ctl.mode==='arrows'?'tilt':'touch')));
$('btnSens').addEventListener('click',()=>{ctl.sens=ctl.sens===1?1.35:(ctl.sens===1.35?0.7:1);saveCtl();ctlUI();});
ctlUI();
$('btnVoiceTest').addEventListener('click',()=>{const n=$('voiceNote');n.hidden=false;if(Speech.mode!=='browser'){initAudio();if(A.ctx&&A.ctx.state!=='running')A.ctx.resume();const ln=pick(INTRO_P).replace('{d}','مركز التدريب');VO.speak(ln,{pitch:1});n.textContent=VO.find(ln)&&VO.mine.has(VO.find(ln).key)?'ده صوتك المتسجّل 🎙️':'دي أصوات اللعبة المرحة. سجّل أصوات مصرية حقيقية من «استوديو الأصوات».';return;}pickVoices();
  if(!Speech.ok){n.textContent='المتصفح ده مفيهوش خاصية النطق. افتح اللعبة في Chrome.';return;}
  if(!Speech.voice){say('أهلاً يا اسطى، الوردية بدأت',{});n.textContent='لو مسمعتش الجملة: مفيش صوت عربي متسطّب. على أندرويد: الإعدادات ← تحويل النص إلى كلام ← محرك Google ← تثبيت بيانات الصوت ← العربية. وعلى الكمبيوتر استخدم Edge.';return;}
  const ok=say('أهلاً يا اسطى، الوردية بدأت. على مركز التدريب لو سمحت',{pitch:1,rate:1,onend:()=>{}});n.textContent=ok?'لو سمعت الجملة يبقى صوت الحوار شغال: '+Speech.voice.name:'الصوت مقفول من الإعداد.';});
$('btnQuality').addEventListener('click',()=>{setQuality(quality==='low'?'med':(quality==='med'?'high':'low'));});
const VMODES={game:'أصوات اللعبة',browser:'صوت المتصفح',off:'مقفول'};function voiceUI(){$('btnVoice').textContent='صوت الحوار: '+VMODES[Speech.mode];}
$('btnVoice').addEventListener('click',()=>{Speech.mode=Speech.mode==='game'?'off':'game';Speech.enabled=Speech.mode!=='off';try{ls.set('aps_voice',Speech.mode);}catch(_){}VO.stop();if(Speech.ok)try{speechSynthesis.cancel();}catch(_){}voiceUI();});voiceUI();
function renderGarage(){vehUI();$('garWallet').textContent='محفظتك: '+Math.round(save.wallet)+' ج.م';const box=$('paints');box.innerHTML='';
  PAINTS.forEach(p=>{const owned=save.owned.includes(p.id);const b=document.createElement('button');b.className='paint'+(save.paint===p.id?' sel':'')+(owned?'':' locked');
    b.innerHTML='<i style="background:'+p.c+'"></i><span>'+p.n+'<small>'+(owned?(save.paint===p.id?'متركّب':'اضغط للتركيب'):p.p+' ج.م')+'</small></span>';
    b.addEventListener('click',()=>{if(!owned){if(save.wallet<p.p){$('garWallet').textContent='محتاج '+Math.round(p.p-save.wallet)+' ج.م كمان';return;}save.wallet-=p.p;save.owned.push(p.id);}save.paint=p.id;setPaint(p.id);persist();renderGarage();menuWallet();});box.appendChild(b);});
  renderMods();
  const sb=$('slogans');sb.innerHTML='';SLOGANS.forEach(t=>{const b=document.createElement('button');b.className='paint'+(save.slogan===t?' sel':'');b.style.justifyContent='center';b.textContent=t;b.addEventListener('click',()=>{save.slogan=t;setSlogan(t);persist();renderGarage();});sb.appendChild(b);});}
/* --- garage workshop set (Phase 2 E): one closed room built on first open, world hidden while inside (fewer draw calls, not more) --- */
const GAR={open:false,room:null,yaw:.6,hidden:[]};
function garTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;t.wrapS=T.RepeatWrapping;t.repeat.x=-1;return t;}
function garWall(sign){return garTex(1024,512,(g,w,h)=>{
  let gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#3a2c22');gr.addColorStop(.55,'#8a6a4a');gr.addColorStop(1,'#5b4636');g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let i=0;i<900;i++){g.fillStyle='rgba('+(Math.random()<.5?'0,0,0':'255,230,190')+','+(Math.random()*.05)+')';g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*6,2+Math.random()*6);}
  g.fillStyle='#2f5f6b';g.fillRect(0,h*.7,w,h*.3);for(let x=0;x<w;x+=48)for(let y=h*.7;y<h;y+=32){g.strokeStyle='rgba(0,0,0,.25)';g.strokeRect(x+((y/32)%2)*24,y,48,32);}
  g.fillStyle='#1d1b1a';g.fillRect(0,h*.68,w,8);
  const lg=g.createRadialGradient(w/2,0,10,w/2,0,w*.55);lg.addColorStop(0,'rgba(255,196,110,.55)');lg.addColorStop(1,'rgba(255,196,110,0)');g.fillStyle=lg;g.fillRect(0,0,w,h);
  if(sign){g.save();g.translate(w/2,h*.26);g.fillStyle='#F5B928';g.strokeStyle='#101B2D';g.lineWidth=10;g.beginPath();g.roundRect?g.roundRect(-330,-62,660,124,18):g.rect(-330,-62,660,124);g.fill();g.stroke();
    g.fillStyle='#101B2D';g.font='76px Lalezar, sans-serif';g.textAlign='center';g.textBaseline='middle';g.direction='rtl';g.fillText('ورشة المينا للتكاتك',0,6);g.restore();}
  else{g.fillStyle='#4a3a2c';g.fillRect(w*.1,h*.2,w*.34,h*.36);g.strokeStyle='#C87938';g.lineWidth=6;g.strokeRect(w*.1,h*.2,w*.34,h*.36);
    g.strokeStyle='#cfd6de';g.lineWidth=7;g.lineCap='round';for(let i=0;i<7;i++){const x=w*.13+i*w*.045;g.beginPath();g.moveTo(x,h*.25);g.lineTo(x,h*.25+40+(i%3)*22);g.stroke();}
    for(let i=0;i<3;i++){g.fillStyle='#151515';g.beginPath();g.arc(w*.68+i*70,h*.62,46,0,7);g.fill();g.fillStyle='#3a3a3a';g.beginPath();g.arc(w*.68+i*70,h*.62,20,0,7);g.fill();}}
});}
function buildGarageRoom(){const W=14,H=5.2,floor=garTex(1024,1024,(g,w,h)=>{g.fillStyle='#8d8a84';g.fillRect(0,0,w,h);
    for(let i=0;i<5000;i++){const v=Math.random()*40|0;g.fillStyle='rgba('+(110+v)+','+(106+v)+','+(100+v)+',.35)';g.fillRect(Math.random()*w,Math.random()*h,3,3);}
    g.strokeStyle='rgba(40,38,36,.35)';g.lineWidth=3;for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*w/4,0);g.lineTo(i*w/4,h);g.stroke();g.beginPath();g.moveTo(0,i*h/4);g.lineTo(w,i*h/4);g.stroke();}
    for(let i=0;i<6;i++){g.fillStyle='rgba(20,18,16,'+(.15+Math.random()*.2)+')';g.beginPath();g.ellipse(Math.random()*w,Math.random()*h,30+Math.random()*60,20+Math.random()*40,Math.random()*3,0,7);g.fill();}
    const sh=g.createRadialGradient(w/2,h/2,10,w/2,h/2,190);sh.addColorStop(0,'rgba(0,0,0,.55)');sh.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=sh;g.fillRect(0,0,w,h);
    const lg=g.createRadialGradient(w/2,h/2,40,w/2,h/2,w*.7);lg.addColorStop(0,'rgba(255,190,110,.18)');lg.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=lg;g.fillRect(0,0,w,h);});
  const ceil=garTex(256,256,(g,w,h)=>{g.fillStyle='#231d19';g.fillRect(0,0,w,h);g.fillStyle='#ffe2a8';g.fillRect(w*.3,h*.46,w*.4,h*.08);});
  const wa=garWall(true),wb=garWall(false);const M=t=>new T.MeshBasicMaterial({map:t,side:T.BackSide,fog:false});
  /* BoxGeometry face order: +x,-x,+y,-y,+z,-z */
  const room=new T.Mesh(new T.BoxGeometry(W,H,W),[M(wb),M(wa),M(ceil),M(floor),M(wb),M(wa)]);room.name='garageRoom';room.renderOrder=-1;return room;}
function openGarageView(){if(!car)return;if(!GAR.room){GAR.room=buildGarageRoom();}
  GAR.hidden.length=0;for(const o of scene.children){if(o===tuk||o.isLight||o===GAR.room||!o.visible)continue;o.visible=false;GAR.hidden.push(o);}
  GAR.room.position.set(car.x,2.6+.01,car.z);if(!GAR.room.parent)scene.add(GAR.room);GAR.room.visible=true;GAR.open=true;document.body.classList.add('in-garage');}
function closeGarageView(){if(!GAR.open)return;GAR.open=false;for(const o of GAR.hidden)o.visible=true;GAR.hidden.length=0;if(GAR.room)GAR.room.visible=false;document.body.classList.remove('in-garage');}
$('btnGarage').addEventListener('click',()=>{renderGarage();$('garage').hidden=false;openGarageView();});$('garClose').addEventListener('click',()=>{$('garage').hidden=true;for(const k in MODP)MODP[k]=null;applyMods();closeGarageView();});
addEventListener('resize',()=>{if(state==='play')gpsSize();});

/* ============ loop ============ */
let last=performance.now(),mA=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000||0);last=now;
  PEOPLE.update(dt,camera.position,peopleFrame++);
  if(state==='play'){animWorld(dt);updateTraffic(dt);updateCar(dt);updateWalkers(dt);syncTuk();updateFares(dt);dlgUpdate(dt);radioUpdate(dt);updateHUD(dt);updateCam(dt);audioTick();}
  else if(state==='intro'){animWorld(dt);updateTraffic(dt);updateWalkers(dt);cineTick(dt);}
  else if(state==='menu'||state==='loading'){animWorld(dt);updateTraffic(dt);updateWalkers(dt);syncTuk();mA+=dt*.04;
    if(car&&state==='menu'&&GAR.open){if(!dragging)GAR.yaw+=dt*.18;const port=innerWidth<innerHeight,r=port?6.4:4.8,k=port?0:-1.25,sy=Math.sin(GAR.yaw),cy=Math.cos(GAR.yaw);camera.position.set(car.x+sy*r,port?2.6:1.85,car.z+cy*r);camera.lookAt(car.x+cy*k,port?-.55:.9,car.z-sy*k);}
    else if(car&&state==='menu'){const a=Math.sin(mA*2.2)*.55,port=innerWidth<innerHeight?0:-2.2;camera.position.set(car.x+Math.sin(a)*7.2+port,2.3+Math.sin(mA*1.3)*.25,car.z+Math.cos(a)*7.2);camera.lookAt(car.x+port*.6,1.35,car.z-3.5);}
    else{camera.position.set(-140+Math.cos(mA)*70,22+Math.sin(mA*.7)*5,10+Math.sin(mA)*45);camera.lookAt(-120,4,-20);}}
  placeSun();renderer.render(scene,camera);if(perf)perf.tick(now);}


const VEHS=[{id:'tuk',n:'توكتوك',d:'راكب واحد، توصيل لحد الباب'},{id:'van',n:'سوزوكي ٧ راكب',d:'مشروع بمحطات، لحد ٦ ركاب'}];
function vehUI(){const v=VEHS.find(x=>x.id===save.vehicle)||VEHS[0];$('btnVeh').textContent='العربية: '+v.n;const box=$('vehicles');if(!box)return;box.innerHTML='';
  VEHS.forEach(x=>{const b=document.createElement('button');b.className='paint'+(x.id===save.vehicle?' on':'');b.innerHTML='<b>'+x.n+'</b><small>'+x.d+'</small>';b.addEventListener('click',()=>setVehicle(x.id));box.appendChild(b);});}
function setVehicle(id){if(id===save.vehicle)return;save.vehicle=id;persist();toast('بنجهّز '+(VEHS.find(x=>x.id===id).n)+'…');setTimeout(()=>location.reload(),400);}
$('btnVeh').addEventListener('click',()=>setVehicle(save.vehicle==='van'?'tuk':'van'));vehUI();

/* ============ beta channel ============ */
if(IS_BETA){$('betaSec').hidden=false;$('betaTag').hidden=false;document.title='BETA · '+document.title;}
function saveNote(){const n=$('saveNote');if(!n)return;n.textContent='حالة الحفظ: '+({new:'جديد',current:'سليم',migrated:'اتحدّث للإصدار ١ واتعمل نسخة احتياطية','migrated-unsaved':'شغال من الذاكرة، الأصل ما اتلمسش',corrupt:'الحفظ القديم مش مقروء ومحفوظ زي ما هو',future:'من نسخة أحدث، مش هيتعدل'}[SAVE_LOAD.status]||SAVE_LOAD.status)+(saveWritable?'':' (الحفظ متوقف في الجلسة دي)');}
saveNote();
$('btnImportMain').addEventListener('click',()=>{if(!confirm('هتتجاب نسخة من حفظ النسخة الأساسية للنسخة التجريبية. الحفظ الأساسي مش هيتغير. نكمل؟'))return;const r=importMainSave();if(!r.ok){toast(r.why,'bad');return;}toast('اتستورد الحفظ، بنعيد التحميل…','good');setTimeout(()=>location.reload(),900);});

/* ============ menu extras: progress, radio from the menu ============ */
/* ---- missions list (real state from the save) ---- */
function openMissions(){const box=$('msList');box.innerHTML='';const rp=repProgress((save.rep&&save.rep.xp)||0);
  {const D=daily();const h=document.createElement('div');h.className='msday';h.innerHTML='<h3>🎯 أهداف النهارده <small>بتتجدد كل يوم</small></h3>';
   D.g.forEach(q=>{const G=DAILY_POOL.find(x=>x.id===q.id);if(!G)return;const r=document.createElement('div');r.className='dg'+(q.done?' done':'');
     r.innerHTML='<b></b><span class="pill"></span><i><em style="width:'+Math.round(q.p/G.goal*100)+'%"></em></i>';r.querySelector('b').textContent=G.n;r.querySelector('.pill').textContent=q.done?'خلص ✓':(arNum(q.p)+' من '+arNum(G.goal)+' · '+arNum(G.rw)+' ج');h.appendChild(r);});
   box.appendChild(h);}
  MISSIONS.forEach(m=>{const st=missionState(m);const el=document.createElement('div');el.className='msn st-'+st;
    el.innerHTML='<div class="mst"><b></b><span class="pill"></span></div><p></p><small></small>';el.querySelector('b').textContent=m.n;
    el.querySelector('.pill').textContent={done:'خلصت ✓',open:'متاحة',locked:'تتفتح في «'+(REP_LEVELS[m.lvl]||{}).n+'»',soon:'قريبًا'}[st];
    el.querySelector('p').textContent=m.d;el.querySelector('small').textContent=m.soon?'':('المكافأة: الأجرة + '+arNum(m.bonus)+' ج.م + سمعة'+(m.urgent?' · بوقت محدد':'')+(isVan&&st==='open'?' · محتاج التوكتوك':''));box.appendChild(el);});
  $('missions').hidden=false;}
/* ---- full map (drawn on demand, no per-frame cost) ---- */
/* ---- full map: fits the world, pinch/drag to zoom and pan, labels never overlap (more appear as you zoom in) ---- */
const MV={x:-80,z:55,s:0,init:false,ptrs:new Map(),d0:0,s0:0};
const MAP_W={x0:-470,x1:EX+10,z0:-140,z1:250};
function mapFit(){const cv=$('mapCv'),r=cv.getBoundingClientRect();const s=Math.min(r.width/(MAP_W.x1-MAP_W.x0),r.height/(MAP_W.z1-MAP_W.z0));MV.s=s*(r.width<r.height?1.05:1);MV.x=(MAP_W.x0+MAP_W.x1)/2;MV.z=(MAP_W.z0+MAP_W.z1)/2;}
function openMap(){$('mapView').hidden=false;requestAnimationFrame(()=>{if(!MV.init){mapFit();MV.init=true;if(car){const port=innerWidth<innerHeight;MV.x=port?car.x:clamp(car.x,-250,150);MV.z=car.z;MV.s*=port?2.6:1.5;}}drawMap();});}
function drawMap(){const cv=$('mapCv'),r=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);const W=Math.round(r.width*dpr),H=Math.round(r.height*dpr);if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}const g=cv.getContext('2d');
  const sc=MV.s*dpr,P=(x,z)=>[W/2+(x-MV.x)*sc,H/2+(z-MV.z)*sc];
  g.fillStyle='#14304d';g.fillRect(0,0,W,H);
  const zone=(x0,x1,z0,z1,c)=>{const [a,b]=P(x0,z0),[c2,d]=P(x1,z1);g.fillStyle=c;g.fillRect(a,b,c2-a,d-b);};
  zone(-300,115,-124,-16,'#2c4157');zone(115,300,-124,-16,'#3a3a4f');zone(-300,EX,-16,244,'#34404f');zone(-300,-155,9,244,'#3b3f52');zone(-450,-300,-16,215,'#453c47');zone(TC.X0,TC.X1,TC.Z0,TC.Z1,'#2f4a44');
  if(TRAINING)for(const q of TRAINING.buildings)zone(q.x0,q.x1,q.z0,q.z1,q.map||'#566a74');
  g.lineCap='round';g.lineJoin='round';
  for(const s2 of ROADSEG){const [a,b]=P(s2[0],s2[1]),[c2,d]=P(s2[2],s2[3]);g.strokeStyle='#5d6c80';g.lineWidth=Math.max(3*dpr,(s2[4]+3)*sc);g.beginPath();g.moveTo(a,b);g.lineTo(c2,d);g.stroke();}
  for(const s2 of ROADSEG){const [a,b]=P(s2[0],s2[1]),[c2,d]=P(s2[2],s2[3]);g.strokeStyle='#c9d2dc';g.lineWidth=Math.max(2*dpr,s2[4]*sc*.8);g.beginPath();g.moveTo(a,b);g.lineTo(c2,d);g.stroke();}
  /* street names along the roads once zoomed in */
  if(sc>1.1*dpr){g.save();g.font='600 '+Math.round(Math.min(15,Math.max(10,sc*3.2/dpr))*dpr)+'px '+AR;g.textAlign='center';g.textBaseline='middle';g.direction='rtl';
    for(const q of STREETS){const [a,b]=P(q.a[0],q.a[1]),[c2,d]=P(q.b[0],q.b[1]);let ang=Math.atan2(d-b,c2-a);if(ang>Math.PI/2)ang-=Math.PI;if(ang<-Math.PI/2)ang+=Math.PI;
      g.save();g.translate((a+c2)/2,(b+d)/2);g.rotate(ang);g.fillStyle='rgba(29,79,154,.92)';const tw=g.measureText(q.n).width+12*dpr;g.fillRect(-tw/2,-9*dpr,tw,18*dpr);g.fillStyle='#fff';g.fillText(q.n,0,1);g.restore();}
    g.restore();}
  if(fare&&POI[fare.to]){try{const p=POI[fare.to],rt=route(car.x,car.z,p.x,p.z);g.strokeStyle=RIDER_COLS[fare.col];g.lineWidth=Math.max(3*dpr,4*sc);g.beginPath();rt.pts.forEach((q,i)=>{const [a,b]=P(q[0],q[1]);i?g.lineTo(a,b):g.moveTo(a,b);});g.stroke();}catch(_){}}
  const placed=[],fit=(x,y,w,h)=>{for(const q of placed)if(x<q[0]+q[2]&&x+w>q[0]&&y<q[1]+q[3]&&y+h>q[1])return false;placed.push([x,y,w,h]);return true;};
  g.textAlign='center';g.textBaseline='middle';g.direction='rtl';
  [['الميناء',-90,-70],['الترسانة',205,-70],['الحي',60,180],['القباري',-225,70],['الورديان',-375,40],['مركز التدريب',(TC.X0+TC.X1)/2,(TC.Z0+TC.Z1)/2]].forEach(([n,x,z])=>{const [a,b]=P(x,z);const fs=Math.max(18*dpr,Math.min(40*dpr,sc*14));g.font=fs+'px '+GAMEF;g.fillStyle='rgba(245,241,232,.28)';g.fillText(n,a,b);});
  const fs=Math.round(13*dpr);g.font='700 '+fs+'px '+AR;
  if(car){const [a,b]=P(car.x,car.z);placed.push([a-14*dpr,b-14*dpr,28*dpr,28*dpr]);}
  const isDest=k=>riders.some(r=>r.to===k);const order=Object.keys(POI).sort((a,b)=>(isDest(b)-isDest(a))||(waiting.some(w=>w.poi===b)-waiting.some(w=>w.poi===a)));
  for(const k of order){const p=POI[k];const [a,b]=P(p.x,p.z);if(a<-50||b<-50||a>W+50||b>H+50)continue;const ri=riders.findIndex(r=>r.to===k),dest=ri>=0,dc=dest?RIDER_COLS[riders[ri].col]:null,wt=waiting.some(w=>w.poi===k);
    g.fillStyle=dest?dc:(wt?'#F5B928':'#9fb0c4');g.beginPath();g.arc(a,b,(dest?9:(wt?5:3.5))*dpr,0,7);g.fill();g.strokeStyle='#101B2D';g.lineWidth=1.5*dpr;g.stroke();
    if(dest){g.fillStyle='#101B2D';g.font='800 '+Math.round(11*dpr)+'px '+AR;g.fillText(arNum(ri+1),a,b+1);g.font='700 '+fs+'px '+AR;}
    const tw=g.measureText(p.n).width+10*dpr,th=fs+6*dpr;if(fit(a-tw/2,b-th-6*dpr,tw,th)){g.fillStyle='rgba(16,27,45,.78)';g.fillRect(a-tw/2,b-th-6*dpr,tw,th);g.fillStyle=dest?dc:(wt?'#F5B928':'#e7ecf2');g.fillText(p.n,a,b-th/2-6*dpr);}}
  for(const s2 of STATIONS_F){const [a,b]=P(s2.sx,s2.sz);g.fillStyle='#ff6a3a';g.fillRect(a-5*dpr,b-5*dpr,10*dpr,10*dpr);g.fillStyle='#fff';g.font='700 '+Math.round(8*dpr)+'px '+AR;g.fillText('⛽',a,b);g.font='700 '+fs+'px '+AR;}
  if(car){const [a,b]=P(car.x,car.z);g.save();g.translate(a,b);g.rotate(-car.h);g.fillStyle='#fff';g.strokeStyle='#101B2D';g.lineWidth=2.5*dpr;g.beginPath();g.moveTo(0,-11*dpr);g.lineTo(8*dpr,9*dpr);g.lineTo(0,4*dpr);g.lineTo(-8*dpr,9*dpr);g.closePath();g.fill();g.stroke();g.restore();}}
(function mapGestures(){const cv=$('mapCv');const zoom=(f,cx,cy)=>{const r=cv.getBoundingClientRect();const px=cx-r.left-r.width/2,py=cy-r.top-r.height/2;const wx=MV.x+px/MV.s,wz=MV.z+py/MV.s;MV.s=clamp(MV.s*f,.4,14);MV.x=wx-px/MV.s;MV.z=wz-py/MV.s;drawMap();};
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);MV.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(MV.ptrs.size===2){const [a,b]=[...MV.ptrs.values()];MV.d0=Math.hypot(a.x-b.x,a.y-b.y);MV.s0=MV.s;}});
  cv.addEventListener('pointermove',e=>{const q=MV.ptrs.get(e.pointerId);if(!q)return;if(MV.ptrs.size===1){MV.x-=(e.clientX-q.x)/MV.s;MV.z-=(e.clientY-q.y)/MV.s;q.x=e.clientX;q.y=e.clientY;drawMap();return;}
    q.x=e.clientX;q.y=e.clientY;const [a,b]=[...MV.ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(MV.d0>0){const f=(MV.s0*d/MV.d0)/MV.s;zoom(f,(a.x+b.x)/2,(a.y+b.y)/2);}});
  ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,e=>{MV.ptrs.delete(e.pointerId);if(MV.ptrs.size<2)MV.d0=0;}));
  cv.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY);},{passive:false});
  $('mapIn').addEventListener('click',()=>{const r=cv.getBoundingClientRect();zoom(1.4,r.left+r.width/2,r.top+r.height/2);});
  $('mapOut').addEventListener('click',()=>{const r=cv.getBoundingClientRect();zoom(1/1.4,r.left+r.width/2,r.top+r.height/2);});
  $('mapMe').addEventListener('click',()=>{if(car){MV.x=car.x;MV.z=car.z;MV.s=Math.max(MV.s,3);drawMap();}});
  $('mapAll').addEventListener('click',()=>{mapFit();drawMap();});})();
$('btnMissions').addEventListener('click',openMissions);$('msClose').addEventListener('click',()=>{$('missions').hidden=true;});
$('btnMap').addEventListener('click',openMap);$('mapClose').addEventListener('click',()=>{$('mapView').hidden=true;});
addEventListener('resize',()=>{if(!$('mapView').hidden)drawMap();});
function openProgress(){const rp=repProgress((save.rep&&save.rep.xp)||0);$('pgRepName').textContent='⭐ '+rp.name;$('pgRepNext').textContent=rp.next?('باقي '+arNum(rp.need-rp.into)+' نقطة لـ «'+rp.next+'»'):'وصلت لأعلى مستوى';$('pgRepBar').style.width=Math.round(rp.frac*100)+'%';$('pgWallet').textContent=Math.round(save.wallet);$('pgTotal').textContent=Math.round(save.total);$('pgTrips').textContent=save.trips;$('pgPaints').textContent=save.owned.length;$('progress').hidden=false;}
$('btnProgress').addEventListener('click',openProgress);$('pgClose').addEventListener('click',()=>{$('progress').hidden=true;});
$('progress').addEventListener('click',e=>{if(e.target.id==='progress')$('progress').hidden=true;});
/* the radio panel lives at the top level so it can open over the menu too */
document.body.appendChild($('radio'));
$('btnMenuRadio').addEventListener('click',()=>{initAudio();if(A.ctx&&A.ctx.state!=='running')A.ctx.resume().catch(()=>{});toggleRadio();});

/* ============ UI sounds + volume (Phase 2) ============ */
const VOL={master:1,ui:.7};try{Object.assign(VOL,JSON.parse(ls.get('aps_vol')||'{}'));}catch(e){}
function saveVol(){ls.set('aps_vol',JSON.stringify(VOL));if(A.ctx&&A.master&&!A.muted)A.master.gain.setTargetAtTime(.9*VOL.master,A.ctx.currentTime,.05);}
/* short, quiet clicks; only after the player has touched the page (browsers block sound before that) */
function uiSfx(kind){if(!A.ctx||A.ctx.state!=='running'||VOL.ui<=0||A.muted)return;const ctx=A.ctx,t=ctx.currentTime,g=ctx.createGain();g.connect(A.master);
  const tone=(f,at,d,type,v)=>{const o=ctx.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(f,t+at);const e=ctx.createGain();e.gain.setValueAtTime(.0001,t+at);e.gain.exponentialRampToValueAtTime(v*VOL.ui,t+at+.008);e.gain.exponentialRampToValueAtTime(.0001,t+at+d);o.connect(e);e.connect(g);o.start(t+at);o.stop(t+at+d+.02);};
  if(kind==='ok'){tone(784,0,.12,'triangle',.16);tone(1175,.07,.18,'triangle',.14);}
  else if(kind==='open'){tone(520,0,.09,'sine',.1);tone(780,.04,.1,'sine',.08);}
  else tone(1250,0,.045,'square',.035);}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.closest('#hud')&&!b.closest('#pay'))return;
  initAudio();uiSfx(b.matches('#btnStart,#pOk,#garClose,.vpick button,.paint')?'ok':(b.matches('#btnGarage,#btnSettings,#btnStudio,#btnProgress,#btnMenuRadio,#btnMissions,#btnMap')?'open':'tap'));},true);
$('volMaster').value=Math.round(VOL.master*100);$('volUi').value=Math.round(VOL.ui*100);
$('volMaster').addEventListener('input',e=>{VOL.master=e.target.value/100;saveVol();});$('volUi').addEventListener('input',e=>{VOL.ui=e.target.value/100;saveVol();uiSfx('tap');});

/* ============ settings panel ============ */
function seg(id,opts,get,set){const el=$(id);const draw=()=>{el.innerHTML='';opts.forEach(([v,lab])=>{const b=document.createElement('button');b.textContent=lab;b.setAttribute('aria-pressed',String(get()===v));b.addEventListener('click',async()=>{if(get()!==v){await set(v);}draw();});el.appendChild(b);});};draw();return draw;}
const segDraw=[];
segDraw.push(seg('segCtl',[['touch','الدركسيون'],['arrows','الأسهم'],['tilt','الإمالة']],()=>ctl.mode,v=>setCtl(v)));
segDraw.push(seg('segSens',[[0.7,'تقيل'],[1,'عادي'],[1.35,'خفيف']],()=>ctl.sens,v=>{ctl.sens=v;saveCtl();ctlUI();}));
segDraw.push(seg('segVoice',[['game','شغالة'],['off','مقفولة']],()=>Speech.mode,v=>{while(Speech.mode!==v)$('btnVoice').click();}));
segDraw.push(seg('segIntro',[['play','شغّلها'],['skip','اتخطاها']],()=>skipIntro()?'skip':'play',v=>{ls.set('aps_skipIntro',v==='skip'?'1':'0');}));
segDraw.push(seg('segQ',[['low','خفيفة'],['med','متوسطة'],['high','عالية']],()=>quality,v=>setQuality(v)));
$('btnSettings').addEventListener('click',()=>{segDraw.forEach(f=>f());$('verNote').textContent='النسخة '+APP_VERSION;$('settings').hidden=false;});
$('setClose').addEventListener('click',()=>{$('settings').hidden=true;});
$('settings').addEventListener('click',e=>{if(e.target.id==='settings')$('settings').hidden=true;});
function vehPick(){const box=$('vehPick');box.innerHTML='';VEHS.forEach(x=>{const b=document.createElement('button');b.setAttribute('role','radio');b.setAttribute('aria-checked',String(x.id===save.vehicle));b.innerHTML='<img src="./img/'+x.id+'-thumb.png" alt="">'+x.n+'<small>'+x.d+'</small>';b.addEventListener('click',()=>setVehicle(x.id));box.appendChild(b);});}
vehPick();

/* ============ voice lines registry + studio ============ */
VO.register('ركوب الزبون',[INTRO_P,PRICE_P,HAIL_L],'p');VO.register('ردود الاسطى',[INTRO_D,INTRO_D2,PRICE_D],'d');
VO.register('الدفع والباقي',[PAY_GIVE,PAY_OK,PAY_SHORT,PAY_OVER_HONEST,PAY_KEEP],'p');VO.register('نهاية المشوار',[END_SEQ,END_LATE]);
VO.register('السواقة',[HIT_L,FAST_L,RADIO_L,WALK_L],'p');VO.register('البوابات',[GUARD_IN,GUARD_OUT,CAMPUS_IN]);
VO.register('كلام الركاب',[PT.map(t=>t.ride),AREA_C],'p');
VO.register('السوزوكي',[L_BOARD,L_PASS,L_DOWN],'p');VO.register('السوزوكي',[L_YES,L_FULL,'مع السلامة يا جماعة','مع السلامة يا باشا'],'d');VO.register('الدفع والباقي',['اتفضل يا اسطى، الأجرة مظبوطة'],'p');
VO.register('المهام',MISSIONS.filter(m=>!m.soon).map(m=>[m.intro,m.pax.ride]),'p');VO.register('مذيع الراديو',RST.map(r=>r.idents),'r');
VO.loadMine();VO.loadPack();
const studio={i:0,rec:null,chunks:[],stream:null};
function studioList(){const g=$('stGroup').value;return VO.templates.filter(t=>!g||t.group===g);}
function studioRender(){const L=studioList();if(!L.length)return;studio.i=clamp(studio.i,0,L.length-1);const t=L[studio.i];
  $('stWho').textContent=t.who==='d'?'الاسطى (إنت)':(t.who==='r'?'مذيع الراديو':'الراكب');$('stText').textContent=t.say;$('stPos').textContent=(studio.i+1)+' / '+L.length;
  const done=VO.templates.filter(x=>VO.mine.has(x.key)).length;$('stDone').textContent='اتسجّل '+done+' من '+VO.templates.length;
  $('stPlay').disabled=!VO.mine.has(t.key);$('stDel').disabled=!VO.mine.has(t.key);$('stRec').classList.toggle('has',VO.mine.has(t.key));}
async function studioRecord(){const L=studioList(),t=L[studio.i];if(studio.rec){studio.rec.stop();return;}
  try{studio.stream=studio.stream||await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});}catch(e){toast('محتاجين إذن الميكروفون','bad');return;}
  const mt=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m))||'';
  const r=new MediaRecorder(studio.stream,mt?{mimeType:mt}:{});studio.chunks=[];r.ondataavailable=e=>{if(e.data.size)studio.chunks.push(e.data);};
  r.onstop=async()=>{studio.rec=null;$('stRec').classList.remove('on');$('stRec').textContent='🎙️ سجّل';const b=new Blob(studio.chunks,{type:r.mimeType||'audio/webm'});if(b.size>800){await VO.saveMine(t.key,b);VO.speak(t.tpl,{});if(studio.i<L.length-1)setTimeout(()=>{studio.i++;studioRender();},900);}studioRender();};
  r.start();studio.rec=r;$('stRec').classList.add('on');$('stRec').textContent='⏹️ وقّف';}
function openStudio(){initAudio();if(A.ctx&&A.ctx.state!=='running')A.ctx.resume();const sel=$('stGroup');if(!sel.options.length){sel.add(new Option('كل الجمل',''));[...new Set(VO.templates.map(t=>t.group))].forEach(g=>sel.add(new Option(g,g)));}$('studio').hidden=false;studioRender();}
$('btnStudio').addEventListener('click',openStudio);$('stClose').addEventListener('click',()=>{$('studio').hidden=true;if(studio.rec)studio.rec.stop();if(studio.stream){studio.stream.getTracks().forEach(t=>t.stop());studio.stream=null;}});
$('stGroup').addEventListener('change',()=>{studio.i=0;studioRender();});
$('stPrev').addEventListener('click',()=>{studio.i--;studioRender();});$('stNext').addEventListener('click',()=>{studio.i++;studioRender();});
$('stRec').addEventListener('click',studioRecord);$('stPlay').addEventListener('click',()=>{const t=studioList()[studio.i];VO.speak(t.tpl,{});});
$('stDel').addEventListener('click',async()=>{const t=studioList()[studio.i];await VO.deleteMine(t.key);studioRender();});
$('stExport').addEventListener('click',async()=>{if(!VO.mine.size){toast('سجّل جمل الأول');return;}const b=await VO.exportPack();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='toktok-voices.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);});
$('stImport').addEventListener('click',()=>$('stFile').click());$('stFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const n=await VO.importPack(f);toast('اتضاف '+n+' صوت','good');studioRender();}catch(_){toast('الملف ده مش باكدج أصوات','bad');}});

/* ============ PWA: install + forced updates ============ */
const APP_VERSION=typeof __APP_VERSION__!=='undefined'?__APP_VERSION__:'dev';
if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('./sw.js?v='+APP_VERSION+(IS_BETA?'&ch=beta':'')).catch(e=>console.warn('sw',e));}
let installEvt=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;$('install').classList.add('show');});
$('install').addEventListener('click',async()=>{if(installEvt){installEvt.prompt();try{await installEvt.userChoice;}catch(_){}installEvt=null;$('install').classList.remove('show');}});
if(/iphone|ipad/i.test(navigator.userAgent)&&!navigator.standalone){$('install').classList.add('show');$('install').addEventListener('click',()=>{if(!installEvt)toast('من Safari: زرار المشاركة ← "إضافة إلى الشاشة الرئيسية"');});}
async function forceUpdate(){const b=$('updBtn');b.disabled=true;b.textContent='بيحدّث…';if(window.__hardUpdate){window.__hardUpdate();return;}
  /* only this channel's worker and caches: updating Beta never touches the main game, and the other way round */
  const here=new URL('./',location.href).href;
  try{const regs=await navigator.serviceWorker?.getRegistrations?.()||[];for(const r of regs)if(r.scope===here)await r.unregister();}catch(_){}
  try{for(const k of await caches.keys())if(IS_BETA?k.startsWith('toktok-beta-'):(k.startsWith('toktok-')&&!k.startsWith('toktok-beta-')))await caches.delete(k);}catch(_){}
  location.replace(location.pathname+'?v='+Date.now());}
async function checkUpdate(){if(APP_VERSION==='dev'||location.protocol==='file:')return;
  try{const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
    if(j.version&&j.version!==APP_VERSION){$('updVer').textContent='نسختك: '+APP_VERSION+' ← الجديدة: '+j.version;$('upd').hidden=false;if(state==='play'&&typeof pauseGame==='function')pauseGame();}}catch(_){}}
$('updBtn').addEventListener('click',forceUpdate);
checkUpdate();setInterval(checkUpdate,3*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate();});

/* ============ intro ============ */
let introT0=performance.now();
function introFit(){document.documentElement.style.setProperty('--fit',(innerWidth/(innerHeight*1672/941)).toFixed(3));}introFit();addEventListener('resize',introFit);
function introReady(){const L=$('loading');$('loadBar').style.width='100%';L.classList.add('ready');loadingText.textContent='👆 اضغط عشان تبدأ';
  let played=false,done=false;
  const toMenu=()=>{if(done)return;done=true;removeEventListener('keydown',go);if(introAmb)try{introAmb.stop();}catch(_){}L.classList.add('out');showMenu();setTimeout(()=>{L.hidden=true;},600);};
  const go=e=>{if(e&&e.type==='keydown'&&e.repeat)return;if(played)return;played=true;removeEventListener('keydown',go);initAudio();if(A.ctx)A.ctx.resume().catch(()=>{});
    L.classList.add('out');setTimeout(()=>{L.hidden=true;},600);startCine(()=>{done=true;showMenu();});};
  if(skipIntro()){toMenu();return;}
  L.addEventListener('pointerdown',go);addEventListener('keydown',go);}
function showMenu(){const m=$('menu');m.hidden=false;m.classList.remove('enter');void m.offsetWidth;m.classList.add('enter');menuWallet();}
function skipIntro(){return ls.get('aps_skipIntro')==='1';}

/* ============ cinematic intro (Phase 4): the real game world, the same renderer and the same frame loop ============
   six shots ≈14 s: sea → port flyover → Wardian street → tuk passes → hero stop → logo. Tap/any key skips.
   If the first 1.5 s run slowly (avg frame > 45 ms) the port flyover is dropped (light version). */
const V3=(x,y,z)=>[x,y,z];
/* Phase 8 intro: a drone over the city and the sea, the port, the shipyard, the training centre (outside then the students'
   corridor), the driver walking to his tuk and getting in, the tuk on the avenue, then the hero shot and the logo. */
const GM=TC.gateMain,TKZ=6.2;
const CINE_SHOTS=[
  {id:'drone',dur:3.4,cam:[V3(-520,150,-300),V3(-240,105,-170)],look:[V3(-40,0,-20),V3(60,0,30)],cap:['الإسكندرية','غرب المدينة — الورديان والقباري والمينا']},
  {id:'port',dur:2.8,cam:[V3(-262,46,-6),V3(-150,32,-18)],look:[V3(-150,0,-92),V3(-60,0,-100)],cap:['ميناء الإسكندرية','الأرصفة والأوناش والحاويات']},
  {id:'yard',dur:2.6,cam:[V3(140,34,-14),V3(196,24,-34)],look:[V3(228,0,-96),V3(236,0,-100)],cap:['ترسانة الإسكندرية','الحوض الجاف والأوناش']},
  {id:'tc',dur:2.8,cam:[V3(GM+6,16,-14),V3(GM-2,8,12)],look:[V3(GM-6,4,40),V3(GM-8,5,32)],cap:['مركز تدريب الترسانة','الإدارة والفصول والورش']},
  {id:'tcin',dur:2.6,cam:[V3(232,2.3,57.85),V3(206,2.1,57.85)],look:[V3(200,2,57.85),V3(176,1.8,57.85)],cap:['ممر دخول وخروج الطلبة','ورش النجارة وتصنيع الآلات']},
  {id:'board',dur:3.6,cam:[V3(GM+13,1.75,14.8),V3(GM+11.5,1.6,12.6)],look:[V3(GM+8,1.1,TKZ),V3(GM+8,1.1,TKZ)],tuk:()=>[GM+8,TKZ,Math.PI/2],speed:0,driver:true,cap:['الوردية بتبدأ','الأسطى راكب التوكتوك']},
  {id:'drive',dur:3.2,follow:u=>[-7+3*u,1.0+.4*u,-3.2],tuk:u=>[GM+8-52*u,TKZ,Math.PI/2],speed:16},
  {id:'hero',dur:2.2,cam:[V3(GM-51,.95,3.2),V3(GM-52.2,.75,4.6)],look:null,tuk:()=>[GM-46,TKZ,Math.PI/2],speed:0,lights:true},
  {id:'logo',dur:2.6,cam:[V3(GM-52.2,.75,4.6),V3(GM-52.8,.9,5.2)],look:null,tuk:()=>[GM-46,TKZ,Math.PI/2],speed:0,lights:true}];
const CINE={on:false,t:0,shots:null,end:null,slow:0,frames:0,cues:null,hg:true};
const easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function cineBuild(light){let t=0;CINE.shots=CINE_SHOTS.filter(s=>!(light&&(s.id==='port'||s.id==='yard'))).map(s=>{const o=Object.assign({},s,{t0:t});t+=s.dur;o.t1=t;return o;});CINE.len=t;}
function startCine(onEnd){const el=$('cine');$('hud').hidden=true;$('toast').hidden=true;CINE.on=true;CINE.t=0;CINE.end=onEnd;CINE.slow=0;CINE.frames=0;CINE.light=false;cineBuild(false);
  CINE.hg=headGlow?headGlow.visible:true;if(headGlow)headGlow.visible=false;
  el.hidden=false;el.className='';void el.offsetWidth;el.classList.add('run');
  state='intro';camera.fov=48;camera.updateProjectionMatrix();
  /* sound cues, fired from the frame clock so a skip stops them all */
  CINE.cues=[[0,sfxWaves],[.3,sfxShipHorn],['port',.4,sfxGull],['port',1.7,sfxGull],['tc',.2,()=>sfxWhoosh(.5,.25)],['board',2.9,()=>blip('ok')],['drive',.05,introEngine],['drive',1.6,sfxHorn],['logo',0,()=>sfxWhoosh(.8,.4)],['logo',.35,sfxBoom],['logo',.55,()=>sfxChime(0)],['logo',.8,()=>sfxChime(2)]].map(c=>({c:c,done:false}));
  el.onpointerdown=()=>finishCine();CINE.key=e=>{finishCine();};addEventListener('keydown',CINE.key);}
function cueTime(c){if(typeof c[0]==='number')return c[0];const s=CINE.shots.find(x=>x.id===c[0]);return s?s.t0+c[1]:null;}
function cineTick(dt){CINE.t+=dt;const t=CINE.t;
  if(t<1.5){CINE.frames++;CINE.slow+=dt;}else if(!CINE.light&&CINE.frames&&t<2.2&&CINE.slow/CINE.frames>.045){CINE.light=true;const sea=CINE.shots[0];cineBuild(true);}
  for(const q of CINE.cues){if(q.done)continue;const ct=cueTime(q.c);if(ct===null){q.done=true;continue;}if(t>=ct){q.done=true;try{q.c[q.c.length-1]();}catch(_){}}}
  if(t>=CINE.len){finishCine();return;}
  const s=CINE.shots.find(x=>t>=x.t0&&t<x.t1)||CINE.shots[CINE.shots.length-1];const u=Math.min(1,(t-s.t0)/s.dur),e=easeIO(u);
  const el=$('cine');if(el.dataset.shot!==s.id){el.dataset.shot=s.id;}
  if(el.dataset.cap!==s.id){el.dataset.cap=s.id;const cp=$('cineCap');if(s.cap){cp.innerHTML=s.cap[0]+'<small>'+s.cap[1]+'</small>';cp.classList.add('on');}else cp.classList.remove('on');}
  if(s.tuk){const [x,z,h]=s.tuk(s.follow?u:e);veh.teleport(x,z,h);car.v=s.speed||0;syncTuk();}
  cineDriver(s,u);
  if(s.follow){const [ox,oy,oz]=s.follow(u);camera.position.set(car.x+ox,oy,car.z+oz);}
  else{const c0=s.cam[0],c1=s.cam[1];camera.position.set(c0[0]+(c1[0]-c0[0])*e,c0[1]+(c1[1]-c0[1])*e,c0[2]+(c1[2]-c0[2])*e);}
  if(s.look){const l0=s.look[0],l1=s.look[1];camera.lookAt(l0[0]+(l1[0]-l0[0])*e,l0[1]+(l1[1]-l0[1])*e,l0[2]+(l1[2]-l0[2])*e);}else camera.lookAt(car.x,car.y+1.15,car.z);
  if(headGlow&&s.lights){const on=s.id==='logo'||u>.35;if(headGlow.visible!==on){headGlow.visible=on;if(on)blip('ok');}}
  /* dips to black between shots */
  const edge=Math.min(t-s.t0,s.t1-t);$('cineFade').style.opacity=s.id==='sea'?Math.max(0,1-t/1.6):(edge<.18&&s.id!=='logo'?(1-edge/.18)*.85:0);}
/* the driver walks from the pavement to the tuk and gets in (the seated driver is shown once he is in) */
function cineDriver(s,u){const dh=tukNodes.driverH;
  if(s.driver){if(!CINE.dv){CINE.dv=person({variant:'Man',shirt:'#3f6587',pants:'#2a3550',skin:'#8f6446'},car.x+3.2,12.4,Math.PI);}
    const d=CINE.dv,tx=car.x-.35,tz=car.z+.95;
    if(u<.78){const k=Math.min(1,u/.7);d.visible=true;const sx=car.x+3.2,sz=12.4;d.position.set(sx+(tx-sx)*k,0,sz+(tz-sz)*k);d.rotation.y=Math.atan2(tx-sx,tz-sz);PEOPLE.play(d,'Walk',.15);if(dh)dh.visible=false;}
    else{d.visible=false;if(dh)dh.visible=true;}}
  else{if(CINE.dv)CINE.dv.visible=false;if(dh)dh.visible=true;}}
function finishCine(){if(!CINE.on)return;CINE.on=false;if(CINE.dv){scene.remove(CINE.dv);CINE.dv=null;}if(tukNodes.driverH)tukNodes.driverH.visible=true;$('cineCap').classList.remove('on');removeEventListener('keydown',CINE.key);if(introAmb)try{introAmb.stop();}catch(_){}
  const el=$('cine');el.classList.add('out');setTimeout(()=>{el.hidden=true;el.classList.remove('run','out');el.onpointerdown=null;},450);
  if(headGlow)headGlow.visible=CINE.hg;camera.fov=baseFov;camera.updateProjectionMatrix();veh.teleport(-160,7,-Math.PI/2);car.v=0;syncTuk();
  state='menu';const cb=CINE.end;CINE.end=null;if(cb)cb();}
/* distant ship horn: two low detuned tones with a slow swell */
function sfxShipHorn(){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;[[98,.0],[123,.004]].forEach(([f,d])=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f*(1+d);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
  const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.11,t+.6);g.gain.setValueAtTime(.11,t+1.7);g.gain.exponentialRampToValueAtTime(.0001,t+2.6);o.connect(lp);lp.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+2.7);});}
/* loading: real steps only — the bar moves when a step actually finishes, no invented percentage */
const LD={done:0,total:8};
function ldStep(msg){LD.done=Math.min(LD.total,LD.done+1);const b=$('loadBar');if(b)b.style.width=(LD.done/LD.total*100)+'%';
  if(msg)loadingText.textContent=msg;const c=$('ldCount');if(c)c.textContent=LD.done.toLocaleString('ar-EG')+' من '+LD.total.toLocaleString('ar-EG');}
const nextPaint=()=>new Promise(r=>{let d=false;const f=()=>{if(!d){d=true;r();}};requestAnimationFrame(()=>setTimeout(f,0));setTimeout(f,120);});
/* --- intro sound design (all synthesized, no files) --- */
let introAmb=null;
function noiseBuf(sec){const ctx=A.ctx;const b=ctx.createBuffer(1,ctx.sampleRate*sec,ctx.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;}
function sfxWhoosh(dur,vol){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;const n=ctx.createBufferSource();n.buffer=noiseBuf(dur);const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.2;f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(3500,t+dur*.7);f.frequency.exponentialRampToValueAtTime(800,t+dur);
  const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur*.6);g.gain.exponentialRampToValueAtTime(.0001,t+dur);n.connect(f);f.connect(g);g.connect(A.sfx);n.start(t);}
function sfxBoom(){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(38,t+.6);const g=ctx.createGain();g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.0001,t+.8);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+.85);
  const n=ctx.createBufferSource();n.buffer=noiseBuf(.3);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;const ng=ctx.createGain();ng.gain.setValueAtTime(.4,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.3);n.connect(lp);lp.connect(ng);ng.connect(A.sfx);n.start(t);}
function sfxChime(i){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;[1568,2093,2637].forEach((fq,k)=>{const o=ctx.createOscillator();o.type='triangle';o.frequency.value=fq*(1+i*.12);const g=ctx.createGain();g.gain.setValueAtTime(.0001,t+k*.05);g.gain.exponentialRampToValueAtTime(.12,t+k*.05+.01);g.gain.exponentialRampToValueAtTime(.0001,t+k*.05+.6);o.connect(g);g.connect(A.sfx);o.start(t+k*.05);o.stop(t+k*.05+.65);});}
function sfxWaves(){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;const n=ctx.createBufferSource();n.buffer=noiseBuf(6);const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=700;const g=ctx.createGain();g.gain.value=0;
  const l=ctx.createOscillator();l.frequency.value=.28;const lg=ctx.createGain();lg.gain.value=.09;l.connect(lg);lg.connect(g.gain);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.12,t+1);n.connect(lp);lp.connect(g);g.connect(A.sfx);n.start(t);l.start(t);n.stop(t+6);l.stop(t+6);introAmb=n;}
function sfxGull(){if(!A.ctx)return;const ctx=A.ctx;let t=ctx.currentTime;for(let k=0;k<3;k++){const o=ctx.createOscillator();o.type='sawtooth';const f0=1500+Math.random()*300;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f0*1.45,t+.07);o.frequency.exponentialRampToValueAtTime(f0*.75,t+.28);
  const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=2200;bp.Q.value=2;const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(bp);bp.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+.32);t+=.34+Math.random()*.1;}}
function sfxHorn(){if(!A.ctx)return;const ctx=A.ctx;let t=ctx.currentTime;for(const d of [.12,.26]){[415,523].forEach(fq=>{const o=ctx.createOscillator();o.type='square';o.frequency.value=fq;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.01);g.gain.setValueAtTime(.12,t+d-.02);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(lp);lp.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+d+.02);});t+=d+.08;}}
/* tuk-tuk two-stroke putter revving up as it drives into the intro */
function introEngine(){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;const o=ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(48,t);o.frequency.exponentialRampToValueAtTime(150,t+.8);o.frequency.exponentialRampToValueAtTime(55,t+1.25);
  const am=ctx.createOscillator();am.type='square';am.frequency.setValueAtTime(18,t);am.frequency.linearRampToValueAtTime(42,t+.8);am.frequency.linearRampToValueAtTime(16,t+1.3);const amg=ctx.createGain();amg.gain.value=.5;am.connect(amg);
  const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.35,t+.15);g.gain.setValueAtTime(.35,t+1.0);g.gain.exponentialRampToValueAtTime(.0001,t+1.6);amg.connect(g.gain);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;o.connect(lp);lp.connect(g);g.connect(A.sfx);o.start(t);am.start(t);o.stop(t+1.7);am.stop(t+1.7);
  // tyre skid when it stops
  const n=ctx.createBufferSource();const b=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);n.buffer=b;
  const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=2600;bp.Q.value=3;const ng=ctx.createGain();ng.gain.value=.18;n.connect(bp);bp.connect(ng);ng.connect(A.sfx);n.start(t+.85);}
/* ============ performance counter (?debug=1) ============ */
const perf=new URLSearchParams(location.search).get('debug')==='1'?(()=>{
  const el=document.createElement('div');el.id='perf';el.innerHTML='<pre id="perfTxt"></pre><div class="pb2"><button id="perfCopy">نسخ التقرير</button><button id="perfReset">تصفير</button><button id="perfMark">علامة هنا</button></div>';document.body.appendChild(el);
  const P={t0:0,last:0,win:[],all:0,frames:0,sumDt:0,maxDt:0,calls:0,tris:0,marks:[],shown:0};
  /* count at the WebGL level so shadow passes are included (renderer.info misses them) */
  const G={calls:0,tris:0};const gl=renderer.getContext();const TRI=4,STRIP=5,FAN=6;const tri=(mode,n)=>mode===TRI?n/3:(mode===STRIP||mode===FAN?Math.max(0,n-2):0);
  for(const [name,ci,ii] of [['drawElements',1,-1],['drawArrays',2,-1],['drawElementsInstanced',1,4],['drawArraysInstanced',2,3]]){const f=gl[name];if(!f)continue;gl[name]=function(){G.calls++;G.tris+=tri(arguments[0],arguments[ci])*(ii>=0?arguments[ii]:1);return f.apply(gl,arguments);};}
  const reset=()=>{P.t0=performance.now();P.frames=0;P.sumDt=0;P.maxDt=0;P.win.length=0;};reset();
  const area=()=>car?areaOf(car.x,car.z):'-';
  const snap=()=>{const fpsNow=P.win.length>1?Math.round((P.win.length-1)/((P.win.at(-1)-P.win[0])/1000)):0;const avg=P.frames?(P.frames/((performance.now()-P.t0)/1000)):0;
    const mem=performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null;
    return {fpsNow:fpsNow,fpsAvg:+avg.toFixed(1),frameMs:+(P.frames?P.sumDt/P.frames:0).toFixed(1),frameMaxMs:+P.maxDt.toFixed(1),calls:P.calls,tris:P.tris,memMB:mem,vehicles:traffic.length+1,walkers:walkers.length,area:area(),x:car?Math.round(car.x):0,z:car?Math.round(car.z):0};};
  const report=()=>{const s=snap();return ['توكتوك في المينا — تقرير أداء','النسخة: '+APP_VERSION+' ('+CHANNEL+')','الوقت: '+new Date().toLocaleString('ar-EG'),'الجهاز: '+navigator.userAgent,'الشاشة: '+innerWidth+'×'+innerHeight+' · DPR '+(devicePixelRatio||1)+' · الرسوم: '+quality,'العربية: '+(isVan?'سوزوكي':'توكتوك')+' · الفيزياء: '+(car?car.mode:'-'),
    'الآن: FPS '+s.fpsNow+' · المتوسط '+s.fpsAvg+' · زمن الفريم '+s.frameMs+'ms (أقصى '+s.frameMaxMs+') · Draw Calls '+s.calls+' · Triangles '+s.tris+' · ذاكرة JS '+(s.memMB==null?'غير متاحة':s.memMB+'MB')+' · مركبات '+s.vehicles+' · مشاة '+s.walkers+' · المكان '+s.area+' ('+s.x+','+s.z+')']
    .concat(P.marks.length?['علامات:'].concat(P.marks.map((m,i)=>(i+1)+') '+m.area+' ('+m.x+','+m.z+') FPS '+m.fpsNow+' متوسط '+m.fpsAvg+' · '+m.frameMs+'ms · calls '+m.calls+' · tris '+m.tris+' · mem '+m.memMB)):[]).join('\n');};
  el.querySelector('#perfCopy').addEventListener('click',async()=>{const t=report();try{await navigator.clipboard.writeText(t);toast('اتنسخ التقرير','good');}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('اتنسخ التقرير','good');}catch(_){toast('انسخ النص يدوي','bad');}ta.remove();}});
  el.querySelector('#perfReset').addEventListener('click',reset);
  el.querySelector('#perfMark').addEventListener('click',()=>{P.marks.push(snap());toast('اتسجلت علامة '+P.marks.length,'good');});
  return {tick(now){const dt=P.last?now-P.last:16.7;P.last=now;if(document.hidden)return;P.frames++;P.sumDt+=dt;if(dt>P.maxDt&&P.frames>5)P.maxDt=dt;P.win.push(now);while(P.win.length&&now-P.win[0]>1000)P.win.shift();
      P.calls=G.calls;P.tris=Math.round(G.tris);G.calls=0;G.tris=0;
      if(now-P.shown>500){P.shown=now;const s=snap();$('perfTxt').textContent='FPS '+s.fpsNow+'   avg '+s.fpsAvg+'\nframe '+s.frameMs+' ms   max '+s.frameMaxMs+'\ndraw '+s.calls+'   tris '+(s.tris/1000).toFixed(0)+'k\nJS mem '+(s.memMB==null?'n/a':s.memMB+' MB')+'   veh '+s.vehicles+'\n'+s.area+'  '+APP_VERSION;}},
    snap:snap,report:report};})():null;

/* ============ boot ============ */
async function boot(){try{ldStep('بنفتح بوابة الميناء…');await nextPaint();buildWorld();setQuality(quality);ldStep('الرصيف جاهز، بنركّب الأوناش…');await nextPaint();
  const step=(pr,msg)=>pr.then(v=>{ldStep(msg);return v;});
  const [gltf,vanG,carsG,R]=await Promise.all([
    step(new GLTFLoader().loadAsync(window.TUK_MODEL||'./models/tuk.glb'),'التوكتوك وصل الجراج 🛺'),
    save.vehicle==='van'?new GLTFLoader().loadAsync('./models/van.glb').catch(e=>{console.warn('van',e);return null;}):Promise.resolve(null),
    step(new GLTFLoader().loadAsync(window.CARS_MODEL||'./models/cars.glb').catch(e=>{console.warn('cars model',e);return null;}),'العربيات نزلت الشارع…'),
    step(RAPIER.init().then(()=>RAPIER).catch(e=>{console.warn('physics unavailable, arcade mode',e);return null;}),'ظبطنا الفرامل والعجل…'),
    step(new GLTFLoader().loadAsync('./models/people.glb').then(g=>{PEOPLE.load(g);return g;}).catch(e=>{console.warn('people',e);return null;}),'الناس نزلت الشارع…')]);
  TUK_TRAFFIC=vanG?gltf.scene:null;loadTuk(vanG||gltf);if(!TUK_TRAFFIC)TUK_TRAFFIC=tuk;CARS=carsG&&carsG.scene;PARKED.forEach(([g,k])=>g.add(makeTraffic(k)));initTraffic();initWalkers();trainingWalkers();buildWardianLate({T,scene,col,makeTraffic,walkers,personGeo,VC,human},WARDIAN);ldStep('الزباين واقفين على الرصيف…');await nextPaint();
  veh=await createVehicle({RAPIER:R,colliders,traffic,spawn:{x:-160,z:7,h:-Math.PI/2},kind:isVan?'van':'tuk'});car=veh.car;
  veh.onImpact(s=>{shake=Math.min(1,s/9);onImpact(s);});
  destBeam=new T.Mesh(beamGeo,new T.MeshBasicMaterial({color:'#4cff5e',transparent:true,opacity:.28,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));destBeam.visible=false;scene.add(destBeam);
  destRing=new T.Mesh(new T.TorusGeometry(3,.15,8,40),new T.MeshBasicMaterial({color:'#4cff5e'}));destRing.rotation.x=Math.PI/2;destRing.visible=false;scene.add(destRing);
  buildRadioUI();radioUI();syncTuk();menuWallet();updateMoney();
  window.portSim={audio:A,mus:Mus,radio:radio,get scene(){return scene;},get wardian(){return WARDIAN;},get training(){return TRAINING;},voices:VO,get save(){return save;},colliders:colliders,route:(a,b,c,d)=>route(a,b,c,d),sync:()=>syncTuk(),cam:camera,get car(){return car;},teleport:(x,z,h)=>veh.teleport(x,z,h===undefined?car.h:h),POI:POI,waiting:waiting,cineSeek:t=>{if(CINE.on)CINE.t=t;},get cineShots(){return CINE.shots&&CINE.shots.map(x=>[x.id,x.t0,x.t1]);},get fare(){return fare;},get riders(){return riders;},get boarding(){return boarding;},get people(){return PEOPLE;},get line(){return line;},get perf(){return perf;},shot:v=>{debugCam=v;},payConfirm:()=>payConfirm(),startPay:()=>startPay(),get fuel(){return fuel;},input:input};
  state='menu';ldStep('كله تمام، الوردية مستنياك!');requestAnimationFrame(frame);introReady();}
  catch(err){console.error(err);loadingText.textContent='حصلت مشكلة: '+err.message;}}
const fr0=document.fonts&&document.fonts.load?Promise.all([document.fonts.load('40px Lalezar'),document.fonts.load('700 40px "IBM Plex Sans Arabic"'),document.fonts.load('900 40px "Big Shoulders Display"')]).catch(()=>{}):Promise.resolve();
Promise.race([fr0,new Promise(r=>setTimeout(r,2500))]).then(()=>{ldStep('الخطوط جاهزة، يلا بينا…');boot();});

})();
