import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createVehicle, syncModel, TUNING } from './vehicle.js';

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
const SAVE_KEY='aps_tuk_v2';
const save={wallet:60,total:0,trips:0,owned:['yellow','orange','red'],paint:'yellow',slogan:'ماشي بدعا الوالدين'};
try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(s)Object.assign(save,s);}catch(e){}
if(!save.owned.includes('orange'))save.owned.unshift('orange');if(!save.owned.includes('yellow')){save.owned.unshift('yellow');save.paint='yellow';}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}}

/* ============ renderer ============ */
const canvas=$('game');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){loadingText.textContent='الجهاز ده مش بيدعم WebGL.';return;}
renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
let quality=isTouch?'med':'high';
function applyPR(){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='high'?2:1.3));}
applyPR();
const scene=new T.Scene();const camera=new T.PerspectiveCamera(62,1,.1,2600);let baseFov=62;
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;baseFov=w<h?72:60;camera.fov=baseFov;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
const ANI=Math.min(8,renderer.capabilities.getMaxAnisotropy());

/* ============ textures ============ */
function ctex(w,h,draw,srgb){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;if(srgb!==false)t.encoding=T.sRGBEncoding;t.anisotropy=ANI;return t;}
function rep(t,x,y){const n=t.clone();n.needsUpdate=true;n.repeat.set(x,y);return n;}
function speckle(g,w,h,n,cols,s){for(let i=0;i<n;i++){g.fillStyle=cols[(Math.random()*cols.length)|0];const z=Math.random()*s+.5;g.fillRect(Math.random()*w,Math.random()*h,z,z);}}
function blot(g,w,h,n,cols,a,r0,r1){g.globalAlpha=a;for(let i=0;i<n;i++){g.fillStyle=cols[(Math.random()*cols.length)|0];g.beginPath();g.ellipse(Math.random()*w,Math.random()*h,rand(r0,r1),rand(r0*.5,r1*.5),Math.random()*3,0,7);g.fill();}g.globalAlpha=1;}
const AR='"IBM Plex Sans Arabic","Noto Naskh Arabic",Tahoma,sans-serif',GAMEF='Lalezar,'+AR;

const texAsph=ctex(256,256,(g,w,h)=>{g.fillStyle='#4a4a55';g.fillRect(0,0,w,h);speckle(g,w,h,6000,['#3e3e48','#575763','#50505b','#34343c'],2);blot(g,w,h,14,['#222','#777'],.07,12,44);});
/* 8m carriageway, 2 lanes: solid edges, dashed centre */
const texCarr=ctex(512,256,(g,w,h)=>{g.drawImage(texAsph.image,0,0);g.drawImage(texAsph.image,256,0);g.fillStyle='rgba(20,20,24,.22)';[.25,.75].forEach(v=>g.fillRect(0,v*h-10,w,20));
  g.fillStyle='#f0ebdc';g.fillRect(0,6,w,7);g.fillRect(0,h-13,w,7);g.fillRect(0,h/2-4,w*.4,8);});
/* 10m street, one lane each way: yellow edges, white dashes */
const texStreet=ctex(512,256,(g,w,h)=>{g.drawImage(texAsph.image,0,0);g.drawImage(texAsph.image,256,0);g.fillStyle='rgba(20,20,24,.2)';[.27,.73].forEach(v=>g.fillRect(0,v*h-9,w,18));
  g.fillStyle='#e7c23a';g.fillRect(0,8,w,5);g.fillRect(0,h-13,w,5);g.fillStyle='#f0ebdc';g.fillRect(0,h/2-3,w*.45,6);});
const texConc=ctex(512,512,(g,w,h)=>{g.fillStyle='#b4aa9b';g.fillRect(0,0,w,h);speckle(g,w,h,9000,['#a69d8f','#c1b8a8','#9a9285','#bbb2a2'],2.2);blot(g,w,h,30,['#3b3226','#fff','#5a4a32'],.07,20,90);
  g.strokeStyle='rgba(60,52,40,.3)';g.lineWidth=2;for(let i=0;i<=4;i++){g.beginPath();g.moveTo(i*128,0);g.lineTo(i*128,h);g.stroke();g.beginPath();g.moveTo(0,i*128);g.lineTo(w,i*128);g.stroke();}});
const texPave=ctex(256,256,(g,w,h)=>{g.fillStyle='#5f5552';g.fillRect(0,0,w,h);for(let y=0;y<8;y++)for(let x=0;x<8;x++){g.fillStyle=(x+y)%2?'#a1574a':'#8f8781';g.fillRect(x*32+1,y*32+1,30,30);}speckle(g,w,h,1400,['rgba(0,0,0,.15)','rgba(255,255,255,.07)'],2);});
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
const ST_X=[-250,-150,-50,50,150,250];const ST_Z=[120,235];
const GATES=[{x:-230,ar:'بوابة ١',en:'PORT GATE 1',c:'#173f6b'},{x:40,ar:'بوابة ٥٠',en:'PORT GATE 50',c:'#173f6b'},{x:170,ar:'ترسانة الإسكندرية',en:'ALEXANDRIA SHIPYARD',c:'#8a1f1a'}];
const RESERVE=[];
function reserved(x0,x1,z0,z1){for(const r of RESERVE)if(x1>r[0]&&x0<r[1]&&z1>r[2]&&z0<r[3])return true;return false;}

/* road graph (for GPS + roads) */
const NODES={};const EDGES=[];
function node(x,z){const k=x+','+z;if(!NODES[k])NODES[k]={x:x,z:z,k:k,adj:[]};return NODES[k];}
function edge(a,b,kind){const A=node(a[0],a[1]),B=node(b[0],b[1]);const d=Math.hypot(A.x-B.x,A.z-B.z);A.adj.push([B,d]);B.adj.push([A,d]);EDGES.push({a:A,b:B,kind:kind});}
(function(){const AX=[-290,-250,-230,-150,-50,40,50,150,170,250,290];for(let i=0;i<AX.length-1;i++)edge([AX[i],0],[AX[i+1],0],'ave');
  ST_X.forEach(x=>{edge([x,0],[x,120],'st');edge([x,120],[x,235],'st');});
  ST_Z.forEach(z=>{for(let i=0;i<ST_X.length-1;i++)edge([ST_X[i],z],[ST_X[i+1],z],'st');});
  const PX=[-280,-230,-120,-20,40,100];for(let i=0;i<PX.length-1;i++){edge([PX[i],-30],[PX[i+1],-30],'port');edge([PX[i],-112],[PX[i+1],-112],'port');}
  edge([-230,0],[-230,-30],'gate');edge([40,0],[40,-30],'gate');
  [-280,-120,-20,100].forEach(x=>edge([x,-30],[x,-112],'port'));
  edge([170,0],[170,-38],'gate');edge([170,-38],[170,-45],'port');edge([125,-45],[170,-45],'port');edge([170,-45],[170,-108],'port');edge([170,-38],[185,-38],'campus');edge([185,-38],[280,-38],'campus');})();

/* points of interest (stop spots on the kerb side of a lane) */
const POI={
  gate1:{n:'بوابة ١',x:-238,z:-6.5,sx:0,sz:-5,area:'port'},
  gate50:{n:'بوابة ٥٠',x:30,z:-6.5,sx:0,sz:-5,area:'port'},
  quay:{n:'رصيف الحاويات',x:-70,z:-109.5,sx:0,sz:5,area:'port'},
  store:{n:'مخازن الميناء',x:-200,z:-27.5,sx:0,sz:5,area:'port'},
  gateS:{n:'بوابة الترسانة',x:180,z:-6.5,sx:0,sz:-5,area:'yard'},
  ws:{n:'ورشة الهياكل',x:166.5,z:-63,sx:-4,sz:0,area:'yard'},
  dock:{n:'الحوض الجاف',x:173.5,z:-100,sx:4.5,sz:0,area:'yard'},
  elec:{n:'ورشة الكهرباء بمركز التدريب',x:200,z:-40.5,sx:0,sz:-4.5,area:'yard'},
  theory:{n:'مبنى النظري بمركز التدريب',x:214,z:-35.5,sx:0,sz:4,area:'yard'},
  weld:{n:'ورشة اللحام بمركز التدريب',x:232,z:-40.5,sx:0,sz:-4.5,area:'yard'},
  lathe:{n:'ورشة الخراطة بمركز التدريب',x:264,z:-40.5,sx:0,sz:-4.5,area:'yard'},
  tcadmin:{n:'إدارة مركز التدريب',x:274,z:-35.5,sx:0,sz:4.6,area:'yard'},
  admin:{n:'هيئة الميناء',x:70,z:-32.5,sx:0,sz:-6,area:'port'},
  fish:{n:'سوق السمك',x:-215,z:6.5,sx:0,sz:5.5,area:'city'},
  cafe:{n:'قهوة البحّارة',x:175,z:6.5,sx:0,sz:5.5,area:'city'},
  mosque:{n:'الجامع',x:-215,z:122.5,sx:0,sz:5,area:'city'},
  school:{n:'المدرسة الصناعية',x:22,z:122.5,sx:0,sz:5,area:'city'},
  bakery:{n:'فرن العيش',x:147.5,z:70,sx:-4.5,sz:0,area:'city'},
  micro:{n:'موقف الميكروباص',x:247.5,z:180,sx:-4.5,sz:0,area:'city'},
  market:{n:'سوق الخضار',x:-52.5,z:60,sx:4.5,sz:0,area:'city'},
  clinic:{n:'المستوصف',x:-147.5,z:190,sx:-4.5,sz:0,area:'city'}};
const STATIONS_F=[{n:'بنزينة الميناء',x:-121,z:26,sx:-122,sz:26},{n:'بنزينة الحي',x:79,z:138,sx:79,sz:138}];

