(() => {
'use strict';
const T=window.THREE, host=document.getElementById('stage'), note=document.getElementById('note');
if(!T){note.textContent='Three.js 로드 실패';return;}
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
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
materials.paper=new T.MeshStandardMaterial({color:'#cdbb95',roughness:.94,side:T.DoubleSide});
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
const desk=new T.Group();desk.position.set(0,0,-.55);scene.add(desk);
let imported=false;
try{
 if(window.HNJTableAsset&&window.HNJStaticModel){
 const table=window.HNJStaticModel.create(window.HNJTableAsset,'table',{anisotropy:8,materials:ownedMaterials,geometries,textures});
 table.rotation.y=Math.PI/2;table.scale.set(1.42,1.12,1.36);table.position.y=.04;desk.add(table);imported=true;
 }
}catch(err){console.warn('Table asset fallback',err);}
if(!imported){box(2.65,.10,1.55,0,.79,0,materials.wood,desk);for(const x of [-1.12,1.12])for(const z of [-.61,.61])box(.12,.72,.12,x,.36,z,materials.joinery,desk);}
const top=.88;
const evidence=new T.Group();evidence.name='case-file';desk.add(evidence);
box(.78,.012,.96,-.08,top+.018,-.05,materials.leather,evidence);
for(let i=0;i<6;i++){const page=box(.58,.002,.76,-.07+(i%3)*.002,top+.028+i*.003,-.08,materials.paper,evidence);page.rotation.y=(i-2)*.007;}
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
const fileMat=new T.MeshStandardMaterial({map:printTexture('CASE FILE / 001',18),roughness:.91,side:T.DoubleSide});
const page=mesh(new T.PlaneGeometry(.56,.74),fileMat,evidence);page.rotation.x=-Math.PI/2;page.position.set(-.065,top+.050,-.08);page.name='clickable-file';
const memoMat=new T.MeshStandardMaterial({map:printTexture('EVIDENCE',10),roughness:.93,side:T.DoubleSide});
const memo=mesh(new T.PlaneGeometry(.35,.48),memoMat,desk);memo.rotation.x=-Math.PI/2;memo.rotation.z=.13;memo.position.set(.78,top+.015,.08);memo.name='clickable-memo';
const cup=cylinder(.07,.068,.14,.9,top+.07,-.42,materials.iron,desk);
const coffee=cylinder(.063,.063,.002,.9,top+.143,-.42,new T.MeshStandardMaterial({color:'#241711',roughness:.22}),desk);
const saucer=cylinder(.105,.105,.012,.9,top+.004,-.42,materials.paper,desk);
const lamp=new T.Group();lamp.position.set(-1.0,top+.01,-.38);desk.add(lamp);
cylinder(.13,.13,.025,0,.01,0,materials.brass,lamp);
cylinder(.018,.022,.41,0,.24,0,materials.brass,lamp);
const shade=mesh(new T.CylinderGeometry(.15,.25,.19,64,1,true),materials.green,lamp);shade.position.y=.48;
cylinder(.16,.16,.008,0,.382,0,materials.glow,lamp);
const lampLight=new T.SpotLight('#ffd3a1',23,5,.83,.66,1.6);lampLight.position.set(-1.0,1.39,-.9);
lampLight.target.position.set(-.15,.7,-.65);lampLight.castShadow=true;lampLight.shadow.mapSize.set(2048,2048);
lampLight.shadow.bias=-.00015;scene.add(lampLight,lampLight.target);
const fill=new T.DirectionalLight('#a8b7c2',1.0);fill.position.set(2.8,3.5,2);scene.add(fill);
const rim=new T.SpotLight('#d9ad77',5,8,1.1,.9);rim.position.set(2.4,2.6,-2.6);rim.target.position.set(0,.9,-.5);scene.add(rim,rim.target);
scene.add(new T.HemisphereLight('#d8c4a8','#211b16',.65));
const frame=box(2.0,1.13,.07,0,1.82,-3.54,materials.joinery);
const cork=new T.MeshStandardMaterial({color:'#765139',roughness:1});
box(1.84,.99,.013,0,1.82,-3.49,cork);
for(let i=0;i<5;i++){
 const m=new T.MeshStandardMaterial({map:printTexture(i%2?'PERSONNEL':'FIELD NOTES',9),roughness:.95});
 const p=mesh(new T.PlaneGeometry(.29,.39),m);p.position.set(-.65+(i%3)*.62,1.62+Math.floor(i/3)*.46,-3.472);p.rotation.z=(i-2)*.05;
}
const views={overview:{radius:4.65,az:.13,el:.35,target:[0,.9,-.8]},desk:{radius:2.6,az:.16,el:.52,target:[0,.84,-.55]},evidence:{radius:1.5,az:0,el:1.12,target:[-.1,.84,-.55]}};
let az=.13,el=.35,radius=4.65,target=new T.Vector3(0,.9,-.8),drag=false,lastX=0,lastY=0;
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
