(()=>{
'use strict';
const T=window.THREE,root=document.getElementById('stage'),status=document.getElementById('status');
if(!T){status.textContent='3D 엔진을 불러오지 못했습니다.';return;}
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;root.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x161310);scene.fog=new T.FogExp2(0x161310,.032);
const camera=new T.PerspectiveCamera(37,innerWidth/innerHeight,.05,35);
const mat=(c,r=.83,m=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const wood=mat('#423027',.72),edge=mat('#251c17',.78),wall=mat('#635b50',.98),cork=mat('#715039',.96),metal=mat('#262a29',.48,.7),brass=mat('#9e7747',.36,.73),paper=mat('#d3c5a6',.98),green=mat('#123d2e',.24),black=mat('#141614',.65),red=mat('#69312d',.85);
const box=(w,h,d,x,y,z,m,p=scene)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};
const cyl=(rt,rb,h,x,y,z,m,p=scene)=>{const o=new T.Mesh(new T.CylinderGeometry(rt,rb,h,32),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};
const plane=(w,h,x,y,z,m,p=scene)=>{const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(x,y,z);o.receiveShadow=true;p.add(o);return o};
const texture=(kind,seed=0)=>{
 const c=document.createElement('canvas');c.width=1024;c.height=1024;const g=c.getContext('2d');
 if(kind==='wood'){g.fillStyle='#6c4730';g.fillRect(0,0,1024,1024);for(let i=0;i<1200;i++){const y=(i*79)%1024;g.strokeStyle=i%3?'#2b1c1640':'#b27e4d36';g.lineWidth=.3+(i%5)*.3;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(300,y+Math.sin(i)*8,650,y-7,1024,y+Math.cos(i)*7);g.stroke()}}
 else if(kind==='plaster'){g.fillStyle='#6a6155';g.fillRect(0,0,1024,1024);for(let i=0;i<27000;i++){const x=(i*367)%1024,y=(i*197)%1024;g.fillStyle=i%4===0?'#c0a99013':'#17130e14';g.fillRect(x,y,2+(i%6),2+(i%7))}}
 else {g.fillStyle=kind==='photo'?'#343331':'#d9cbb0';g.fillRect(0,0,1024,1024);if(kind==='photo'){g.fillStyle='#8b897e';g.fillRect(90,70,844,690);g.fillStyle='#373a39';g.fillRect(210,200,580,420);g.fillStyle='#a6a195';g.fillRect(330,245,260,300);g.fillStyle='#292c2a';g.fillRect(90,755,844,30)}
 else{g.fillStyle='#2b302d';g.font='bold 52px monospace';g.fillText(seed?'EVIDENCE RECORD':'CASE FILE / 001',80,130);g.font='25px monospace';g.fillText('INVESTIGATION DEPARTMENT',80,182);for(let i=0;i<15;i++){g.fillStyle=i%4?'#555044':'#8b3931';g.fillRect(85,255+i*38,760-(i%5)*75,3)}g.strokeStyle='#773d35';g.lineWidth=12;g.strokeRect(75,68,870,885);g.font='bold 36px monospace';g.fillText('RESTRICTED',95,908)}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
};
const wallMat=new T.MeshStandardMaterial({map:texture('plaster'),roughness:1});
const woodMat=new T.MeshStandardMaterial({map:texture('wood'),roughness:.66});
box(10,.16,9,0,-.08,0,woodMat);
box(10,3.8,.12,0,1.9,-2.78,wallMat);
box(.14,3.8,9,-4.5,1.9,0,wall);
box(.14,3.8,9,4.5,1.9,0,wall);
box(9,.58,.07,0,.29,-2.68,wood);box(9,.055,.11,0,.62,-2.65,edge);
const desk=new T.Group();desk.position.set(0,0,-1.10);scene.add(desk);
box(3.55,.095,1.48,0,.79,0,woodMat,desk);
for(const x of [-1.61,1.61])for(const z of [-.60,.60])box(.105,.75,.105,x,.375,z,edge,desk);
box(3.23,.21,.07,0,.67,-.66,wood,desk);box(3.23,.21,.07,0,.67,.66,wood,desk);
box(.07,.19,1.20,-1.6,.67,0,wood,desk);box(.07,.19,1.20,1.6,.67,0,wood,desk);
const y=.843;
const file=new T.Group();file.position.set(-.10,y+.012,.05);desk.add(file);file.name='case';
box(.84,.018,1.02,0,0,0,mat('#82613f'),file);
for(let i=0;i<5;i++){const sheet=box(.78,.002,.95,0,.012+i*.003,-.015, paper,file);sheet.rotation.y=(i-2)*.005}
const fileSheet=plane(.75,.92,0,.035,-.015,new T.MeshStandardMaterial({map:texture('paper',0),roughness:1,side:T.DoubleSide}),file);fileSheet.rotation.x=-Math.PI/2;fileSheet.name='fileSheet';
const photoMat=new T.MeshStandardMaterial({map:texture('photo'),roughness:1,side:T.DoubleSide});
for(let i=0;i<3;i++){const photo=new T.Group();photo.position.set(.67+i*.24,y+.011,-.30+i*.13);photo.rotation.y=(i-1)*.17;desk.add(photo);box(.25,.005,.33,0,0,0,paper,photo);const pic=plane(.21,.26,0,.004,-.025,photoMat,photo);pic.rotation.x=-Math.PI/2}
const recorder=new T.Group();recorder.position.set(-.88,y+.064,.30);desk.add(recorder);box(.45,.12,.29,0,0,0,black,recorder);box(.26,.009,.12,-.035,.066,-.04,metal,recorder);
for(let i=0;i<5;i++)box(.055,.012,.045,-.15+i*.075,.069,.08,brass,recorder);
const lamp=new T.Group();lamp.position.set(-1.21,y+.012,-.40);desk.add(lamp);
cyl(.15,.15,.025,0,.01,0,brass,lamp);cyl(.018,.023,.45,0,.25,0,brass,lamp);
const shade=new T.Mesh(new T.CylinderGeometry(.20,.30,.20,64,1,true),new T.MeshPhysicalMaterial({color:'#184e38',roughness:.23,metalness:.1,clearcoat:.65}));shade.position.y=.54;shade.castShadow=true;lamp.add(shade);
cyl(.195,.195,.009,0,.43,0,new T.MeshStandardMaterial({color:'#f4d7a7',emissive:'#f9b862',emissiveIntensity:1.8}),lamp);
const mug=cyl(.085,.085,.18,1.20,y+.095,-.31,paper,desk);cyl(.075,.075,.004,1.20,y+.188,-.31,black,desk);
const board=new T.Group();board.position.set(0,1.91,-2.60);scene.add(board);
box(2.9,1.56,.07,0,0,0,edge,board);box(2.77,1.43,.014,0,0,.046,cork,board);
const evidenceMat=new T.MeshStandardMaterial({map:texture('paper',1),side:T.DoubleSide,roughness:1});
for(let i=0;i<10;i++){const px=-1.1+(i%5)*.54,pz=.061,py=.43-Math.floor(i/5)*.73;const o=plane(i%3===0?.43:.36,i%3===0?.53:.45,px,py,pz,i%3===0?photoMat:evidenceMat,board);o.rotation.z=(i%4-1.5)*.08;cyl(.017,.017,.015,px,py+.23,pz+.014,brass,board).rotation.x=Math.PI/2}
const lineMat=new T.LineBasicMaterial({color:0x9b3e32});
for(const [a,b] of [[[-.98,.56],[.11,.43]],[[.11,.43],[.91,-.36]],[[.91,-.36],[-.41,-.34]],[[-.41,-.34],[.11,.43]]]){
 const points=[new T.Vector3(a[0],a[1],.09),new T.Vector3(b[0],b[1],.09)];board.add(new T.Line(new T.BufferGeometry().setFromPoints(points),lineMat));
}
const cabinet=new T.Group();cabinet.position.set(-2.5,0,-2.18);scene.add(cabinet);
box(.68,1.64,.58,0,.82,0,metal,cabinet);for(let i=0;i<4;i++){box(.58,.34,.015,0,.25+i*.39,.30,black,cabinet);box(.17,.025,.025,0,.25+i*.39,.325,brass,cabinet)}
const key=new T.SpotLight('#ffc88d',13,4.3,.76,.85,1.6);key.position.set(-1.24,1.62,-1.42);key.target.position.set(-.18,.83,-1.1);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.018;scene.add(key,key.target);
scene.add(new T.HemisphereLight('#8b9291','#211710',.65));
const ambient=new T.PointLight('#c3b6a5',.75,6,2);ambient.position.set(1.4,2.9,.6);scene.add(ambient);
const boardLight=new T.SpotLight('#b9a58e',2.3,5,.82,.9,2);boardLight.position.set(.6,3,-1.2);boardLight.target.position.set(0,1.8,-2.6);scene.add(boardLight,boardLight.target);
const views={room:{pos:[.08,1.72,3.05],target:[0,1.12,-1.72]},desk:{pos:[.02,1.78,1.13],target:[0,.85,-1.12]},file:{pos:[-.13,1.74,.20],target:[-.10,.84,-1.05]}};
let current='room',drag=false,downX=0,downY=0;
function view(k){current=k;const v=views[k];const aspect=innerWidth/innerHeight;camera.fov=aspect<.8?Math.min(76,37+(.8-aspect)*72):37;camera.updateProjectionMatrix();const pos=[...v.pos];if(aspect<.8){pos[2]+=(.8-aspect)*(k==='room'?3.4:k==='desk'?2.3:1.7);pos[1]+=(.8-aspect)*.3;}camera.position.set(...pos);camera.lookAt(...v.target);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===k)));status.textContent=k==='room'?'수사실 · 전체 시점':k==='desk'?'책상 · 조사 시점':'사건 파일 · 열람 시점'}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
const ray=new T.Raycaster(),pointer=new T.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{downX=e.clientX;downY=e.clientY;drag=true});
renderer.domElement.addEventListener('pointerup',e=>{if(!drag)return;drag=false;if(Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY)>12)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);if(ray.intersectObject(fileSheet).length)view('file')});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);view(current)});
view('room');renderer.setAnimationLoop(()=>renderer.render(scene,camera));
})();