let sky,sun,water,flags=[],trolleys=[],glowPts,gulls=[],headGlow,coneGlow;
const contData=[];const CONT=['#2e5e8c','#b23a2a','#d6802b','#3b7a4a','#8a8f94','#7a3b5a','#c9a227','#1f4e5f','#e0ddd5'];
const S=new Merger();   /* static vertex-coloured props */
const SM=new Merger();  /* metallic props */
const lampsList=[],palmsList=[];

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
  const gaps=[-250,-230,-150,-50,45,150,170,250];
  let mx=-450;const medSeg=(a,b)=>{if(b-a<2)return;S.box(a,b,0,.28,-1,1,'#3f6a3a');curb(a,b,-1.15,-1);curb(a,b,1,1.15);};
  gaps.slice().sort((a,b)=>a-b).forEach(g=>{const half=g===45?12:7;medSeg(mx,g-half);mx=g+half;});medSeg(mx,450);
  for(let x=-280;x<=280;x+=22){if(gaps.some(g=>Math.abs(x-g)<12))continue;palmsList.push([x,0,rand(7,9)]);col(x-.4,x+.4,-.4,.4,9);}
  /* sidewalks */
  plane(900,6,new T.MeshStandardMaterial({map:rep(texPave,225,1.5),roughness:.9}),0,.12,12);
  plane(900,7,new T.MeshStandardMaterial({map:rep(texPave,225,1.75),roughness:.9}),0,.12,-12.5);
  /* kerbs (yellow & black) */
  const southGaps=ST_X.map(x=>[x-5,x+5]).concat([[-139,-103]]);segs(-450,450,southGaps).forEach(s=>curb(s[0],s[1],9,9.3));
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
  segs(-300,300,GATES.map(g=>[g.x-7,g.x+7])).forEach(s=>{S.box(s[0],s[1],0,3.4,-16.5,-15.5,'#e7ddc8');S.box(s[0],s[1],3.4,3.7,-16.7,-15.3,'#3b6e8c');S.box(s[0],s[1],0,.6,-16.6,-15.4,'#4c6a6a');col(s[0],s[1],-16.5,-15.5,3.7);});
  S.box(114.5,115.5,0,3.4,-125,-16.5,'#e7ddc8');col(114.5,115.5,-125,-16.5,3.4);
  GATES.forEach(g=>gate(g));
  /* boundaries */
  col(-900,-298,-900,900,0);col(298,900,-900,900,0);col(-900,900,244,900,0);

  /* ===== city blocks ===== */
  RESERVE.push([-139,-102,13,50],[58,100,126,162],[-242,-200,13,40],[-244,-221,127,150],[4,44,127,172],[156,196,13,32],[226,243,166,196],[140,146,62,78]);
  const BX=[-300].concat(ST_X).concat([300]);
  const facM=new T.MeshStandardMaterial({map:texFacade,emissiveMap:texFacadeLit,emissive:'#ffffff',emissiveIntensity:.95,vertexColors:true,roughness:.85});
  const shopM=new T.MeshStandardMaterial({map:texShops,emissiveMap:texShopsLit,emissive:'#ffffff',emissiveIntensity:.8,vertexColors:true,roughness:.8});
  const FAC=new Merger(),SHP=new Merger(),ROOF=new Merger();
  const tints=['#ffffff','#ffd9a8','#ffe9c9','#ffc8b4','#d6e6f2','#fff0b0','#ead6ff','#d4ecd4','#f6c99a','#ffffff'];
  const zBands=[[15,111],[129,226],[244,300]];
  for(let i=0;i<BX.length-1;i++){const xa=BX[i]+(i===0?0:9),xb=BX[i+1]-(i===BX.length-2?0:9);
    zBands.forEach((zb,bi)=>{let x=xa;while(x<xb-6){let w=rand(16,26);if(xb-(x+w)<10)w=xb-x;let z=zb[0];
        while(z<zb[1]-6){let d=rand(20,30);if(zb[1]-(z+d)<12)d=zb[1]-z;
          const x0=x+.6,x1=x+w-.6,z0=z+.6,z1=z+d-.6;
          if(!reserved(x0,x1,z0,z1)){const fl=3+((sr()*8)|0)+(bi===2?3:0),h=4.5+fl*3;building(FAC,SHP,ROOF,x0,x1,z0,z1,h,pick(tints),bi===2,{n:z===zb[0],s:z+d>=zb[1]-.01,w:x===xa,e:x+w>=xb-.01});if(bi<2)col(x0,x1,z0,z1,h);}
          z+=d;}
        x+=w;}});}
  FAC.mesh(facM);SHP.mesh(shopM);ROOF.mesh(VC);
  RESERVE.length=0;
  /* ===== landmarks in the city ===== */
  fuelStation(-139,-103,14,48,'بنزينة الميناء',1);fuelStation(60,98,128,160,'بنزينة الحي',-1);
  fishMarket();mosque(-243,129);school(5,128);cafe(158,14);microStand();
  signBoard('فرن العيش',143,6,72,Math.PI/2);signBoard('سوق الخضار',-46,6,62,-Math.PI/2);signBoard('المستوصف',-141,6,192,Math.PI/2);
  billboards();trafficLights();

  /* ===== port ===== */
  const blk=(x0,x1,z0,z1,mh)=>{for(let x=x0+6.1;x+6.1<=x1+.01;x+=12.6)for(let z=z0+1.22;z+1.22<=z1+.01;z+=2.72){const n=1+Math.floor(sr()*mh);for(let k=0;k<n;k++)contData.push([x,1.3+k*2.6,z,CONT[(sr()*CONT.length)|0]]);}col(x0,x1,z0,z1,mh*2.6);};
  blk(-268,-133,-104,-77,4);blk(-108,-33,-104,-40,4);blk(-8,86,-104,-77,3);blk(-8,36,-66,-40,2);blk(-268,-235,-66,-38,2);
  archWarehouse(-224,-188,-70,-38,'#d3c09e','مخازن الميناء');archWarehouse(-180,-140,-70,-38,'#b9c7b2','مخزن رقم ٣');
  ship({x:-90,z:-150,L:150,B:24,y0:-7,hB:6.5,hT:7.5,bottom:'#7d2a22',top:'#22374a',deck:'#46525a',sup:'#e8e5dc',funnel:'#c9302a'});
  for(let x=-150;x<=-45;x+=12.6)for(let z=-160;z<=-141;z+=2.72){const n=1+Math.floor(sr()*3);for(let k=0;k<n;k++)contData.push([x,7+1.3+k*2.6,z,CONT[(sr()*CONT.length)|0]]);}
  ship({x:60,z:-146,L:110,B:18,y0:-6,hB:5,hT:6,bottom:'#7d2a22',top:'#7a2a2a',deck:'#5a4a3a',sup:'#efece4',funnel:'#173f6b'});
  [-230,-160,-60,30,90].forEach(x=>sts(x));
  rtg(-200,-105.6,-75.4);rtg(-160,-105.6,-75.4);rtg(40,-105.6,-75.4);portAdmin();customs();harbourLife();

  /* ===== shipyard ===== */
  shipyard();
  /* containers (instanced) */
  const cm=new T.MeshStandardMaterial({map:texCont,color:'#ffffff',roughness:.7,metalness:.25});
  const inst=new T.InstancedMesh(new T.BoxGeometry(1,1,1),cm,contData.length);inst.castShadow=true;inst.receiveShadow=true;const cc=new T.Color();
  contData.forEach((c,i)=>{_dum.position.set(c[0],c[1],c[2]);_dum.rotation.set(0,0,0);_dum.scale.set(12.2,2.6,2.44);_dum.updateMatrix();inst.setMatrixAt(i,_dum.matrix);cc.set(c[3]);inst.setColorAt(i,cc);});scene.add(inst);

  /* lamps along avenue + streets */
  for(let x=-290;x<=290;x+=26){if(GATES.some(g=>Math.abs(x-g.x)<10)||ST_X.some(s=>Math.abs(x-s)<8))continue;lampsList.push([x,10.2,Math.PI]);lampsList.push([x+13,-10.2,0]);}
  ST_X.forEach(x=>{for(let z=30;z<230;z+=34){if(Math.abs(z-120)<10)continue;lampsList.push([x+5.8,z,-Math.PI/2]);}});
  buildLamps();buildPalms();buildTrees();
  /* gulls */
  for(let i=0;i<10;i++){const g=new T.Group();const m=new T.MeshStandardMaterial({color:'#f2eef0'});const body=new T.Mesh(new T.BoxGeometry(.24,.16,.75),m);g.add(body);const l=new T.Group(),r=new T.Group();const wg=new T.BoxGeometry(.9,.04,.3);wg.translate(-.45,0,0);const wl=new T.Mesh(wg,m);l.add(wl);const wg2=wg.clone();wg2.translate(.9,0,0);r.add(new T.Mesh(wg2,m));g.add(l,r);scene.add(g);gulls.push({g:g,l:l,r:r,cx:rand(-250,150),cz:rand(-200,-130),rad:rand(18,45),y:rand(14,30),sp:rand(.15,.3)*(Math.random()<.5?-1:1),ph:rand(0,6.28)});}
  S.mesh(VC);SM.mesh(VCm);
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
function microStand(){S.box(229,241,3.4,3.6,172,192,'#2a6fb0');[[229.2,172.2],[240.8,172.2],[229.2,191.8],[240.8,191.8]].forEach(p=>S.box(p[0]-.1,p[0]+.1,0,3.4,p[1]-.1,p[1]+.1,'#888'));
  [176,183,189].forEach(z=>{const g=vehicleGeo('micro','#f2f2f2');const m=new T.Mesh(g,VC);m.position.set(235,0,z);m.rotation.y=Math.PI/2;m.castShadow=true;scene.add(m);col(231.5,238.5,z-1.2,z+1.2,2.5);});
  plainSign('موقف الميكروباص',8,1.3,241.3,4.4,182,-Math.PI/2,{bg:'#2a6fb0',glow:true});}
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
  const red='#b8322a',wh='#ece9e1',zc=-92;
  [189,271].forEach(x=>{SM.beam(V(x,0,zc-9),V(x,55,zc-1.6),1.9,red);SM.beam(V(x,0,zc+9),V(x,55,zc+1.6),1.9,red);SM.beam(V(x,20,zc-6),V(x,20,zc+6),.9,red);SM.box(x-2,x+2,0,1.3,zc-10,zc+10,'#3a3a3a');col(x-2.2,x+2.2,zc-10.2,zc+10.2,55);});
  SM.box(185,275,55,60.5,zc-3.2,zc+3.2,red);SM.box(185,275,60.5,61.1,zc-3.4,zc+3.4,wh);
  plainSign('ترسانة الإسكندرية',34,4,230,57.8,zc+3.26,0,{bg:red,border:false,sub:'ALEXANDRIA SHIPYARD',glow:true});plainSign('ترسانة الإسكندرية',34,4,230,57.8,zc-3.26,Math.PI,{bg:red,border:false,sub:'ALEXANDRIA SHIPYARD'});
  const tg=new T.Group();const tm=new T.MeshStandardMaterial({color:wh});const tt=new T.Mesh(NI.box,tm);tt.scale.set(6,3,7.2);tt.position.y=62.6;tg.add(tt);const cbl=new T.Mesh(NI.box,new T.MeshStandardMaterial({color:'#222'}));cbl.scale.set(.12,52,.12);cbl.position.y=35;tg.add(cbl);const hk=new T.Mesh(NI.box,new T.MeshStandardMaterial({color:'#e2a21c'}));hk.scale.set(1.6,1.6,1.6);hk.position.y=8.4;tg.add(hk);
  tg.position.set(230,0,zc);scene.add(tg);trolleys.push({g:tg,a:205,b:255,sp:.06,ph:0,axis:'x'});
  /* hull workshop (drive-in through east door) */
  hall(122,160,-90,-52,15,'#9fb2be','ورشة الهياكل',{z0:-70,z1:-56});
  /* machine shop */
  hall(122,160,-122,-96,13,'#c7b48d','ورشة الماكينات',null);
  /* yard props */
  [[126,142,-36,-24]].forEach(b=>{S.box(b[0],b[1],0,6,b[2],b[3],'#c4602b');S.box(b[0]+.4,b[1]-.4,6,6.4,b[2]+.4,b[3]-.4,'#7a858c');col(b[0],b[1],b[2],b[3],6);});
  for(let i=0;i<8;i++)S.cyl(.22,1.6,125+i*.55,.8,-36,i%2?'#2f6b4f':'#c9302a');
  person({shirt:'#e86a1c',pants:'#2b3a52',skin:'#9a6b4a',helmet:'#f2c230'},178,-103,0);
  campus();}
