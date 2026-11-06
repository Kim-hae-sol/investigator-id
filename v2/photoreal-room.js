(() => {
'use strict';
const T=window.THREE, host=document.getElementById('stage'), note=document.getElementById('note');
if(!T){note.textContent='Three.js 로드 실패';return;}
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#17120f');scene.fog=new T.FogExp2('#17120f',.045);
const camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,.08,45);
const ownedMaterials=new Set(),geometries=new Map(),textures=new Map();
const materials={};
function pbr(role,color,roughness=.7){
 const m=new T.MeshStandardMaterial({color,roughness,metalness:0});
 for(const [type,key] of [['color','map'],['normal','normalMap'],['roughness','roughnessMap']]){
 const img=document.querySelector('[data-pbr="'+role+'-'+type+'"]');
 if(!img)continue;
 const t=new T.Texture(img);t.colorSpace=type==='color'?T.SRGBColorSpace:T.NoColorSpace;
 t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;
 m[key]=t;textures.set(role+'-'+type,{map:t});
 }
 if(m.normalMap)m.normalScale.set(.22,.22);
 ownedMaterials.add(m);return m;
}
materials.wood=pbr('wood','#cbb8a6',.67);
materials.joinery=pbr('joinery','#c7b8a8',.75);
materials.wall=pbr('wall','#9c9286',.92);
materials.leather=pbr('leather','#7e6a5a',.78);
materials.paper=new T.MeshStandardMaterial({color:'#e5d8bc',roughness:1,side:T.DoubleSide});
materials.brass=new T.MeshStandardMaterial({color:'#a68b5b',metalness:.82,roughness:.28});
materials.iron=new T.MeshStandardMaterial({color:'#343330',metalness:.68,roughness:.4});
materials.green=new T.MeshPhysicalMaterial({color:'#174c3b',metalness:0,roughness:.19,clearcoat:.7,clearcoatRoughness:.13});
materials.glow=new T.MeshStandardMaterial({color:'#f3d3a2',emissive:'#ffb956',emissiveIntensity:1.7});
function mesh(geometry,material,parent=scene){const m=new T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,x,y,z,mat,parent=scene){const m=mesh(new T.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);return m;}
function cylinder(rt,rb,h,x,y,z,mat,parent=scene){const m=mesh(new T.CylinderGeometry(rt,rb,h,48),mat,parent);m.position.set(x,y,z);return m;}
const floor=box(8,.16,8,0,-.08,0,materials.wood);floor.material=materials.joinery;
box(8,3.3,.15,0,1.65,-3.75,materials.wall);
box(.15,3.3,8,-4,1.65,0,materials.wall);
box(.15,3.3,8,4,1.65,0,materials.wall);
for(let x=-3.5;x<4;x+=.86){box(.035,2.7,.09,x,1.65,-3.65,materials.joinery);box(.76,.045,.09,x+.39,.92,-3.64,materials.joinery);}
box(7.8,.17,.11,0,.16,-3.59,materials.joinery);
const desk=new T.Group();desk.position.set(0,0,-1.48);scene.add(desk);
// Controlled desk proportions: wide along X, shallow along Z, feet touching floor.
const deskTop=box(2.95,.095,1.34,0,.797,0,materials.wood,desk);
for(const x of [-1.30,1.30])for(const z of [-.49,.49]){
 box(.105,.747,.105,x,.3735,z,materials.joinery,desk);
}
box(2.65,.12,.075,0,.66,-.54,materials.joinery,desk);
box(2.65,.12,.075,0,.66,.54,materials.joinery,desk);
box(.075,.12,1.04,-1.3,.66,0,materials.joinery,desk);
box(.075,.12,1.04,1.3,.66,0,materials.joinery,desk);
const top=.845; const propY=top+.003; // desk surface: keep props in direct contact with tabletop
const evidence=new T.Group();evidence.name='case-file';desk.add(evidence);
box(.78,.009,.96,-.08,propY+.0045,-.05,materials.leather,evidence);
for(let i=0;i<6;i++){const page=box(.58,.002,.76,-.07+(i%3)*.002,propY+.011+i*.0015,-.08,materials.paper,evidence);page.rotation.y=(i-2)*.007;}
function printTexture(title,lines){
 const c=document.createElement('canvas');c.width=768;c.height=1024;const g=c.getContext('2d');
 g.fillStyle='#d7c6a3';g.fillRect(0,0,768,1024);
 for(let i=0;i<2400;i++){g.fillStyle=i%2?'#6c50300c':'#fff8e20e';g.fillRect((i*97)%768,(i*173)%1024,2,3);}
 g.strokeStyle='#685c47';g.lineWidth=3;g.strokeRect(43,42,682,936);
 g.fillStyle='#38352f';g.font='bold 43px Georgia';g.fillText(title,76,134);
 g.font='23px monospace';g.fillText('SPECIAL INVESTIGATION UNIT',76,185);
 for(let i=0;i<lines;i++){g.fillStyle=i%4===0?'#4a443c':'#716858';g.fillRect(78,258+i*28,500-(i%5)*63,3);}
 g.font='bold 28px monospace';g.fillText('HNJ / CONFIDENTIAL',76,914);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
const fileMat=new T.MeshStandardMaterial({map:printTexture('CASE FILE / 001',18),roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
const page=mesh(new T.PlaneGeometry(.56,.74),fileMat,evidence);page.rotation.x=-Math.PI/2;page.position.set(-.065,propY+.023,-.08);page.name='clickable-file';
const memoMat=new T.MeshStandardMaterial({map:printTexture('EVIDENCE',10),roughness:.93,side:T.DoubleSide});
const memo=mesh(new T.PlaneGeometry(.35,.48),memoMat,desk);memo.rotation.x=-Math.PI/2;memo.rotation.z=.13;memo.position.set(.78,propY+.003,.08);memo.name='clickable-memo';
const cup=cylinder(.07,.068,.14,.9,propY+.076,-.42,materials.iron,desk);
const coffee=cylinder(.063,.063,.002,.9,propY+.147,-.42,new T.MeshStandardMaterial({color:'#241711',roughness:.22}),desk);
const saucer=cylinder(.105,.105,.012,.9,propY+.006,-.42,materials.paper,desk);
// Grounded desk props: all vertical coordinates are referenced to the desk surface.
const penBody=new T.MeshStandardMaterial({color:'#202322',metalness:.65,roughness:.32});
const ink=new T.MeshStandardMaterial({color:'#27231e',roughness:.8});
const photoBorder=new T.MeshStandardMaterial({color:'#e2d7bd',roughness:1});
function rod(a,b,r,mat,parent=desk){const d=new T.Vector3().subVectors(b,a),m=mesh(new T.CylinderGeometry(r,r,d.length(),12),mat,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
rod(new T.Vector3(.34,propY+.015,.29),new T.Vector3(.68,propY+.015,.36),.008,penBody);
rod(new T.Vector3(.68,propY+.015,.36),new T.Vector3(.735,propY+.015,.37),.004,materials.brass);
const tape=new T.Group();tape.position.set(-.84,propY+.052,.39);desk.add(tape);
box(.34,.10,.22,0,0,0,materials.iron,tape);
box(.16,.009,.085,-.065,.056,0,materials.brass,tape);
for(let i=0;i<4;i++)box(.035,.012,.04,.07+i*.043,.058,.05,penBody,tape);
for(let i=0;i<2;i++){const reel=cylinder(.044,.044,.008,-.08+i*.13,.062,-.02,penBody,tape);reel.rotation.x=Math.PI/2;}
const photoTexture=printTexture('SUBJECT / 01',6);
const photoMat=new T.MeshStandardMaterial({map:photoTexture,roughness:1,side:T.DoubleSide});
for(let i=0;i<2;i++){
 const g=new T.Group();g.position.set(.43+i*.26,propY+.008,-.35+i*.05);g.rotation.y=(i?-.18:.11);desk.add(g);
 box(.22,.003,.30,0,0,0,photoBorder,g);
 const face=mesh(new T.PlaneGeometry(.18,.22),photoMat,g);face.rotation.x=-Math.PI/2;face.position.y=.003;face.position.z=-.02;
}
const pad=new T.Group();pad.position.set(.56,propY+.009,.48);pad.rotation.y=-.12;desk.add(pad);
box(.33,.006,.26,0,0,0,materials.paper,pad);
for(let i=0;i<7;i++)box(.22,.0008,.002,-.025,.004,-.085+i*.024,ink,pad);
const book=new T.Group();book.position.set(-.49,propY+.029,-.34);book.rotation.y=.15;desk.add(book);
box(.38,.048,.51,0,0,0,materials.leather,book);
box(.355,.042,.48,0,.003,0,materials.paper,book);
box(.38,.006,.51,0,.028,0,materials.leather,book);
const lamp=new T.Group();lamp.position.set(-1.0,propY+.013,-.38);desk.add(lamp);
cylinder(.13,.13,.025,0,.01,0,materials.brass,lamp);
cylinder(.018,.022,.41,0,.24,0,materials.brass,lamp);
const shade=mesh(new T.CylinderGeometry(.15,.25,.19,64,1,true),materials.green,lamp);shade.position.y=.48;
cylinder(.16,.16,.008,0,.382,0,materials.glow,lamp);
const lampLight=new T.SpotLight('#ffcf98',12,3.5,.72,.82,1.5);lampLight.position.set(-1.0,1.48,-1.78);
lampLight.target.position.set(-.15,.7,-1.48);lampLight.castShadow=true;lampLight.shadow.mapSize.set(2048,2048);
lampLight.shadow.bias=-.0001;lampLight.shadow.normalBias=.018;lampLight.shadow.radius=3;scene.add(lampLight,lampLight.target);
const fill=new T.DirectionalLight('#9eacc0',.65);fill.position.set(2.8,3.5,2);scene.add(fill);
const rim=new T.SpotLight('#d8aa79',2.1,7,.95,.9,1.6);rim.position.set(2.4,2.6,-2.6);rim.target.position.set(0,.9,-1.48);scene.add(rim,rim.target);
scene.add(new T.HemisphereLight('#c6b8a6','#30221c',.95));
// Soft overhead practical bounce: lifts evidence without flattening the warm desk-lamp pool.
const ceilingBounce=new T.PointLight('#d8c3a6',1.25,6,2);ceilingBounce.position.set(.2,2.7,-1.75);scene.add(ceilingBounce);
const boardWash=new T.SpotLight('#c6b7a4',2.0,5,.78,.9,2);boardWash.position.set(0,2.95,-2.0);boardWash.target.position.set(0,1.8,-3.5);scene.add(boardWash,boardWash.target);
const frame=box(2.0,1.13,.07,0,1.82,-3.54,materials.joinery);
const cork=new T.MeshStandardMaterial({color:'#765139',roughness:1});
box(1.84,.99,.013,0,1.82,-3.49,cork);
for(let i=0;i<5;i++){
 const m=new T.MeshStandardMaterial({map:printTexture(i%2?'PERSONNEL':'FIELD NOTES',9),roughness:.95});
 const p=mesh(new T.PlaneGeometry(.29,.39),m);p.position.set(-.65+(i%3)*.62,1.62+Math.floor(i/3)*.46,-3.472);p.rotation.z=(i-2)*.05;
}
const views={overview:{radius:3.25,az:.04,el:.55,target:[0,.86,-1.48]},desk:{radius:2.25,az:.02,el:.77,target:[0,.86,-1.48]},evidence:{radius:1.4,az:0,el:1.16,target:[-.1,.87,-1.48]}};
let az=.04,el=.55,radius=3.25,target=new T.Vector3(0,.86,-1.48),drag=false,lastX=0,lastY=0;
function updateCamera(){camera.position.set(target.x+radius*Math.sin(az)*Math.cos(el),target.y+radius*Math.sin(el),target.z+radius*Math.cos(az)*Math.cos(el));camera.lookAt(target);}
function selectView(name){const v=views[name];radius=v.radius;az=v.az;el=v.el;target.set(...v.target);updateCamera();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;az-=(e.clientX-lastX)*.004;el=Math.max(.12,Math.min(1.36,el+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY;updateCamera();});
canvas.addEventListener('pointerup',()=>drag=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();radius=Math.max(1.25,Math.min(7,radius+e.deltaY*.003));updateCamera();},{passive:false});
const ray=new T.Raycaster(),pointer=new T.Vector2();
canvas.addEventListener('click',e=>{pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects([page,memo]);if(hits.length)note.textContent=hits[0].object===page?'CASE FILE / 001 — 사건 기록 열람 인터랙션 시안':'EVIDENCE — 단서 확인 인터랙션 시안';});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
selectView('overview');
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
})();