/* ===== training campus: theory building, workshops, admin ===== */
const texBoard=(title,lines,bg)=>ctex(1024,320,g=>{g.fillStyle=bg||'#1f4a36';g.fillRect(0,0,1024,320);g.strokeStyle='#8a6a3a';g.lineWidth=18;g.strokeRect(9,9,1006,302);g.fillStyle='#f4f1e6';g.textAlign='center';g.direction='rtl';g.font='62px '+GAMEF;g.fillText(title,512,82);g.font='700 40px '+AR;lines.forEach((l,i)=>g.fillText(l,512,156+i*58));});
const texGlassF=ctex(256,256,g=>{const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#6f9cc4');gr.addColorStop(1,'#2d4f72');g.fillStyle=gr;g.fillRect(0,0,256,256);g.fillStyle='#e9eef2';for(let i=0;i<=4;i++){g.fillRect(i*64-3,0,6,256);g.fillRect(0,i*64-4,256,8);}g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(0,256);g.lineTo(256,0);g.lineTo(256,60);g.lineTo(60,256);g.fill();});
const texGlassFLit=ctex(256,256,g=>{g.fillStyle='#000';g.fillRect(0,0,256,256);for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(Math.random()<.45){g.fillStyle=Math.random()<.7?'#ffd59a':'#cfe6ff';g.fillRect(c*64+4,r*64+5,56,54);}});
function campus(){const X0=180,X1=296,Z0=-61,Z1=-16;
  const pv=new T.Mesh(new T.PlaneGeometry(X1-X0,Z1-Z0),new T.MeshStandardMaterial({map:rep(texPave,29,11),roughness:.9}));pv.rotation.x=-Math.PI/2;pv.position.set((X0+X1)/2,.02,(Z0+Z1)/2);pv.receiveShadow=true;scene.add(pv);
  const wallC='#e9dfca';
  segs(Z0,Z1,[[-45,-31]]).forEach(s=>{S.box(X0-.5,X0+.5,0,3,s[0],s[1],wallC);S.box(X0-.6,X0+.6,3,3.25,s[0],s[1],'#0f4a3a');col(X0-.5,X0+.5,s[0],s[1],3.2);});
  S.box(X1-.5,X1+.5,0,3,Z0,Z1,wallC);col(X1-.5,X1+.5,Z0,Z1,3);S.box(X0,X1,0,3,Z0-.5,Z0+.5,wallC);col(X0,X1,Z0-.5,Z0+.5,3);
  /* entrance arch */
  [[-46.5,-45],[-31,-29.5]].forEach(z=>{S.box(X0-.9,X0+.9,0,7.2,z[0],z[1],'#efe7d6');col(X0-.9,X0+.9,z[0],z[1],7.2);});S.box(X0-1.1,X0+1.1,7.2,8.6,-46.5,-29.5,'#0f4a3a');
  plainSign('مركز تدريب ترسانة الإسكندرية',15,1.25,X0-1.12,7.9,-38,-Math.PI/2,{bg:'#0f4a3a',border:'#e8c35a',glow:true});plainSign('أهلاً بكم في مركز التدريب',15,1.25,X0+1.12,7.9,-38,Math.PI/2,{bg:'#0f4a3a',border:'#e8c35a'});
  S.box(X0+2,X0+5,0,2.8,-29.4,-26,'#efe7d6');S.box(X0+1.8,X0+5.2,2.8,3.1,-29.6,-25.8,'#0f4a3a');col(X0+2,X0+5,-29.4,-26,3);person({shirt:'#2d3b4f',pants:'#2d3b4f',skin:'#8f6446',cap:'#24303f'},X0+3.5,-30.2,0);

  /* ---- theory building (glass ground floor, arcade, classrooms you can see into) ---- */
  const tx0=186,tx1=250,tz0=-33,tzg=-28,tz1=-17,gh=4.2,H=12.5;
  const up=new T.Mesh(new T.BoxGeometry(tx1-tx0,H-gh,tz1-tz0),new T.MeshStandardMaterial({map:rep(texFacade,(tx1-tx0)/12,(H-gh)/9),emissiveMap:rep(texFacadeLit,(tx1-tx0)/12,(H-gh)/9),emissive:'#ffffff',emissiveIntensity:.85,color:'#f3e6cf',roughness:.85}));
  up.position.set((tx0+tx1)/2,(gh+H)/2,(tz0+tz1)/2);up.castShadow=up.receiveShadow=true;scene.add(up);S.box(tx0-.3,tx1+.3,H,H+.6,tz0-.3,tz1+.3,'#cdb894');S.box(tx0,tx1,gh-.05,gh+.35,tz0-.6,tz0,'#d9cbb0');
  for(let x=tx0+1;x<=tx1-1;x+=7){S.box(x-.35,x+.35,0,gh,tz0+.2,tz0+.9,'#efe7d6');col(x-.4,x+.4,tz0+.15,tz0+.95,gh);}
  S.box(tx0,tx1,0,gh,tz1-.6,tz1,'#e8dcc4');S.box(tx0,tx0+.6,0,gh,tzg,tz1,'#e8dcc4');S.box(tx1-.6,tx1,0,gh,tzg,tz1,'#e8dcc4');S.box(217.7,218.3,0,gh,tzg,tz1,'#e8dcc4');
  col(tx0,tx1,tzg,tz1,H);
  const fl=new T.Mesh(new T.PlaneGeometry(tx1-tx0,tz1-tzg),new T.MeshStandardMaterial({color:'#cfc8bb',roughness:.6}));fl.rotation.x=-Math.PI/2;fl.position.set((tx0+tx1)/2,.04,(tzg+tz1)/2);scene.add(fl);
  const gl=new T.Mesh(new T.PlaneGeometry(tx1-tx0,gh-.3),new T.MeshStandardMaterial({color:'#bfe0f0',transparent:true,opacity:.2,roughness:.05,metalness:.5,depthWrite:false}));gl.position.set((tx0+tx1)/2,gh/2-.1,tzg);gl.rotation.y=Math.PI;scene.add(gl);
  for(let x=tx0;x<=tx1;x+=4)S.box(x-.06,x+.06,0,gh,tzg-.06,tzg+.06,'#5a6066');S.box(tx0,tx1,0,.35,tzg-.08,tzg+.08,'#5a6066');S.box(tx0,tx1,gh-.4,gh-.1,tzg-.08,tzg+.08,'#5a6066');
  const ce=new T.Mesh(new T.PlaneGeometry(tx1-tx0,tz1-tz0),new T.MeshStandardMaterial({color:'#efe9df',roughness:.9}));ce.rotation.x=Math.PI/2;ce.position.set((tx0+tx1)/2,gh-.03,(tz0+tz1)/2);scene.add(ce);
  for(let x=tx0+3;x<tx1-2;x+=6){const lp=new T.Mesh(NI.box,new T.MeshBasicMaterial({color:'#fffaf0'}));lp.scale.set(3.2,.05,.5);lp.position.set(x,gh-.07,(tzg+tz1)/2);scene.add(lp);}
  /* classroom 1: theory lesson */
  const brd1=new T.Mesh(new T.PlaneGeometry(9,2.6),new T.MeshBasicMaterial({map:texBoard('الكهرباء: قانون أوم',['الجهد = التيار × المقاومة','V = I × R'])}));brd1.position.set(202,2.3,tz1-.65);brd1.rotation.y=Math.PI;scene.add(brd1);
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=191+c*6.6,z=-25.8+r*2.4;S.box(x-1.3,x+1.3,.72,.8,z-.3,z+.3,'#b98b5a');S.box(x-1.25,x-1.15,0,.72,z-.25,z+.25,'#555');S.box(x+1.15,x+1.25,0,.72,z-.25,z+.25,'#555');
    [-.6,.6].forEach(o=>{S.box(x+o-.22,x+o+.22,.42,.48,z-.75,z-.35,'#2e5e8c');person(pick([{shirt:'#2e5e8c',pants:'#2e5e8c',skin:'#b07a55'},{shirt:'#1f6f5c',pants:'#2a3550',skin:'#9c6b48'},{shirt:'#e9e2d0',pants:'#384a63',skin:'#8f6446'},{shirt:'#7a3b5a',pants:'#2a3550',skin:'#c69472',hijab:'#2f4f7a'}]),x+o,z-.55,Math.PI,true).position.y=.48;});}
  person({shirt:'#f4f1ea',pants:'#3b4a63',skin:'#9a6b4a'},211,-19.4,0);
  /* classroom 2: drawing & computer lab */
  const brd2=new T.Mesh(new T.PlaneGeometry(9,2.6),new T.MeshBasicMaterial({map:texBoard('معمل الرسم الفني',['قراءة الرسومات الهندسية','المساقط والقطاعات'],'#1d3550')}));brd2.position.set(234,2.3,tz1-.65);brd2.rotation.y=Math.PI;scene.add(brd2);
  const scr=new T.MeshBasicMaterial({color:'#6fc2ff'});
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=223+c*6.6,z=-25.8+r*2.4;S.box(x-1.3,x+1.3,.72,.8,z-.3,z+.3,'#d9d9d4');S.box(x-1.25,x-1.15,0,.72,z-.25,z+.25,'#555');S.box(x+1.15,x+1.25,0,.72,z-.25,z+.25,'#555');
    [-.6,.6].forEach(o=>{const s=new T.Mesh(NI.box,scr);s.scale.set(.5,.32,.03);s.position.set(x+o,1.0,z+.1);s.rotation.y=Math.PI;scene.add(s);S.box(x+o-.25,x+o+.25,.8,.84,z,z+.25,'#222');});}
  [[227,-23],[240,-20.6]].forEach(p=>person({shirt:'#1f6f5c',pants:'#2a3550',skin:'#b07a55'},p[0],p[1],Math.PI));
  plainSign('مبنى الدراسة النظرية',18,2,218,9.2,tz0-.32,Math.PI,{bg:'#0f4a3a',border:'#e8c35a',glow:true});
  plainSign('قاعة ١',3,.7,202,3.5,tzg-.12,Math.PI,{bg:'#f1ead8',fg:'#0f4a3a',border:false});plainSign('معمل ٢',3,.7,234,3.5,tzg-.12,Math.PI,{bg:'#f1ead8',fg:'#0f4a3a',border:false});
  /* ---- admin & trainee affairs ---- */
  const am=new T.Mesh(new T.BoxGeometry(36,9,13),new T.MeshStandardMaterial({map:rep(texFacade,3,1),emissiveMap:rep(texFacadeLit,3,1),emissive:'#ffffff',emissiveIntensity:.85,color:'#f6efe0',roughness:.85}));am.position.set(274,4.5,-23.5);am.castShadow=am.receiveShadow=true;scene.add(am);col(256,292,-30,-17,9);
  S.box(255.6,292.4,9,9.5,-30.4,-16.6,'#cdb894');S.box(268,280,3.6,4,-33,-30,'#0f4a3a');[268.5,279.5].forEach(x=>{S.cyl(.18,3.6,x,1.8,-32.6,'#efe7d6');col(x-.25,x+.25,-32.9,-32.3,3.6);});S.box(271,277,0,3,-30.06,-30,'#24394a');
  plainSign('الإدارة وشؤون المتدربين',12,1.4,274,7.6,-30.06,Math.PI,{bg:'#0f4a3a',border:'#e8c35a',glow:true});flag(262,-32,10);
  /* ---- workshops (open fronts) ---- */
  shed(186,214,'ورشة الكهرباء','elec');shed(218,246,'ورشة اللحام','weld');shed(250,278,'ورشة الخراطة والتشغيل','lathe');
  plainSign('السلامة أولاً – البس مهمات الوقاية',10,1.6,288,4.4,-44.5,0,{bg:'#f2b705',fg:'#1b1b1b',border:'#1b1b1b',glow:true});S.box(287.8,288.2,0,3.6,-44.7,-44.3,'#444');col(287.6,288.4,-44.8,-44.2,4);
  /* parked staff bus */
  const bus=new T.Mesh(vehicleGeo('bus','#f2f2f2'),VC);bus.position.set(287,0,-38.5);bus.rotation.y=Math.PI/2;bus.castShadow=true;scene.add(bus);col(281.5,292.5,-40,-37,3);
  [[190,-44.6],[284,-31.5]].forEach(p=>palmsList.push([p[0],p[1],7.5]));}
function shed(x0,x1,label,kind){const zf=-46,zb=-60,h=7.5,t=.5;const wm=new T.MeshStandardMaterial({map:rep(texCorr,(x1-x0)/5,1),color:'#a9bcc4',metalness:.25,roughness:.6});const wz=new T.MeshStandardMaterial({map:rep(texCorr,(zf-zb)/5,1),color:'#a9bcc4',metalness:.25,roughness:.6});
  const w=(a,b,c,d,e,f,m)=>{const o=new T.Mesh(NI.box,m);o.position.set((a+b)/2,(c+d)/2,(e+f)/2);o.scale.set(b-a,d-c,f-e);o.castShadow=o.receiveShadow=true;scene.add(o);};
  w(x0,x1,0,h,zb,zb+t,wm);w(x0,x0+t,0,h,zb,zf,wz);w(x1-t,x1,0,h,zb,zf,wz);w(x0,x1,5.6,h,zf-t,zf,wm);col(x0,x1,zb,zb+t,h);col(x0,x0+t,zb,zf,h);col(x1-t,x1,zb,zf,h);
  S.box(x0+t,x0+t+.5,0,5.6,zf-.6,zf,'#f2b705');S.box(x1-t-.5,x1-t,0,5.6,zf-.6,zf,'#f2b705');
  const D=x1-x0;const s=new T.Shape();s.moveTo(-(zb-zf)/2,0);s.lineTo(0,0);s.closePath();
  const rs=new T.Shape();rs.moveTo(-D/2-.6,0);rs.lineTo(D/2+.6,0);rs.lineTo(0,3.2);rs.closePath();const rg=new T.ExtrudeGeometry(rs,{depth:zf-zb+1.2,bevelEnabled:false});
  const r=new T.Mesh(rg,new T.MeshStandardMaterial({map:rep(texCorr,D/4,1),color:'#7b8a92',metalness:.35,roughness:.5}));r.position.set((x0+x1)/2,h,zb-.6);r.castShadow=r.receiveShadow=true;scene.add(r);
  const fl=new T.Mesh(new T.PlaneGeometry(D-1,zf-zb-.6),new T.MeshStandardMaterial({map:rep(texConc,2,1),color:'#9a958c',roughness:.7}));fl.rotation.x=-Math.PI/2;fl.position.set((x0+x1)/2,.03,(zf+zb)/2);fl.receiveShadow=true;scene.add(fl);
  const cx=(x0+x1)/2;S.box(cx-3.2,cx-3.05,.035,.04,zb+1,zf,'#f2c218');S.box(cx+3.05,cx+3.2,.035,.04,zb+1,zf,'#f2c218');
  for(let x=x0+3;x<x1-2;x+=5)S.box(x-1.2,x+1.2,h-.3,h-.22,zb+2,zf-1,'#ffffff');
  plainSign(label,14,1.5,cx,6.6,zf+.02,0,{bg:'#0f4a3a',border:'#e8c35a',glow:true});
  const L=x0+1.2,R=x1-1.2;
  if(kind==='elec'){for(let x=x0+2;x<x1-2;x+=3.2){S.box(x,x+2.6,.2,2.4,zb+.5,zb+1.1,'#9aa3aa');S.box(x+.3,x+2.3,1.2,2.1,zb+1.1,zb+1.12,'#2b3a46');for(let k=0;k<4;k++)S.box(x+.5+k*.45,x+.62+k*.45,1.9,2.0,zb+1.12,zb+1.16,['#ff3b2a','#38ff6a','#ffd23a','#3ec6ff'][k]);}
    col(x0,x1,zb,zb+1.2,2.4);
    [L,R-2.4].forEach(bx=>{S.box(bx,bx+2.4,.85,.95,zb+3,zf-2,'#8a6a4a');S.box(bx+.1,bx+.2,0,.85,zb+3,zf-2,'#555');S.box(bx+2.2,bx+2.3,0,.85,zb+3,zf-2,'#555');
      for(let z=zb+3.6;z<zf-2.5;z+=2.4)S.box(bx+(bx===L?.1:2.2),bx+(bx===L?.2:2.3),.95,2.2,z-.9,z+.9,'#e8e8e2');col(bx,bx+2.4,zb+3,zf-2,2.2);});
    S.box(x0+1,x1-1,5.2,5.3,zb+6,zb+6.6,'#7a7f86');
    plainSign('خطر – كهرباء',2.4,.8,x0+5,3,zb+1.15,0,{bg:'#f2b705',fg:'#1b1b1b',border:'#1b1b1b'});
    [[L+3,zb+6],[R-3,zb+8],[L+3,zb+10]].forEach((p,i)=>person({shirt:'#1f4e8c',pants:'#1f4e8c',skin:['#b07a55','#9c6b48','#8f6446'][i],helmet:'#ffffff'},p[0],p[1],p[0]<cx?-Math.PI/2:Math.PI/2));}
  if(kind==='weld'){for(let i=0;i<4;i++){const bx=x0+2+i*6.2;S.box(bx,bx+.12,0,2.4,zb+.5,zb+4.5,'#3a3d42');S.box(bx+4.8,bx+4.92,0,2.4,zb+.5,zb+4.5,'#3a3d42');S.box(bx+1.4,bx+3.4,.85,.95,zb+1.2,zb+2.4,'#5c6870');
      const cu=new T.Mesh(new T.PlaneGeometry(4.6,2.1),new T.MeshStandardMaterial({color:'#e8641c',transparent:true,opacity:.55,side:T.DoubleSide}));cu.position.set(bx+2.46,1.25,zb+4.5);scene.add(cu);
      if(i===1||i===3)sparksAt(bx+2.4,1.0,zb+1.8,0);person({shirt:'#2e3a4a',pants:'#2e3a4a',skin:'#8a5a3b',helmet:'#1b1b1b'},bx+2.4,zb+3,Math.PI);}
    col(x0+1.8,x1-1.8,zb,zb+4.6,2.4);
    for(let i=0;i<6;i++)S.cyl(.2,1.5,R-.4,.75,zb+6+i*.55,i%2?'#2f6b4f':'#c9302a');col(R-.7,R,zb+5.6,zb+9.2,1.5);
    S.box(L,L+2.2,.8,.9,zb+7,zb+11,'#5c6870');col(L,L+2.2,zb+7,zb+11,1);}
  if(kind==='lathe'){const lathe=(x,z)=>{S.box(x-1.3,x+1.3,.8,1.15,z-.32,z+.32,'#4f6b5a');S.box(x-1.2,x-1.0,0,.8,z-.25,z+.25,'#3b4f44');S.box(x+1.0,x+1.2,0,.8,z-.25,z+.25,'#3b4f44');S.box(x-1.3,x-.6,1.15,1.65,z-.36,z+.36,'#4f6b5a');S.xf(NI.cyl12,x-.45,1.38,z,.32,.2,.32,0,'#b9bec4',0,Math.PI/2);S.box(x+.7,x+1.1,1.15,1.45,z-.18,z+.18,'#4f6b5a');col(x-1.4,x+1.4,z-.5,z+.5,1.7);};
    [zb+3,zb+6.5,zb+10].forEach(z=>{lathe(L+1.6,z);lathe(R-1.6,z);});
    for(let i=0;i<3;i++)S.box(cx-4+i*2.8,cx-2+i*2.8,0,1.6,zb+.5,zb+1.2,'#c9302a');col(cx-4,cx+4.4,zb+.5,zb+1.2,1.6);
    [[L+1.6,zb+4.2],[R-1.6,zb+7.7],[R-1.6,zb+4.2]].forEach((p,i)=>person({shirt:'#2e5e8c',pants:'#2e5e8c',skin:['#9a6b4a','#b07a55','#7f5538'][i],helmet:'#f2c230'},p[0],p[1],Math.PI));}}
/* ===== port extras ===== */
function rtg(x,z0,z1){const w='#e9e7e1',b='#2c6ea6';[[x-6,z0],[x+6,z0],[x-6,z1],[x+6,z1]].forEach(p=>{SM.box(p[0]-.45,p[0]+.45,1,18,p[1]-.45,p[1]+.45,w);SM.box(p[0]-.6,p[0]+.6,0,1.2,p[1]-1.1,p[1]+1.1,'#30343a');});
  [z0,z1].forEach(z=>SM.box(x-6.5,x+6.5,16.5,18,z-.55,z+.55,w));[x-6,x+6].forEach(xx=>SM.box(xx-.6,xx+.6,18,19.4,z0-.6,z1+.6,b));SM.box(x-1.6,x+1.6,19.4,21.2,(z0+z1)/2-1.8,(z0+z1)/2+1.8,w);SM.box(x-6.2,x-4.4,10,12,z1-1.6,z1,'#1f3340');SM.box(x-.06,x+.06,8,19.4,(z0+z1)/2-.06,(z0+z1)/2+.06,'#222');SM.box(x-1.3,x+1.3,7.4,8,(z0+z1)/2-6.1,(z0+z1)/2+6.1,'#e2a21c');}
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
function hall(x0,x1,z0,z1,h,color,label,door){const t=.6;const wm=len=>new T.MeshStandardMaterial({map:rep(texCorr,len/5,1),color:color,metalness:.25,roughness:.6});
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
  const r=new T.Mesh(rg,new T.MeshStandardMaterial({map:rep(texCorr,D/4,(z1-z0)/14),color:'#7b8a92',metalness:.35,roughness:.5}));r.position.set((x0+x1)/2,h,z0-1);r.castShadow=r.receiveShadow=true;scene.add(r);
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
function person(lk,x,z,ry,seated){const m=new T.Mesh(personGeo(lk,seated),VC);m.position.set(x,0,z);m.rotation.y=ry||0;m.castShadow=true;scene.add(m);return m;}

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
let tuk,tukBody,fwPivot,wheels=[],paxSeat,arrow3D,paintMat,headLight;
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
  tukBody=tuk.getObjectByName('Body')||tuk;
  tukNodes.steer=tuk.getObjectByName('SteerF');tukNodes.wf=tuk.getObjectByName('WheelF');tukNodes.wl=tuk.getObjectByName('WheelRL');tukNodes.wr=tuk.getObjectByName('WheelRR');
  setPaint(save.paint);
  sloganMat=new T.MeshStandardMaterial({map:sloganStrip(save.slogan||SLOGANS[0]),roughness:.5});
  const sp=new T.Mesh(new T.PlaneGeometry(.8,.1),sloganMat);sp.position.set(0,.79,1.402);tukBody.add(sp);
  const plate=new T.Mesh(new T.PlaneGeometry(.34,.14),new T.MeshStandardMaterial({map:ctex(256,104,g=>{g.fillStyle='#f4f4f0';g.fillRect(0,0,256,104);g.fillStyle='#1f5fb0';g.fillRect(0,0,256,28);g.fillStyle='#fff';g.font='700 20px '+AR;g.textAlign='center';g.textBaseline='middle';g.fillText('مصر  EGYPT',128,15);g.fillStyle='#111';g.font='48px '+GAMEF;g.direction='rtl';g.fillText('ت ك س  ٥٢٧',128,70);}),roughness:.5}));
  plate.position.set(0,.63,1.412);tukBody.add(plate);
  paxSeat=tuk.getObjectByName('PaxSeatPt')||new T.Group();
  /* headlight glow on the road + lamp halos + turbo flame */
  const cg=new T.PlaneGeometry(3.6,8);cg.rotateX(-Math.PI/2);cg.translate(0,.06,-5.6);
  const ct=ctex(64,128,g=>{const gr=g.createLinearGradient(0,128,0,0);gr.addColorStop(0,'rgba(255,236,190,.5)');gr.addColorStop(1,'rgba(255,236,190,0)');g.fillStyle=gr;g.beginPath();g.moveTo(20,128);g.lineTo(44,128);g.lineTo(64,0);g.lineTo(0,0);g.closePath();g.fill();});
  coneGlow=new T.Mesh(cg,new T.MeshBasicMaterial({map:ct,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));tuk.add(coneGlow);
  headGlow=new T.Group();[-.27,.27].forEach(x=>{const s=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#fff0c8',transparent:true,depthWrite:false,blending:T.AdditiveBlending}));s.scale.set(.6,.6,1);s.position.set(x,.86,-1.47);headGlow.add(s);});tukBody.add(headGlow);
  flame=new T.Sprite(new T.SpriteMaterial({map:texGlow,color:'#ff7a1a',transparent:true,depthWrite:false,blending:T.AdditiveBlending}));flame.position.set(.46,.33,1.52);flame.visible=false;tukBody.add(flame);
  scene.add(tuk);arrow3D=new T.Object3D();buildChev();}
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
function setPaint(id){const p=PAINTS.find(q=>q.id===id);if(p&&paintMat)paintMat.color.set(p.c).convertSRGBToLinear();}

/* ============ vehicle (see vehicle.js) ============ */
const input={up:0,down:0,steerKey:0,joy:0,drift:0,turbo:0,horn:0};
let fuel=100,turbo=1,shake=0,dead=0,skidT=0;
let veh=null,car=null;
const ctl={mode:'touch',sens:1,tilt:0};try{const c=JSON.parse(localStorage.getItem('aps_ctl')||'null');if(c)Object.assign(ctl,c);}catch(e){}
function saveCtl(){try{localStorage.setItem('aps_ctl',JSON.stringify({mode:ctl.mode,sens:ctl.sens}));}catch(e){}}
addEventListener('deviceorientation',e=>{if(e.gamma==null)return;const land=Math.abs((screen.orientation&&screen.orientation.angle)||window.orientation||0)===90;const a=land?(e.beta||0)*((screen.orientation&&screen.orientation.angle)===270||window.orientation===-90?-1:1):(e.gamma||0);ctl.tilt=clamp(-a/22,-1,1);});
let padUsed=false;
function readPad(){const gp=navigator.getGamepads?navigator.getGamepads():[];for(const g of gp){if(!g)continue;const ax=g.axes[0]||0,rt=g.buttons[7]?g.buttons[7].value:0,lt=g.buttons[6]?g.buttons[6].value:0;
  if(Math.abs(ax)>.12||rt>.1||lt>.1||g.buttons[0]?.pressed)padUsed=true;if(!padUsed)return;
  input.joy=Math.abs(ax)>.12?-ax:0;input.up=rt>.15?1:0;input.down=lt>.15?1:0;input.drift=g.buttons[0]?.pressed?1:0;input.turbo=(g.buttons[1]?.pressed||g.buttons[5]?.pressed)?1:0;input.horn=g.buttons[3]?.pressed?1:0;return;}}
function updateCar(dt){const fuelOk=fuel>0;veh.turbo=turbo;readPad();
  const joySave=input.joy;if(ctl.mode==='tilt'&&!padUsed)input.joy=ctl.tilt;input.joy*=ctl.sens;input.steerKey*=1;
  veh.update(dt,input,fuelOk);input.joy=joySave;
  const dist=Math.abs(car.v)*dt;fuel=Math.max(0,fuel-dist*TUNING.fuelPerMeter*(car.boost?2:1)-(car.thr?dt*TUNING.fuelIdlePerSec:0));
  turbo=car.boost?Math.max(0,turbo-dt*.16):Math.min(1,turbo+dt*.07);}
function syncTuk(){if(!tuk||!car)return;syncModel(tuk,tukNodes,car);if(tukBody&&tukBody!==tuk)tukBody.position.y=Math.sin(clock*38)*.004*(1+Math.abs(car.v)*.06);}
const SAFE=[];Object.values(NODES).forEach(n=>SAFE.push(n));
function resetToRoad(){let best=null,bd=1e9;for(const n of SAFE){const d=Math.hypot(n.x-car.x,n.z-car.z);if(d<bd){bd=d;best=n;}}veh.teleport(best.x,best.z,car.h);snapCam=true;}

/* ============ traffic ============ */
const traffic=[];
function laneLoop(pts,off){const out=[];const n=pts.length;for(let i=0;i<n;i++){const p=pts[i],a=pts[(i-1+n)%n],b=pts[(i+1)%n];const d1x=Math.sign(p[0]-a[0]),d1z=Math.sign(p[1]-a[1]),d2x=Math.sign(b[0]-p[0]),d2z=Math.sign(b[1]-p[1]);out.push([p[0]+(-d1z-d2z)*off,p[1]+(d1x+d2x)*off]);}return out;}
function mkPath(pts){const L=[];let tot=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];const l=Math.hypot(b[0]-a[0],b[1]-a[1]);L.push(l);tot+=l;}return {pts:pts,L:L,tot:tot};}
function pathAt(P,s,o){s=((s%P.tot)+P.tot)%P.tot;for(let i=0;i<P.pts.length;i++){if(s<=P.L[i]){const a=P.pts[i],b=P.pts[(i+1)%P.pts.length],t=s/P.L[i];o.x=a[0]+(b[0]-a[0])*t;o.z=a[1]+(b[1]-a[1])*t;o.dx=(b[0]-a[0])/P.L[i];o.dz=(b[1]-a[1])/P.L[i];return o;}s-=P.L[i];}return o;}
function initTraffic(){
  const loops=[
    {p:mkPath([[-292,7],[292,7],[292,-7],[-292,-7]]),n:7,sp:11},
    {p:mkPath([[-282,3],[282,3],[282,-3],[-282,-3]]),n:6,sp:12.5},
    {p:mkPath(laneLoop([[-50,0],[50,0],[50,120],[-50,120]],3)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[150,0],[250,0],[250,120],[150,120]],3)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[-250,0],[-150,0],[-150,120],[-250,120]],3)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[-250,120],[-50,120],[-50,235],[-250,235]],2.5)),n:3,sp:8.5},
    {p:mkPath(laneLoop([[50,120],[250,120],[250,235],[50,235]],2.5)),n:3,sp:8.5},
    {p:mkPath(laneLoop([[-150,120],[150,120],[150,235],[-150,235]],2.5)),n:2,sp:8.5},
    {p:mkPath(laneLoop([[-230,-30],[40,-30],[40,0],[-230,0]],2.5)),n:3,sp:7,truck:true},
    {p:mkPath(laneLoop([[-120,-30],[-20,-30],[-20,-112],[-120,-112]],2.5)),n:2,sp:6.5,truck:true}];
  /* avenue loops drive on the outer lanes, fix their offsets: they already include lane z */
  const kinds=[['taxi','#f2c218'],['taxi','#f2c218'],['sedan','#e9e9e9'],['sedan','#2e5e8c'],['sedan','#b23a2a'],['sedan','#3a3a3a'],['micro','#f2f2f2'],['tuk','#2a6fb0'],['tuk','#c9302a'],['tuk','#f09a1a'],['tuk','#1f7a4a'],['sedan','#c9b48a']];
  loops.forEach(L=>{for(let i=0;i<L.n;i++){let k=L.truck?['truck',pick(['#e9e6dd','#c9302a','#2e5e8c']),pick(CONT)]:pick(kinds);const g=vehicleGeo(k[0],k[1],k[2]);const m=new T.Mesh(g,VC);m.castShadow=true;scene.add(m);
    const big=k[0]==='truck'||k[0]==='micro';const nc=k[0]==='truck'?4:(k[0]==='tuk'?1:2);const circ=[];for(let j=0;j<nc;j++)circ.push({x:0,z:0,o:k[0]==='truck'?-6.5+j*4.3:(nc===1?0:(j?1.3:-1.3))});
    traffic.push({kind:k[0],m:m,P:L.p,s:L.p.tot*(i/L.n)+rand(0,20),v:L.sp,sp:L.sp*rand(.85,1.1),circ:circ,r:big?1.4:(k[0]==='tuk'?.9:1.1),len:k[0]==='truck'?8:3,hx:0,hz:-1,x:0,z:0});}});
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
    const m=new T.Mesh(personGeo(pick(looks),false),VC);m.castShadow=true;scene.add(m);walkers.push({m:m,a:a,b:b,f:fixed,ax:alongX,t:Math.random(),dir:1,sp:rand(.9,1.4)/(b-a)});}}
function updateWalkers(dt){for(const w of walkers){w.t+=w.dir*w.sp*dt;if(w.t>1){w.t=1;w.dir=-1;}if(w.t<0){w.t=0;w.dir=1;}const p=w.a+(w.b-w.a)*w.t;
  if(w.ax){w.m.position.set(p,Math.abs(Math.sin(clock*7+w.a))*.05,w.f);w.m.rotation.y=w.dir>0?-Math.PI/2:Math.PI/2;}else{w.m.position.set(w.f,Math.abs(Math.sin(clock*7+w.a))*.05,p);w.m.rotation.y=w.dir>0?Math.PI:0;}}}

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
function updateCam(dt){const vh=Math.atan2(-car.vx,-car.vz);const spd=Math.hypot(car.vx,car.vz);const hh=(spd>3&&car.v>0?lerpAng(car.h,vh,.35):car.h)+camYaw;const fx=-Math.sin(hh),fz=-Math.cos(hh);
  if(camMode===2){const cf=-Math.sin(car.h),cz=-Math.cos(car.h);tv.set(car.x+cf*.42,car.y+1.74,car.z+cz*.42);tl.set(car.x+fx*12,car.y+1.3,car.z+fz*12);camPos.copy(tv);camLook.lerp(tl,snapCam?1:1-Math.exp(-dt*14));}
  else{const dist=(camMode===1?10.5:6.3)+(car.boost?1.2:0),hgt=camMode===1?4.8:2.75;let t=1;for(let i=0;i<8;i++){tv.set(car.x-fx*dist*t,hgt*(.75+.25*t),car.z-fz*dist*t);if(!insideTall(tv.x,tv.y,tv.z))break;t-=.12;}
    tl.set(car.x+fx*4,1.2,car.z+fz*4);if(snapCam){camPos.copy(tv);camLook.copy(tl);}else{camPos.lerp(tv,1-Math.exp(-dt*5));camLook.lerp(tl,1-Math.exp(-dt*10));}}
  snapCam=false;if(!dragging)camYaw*=Math.exp(-dt*1.8);camera.position.copy(camPos);
  if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.25;camera.position.y+=(Math.random()-.5)*shake*.2;shake=Math.max(0,shake-dt*2.5);}
  camera.lookAt(camLook);const tf=baseFov+(car.boost?9:0)+Math.min(6,spd*.25);camera.fov+=(tf-camera.fov)*Math.min(1,dt*4);camera.updateProjectionMatrix();}
function lerpAng(a,b,t){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*t;}

/* ============ audio ============ */
const A={ctx:null,muted:false};
function initAudio(){if(A.ctx){if(A.ctx.state!=='running')A.ctx.resume().catch(()=>{});return;}const C=window.AudioContext||window.webkitAudioContext;if(!C){A.fail=true;return;}let ctx;try{ctx=new C();}catch(e){A.fail=true;return;}A.ctx=ctx;
  A.master=ctx.createGain();A.master.gain.value=.9;A.master.connect(ctx.destination);
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
  A.eng.eg.gain.setTargetAtTime(fuel<=0?0:.075+(thr?.05:0)+sp*.004,t,.1);A.hornG.gain.setTargetAtTime(input.horn?.16:0,t,.015);
  A.skidG.gain.setTargetAtTime(Math.min(.25,Math.max(0,Math.abs(car.lat)-1.5)*.05),t,.05);A.turboG.gain.setTargetAtTime(car.boost?.05:0,t,.08);}
function blip(kind,s){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime;
  if(kind==='thud'){const src=ctx.createBufferSource();src.buffer=A.noise;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=380;const g=ctx.createGain();g.gain.setValueAtTime(Math.min(1,.25+s*.08),t);g.gain.exponentialRampToValueAtTime(.001,t+.35);src.connect(f);f.connect(g);g.connect(A.sfx);src.start(t);src.stop(t+.4);}
  else{const notes=kind==='cash'?[880,1174.7,1568]:[660,880];notes.forEach((fq,i)=>{const o=ctx.createOscillator();o.type='triangle';o.frequency.value=fq;const g=ctx.createGain();g.gain.setValueAtTime(.0001,t+i*.09);g.gain.exponentialRampToValueAtTime(.2,t+i*.09+.01);g.gain.exponentialRampToValueAtTime(.0001,t+i*.09+.5);o.connect(g);g.connect(A.sfx);o.start(t+i*.09);o.stop(t+i*.09+.55);});}}
function setMute(m){A.muted=m;if(A.ctx)A.master.gain.setTargetAtTime(m?0:.9,A.ctx.currentTime,.05);$('bMute').classList.toggle('off',m);if(m&&Speech.ok)try{speechSynthesis.cancel();}catch(e){}}

/* radio music (maqam synth) */
const SCALES={hijaz:{root:146.83,c:[0,100,400,500,700,800,1000]},rast:{root:130.81,c:[0,200,350,500,700,900,1050]}};
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
function say(text,o){if(A.muted||!Speech.ok||!Speech.enabled)return false;try{speechSynthesis.cancel();if(speechSynthesis.paused)speechSynthesis.resume();const u=new SpeechSynthesisUtterance(text);const v=o.female?Speech.voiceF:Speech.voiceM;if(v||Speech.voice){u.voice=v||Speech.voice;u.lang=u.voice.lang;}else u.lang='ar-EG';u.pitch=o.pitch||1;u.rate=o.rate||1;u.onend=u.onerror=()=>{o.onend&&o.onend();};speechSynthesis.speak(u);return true;}catch(e){return false;}}

/* radio */
const RST=[{id:'quran',name:'إذاعة القرآن الكريم',kind:'file',idents:['إذاعة القرآن الكريم من القاهرة']},
  {id:'sharq',name:'إذاعة الشرق الأوسط',kind:'synth',maqam:'hijaz',tempo:104,rhythm:'maqsum',voice:'oud',idents:['إذاعة الشرق الأوسط من القاهرة','معاكم إذاعة الشرق الأوسط']},
  {id:'nogoum',name:'نجوم إف إم',kind:'synth',maqam:'rast',tempo:112,rhythm:'maqsum',voice:'oud',idents:['نجوم إف إم','معاكم نجوم إف إم، مية وستة من عشرة',arTime]}];
const NEEDLE=['17%','50%','83%'];const radio={on:false,idx:2,vol:.7,buffers:{},src:null,nextIdent:0,identSpeaking:false};
function arTime(){const d=new Date();let h=d.getHours(),m=d.getMinutes();const H=['الثانية عشرة','الواحدة','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة','الحادية عشرة'];let part;const per=h<12?'صباحًا':(h<15?'ظهرًا':'مساءً');
  if(m<8)part='تمامًا';else if(m<23)part='والربع';else if(m<38)part='والنصف';else if(m<53){part='إلا ربعًا';h++;}else{part='تقريبًا';h++;}return 'الساعة دلوقتي '+H[h%12]+' '+part+' '+per;}
function buildRadioUI(){const box=$('stations');RST.forEach((s,i)=>{const b=document.createElement('button');b.className='st';b.textContent=s.name;b.id='st'+i;b.addEventListener('click',()=>{if(!radio.on)radioPower(true);tuneTo(i);});box.appendChild(b);});
  $('rPower').addEventListener('click',()=>radioPower(!radio.on));$('rClose').addEventListener('click',()=>{$('radio').hidden=true;$('bRadio').classList.remove('on');});
  $('rVol').addEventListener('input',e=>{radio.vol=e.target.value/100;radioLevel();});$('rLoad').addEventListener('click',()=>$('rFile').click());
  $('rUrlSave').addEventListener('click',()=>{const v=$('rUrl').value.trim(),id=RST[radio.idx].id;try{if(v)localStorage.setItem('aps_custom_'+id,v);else localStorage.removeItem('aps_custom_'+id);}catch(e){}if(!radio.on)radioPower(true);tuneTo(radio.idx);});
  $('rFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;initAudio();const st=RST[radio.idx];$('rNote').textContent='بيحمّل '+f.name+'…';const fr=new FileReader();fr.onload=()=>{A.ctx.decodeAudioData(fr.result.slice(0),buf=>{radio.buffers[st.id]={buf:buf,name:f.name};if(!radio.on)radioPower(true);tuneTo(radio.idx);},()=>{$('rNote').textContent='الملف ده مش مدعوم. جرّب MP3 أو M4A.';});};fr.readAsArrayBuffer(f);e.target.value='';});}
function radioUI(){$('rPower').setAttribute('aria-pressed',radio.on);$('rPower').textContent=radio.on?'شغّال':'مقفول';RST.forEach((s,i)=>$('st'+i).classList.toggle('on',radio.on&&i===radio.idx));$('needle').style.left=NEEDLE[radio.idx];
  const st=RST[radio.idx],b=radio.buffers[st.id];let note;
  if(b)note='شغّال من جهازك: '+b.name;
  else if(radio.live)note='🔴 بث مباشر الآن: '+radio.liveName;
  else if(radio.liveState)note=radio.liveState+(radio.liveBusy?'':(st.kind==='file'?' — تقدر تحمّل تلاوة من جهازك.':' — شغالين مؤقتًا على محاكاة المحطة.'));
  else note=st.kind==='file'?'حمّل تلاوة من جهازك.':'محاكاة لروح المحطة.';
  if(A.fail)note='المتصفح ده مش بيدعم الصوت. افتح اللعبة في Chrome أو Edge.';
  $('rNote').textContent=note;let cu='';try{cu=localStorage.getItem('aps_custom_'+st.id)||'';}catch(e){}$('rUrl').value=cu;
  $('rLoad').textContent=st.kind==='file'?'حمّل تلاوة من جهازك':'شغّل تسجيل من جهازك';if(onairT<=0){const oa=$('onair');if(radio.on&&state==='play'){oa.hidden=false;oa.textContent=(radio.live?'🔴 مباشر • ':'')+(b?st.name+' • '+b.name:st.name);}else oa.hidden=true;}}
function radioLevel(){const duck=(Dlg.cur?.32:1)*(radio.identSpeaking?.45:1);if(liveEl)liveEl.volume=radio.on&&radio.live?clamp(radio.vol*(Dlg.cur?.4:1),0,1):0;if(!A.ctx)return;A.radioVol.gain.setTargetAtTime(radio.on&&!radio.live?radio.vol*duck:0,A.ctx.currentTime,.12);}
const LIVEQ={quran:['القرآن الكريم من القاهرة','القرآن الكريم','Quran Cairo'],sharq:['الشرق الأوسط','الشرق الاوسط','Middle East','Sharq','El Sharq'],nogoum:['نجوم','Nogoum','Nogoom','Nojoom']};
const RB=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
let liveEl=null,liveTok=0;
function liveAudio(){if(!liveEl){liveEl=new Audio();liveEl.preload='none';liveEl.addEventListener('playing',()=>{if(liveEl._tok!==liveTok)return;radio.live=true;radio.liveName=liveEl._name;if(A.ctx)A.staticG.gain.setTargetAtTime(0,A.ctx.currentTime,.1);radioLevel();radioUI();});
  liveEl.addEventListener('error',()=>{if(liveEl._tok===liveTok&&radio.live)liveFail('البث اتقطع، اضغط على المحطة تاني');});}return liveEl;}
async function fetchJ(u,ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(u,{signal:c.signal});return await r.json();}finally{clearTimeout(t);}}
async function findStreams(id){const out=[],seen=new Set();try{const m=localStorage.getItem('aps_custom_'+id);if(m){out.push({url:m,name:'رابط مخصص'});seen.add(m);}}catch(e){}
  try{const okU=localStorage.getItem('aps_ok_'+id);if(okU&&!seen.has(okU)){seen.add(okU);out.push({url:okU,name:'آخر بث اشتغل'});}}catch(e){}
  const add=arr=>{(arr||[]).forEach(x=>{const u=x.url_resolved||x.url;if(u&&!seen.has(u)&&x.lastcheckok!==0){seen.add(u);out.push({url:u,name:x.name});}});};
  for(const srv of RB){let dead=false;
    for(const q of LIVEQ[id]){try{add(await fetchJ(srv+'/json/stations/search?countrycode=EG&order=clickcount&reverse=true&limit=8&name='+encodeURIComponent(q),6000));}catch(e){dead=true;break;}if(out.length>=6)break;}
    if(!dead&&out.length<2){for(const q of LIVEQ[id].slice(0,2)){try{add(await fetchJ(srv+'/json/stations/search?order=clickcount&reverse=true&limit=5&name='+encodeURIComponent(q),6000));}catch(e){}}}
    if(out.length>(localStorage.getItem?0:0)&&!dead)return out;if(dead&&location.protocol==='https:')return out;}
  return out;}
async function liveTry(i){const tok=++liveTok;radio.live=false;radio.liveBusy=true;radio.liveState='بيدوّر على البث المباشر…';radioUI();const st=RST[i];let list=[];try{list=await findStreams(st.id);}catch(e){}
  if(tok!==liveTok||!radio.on||radio.idx!==i)return;
  if(!list.length){radio.liveBusy=false;liveFail(location.protocol==='https:'?'البث المباشر مش متاح جوه Claude؛ افتح ملف اللعبة في Chrome':'مش لاقي بث للمحطة دي دلوقتي');return;}
  const a=liveAudio();
  for(let k=0;k<list.length;k++){if(tok!==liveTok)return;const c=list[k];a._tok=tok;a._name=c.name;radio.liveState='بيجرّب بث '+(k+1)+' من '+list.length+': '+c.name;radioUI();
    const ok=await new Promise(res=>{let done=false;const fin=v=>{if(done)return;done=true;a.removeEventListener('playing',onP);a.removeEventListener('error',onE);clearTimeout(t);res(v);};
      const onP=()=>fin(true),onE=()=>fin(false);a.addEventListener('playing',onP);a.addEventListener('error',onE);const t=setTimeout(()=>fin(false),8000);
      try{a.src=c.url;a.volume=radio.vol;const pr=a.play();if(pr)pr.catch(()=>fin(false));}catch(e){fin(false);}});
    if(tok!==liveTok)return;if(ok){try{localStorage.setItem('aps_ok_'+st.id,c.url);}catch(e){}return;}}
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
    radio.identSpeaking=say(txt,{pitch:.82,rate:.88,onend:()=>{radio.identSpeaking=false;radioLevel();}});radioLevel();radio.nextIdent=clock+rand(40,75);}}

/* dialogue */
const Dlg={q:[],cur:null,t:0,minT:0,maxT:0,done:false,gap:0};
function dlgPush(lines,pax){lines.forEach(l=>Dlg.q.push({who:l[0],text:l[1],pax:pax}));}
function dlgStart(it){Dlg.cur=it;Dlg.t=0;Dlg.done=false;const len=it.text.length;Dlg.minT=1.3+len*.05;Dlg.maxT=Math.max(Dlg.minT,len*.12+2.4);$('dialog').hidden=false;const w=$('dWho');w.className='who'+(it.who==='d'?' d':'');w.textContent=it.who==='d'?'الاسطى':it.pax.name;$('dText').textContent=it.text;radio.identSpeaking=false;
  const pr=it.who==='d'?{pitch:.95,rate:1.05}:{pitch:it.pax.pitch,rate:it.pax.rate||1,female:it.pax.female};if(!say(it.text,Object.assign(pr,{onend:()=>{Dlg.done=true;}})))Dlg.done=true;radioLevel();}
function dlgUpdate(dt){if(Dlg.cur){Dlg.t+=dt;if((Dlg.done&&Dlg.t>=Dlg.minT)||Dlg.t>=Dlg.maxT){Dlg.cur=null;Dlg.gap=.25;if(!Dlg.q.length){$('dialog').hidden=true;radioLevel();}}}else if(Dlg.q.length){Dlg.gap-=dt;if(Dlg.gap<=0)dlgStart(Dlg.q.shift());}}
function dlgClear(){Dlg.q.length=0;Dlg.cur=null;$('dialog').hidden=true;if(Speech.ok)try{speechSynthesis.cancel();}catch(e){}}

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
const HIT_L=['حاسب يا اسطى! هتودّينا في داهية','براحة يا معلم، إحنا مش في سباق','يا ساتر يا رب! خلّي بالك من الطريق'];
const FAST_L=['بالراحة يا اسطى، مش مستعجلين على آخرتنا','هدّي شوية الله يخليك، قلبي وقع','إيه ده يا اسطى! التوكتوك ده فيه موتور طيارة؟'];
const RADIO_L=['الله! صوت الراديو ده بيفكرني بأيام زمان','علّي الراديو شوية يا اسطى، الإذاعة دي حلوة','هنا القاهرة… ياه، أيام ما كنا بنسمعها مع أبويا'];
const GUARD={name:'أمن البوابة',pitch:.72,rate:.95},WALKER={name:'واحد ماشي',pitch:1.05,rate:1.1};
const GUARD_IN=[[['p','مساء الخير يا اسطى، التصريح معاك؟'],['d','أيوه يا باشا، اتفضل'],['p','تمام، اتفضل. وخلّي سرعتك هادية جوه']],[['p','على فين يا اسطى؟'],['d','موصّل زبون جوه يا فندم'],['p','ماشي، بالراحة على الرصيف']],[['p','صباح الفل يا اسطى، اتفضل عدّي']]];
const GUARD_OUT=[[['p','مع السلامة يا اسطى']],[['p','في رعاية الله، وخلّي بالك من الزحمة برّه']]];
const CAMPUS_IN=[[['p','أهلاً يا اسطى، المتدربين كتير جوه، هدّي السرعة'],['d','حاضر يا باشمهندس']],[['p','اتفضل، بس متقرّبش من الورش وهي شغالة'],['d','تحت أمرك']]];
const WALK_L=['حاسب يا اسطى!','براحة يا عم، كنت هتخبطني!','يا جدع بص قدامك!'];
const HAIL_L=['يا توكتوك! يا اسطى!','اسطى! استنى عندك!','يا اسطى، فاضي؟'];
const AREA_C={campus:['مركز التدريب ده خرّج أجيال من أشطر الفنيين','الورش هنا فيها مكن حديث، والمدربين على أعلى مستوى'],yard:['الترسانة دي تاريخ، ياما بنت وصلّحت مراكب','شايف الونش الأحمر ده؟ بيرفع بلوكات المراكب كلها'],port:['الميناء النهارده زحمة حاويات','المراكب دي جاية من آخر الدنيا'],city:['الحمد لله طلعنا من الزحمة','الشارع ده كان كله جناين زمان']};
function areaOf(x,z){if(z<-16){if(x>180&&z>-61)return 'campus';if(x>115)return 'yard';return 'port';}return 'city';}
const guardCd={};let walkCd=0,hailCd=0;
function interactions(dt){walkCd-=dt;hailCd-=dt;const quiet=!Dlg.cur&&!Dlg.q.length;
  for(const g of GATES){if(Math.abs(car.x-g.x)<6&&car.z>-21&&car.z<-11&&(guardCd[g.x]||0)<clock&&quiet){if(car.vz<-1.2){dlgPush(pick(GUARD_IN),GUARD);guardCd[g.x]=clock+45;}else if(car.vz>1.2){dlgPush(pick(GUARD_OUT),GUARD);guardCd[g.x]=clock+45;}}}
  if(Math.abs(car.z+38)<6&&car.x>176&&car.x<186&&car.vx>1.2&&(guardCd.c||0)<clock&&quiet){dlgPush(pick(CAMPUS_IN),GUARD);guardCd.c=clock+45;}
  if(walkCd<=0&&Math.abs(car.v)>5&&Dlg.q.length<2){for(const w of walkers){if(Math.hypot(w.m.position.x-car.x,w.m.position.z-car.z)<2.6){dlgPush([['p',pick(WALK_L)]],WALKER);walkCd=10;break;}}}
  if(!fare&&hailCd<=0&&quiet){for(const w of waiting){const p=POI[w.poi],d=Math.hypot(p.x-car.x,p.z-car.z);if(!w.hailed&&d>12&&d<35){w.hailed=true;dlgPush([['p',pick(HAIL_L)]],{name:w.name,pitch:w.type.pitch,female:w.type.female});hailCd=12;break;}}}
  if(fare&&fare.phase==='ride'){const a=areaOf(car.x,car.z);if(a!==fare.area){fare.area=a;if(Math.random()<.6&&quiet)dlgPush([['p',pick(AREA_C[a])]],fare.pax);}}}
const waiting=[];let fare=null;const MAXW=6;
const beamMat=new T.MeshBasicMaterial({color:'#fff1c8',transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
const beamGeo=new T.CylinderGeometry(1.6,1.6,60,20,1,true);beamGeo.translate(0,30,0);
let destBeam,destRing;
function spawnWaiting(){const keys=Object.keys(POI).filter(k=>!waiting.some(w=>w.poi===k)&&(!fare||fare.to!==k)&&Math.hypot(POI[k].x-car.x,POI[k].z-car.z)>40);if(!keys.length)return;
  const k=pick(keys),p=POI[k];const ty=pick(PT);const lk=ty.look;const m=person(lk,p.x+p.sx,p.z+p.sz,Math.atan2(-(p.x-(p.x+p.sx)),-(p.z-(p.z+p.sz))));const b=new T.Mesh(beamGeo,beamMat);b.position.set(p.x,0,p.z);scene.add(b);
  waiting.push({poi:k,type:ty,name:pick(ty.names),m:m,b:b});}
function startFare(w){const opts=Object.keys(POI).filter(k=>k!==w.poi&&Math.hypot(POI[k].x-POI[w.poi].x,POI[k].z-POI[w.poi].z)>110);let to=opts.filter(k=>w.type.likes.includes(k));to=to.length&&Math.random()<.75?pick(to):pick(opts);
  const r=route(POI[w.poi].x,POI[w.poi].z,POI[to].x,POI[to].z);fare={pax:Object.assign({name:w.name},w.type),from:w.poi,to:to,len:r.len,t:0,budget:Math.round(r.len/7.5+22),hits:0,fast:0,chat:rand(9,13),fastCd:0,phase:'board',wait:1.2};
  scene.remove(w.m);scene.remove(w.b);waiting.splice(waiting.indexOf(w),1);
  paxSeat.clear();const s=new T.Mesh(personGeo(w.type.look,true),VC);s.castShadow=true;paxSeat.add(s);
  const d=POI[to].n;const intro=[['p',pick(INTRO_P).replace('{d}',d)],['d',pick(INTRO_D).replace('{t}',w.type.title)]];if(Math.random()<.4)intro.push(['d',pick(INTRO_D2)]);dlgPush(intro,fare.pax);fare.area=areaOf(car.x,car.z);
  destBeam.position.set(POI[to].x,0,POI[to].z);destRing.position.set(POI[to].x,.15,POI[to].z);destBeam.visible=destRing.visible=true;gpsRoute=null;blip('ok');}
function finishFare(){const f=fare;let r=5-f.hits*.6-Math.min(2,f.fast)*.3;const late=f.t>f.budget;if(late)r-=1.2;r=clamp(r,1,5);
  const base=Math.round((12+f.len/1000*14)/5)*5;const bonus=late?0:Math.round((f.budget-f.t)*.4/5)*5;const tip=r>=4.5?10:0;const pay=base+Math.max(0,bonus)+tip;
  save.wallet+=pay;save.total+=pay;save.trips++;persist();dlgPush((late?pick(END_LATE):pick(END_SEQ)).map(l=>[l[0],l[1].replace('{t}',f.pax.title)]),f.pax);blip('cash');
  toast('+'+pay+' ج.م'+(tip?'  • بقشيش':'')+(late?'  • متأخر':''),'good');paxSeat.clear();destBeam.visible=destRing.visible=false;fare=null;gpsRoute=null;updateMoney();}
function onImpact(s){blip('thud',s);if(fare&&fare.phase==='ride'){fare.hits++;if(Dlg.q.length<2)dlgPush([['p',pick(HIT_L)]],fare.pax);}}
let nearMsgT=0,stopHint=0;
function updateFares(dt){interactions(dt);for(let i=0;i<3&&waiting.length<MAXW;i++)spawnWaiting();
  for(const w of waiting){w.m.rotation.y=Math.atan2(-(car.x-w.m.position.x),-(car.z-w.m.position.z))+Math.PI;}
  if(fare){fare.t+=dt;if(fare.phase==='board'){fare.wait-=dt;if(fare.wait<=0&&!Dlg.q.length)fare.phase='ride';}
    else{const p=POI[fare.to],d=Math.hypot(p.x-car.x,p.z-car.z);if(d<5.5){if(Math.abs(car.v)<1.4){finishFare();return;}else if(stopHint<=0){toast('هدّي ووقّف عند العمود');stopHint=3;}}
      fare.chat-=dt;if(fare.chat<=0&&!Dlg.cur&&!Dlg.q.length){dlgPush([['p',radio.on&&Math.random()<.3?pick(RADIO_L):pick(fare.pax.ride)]],fare.pax);fare.chat=rand(14,22);}
      fare.fastCd-=dt;if(Math.abs(car.v)*3.6>48&&fare.fastCd<=0){fare.fastCd=10;fare.fast++;dlgPush([['p',pick(FAST_L)]],fare.pax);}}}
  else{for(const w of waiting){const p=POI[w.poi];if(Math.hypot(p.x-car.x,p.z-car.z)<5.5){if(Math.abs(car.v)<1.4){startFare(w);break;}else if(stopHint<=0){toast('وقّف عشان الزبون يركب');stopHint=3;}}}}
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
const ROADSEG=[];EDGES.forEach(e=>ROADSEG.push([e.a.x,e.a.z,e.b.x,e.b.z,e.kind==='ave'?22:10]));ROADSEG.push([-300,0,-290,0,22],[290,0,300,0,22]);
let navTarget=null,hudT=0,lastSpd=-1;
function drawGPS(){const W=gps.width,H=gps.height;if(!W)return;const sc=W/2/95;gg.save();gg.clearRect(0,0,W,H);gg.beginPath();gg.arc(W/2,H/2,W/2,0,7);gg.clip();gg.fillStyle='#0f2433';gg.fillRect(0,0,W,H);
  gg.translate(W/2,H/2+W*.12);const fx=-Math.sin(car.h),fz=-Math.cos(car.h);gg.rotate(-Math.PI/2-Math.atan2(fz,fx));gg.scale(sc,sc);gg.translate(-car.x,-car.z);
  gg.fillStyle='#2b4f7a';gg.fillRect(-900,-900,1800,775);
  gg.lineCap='round';gg.strokeStyle='#5c7184';for(const r of ROADSEG){gg.lineWidth=r[4];gg.beginPath();gg.moveTo(r[0],r[1]);gg.lineTo(r[2],r[3]);gg.stroke();}
  gg.strokeStyle='#e7c23a';gg.lineWidth=4;gg.beginPath();gg.moveTo(-300,0);gg.lineTo(300,0);gg.stroke();
  if(gpsRoute){gg.strokeStyle=fare?'#3ec6ff':'#ffb347';gg.lineWidth=5;gg.beginPath();gg.moveTo(car.x,car.z);for(let i=gpsIdx;i<gpsRoute.pts.length;i++)gg.lineTo(gpsRoute.pts[i][0],gpsRoute.pts[i][1]);gg.stroke();}
  for(const w of waiting){const p=POI[w.poi];gg.fillStyle='#ff4a4a';gg.beginPath();gg.arc(p.x,p.z,6,0,7);gg.fill();}
  for(const s of STATIONS_F){gg.fillStyle='#f2b705';gg.fillRect(s.sx-6,s.sz-6,12,12);}
  if(fare){const p=POI[fare.to];gg.fillStyle='#4cff5e';gg.beginPath();gg.arc(p.x,p.z,8,0,7);gg.fill();}
  gg.restore();gg.save();gg.translate(W/2,H/2+W*.12);gg.fillStyle='#ffffff';gg.strokeStyle='#0f2433';gg.lineWidth=2*gpsDpr;gg.beginPath();gg.moveTo(0,-9*gpsDpr);gg.lineTo(7*gpsDpr,7*gpsDpr);gg.lineTo(0,3*gpsDpr);gg.lineTo(-7*gpsDpr,7*gpsDpr);gg.closePath();gg.fill();gg.stroke();gg.restore();}
function updateHUD(dt){const sp=Math.round(Math.abs(car.v)*3.6);if(sp!==lastSpd){$('speed').textContent=sp;lastSpd=sp;}
  $('turboBar').style.width=(turbo*100).toFixed(0)+'%';$('speedfx').style.opacity=car.boost?Math.min(1,Math.abs(car.v)/14):0;flame.visible=!!car.boost;if(car.boost){const f=.5+Math.random()*.5;flame.scale.set(f,f,1);}$('fuelBar').style.width=fuel.toFixed(0)+'%';{const gt=$('revTag');gt.hidden=false;gt.textContent=car.gear===0?'رجوع':'غيار '+'٠١٢٣'[car.gear];}
  const bp=$('brakePad');const rev=Math.abs(car.v)<.6;if(bp.classList.contains('revmode')!==rev){bp.classList.toggle('revmode',rev);bp.textContent=rev?'رجوع':'فرامل';}
  if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').hidden=true;}
  /* navigation target */
  let tx=null,tz=null,name='',showTime=false;
  if(fare&&fare.phase!=='board'){const p=POI[fare.to];tx=p.x;tz=p.z;name=p.n;showTime=true;}
  else if(!fare&&fuel<25){const s=nearestStation();tx=s.sx;tz=s.sz;name='أقرب بنزينة';}
  else if(!fare&&waiting.length){let b=null,bd=1e9;for(const w of waiting){const p=POI[w.poi],d=Math.hypot(p.x-car.x,p.z-car.z);if(d<bd){bd=d;b=w;}}if(b){const p=POI[b.poi];tx=p.x;tz=p.z;name='زبون عند '+p.n;}}
  const nav=$('nav');
  if(tx!==null){if(navTarget!==name){navTarget=name;gpsRoute=null;}const g=gpsUpdate(dt,tx,tz);const dx=g.nx-car.x,dz=g.nz-car.z;
    updateChev(tx);
    hudT-=dt;if(hudT<=0){hudT=.2;nav.hidden=false;$('navName').textContent=name;$('navDist').textContent=(g.rem/1000).toFixed(1)+' كم';
      const nt=$('navTime');if(showTime){const left=fare.budget-fare.t;nt.hidden=false;nt.textContent=Math.max(0,Math.round(left))+'s';nt.classList.toggle('late',left<0);}else nt.hidden=true;
      const rel=Math.atan2(-dx,-dz)-car.h;$('navArrow').style.transform='rotate('+(-rel*180/Math.PI)+'deg)';drawGPS();}}
  else{updateChev(null);nav.hidden=true;gpsRoute=null;hudT-=dt;if(hudT<=0){hudT=.2;drawGPS();}}}

/* ============ world animation ============ */
let clock=0;
function animWorld(dt){clock+=dt;water.material.map.offset.x=clock*.004;water.material.map.offset.y=clock*.0025;
  for(const f of flags){const p=f.geo.attributes.position.array,b=f.base;for(let i=0;i<p.length;i+=3){p[i+2]=Math.sin(b[i]*1.9-clock*5.2+f.ph+b[i+1]*.6)*.16*(b[i]/3);}f.geo.attributes.position.needsUpdate=true;}
  for(const t of trolleys){const k=.5+.5*Math.sin(clock*t.sp*Math.PI+t.ph);if(t.axis==='x')t.g.position.x=t.a+(t.b-t.a)*k;else t.g.position.z=t.a+(t.b-t.a)*k;}
  for(const g of gulls){const a=clock*g.sp+g.ph;g.g.position.set(g.cx+Math.cos(a)*g.rad,g.y+Math.sin(a*2)*1.2,g.cz+Math.sin(a)*g.rad);g.g.rotation.y=-a+(g.sp>0?Math.PI:0);const fl=Math.sin(clock*9+g.ph)*.5;g.l.rotation.z=fl;g.r.rotation.z=-fl;}
  for(const l of tlights){const red=((clock+l.ph)%16)<8;l.r.material.color.set(red?'#ff3b2a':'#3a1410');l.g.material.color.set(red?'#123a1a':'#38ff6a');}
  for(const S2 of emitters){const on=Math.sin(clock*.9+S2.ph)>-.2&&Math.sin(clock*13+S2.ph)>-.6;S2.w.intensity=on?1.2+Math.random()*1.6:0;
    for(let i=0;i<S2.N;i++){S2.life[i]-=dt;const j=i*3;if(S2.life[i]<=0){if(on&&Math.random()<.5){S2.pos[j]=S2.o[0];S2.pos[j+1]=S2.o[1];S2.pos[j+2]=S2.o[2];S2.vel[j]=S2.dx?rand(.4,2.6)*S2.dx:rand(-1.6,1.6);S2.vel[j+1]=rand(.5,3.2);S2.vel[j+2]=rand(-1.6,1.6);S2.life[i]=rand(.3,.8);}else{S2.pos[j+1]=-50;S2.life[i]=.05;}continue;}
      S2.vel[j+1]-=9.8*dt;S2.pos[j]+=S2.vel[j]*dt;S2.pos[j+1]+=S2.vel[j+1]*dt;S2.pos[j+2]+=S2.vel[j+2]*dt;if(S2.pos[j+1]<.03){S2.pos[j+1]=.03;S2.vel[j+1]*=-.3;}}S2.pts.geometry.attributes.position.needsUpdate=true;}
  for(const b of boats){const a=clock*b.sp+b.ph;b.g.position.set(b.cx+Math.cos(a)*b.r,0,b.cz+Math.sin(a)*b.r);b.g.rotation.y=-a+(b.sp>0?-Math.PI/2:Math.PI/2);b.g.rotation.z=Math.sin(clock*1.3+b.ph)*.03;}
  const pulse=1+Math.sin(clock*4)*.06;if(destRing)destRing.scale.set(pulse,pulse,pulse);beamMat.opacity=.18+Math.sin(clock*3)*.05;}
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
function releaseAll(){for(const k in input)input[k]=0;steerKeys.left=steerKeys.right=0;document.querySelectorAll('.pad.on').forEach(b=>b.classList.remove('on'));$('knob').style.transform='';}
document.querySelectorAll('[data-in]').forEach(b=>{const k=b.dataset.in;const on=e=>{e.preventDefault();input[k]=1;b.classList.add('on');try{b.setPointerCapture(e.pointerId);}catch(_){}};const off=()=>{input[k]=0;b.classList.remove('on');};
  b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);b.addEventListener('contextmenu',e=>e.preventDefault());});
const joy=$('joy'),knob=$('knob');let joyId=null;
function joyMove(e){const r=joy.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2);const R=r.width/2-20;const v=clamp(dx/R,-1,1);input.joy=-v;knob.style.transform='translateX('+(v*R)+'px)';}
joy.addEventListener('pointerdown',e=>{e.preventDefault();joyId=e.pointerId;try{joy.setPointerCapture(e.pointerId);}catch(_){}joyMove(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e);});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joy.addEventListener(ev,e=>{if(e.pointerId!==joyId)return;joyId=null;input.joy=0;knob.style.transform='';}));
const hb=$('bHorn');hb.addEventListener('pointerdown',e=>{e.preventDefault();input.horn=1;try{hb.setPointerCapture(e.pointerId);}catch(_){}});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>hb.addEventListener(ev,()=>{input.horn=0;}));
$('bCam').addEventListener('click',cycleCam);$('bRadio').addEventListener('click',toggleRadio);$('bPause').addEventListener('click',pauseGame);$('bMute').addEventListener('click',()=>{initAudio();setMute(!A.muted);});
function toggleRadio(){const r=$('radio');r.hidden=!r.hidden;$('bRadio').classList.toggle('on',!r.hidden);if(!r.hidden&&!radio.on)radioPower(true);}
function cycleCam(){camMode=(camMode+1)%3;snapCam=true;toast('الكاميرا: '+CAMS[camMode]);}
canvas.addEventListener('pointerdown',e=>{dragging=true;dragX=e.clientX;try{canvas.setPointerCapture(e.pointerId);}catch(_){}});
canvas.addEventListener('pointermove',e=>{if(!dragging||state!=='play')return;camYaw=clamp(camYaw-(e.clientX-dragX)*.006,-2.6,2.6);dragX=e.clientX;});
['pointerup','pointercancel'].forEach(ev=>canvas.addEventListener(ev,()=>{dragging=false;}));canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pauseGame();});

/* ============ menus / state ============ */
let state='loading';
function menuWallet(){$('menuWallet').textContent='محفظتك: '+Math.round(save.wallet)+' ج.م · مشاوير: '+save.trips;}
function startGame(){initAudio();if(A.ctx){if(A.ctx.state==='suspended')A.ctx.resume();try{const b=A.ctx.createBuffer(1,1,22050),src=A.ctx.createBufferSource();src.buffer=b;src.connect(A.ctx.destination);src.start(0);}catch(e){}}
  if(Speech.ok){try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u);}catch(e){}}pickVoices();$('menu').hidden=true;$('hud').hidden=false;state='play';snapCam=true;gpsSize();updateMoney();
  if(!startGame.done){startGame.done=true;radioPower(true);toast('دوّر على الزباين… العمود المنوّر',"good");}else radioUI();canvas.focus({preventScroll:true});}
function pauseGame(){if(state!=='play')return;state='pause';if(liveEl)liveEl.pause();releaseAll();$('pause').hidden=false;if(A.ctx)A.ctx.suspend();if(Speech.ok)try{speechSynthesis.pause();}catch(e){}persist();}
function resumeGame(){$('pause').hidden=true;state='play';if(liveEl&&radio.live)liveEl.play().catch(()=>{});if(A.ctx)A.ctx.resume();if(Speech.ok)try{speechSynthesis.resume();}catch(e){}canvas.focus({preventScroll:true});}
$('pResume').addEventListener('click',resumeGame);$('pReset').addEventListener('click',()=>{resetToRoad();resumeGame();toast('رجعناك للطريق');});
$('pMenu').addEventListener('click',()=>{if(liveEl)liveEl.pause();$('pause').hidden=true;$('hud').hidden=true;$('menu').hidden=false;state='menu';dlgClear();menuWallet();$('btnStart').textContent='كمّل الوردية';});
$('btnStart').addEventListener('click',startGame);
function ctlUI(){$('btnCtl').textContent='التحكم: '+(ctl.mode==='tilt'?'إمالة الموبايل':'جويستيك');$('btnSens').textContent='الدركسيون: '+({0.7:'تقيل',1:'عادي',1.35:'خفيف'}[ctl.sens]||'عادي');}
$('btnCtl').addEventListener('click',async()=>{if(ctl.mode!=='tilt'){try{if(window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission){const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted'){toast('الموبايل رفض الإمالة');return;}}}catch(e){}ctl.mode='tilt';}else ctl.mode='touch';saveCtl();ctlUI();});
$('btnSens').addEventListener('click',()=>{ctl.sens=ctl.sens===1?1.35:(ctl.sens===1.35?0.7:1);saveCtl();ctlUI();});
ctlUI();
$('btnVoiceTest').addEventListener('click',()=>{pickVoices();const n=$('voiceNote');n.hidden=false;
  if(!Speech.ok){n.textContent='المتصفح ده مفيهوش خاصية النطق. افتح اللعبة في Chrome.';return;}
  if(!Speech.voice){say('أهلاً يا اسطى، الوردية بدأت',{});n.textContent='لو مسمعتش الجملة: مفيش صوت عربي متسطّب. على أندرويد: الإعدادات ← تحويل النص إلى كلام ← محرك Google ← تثبيت بيانات الصوت ← العربية. وعلى الكمبيوتر استخدم Edge.';return;}
  const ok=say('أهلاً يا اسطى، الوردية بدأت. على مركز التدريب لو سمحت',{pitch:1,rate:1,onend:()=>{}});n.textContent=ok?'لو سمعت الجملة يبقى صوت الحوار شغال: '+Speech.voice.name:'الصوت مقفول من الإعداد.';});
$('btnQuality').addEventListener('click',e=>{quality=quality==='high'?'med':'high';e.currentTarget.textContent='الرسوم: '+(quality==='high'?'عالية':'خفيفة');applyPR();setShadowQ();resize();});
$('btnVoice').addEventListener('click',e=>{Speech.enabled=!Speech.enabled;e.currentTarget.textContent='صوت الحوار: '+(Speech.enabled?'شغال':'مقفول');if(!Speech.enabled&&Speech.ok)try{speechSynthesis.cancel();}catch(_){}});
function renderGarage(){$('garWallet').textContent='محفظتك: '+Math.round(save.wallet)+' ج.م';const box=$('paints');box.innerHTML='';
  PAINTS.forEach(p=>{const owned=save.owned.includes(p.id);const b=document.createElement('button');b.className='paint'+(save.paint===p.id?' sel':'')+(owned?'':' locked');
    b.innerHTML='<i style="background:'+p.c+'"></i><span>'+p.n+'<small>'+(owned?(save.paint===p.id?'متركّب':'اضغط للتركيب'):p.p+' ج.م')+'</small></span>';
    b.addEventListener('click',()=>{if(!owned){if(save.wallet<p.p){$('garWallet').textContent='محتاج '+Math.round(p.p-save.wallet)+' ج.م كمان';return;}save.wallet-=p.p;save.owned.push(p.id);}save.paint=p.id;setPaint(p.id);persist();renderGarage();menuWallet();});box.appendChild(b);});
  const sb=$('slogans');sb.innerHTML='';SLOGANS.forEach(t=>{const b=document.createElement('button');b.className='paint'+(save.slogan===t?' sel':'');b.style.justifyContent='center';b.textContent=t;b.addEventListener('click',()=>{save.slogan=t;setSlogan(t);persist();renderGarage();});sb.appendChild(b);});}
$('btnGarage').addEventListener('click',()=>{renderGarage();$('garage').hidden=false;});$('garClose').addEventListener('click',()=>{$('garage').hidden=true;});
addEventListener('resize',()=>{if(state==='play')gpsSize();});

/* ============ loop ============ */
let last=performance.now(),mA=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000||0);last=now;
  if(state==='play'){animWorld(dt);updateTraffic(dt);updateCar(dt);updateWalkers(dt);syncTuk();updateFares(dt);dlgUpdate(dt);radioUpdate(dt);updateHUD(dt);updateCam(dt);audioTick();}
  else if(state==='menu'||state==='loading'){animWorld(dt);updateTraffic(dt);updateWalkers(dt);syncTuk();mA+=dt*.04;
    camera.position.set(-140+Math.cos(mA)*70,22+Math.sin(mA*.7)*5,10+Math.sin(mA)*45);camera.lookAt(-120,4,-20);}
  placeSun();renderer.render(scene,camera);}

/* ============ boot ============ */
async function boot(){try{buildWorld();
  loadingText.textContent='بنجهّز التوكتوك…';
  const [gltf,R]=await Promise.all([
    new GLTFLoader().loadAsync(window.TUK_MODEL||'./models/tuk.glb'),
    RAPIER.init().then(()=>RAPIER).catch(e=>{console.warn('physics unavailable, arcade mode',e);return null;})]);
  loadTuk(gltf);initTraffic();initWalkers();
  veh=await createVehicle({RAPIER:R,colliders,traffic,spawn:{x:-160,z:7,h:-Math.PI/2}});car=veh.car;
  veh.onImpact(s=>{shake=Math.min(1,s/9);onImpact(s);});
  destBeam=new T.Mesh(beamGeo,new T.MeshBasicMaterial({color:'#4cff5e',transparent:true,opacity:.28,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));destBeam.visible=false;scene.add(destBeam);
  destRing=new T.Mesh(new T.TorusGeometry(3,.15,8,40),new T.MeshBasicMaterial({color:'#4cff5e'}));destRing.rotation.x=Math.PI/2;destRing.visible=false;scene.add(destRing);
  buildRadioUI();radioUI();syncTuk();menuWallet();updateMoney();
  window.portSim={audio:A,mus:Mus,radio:radio,sync:()=>syncTuk(),cam:camera,get car(){return car;},teleport:(x,z,h)=>veh.teleport(x,z,h===undefined?car.h:h),POI:POI,waiting:waiting,get fare(){return fare;},get fuel(){return fuel;},input:input};
  $('loading').hidden=true;$('menu').hidden=false;state='menu';requestAnimationFrame(frame);}
  catch(err){console.error(err);loadingText.textContent='حصلت مشكلة: '+err.message;}}
const fr=document.fonts&&document.fonts.load?Promise.all([document.fonts.load('40px Lalezar'),document.fonts.load('700 40px "IBM Plex Sans Arabic"'),document.fonts.load('900 40px "Big Shoulders Display"')]).catch(()=>{}):Promise.resolve();
Promise.race([fr,new Promise(r=>setTimeout(r,2500))]).then(boot);

})();
