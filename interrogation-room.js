/* STEP 04: independent, closed-set interrogation room. No door, identity, or access state is changed here.
   The room can be created after the existing doorway sequence in a future scene transition. */
(() => {
  'use strict';
  const ROOM = Object.freeze({ width: 6.4, depth: 6.8, height: 3.05, fov: 46 });
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = t => t * t * (3 - 2 * t);
  const views = Object.freeze({
    entry: Object.freeze({ position: [0, 1.70, 3.10], target: [0, 1.10, -.55], fov: 48 }),
    seated: Object.freeze({ position: [0, 1.28, 1.74], target: [0, 1.25, -1.55], fov: 43 }),
    tabletop: Object.freeze({ position: [0, 5.15, .08], target: [0, .70, .02], up: [0, 0, -1], fov: 48 })
  });
  const deadline = (promise, ms) => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Room scene preparation timed out')), ms); })])
      .finally(() => clearTimeout(timer));
  };

  async function create(container, options = {}) {
    const T = window.THREE;
    if (!T || !container) return null;
    const shared = !!options.renderer;
    const canvas = shared ? options.renderer.domElement : document.createElement('canvas');
    if (!shared) {
    canvas.className = 'interrogation-room-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '따뜻한 조명 아래 책상과 서로 마주 보는 두 의자가 있는 조사실');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    }
    let renderer;
    try { renderer = options.renderer || new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch { return null; }

    const geometries = new Map(), textures = new Map(), ownedMaterials = new Set();
    let ready=false;
    try {
      const images = [...document.querySelectorAll('[data-pbr], [data-room]')];
      await deadline(Promise.all(images.map(image => image.decode())), 7000);
      if (!shared) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      }

      const scene = new T.Scene();
      scene.background = new T.Color('#171513');
      const camera = new T.PerspectiveCamera(ROOM.fov, 16 / 9, .08, 45);
      const lookTarget = new T.Vector3();
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      function material(role, tint, roughness, normal, rx, ry) {
        const key = `${role}:${rx}:${ry}`;
        let maps = textures.get(key);
        if (!maps) {
          const make = type => {
            const image = document.querySelector(`[data-pbr="${role}-${type}"]`);
            const texture = new T.Texture(image);
            texture.colorSpace = type === 'color' ? T.SRGBColorSpace : T.NoColorSpace;
            texture.wrapS = texture.wrapT = T.RepeatWrapping;
            texture.repeat.set(rx, ry); texture.anisotropy = anisotropy; texture.needsUpdate = true;
            return texture;
          };
          maps = { color: make('color'), normal: make('normal'), roughness: make('roughness') };
          textures.set(key, maps);
        }
        const value = new T.MeshStandardMaterial({ color: tint, map: maps.color, normalMap: maps.normal,
          normalScale: new T.Vector2(normal, normal), roughnessMap: maps.roughness, roughness, metalness: 0 });
        const minimum=role==='floor'?.86:role==='wall'?.90:.62;
        value.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,${minimum.toFixed(2)});`);};
        value.customProgramCacheKey=()=> 'room-surface-v3-'+minimum;
        ownedMaterials.add(value); return value;
      }
      const wood = material('wood', '#876348', .80, .20, 1.0, 1.0);
      const woodDark = material('wood', '#745a43', .88, .16, .85, 1.1);
      const woodTrim = material('wood', '#806044', .84, .13, 1.2, .9);
      const tableFinish=material('wood','#8a6546',.82,.22,1.6,.95);
      for(const m of [tableFinish,woodDark])for(const t of [m.map,m.normalMap,m.roughnessMap]){t.center.set(.5,.5);t.rotation=Math.PI/2;}
      const wall = material('wall', '#b5b2a6', .96, .10, 3.2, 1.7);
      const floor = material('floor', '#787b76', .96, .065, 3.0, 3.0);
      const ceilingMaterial = material('wall', '#76736b', 1, .025, 2.3, 1.4);
      const charcoal = new T.MeshStandardMaterial({ color: '#282622', roughness: .94 }); ownedMaterials.add(charcoal);
      const upholstery = new T.MeshStandardMaterial({ color: '#29251f', roughness: .96 }); ownedMaterials.add(upholstery);
      const brass = new T.MeshStandardMaterial({ color: '#806947', metalness: .64, roughness: .57 }); ownedMaterials.add(brass);
      const darkMetal = new T.MeshStandardMaterial({ color: '#37352f', metalness: .45, roughness: .69 }); ownedMaterials.add(darkMetal);
      const shade = new T.MeshStandardMaterial({ color: '#ead7ac', emissive: '#c29450', emissiveIntensity: .48, roughness: .84 }); ownedMaterials.add(shade);
      const windowGlow = new T.MeshStandardMaterial({ color: '#625446', emissive: '#403326', emissiveIntensity: .16, roughness: 1 }); ownedMaterials.add(windowGlow);

      function box(w, h, d, x, y, z, mat, parent = scene, bevel = 0) {
        const key = `${w}/${h}/${d}/${bevel}`;
        if (!geometries.has(key)) {
          let geometry;
          if (bevel) {
            // Rounded cuboid with normalized face UVs. Extrusion UVs previously stretched
            // the wood over long edges and left the vertical corners perfectly square.
            const r=Math.min(bevel,w*.24,h*.24,d*.24),half=[w/2,h/2,d/2],core=half.map(v=>v-r);
            const vertices=[],normals=[],uvs=[],indices=[];
            const grid=halfSize=>[-halfSize,-halfSize+r/3,-halfSize+r*2/3,-halfSize+r,halfSize-r,halfSize-r*2/3,halfSize-r/3,halfSize];
            const faces=[[[1,0,0],[0,0,-1],[0,1,0],0,2,1],[[-1,0,0],[0,0,1],[0,1,0],0,2,1],
              [[0,1,0],[1,0,0],[0,0,-1],1,0,2],[[0,-1,0],[1,0,0],[0,0,1],1,0,2],
              [[0,0,1],[1,0,0],[0,1,0],2,0,1],[[0,0,-1],[-1,0,0],[0,1,0],2,0,1]];
            for(const [n,u,v,a,ui,vi] of faces){const gx=grid(half[ui]),gy=grid(half[vi]),base=vertices.length/3;
              for(let iy=0;iy<gy.length;iy++)for(let ix=0;ix<gx.length;ix++){
                const point=new T.Vector3(...n).multiplyScalar(half[a]).addScaledVector(new T.Vector3(...u),gx[ix]).addScaledVector(new T.Vector3(...v),gy[iy]);
                const c=new T.Vector3(...core.map((value,j)=>Math.max(-value,Math.min(value,point.getComponent(j)))));
                const normal=point.clone().sub(c).normalize();point.copy(c).addScaledVector(normal,r);
                vertices.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);
                uvs.push(gx[ix]/(half[ui]*2)+.5,gy[iy]/(half[vi]*2)+.5);
              }
              for(let iy=0;iy<gy.length-1;iy++)for(let ix=0;ix<gx.length-1;ix++){const a=base+iy*gx.length+ix,b=a+1,c=a+gx.length,d=c+1;indices.push(a,b,c,b,d,c);}
            }
            geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
            geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
          } else geometry = new T.BoxGeometry(w, h, d);
          geometries.set(key, geometry);
        }
        const mesh = new T.Mesh(geometries.get(key), mat);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
        return mesh;
      }
      function cylinder(radiusTop, radiusBottom, height, x, y, z, mat, parent = scene, radial = 32) {
        const key = `c:${radiusTop}/${radiusBottom}/${height}/${radial}`;
        if (!geometries.has(key)) geometries.set(key, new T.CylinderGeometry(radiusTop, radiusBottom, height, radial));
        const mesh = new T.Mesh(geometries.get(key), mat);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
      }
      function microTexture(kind) {
        const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),pixels=ctx.createImageData(256,256);
        let seed=2439;for(let y=0;y<256;y++)for(let x=0;x<256;x++){seed=(seed*1664525+1013904223)>>>0;const n=seed/4294967296;
          let v=128+(n-.5)*(kind==='paper'?15:kind==='leather'?42:11);
          if(kind==='metal')v+=Math.sin(y*1.7)*3;
          const i=(y*256+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;
        }ctx.putImageData(pixels,0,0);const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(kind==='leather'?7:3,kind==='leather'?7:3);map.needsUpdate=true;textures.set('micro-'+kind,{bump:map});return map;
      }
      const metalMicro=microTexture('metal'),paperMicro=microTexture('paper'),leatherMicro=microTexture('leather');
      darkMetal.bumpMap=metalMicro;darkMetal.bumpScale=.0008;darkMetal.roughness=.48;darkMetal.metalness=.62;
      brass.bumpMap=metalMicro;brass.bumpScale=.00025;brass.roughness=.38;
      const cabinetPaint=new T.MeshStandardMaterial({color:'#555b55',metalness:.46,roughness:.48,bumpMap:metalMicro,bumpScale:.0008});ownedMaterials.add(cabinetPaint);
      const binderCloth=['#3c3e31','#4c302b','#504939'].map(color=>{const m=new T.MeshStandardMaterial({color,roughness:.91,bumpMap:leatherMicro,bumpScale:.0006});ownedMaterials.add(m);return m;});
      const binderLabel=new T.MeshStandardMaterial({color:'#b9b39f',roughness:.97,bumpMap:paperMicro,bumpScale:.0002});ownedMaterials.add(binderLabel);
      const cabinetFront=cabinetPaint.clone();cabinetFront.color.set('#414944');ownedMaterials.add(cabinetFront);

      // Close the space around the visitor. The entrance wall is behind the entry camera; the far wall frames the empty suspect chair.
      const halfW = ROOM.width / 2, halfD = ROOM.depth / 2;
      box(ROOM.width, .13, ROOM.depth, 0, -.065, 0, floor);
      const ceiling = box(ROOM.width, .13, ROOM.depth, 0, ROOM.height + .065, 0, ceilingMaterial);
      box(.16, ROOM.height, ROOM.depth, -halfW - .08, ROOM.height / 2, 0, wall);
      box(.16, ROOM.height, ROOM.depth, halfW + .08, ROOM.height / 2, 0, wall);
      box(ROOM.width + .16, ROOM.height, .16, 0, ROOM.height / 2, -halfD - .08, wall);
      // The doorway is physically open to the corridor; its hinged leaf belongs to the corridor.
      for (const sign of [-1, 1]) box((ROOM.width-1.30)/2,ROOM.height,.16,sign*(1.30/2+(ROOM.width-1.30)/4),ROOM.height/2,halfD+.08,woodDark);
      box(1.30,ROOM.height-2.48,.16,0,2.48+(ROOM.height-2.48)/2,halfD+.08,woodDark);

      // Restrained chair rail and base trim keep the room dimensional without a crime-scene set dressing.
      for (const sign of [-1, 1]) {
        box(.095, .20, ROOM.depth - .14, sign * (halfW - .105), .10, 0, woodTrim);
        box(.052, .055, ROOM.depth - .10, sign * (halfW - .13), .96, 0, woodDark);
        box(.028, .035, ROOM.depth - .10, sign * (halfW - .13), 1.02, 0, woodTrim);
      }
      box(ROOM.width - .24, .20, .055, 0, .10, -halfD + .07, woodTrim);
      box(ROOM.width - .24, .20, .055, 0, .10, halfD - .07, woodTrim);
      for (const y of [1.0, 1.035]) box(ROOM.width - .30, .043, .032, 0, y, -halfD + .09, woodTrim);

      // A dim blind-window on the left brings in a thin, neutral side fill.
      const windowGroup = new T.Group(); windowGroup.position.set(-halfW + .09, 1.92, -.82); windowGroup.rotation.y = Math.PI / 2; scene.add(windowGroup);
      function localBox(w, h, d, x, y, z, mat, parent) { return box(w, h, d, x, y, z, mat, parent); }
      localBox(1.28, 1.36, .025, 0, 0, 0, windowGlow, windowGroup);
      for (const x of [-.68, .68]) localBox(.075, 1.50, .08, x, 0, .04, woodTrim, windowGroup);
      for (const y of [-.76, .76]) localBox(1.42, .075, .08, 0, y, .04, woodTrim, windowGroup);
      for (let i = 0; i < 9; i++) localBox(1.23, .022, .035, 0, -.60 + i * .15, .065, charcoal, windowGroup);

      // A wide, matte walnut table leaves a clear A4 folio area and room for loose evidence later.
      const table = new T.Group(); table.name = 'evidence-table'; scene.add(table);
      box(1.62, .105, 2.34, 0, .785, 0, tableFinish, table, .012);
      box(1.56, .028, 2.28, 0, .718, 0, woodTrim, table, .005);
      for (const x of [-.62, .62]) for (const z of [-.94, .94]) {
        box(.105, .68, .105, x, .355, z, woodDark, table, .006);
        box(.15, .034, .15, x, .055, z, woodTrim, table, .004);
      }
      box(1.22, .17, .075, 0, .605, .99, woodDark, table);
      box(1.22, .17, .075, 0, .605, -.99, woodDark, table);
      box(.055, .06, 1.87, -.68, .602, 0, woodTrim, table);
      box(.055, .06, 1.87, .68, .602, 0, woodTrim, table);

      // Two matching but subtly different wooden chairs face each other across the long table axis.
      const chairLeather=new T.MeshStandardMaterial({color:'#56392d',roughness:.66,bumpMap:leatherMicro,bumpScale:.0012});ownedMaterials.add(chairLeather);
      function chair(z, facing) {
        const g = new T.Group(); g.position.z = z; g.rotation.y = facing > 0 ? 0 : Math.PI; g.name = facing > 0 ? 'investigator-chair' : 'subject-chair'; scene.add(g);
        box(.58, .075, .53, 0, .49, 0, chairLeather, g, .025);
        box(.56, .045, .51, 0, .445, 0, woodDark, g, .006);
        box(.58, .68, .075, 0, .84, -.235, wood, g, .012);
        box(.47,.49,.060,0,.84,-.175,chairLeather,g,.020);
        for(const x of [-.13,.13])for(const y of [.74,.94]){const button=cylinder(.009,.009,.006,x,y,-.141,woodDark,g,12);button.rotation.x=Math.PI/2;}
        box(.034, .64, .045, -.25, .83, -.205, woodTrim, g, .004);
        box(.034, .64, .045, .25, .83, -.205, woodTrim, g, .004);
        for (const x of [-.23, .23]) for (const zz of [-.19, .19]) box(.052, .45, .052, x, .245, zz, woodDark, g, .004);
        for(const x of [-.31,.31]) { box(.065,.055,.49,x,.69,.015,wood,g,.009); box(.035,.20,.035,x,.58,.17,woodTrim,g,.004); }
        return g;
      }
      chair(1.54, -1);
      chair(-1.54, 1);

      // Left: compact records chest and a few restrained bound case files.
      const low = new T.Group(); low.position.set(-2.30, 0, -.10); scene.add(low); low.name = 'records-cabinet-low';
      box(.94, .94, .66, 0, .51, 0, woodDark, low, .01);
      box(.98, .08, .70, 0, 1.02, 0, wood, low, .01);
      for (const y of [.31, .57, .83]) {
        box(.82, .205, .025, 0, y, .342, wood, low, .004);
        box(.15, .018, .014, 0, y + .035, .361, brass, low, .003);
      }
      for (let i = 0; i < 4; i++) {
        const x = -.35 + i * .19, h = .38 + (i % 2) * .10;
        const book=new T.Group();book.position.set(x,1.06+h/2,-.12);book.rotation.z=(i-1.5)*.014;low.add(book);
        box(.145,h,.26,0,0,0,binderCloth[i%3],book,.004);
        box(.125,.008,.235,0,h/2-.009,.005,binderLabel,book,.001);
        box(.078,.047,.004,0,h*.15,.133,brass,book,.002);
        box(.065,.033,.005,0,h*.15,.136,binderLabel,book,.001);
        box(.018,h-.04,.008,-.04,0,.136,brass,book,.001);
      }

      // Right: tall, quiet metal records cabinet, plus a narrow shelf and old case books.
      const tall = new T.Group(); tall.position.set(2.38, 0, -.54); scene.add(tall); tall.name = 'records-cabinet-tall';
      box(.82, 2.10, .62, 0, 1.12, 0, cabinetPaint, tall, .015);
      for (const y of [.48, 1.05, 1.62]) {
        box(.73, .51, .025, 0, y, .323, cabinetFront, tall, .008);
        box(.16,.018,.025,0,y+.14,.350,brass,tall,.003);
        box(.15,.055,.008,0,y-.03,.343,brass,tall,.002);box(.13,.037,.010,0,y-.03,.349,wall,tall,.001);
      }
      box(.88, .065, .68, 0, 2.20, 0, cabinetPaint, tall, .010);
      const shelf = new T.Group(); shelf.position.set(2.40, 1.55, .66); scene.add(shelf); shelf.name = 'case-shelf';
      box(.12, .07, 1.18, 0, 0, 0, woodTrim, shelf);
      for (let i = 0; i < 5; i++) box(.15, .42 + (i % 2) * .06, .26, .04, .24 + (i % 2) * .03, -.43 + i * .19,
        binderCloth[i%3], shelf, .004);

      // A small mechanical wall clock: no institutional emblem or labels.
      const dial=canvasMaterial(512,512,(c,w,h)=>{c.fillStyle='#c4bba5';c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.strokeStyle='#4c483d';
        for(let i=0;i<60;i++){c.save();c.rotate(i*Math.PI/30);c.lineWidth=i%5?1:3;c.beginPath();c.moveTo(0,-214);c.lineTo(0,i%5?-206:-196);c.stroke();c.restore();}
        c.fillStyle='#37362f';c.textAlign='center';c.textBaseline='middle';c.font='30px Georgia';for(let i=1;i<=12;i++){const a=i*Math.PI/6;c.fillText(String(i),Math.sin(a)*171,-Math.cos(a)*171);}c.restore();},.92);
      const clockFace = new T.Mesh(new T.CircleGeometry(.17, 64), dial);
      ownedMaterials.add(clockFace.material); clockFace.position.set(-2.42, 2.27, -3.20); clockFace.rotation.y = -.04; scene.add(clockFace);
      cylinder(.184, .184, .055, -2.42, 2.27, -3.23, brass, scene, 36).rotation.x = Math.PI / 2;
      const clockRim=new T.Mesh(new T.TorusGeometry(.177,.007,12,64),brass);clockRim.position.set(-2.42,2.27,-3.195);clockRim.castShadow=true;scene.add(clockRim);geometries.set('clock-rim',clockRim.geometry);
      box(.009, .108, .012, -2.42, 2.31, -3.19, darkMetal, scene);
      box(.075, .009, .012, -2.39, 2.27, -3.189, darkMetal, scene);

      // Simple suspended tungsten shade. The downlight pools over the folio area; a weak side source separates the suspect seat from the back wall.
      const pendant = new T.Group(); pendant.position.set(0, 2.86, .10); scene.add(pendant); pendant.name = 'table-pendant';
      cylinder(.012, .012, .20, 0, .08, 0, darkMetal, pendant, 12);
      const lampShade = new T.Mesh(new T.CylinderGeometry(.23, .36, .18, 36, 1, true), brass);
      lampShade.position.y = -.07; lampShade.castShadow = true; pendant.add(lampShade);
      const diffuser = new T.Mesh(new T.CircleGeometry(.29, 36), shade); diffuser.rotation.x = -Math.PI / 2; diffuser.position.y = -.16; pendant.add(diffuser);
      const mainLight = new T.SpotLight('#ffdfaf', 34, 6.5, .70, .94, 1.7);
      mainLight.position.set(0, 2.76, .08); mainLight.target.position.set(0, .58, 0); mainLight.castShadow = true;
      mainLight.shadow.mapSize.set(2048, 2048); mainLight.shadow.bias = -.00016; mainLight.shadow.normalBias = .005;
      mainLight.shadow.radius = 3.5; mainLight.shadow.camera.near = .1; mainLight.shadow.camera.far = 8; scene.add(mainLight, mainLight.target);
      const warmBounce = new T.PointLight('#e7cba7', 7, 5.6, 2); warmBounce.position.set(0, 2.55, .12); scene.add(warmBounce);
      const wallBounce = new T.DirectionalLight('#c4bbb0', .85); wallBounce.position.set(-.8, 2.45, -2.55); scene.add(wallBounce);
      const sideFill = new T.DirectionalLight('#bdc8cf', .80); sideFill.position.set(-3.0, 2.2, -1.2); scene.add(sideFill);
      const ambient = new T.HemisphereLight('#c1c5c6', '#393028', .62); scene.add(ambient);
      scene.add(new T.AmbientLight('#b5b4ad', .08));
      const wallGraze=new T.PointLight('#d1c4b2',2.2,3.8,2);wallGraze.position.set(-1.9,2.30,-2.0);scene.add(wallGraze);
      const windowFill=new T.SpotLight('#c3cbd2',4.5,6.5,1.0,1,2);windowFill.position.set(-2.82,2.05,-.82);windowFill.target.position.set(.3,.78,0);scene.add(windowFill,windowFill.target);

      // Reference look: layered walnut joinery, coffered ceiling, warm practicals and a working records wall.
      const details = new T.Group(); details.name='room-dressing'; scene.add(details);
      const paper = new T.MeshStandardMaterial({color:'#c7b999',roughness:.97,bumpMap:paperMicro,bumpScale:.00035}); ownedMaterials.add(paper);
      const leather = new T.MeshStandardMaterial({color:'#51392b',roughness:.72,bumpMap:leatherMicro,bumpScale:.0007}); ownedMaterials.add(leather);
      const ceramic = new T.MeshStandardMaterial({color:'#69645a',roughness:.28,metalness:.02}); ownedMaterials.add(ceramic);
      function canvasMaterial(width,height,paint,roughness=.94) {
        const c=document.createElement('canvas');c.width=width;c.height=height;paint(c.getContext('2d'),width,height);
        const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=anisotropy;
        const m=new T.MeshStandardMaterial({map:t,roughness});ownedMaterials.add(m);
        textures.set('detail-'+textures.size,{color:t});return m;
      }
      // Controlled, deterministic surface variation; no heavy full-screen grain or random flicker.
      let seed=6143; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      const cork=canvasMaterial(1024,640,(c,w,h)=>{c.fillStyle='#79502e';c.fillRect(0,0,w,h);for(let i=0;i<48000;i++){const a=random();c.fillStyle=a>.5?'#b8885244':'#25180f33';c.fillRect(random()*w,random()*h,1+random()*3,1+random()*2);}});
      const boardImage=document.querySelector('[data-room="records-board"]');
      let boardFinish=cork;
      if(boardImage?.naturalWidth){const map=new T.Texture(boardImage);map.colorSpace=T.SRGBColorSpace;map.anisotropy=anisotropy;map.needsUpdate=true;textures.set('board-image',{color:map});boardFinish=new T.MeshStandardMaterial({map,color:'#c4b294',roughness:.98});ownedMaterials.add(boardFinish);}
      const board=new T.Group();board.position.set(1.24,1.95,-3.27);details.add(board);board.name='records-board';
      box(2.46,1.30,.045,0,0,0,boardFinish,board);
      for(const x of [-1.26,1.26])box(.065,1.43,.075,x,0,.02,woodTrim,board,.006);
      for(const y of [-.69,.69])box(2.58,.065,.075,0,y,.02,woodTrim,board,.006);
      const documentMaps=Array.from({length:8},(_,k)=>canvasMaterial(256,360,(c,w,h)=>{
        c.fillStyle=['#d8c9a7','#cbb88e','#ded5bb','#b7a787'][k%4];c.fillRect(0,0,w,h);
        c.fillStyle='#62513d';c.fillRect(22,27,96,5);c.fillStyle='#5e534744';
        for(let y=54;y<330;y+=11){let end=24+random()*60;c.fillRect(22,y,w-end-22,1+random());}
        if(k%3===0){c.fillStyle='#514b40';c.fillRect(28,80,196,116);c.fillStyle='#8b8878';for(let i=0;i<18;i++)c.fillRect(random()*180+30,random()*90+84,18+random()*40,2+random()*10);}
        if(k===4){c.strokeStyle='#817b61';for(let i=0;i<7;i++){c.beginPath();c.moveTo(25,random()*290+30);c.lineTo(230,random()*290+30);c.stroke();}}
      }));
      for(let i=0;i<(boardImage?.naturalWidth?0:17);i++){
        const x=-1.03+(i%6)*.40+(random()-.5)*.08,y=.43-Math.floor(i/6)*.40+(random()-.5)*.08;
        const sheet=box(.31,.39,.002,x,y,.032+i*.0004,documentMaps[i%8],board);sheet.rotation.z=(random()-.5)*.12;sheet.castShadow=false;
        const pin=cylinder(.009,.009,.009,x,y+.17,.043+i*.0004,brass,board,10);pin.rotation.x=Math.PI/2;
      }
      for(const sign of [-1,1])for(let z=-3.0;z<3.2;z+=.65){if(sign<0&&z>-1.7&&z<.1)continue;box(.032,1.67,.63,sign*3.12,2.15,z,woodDark,details,.003);}
      for(let x=-2.85;x<3;x+=.63)box(.61,1.67,.032,x,2.15,-3.30,woodDark,details,.003);
      // Individually recessed panel fields and molding create real grazing-light edges.
      for(let x=-2.85;x<3.0;x+=.63){
        box(.59,1.12,.032,x,.69,-3.28,woodDark,details,.004);
        for(const dx of [-.28,.28])box(.018,1.08,.022,x+dx,.69,-3.25,woodTrim,details,.003);
        box(.60,.035,.035,x,1.27,-3.24,woodTrim,details,.003);
      }
      for(const sign of [-1,1]) for(let z=-2.9;z<3.1;z+=.68){
        box(.034,1.12,.63,sign*3.10,.69,z,woodDark,details,.004);
        box(.036,1.12,.025,sign*3.075,.69,z-.30,woodTrim,details,.003);
      }
      const ceilingJoinery=new T.Group();details.add(ceilingJoinery);
      for(let x=-2.72;x<3;x+=.90)box(.075,.14,6.65,x,2.96,0,woodTrim,ceilingJoinery,.004);
      for(let z=-3.0;z<3.3;z+=.90)box(6.25,.14,.075,0,2.96,z,woodTrim,ceilingJoinery,.004);
      for(let x=-2.7;x<3;x+=.9)for(let z=-3;z<3.3;z+=.9)box(.78,.018,.78,x+.45,3.025,z+.45,woodDark,ceilingJoinery);
      // A low pile rug: woven pattern, dull colors and slight physical edge lift.
      const rugMat=canvasMaterial(1024,1024,(c,w,h)=>{
        c.fillStyle='#29231f';c.fillRect(0,0,w,h);c.strokeStyle='#514334';c.lineWidth=6;
        for(const inset of [26,46,76])c.strokeRect(inset,inset,w-inset*2,h-inset*2);
        for(let y=106;y<940;y+=48)for(let x=106;x<940;x+=48){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.strokeStyle=(x+y)%96?'#483e31':'#42342b';c.lineWidth=3;c.strokeRect(-11,-11,22,22);c.restore();}
        for(let i=0;i<42000;i++){c.fillStyle=random()>.5?'#d3b28a12':'#00000016';c.fillRect(random()*w,random()*h,1,3);}
      });
      rugMat.bumpMap=leatherMicro;rugMat.bumpScale=.0007;rugMat.roughness=1;
      const rug=box(2.70,.012,3.66,0,.008,0,rugMat,details,.003);rug.castShadow=false;
      // Bound ledgers with visible page blocks and individual cover thicknesses.
      const pageEdges=canvasMaterial(256,256,(c,w,h)=>{c.fillStyle='#c2b79b';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=3){c.fillStyle=y%9?'#6e634a33':'#ebe3cb55';c.fillRect(0,y,w,1);}});
      pageEdges.bumpMap=paperMicro;pageEdges.bumpScale=.0002;
      function ledger(x,y,z,w=.28,d=.22,h=.045,parent=details){
        const book=new T.Group();book.position.set(x,y,z);book.rotation.y=(random()-.5)*.13;parent.add(book);
        box(w,h*.70,d,0,0,0,pageEdges,book,.0018);
        for(const sign of [-1,1])box(w+.014,.007,d+.014,0,sign*h*.45,0,leather,book,.0025);
        box(.012,h,d+.014,-w/2,0,0,leather,book,.003);
        for(const zz of [-d*.36,d*.36])box(.014,h*.65,.004,-w/2-.002,0,zz,brass,book,.001);
      }
      for(let i=0;i<4;i++)ledger(-.56+i*.009,.87+i*.051,-.76,.30,.23,.045,details);
      // File tray, brass pen cup and a ceramic mug leave the center clear for the future A4 folio.
      box(.33,.005,.25,.55,.843,.72,darkMetal,details,.001);
      for(const x of [.39,.71])box(.003,.046,.25,x,.863,.72,darkMetal,details,.001);
      box(.33,.046,.003,.55,.863,.60,darkMetal,details,.001);
      for(let i=0;i<9;i++){const sheet=box(.28,.0008,.21,.55+(i%3-1)*.001,.850+i*.0012,.72,paper,details);sheet.rotation.y=(i-4)*.002;}
      const penCupGeo=new T.LatheGeometry([[0,0],[.038,0],[.043,.099],[.041,.105],[.037,.105],[.035,.014],[0,.014]].map(p=>new T.Vector2(...p)),48);geometries.set('pen-cup',penCupGeo);const penCup=new T.Mesh(penCupGeo,brass);penCup.position.set(.57,.8405,-.74);penCup.castShadow=penCup.receiveShadow=true;details.add(penCup);
      for(let i=0;i<3;i++){const pen=cylinder(.003,.003,.20,.55+i*.016,.98,-.74,darkMetal,details,8);pen.rotation.z=(i-1)*.11;}
      const mugProfile=[[0,0],[.040,0],[.046,.006],[.055,.092],[.055,.100],[.051,.104],[.047,.100],[.045,.092],[.039,.015],[0,.015]].map(p=>new T.Vector2(...p));
      const mugGeometry=new T.LatheGeometry(mugProfile,64);geometries.set('mug-lathe',mugGeometry);const mug=new T.Mesh(mugGeometry,ceramic);mug.position.set(-.56,.84,.73);mug.castShadow=mug.receiveShadow=true;details.add(mug);
      const coffee=cylinder(.047,.047,.002,-.56,.942,.73,charcoal,details,32);
      const handle=new T.Mesh(new T.TorusGeometry(.033,.007,16,48),ceramic);handle.position.set(-.62,.90,.73);details.add(handle);
      // Adjustable task lamp on a side records desk; its separate light pools over papers and the board.
      const sideDesk=new T.Group();sideDesk.position.set(-1.95,0,-2.45);details.add(sideDesk);
      box(1.50,.08,.65,0,.85,0,wood,sideDesk,.012);
      for(const x of [-.63,.63])box(.12,.80,.53,x,.42,0,woodDark,sideDesk,.006);
      cylinder(.14,.16,.025,.36,.907,-.10,darkMetal,sideDesk,32);
      function rod(a,b,r,mat,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b);const m=cylinder(r,r,av.distanceTo(bv),0,0,0,mat,parent,12);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...b).sub(new T.Vector3(...a)).normalize());return m;}
      rod([.36,.92,-.1],[.20,1.47,-.1],.014,darkMetal,sideDesk);rod([.20,1.47,-.1],[.47,1.70,-.1],.013,darkMetal,sideDesk);
      const taskShade=new T.Mesh(new T.ConeGeometry(.16,.20,32,1,true),darkMetal);taskShade.position.set(.47,1.61,-.10);taskShade.rotation.z=-.25;sideDesk.add(taskShade);
      const taskLight=new T.SpotLight('#ffd09b',12,4,.78,.9,2);taskLight.position.set(-1.48,1.57,-2.55);taskLight.target.position.set(-1.9,.85,-2.5);scene.add(taskLight,taskLight.target);
      for(let i=0;i<3;i++)ledger(-.35+i*.025,.93+i*.05,.03,.34,.25,.05,sideDesk);
      // Archive boxes, open shelving and varied binders are background detail rather than navigation UI.
      for(let i=0;i<3;i++){
        const x=1.66+(i%2)*.54,z=-2.58+(i===2?.55:0),y=.18;
        box(.46,.35,.42,x,y,z,paper,details,.006);box(.48,.035,.44,x,.37,z,woodTrim,details,.003);box(.11,.035,.004,x,.25,z+.213,charcoal,details,.002);
      }
      const boardLight=new T.PointLight('#edc191',2.6,4.5,2);boardLight.position.set(1.1,2.50,-2.62);scene.add(boardLight);
      // Small real hardware, surface intersections and restrained wear: all at the existing prop locations.
      function tubeHandle(x,y,z,width,parent){
        const path=new T.CatmullRomCurve3([new T.Vector3(x-width/2,y,z),new T.Vector3(x-width/2,y,z+.027),new T.Vector3(x+width/2,y,z+.027),new T.Vector3(x+width/2,y,z)]);
        const geo=new T.TubeGeometry(path,24,.006,10,false);geometries.set('handle-'+geometries.size,geo);const m=new T.Mesh(geo,brass);m.castShadow=true;parent.add(m);
        for(const dx of [-width/2,width/2]){const screw=cylinder(.008,.008,.005,x+dx,y,z,brass,parent,16);screw.rotation.x=Math.PI/2;}
      }
      for(const y of [.48,1.05,1.62])tubeHandle(0,y+.14,.355,.15,tall);
      for(const y of [.31,.57,.83])tubeHandle(0,y+.035,.368,.14,low);
      for(const x of [.39,.71])for(const z of [.61,.83]){const rivet=cylinder(.003,.003,.002,x,.887,z,brass,details,10);rivet.castShadow=false;}
      // Thin vellum layers lift a few selected sheets from the photographic board. The image still determines their layout.
      if(boardImage?.naturalWidth){
        const cropRects=[[.014,.023,.139,.365],[.446,.052,.112,.206],[.852,.027,.133,.322],[.478,.608,.095,.280]];
        for(let i=0;i<cropRects.length;i++){
          const [x,y,w,h]=cropRects[i],map=boardFinish.map.clone();map.repeat.set(w,h);map.offset.set(x,1-y-h);map.needsUpdate=true;textures.set('board-paper-'+i,{color:map});
          const mat=new T.MeshStandardMaterial({map,roughness:.95,bumpMap:paperMicro,bumpScale:.00015,side:T.DoubleSide});ownedMaterials.add(mat);
          const geo=new T.PlaneGeometry(2.46*w,1.30*h,4,6),pos=geo.attributes.position;
          for(let j=0;j<pos.count;j++){const v=pos.getY(j)/(1.30*h)+.5;pos.setZ(j,.0015+Math.pow(1-v,4)*(.005+i*.001));}geo.computeVertexNormals();geometries.set('board-paper-'+i,geo);
          const sheet=new T.Mesh(geo,mat);sheet.position.set((x+w/2-.5)*2.46,(.5-y-h/2)*1.30,.025);sheet.castShadow=sheet.receiveShadow=true;board.add(sheet);
        }
      }
      // Static contact occlusion only, attached to the receiving surfaces. It remains below the soft key-light shadows.
      const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
      const sc=shadowCanvas.getContext('2d'),sg=sc.createRadialGradient(64,64,9,64,64,63);sg.addColorStop(0,'rgba(0,0,0,.58)');sg.addColorStop(.45,'rgba(0,0,0,.28)');sg.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);
      const contactMap=new T.CanvasTexture(shadowCanvas);textures.set('contact-map',{map:contactMap});
      function contact(w,d,x,y,z,opacity=.4,parent=details){const mat=new T.MeshBasicMaterial({map:contactMap,color:'#17130f',transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});ownedMaterials.add(mat);
        const geo=new T.PlaneGeometry(w,d);geometries.set('contact-'+geometries.size,geo);const mesh=new T.Mesh(geo,mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.renderOrder=1;parent.add(mesh);}
      for(const x of [-.62,.62])for(const z of [-.94,.94])contact(.28,.28,x,.023,z,.62);
      for(const z of [-1.54,1.54])contact(.88,.92,0,.023,z,.44);
      contact(1.18,.9,-2.30,.003,-.10,.48);contact(1.12,.87,2.38,.003,-.54,.50);
      contact(.17,.17,-.56,.8405,.73,.42);contact(.45,.34,.55,.8405,.72,.45);contact(.39,.32,-.55,.8405,-.76,.42);contact(.13,.13,.57,.8405,-.74,.35);
      contact(1.8,.9,-1.95,.003,-2.45,.35);

      // Blurred light cards provide subdued metal/leather reflections without an external HDR asset.
      const envCanvas=document.createElement('canvas');envCanvas.width=256;envCanvas.height=128;
      const en=envCanvas.getContext('2d'),eg=en.createLinearGradient(0,0,0,128);eg.addColorStop(0,'#49301d');eg.addColorStop(.5,'#33291f');eg.addColorStop(1,'#100d0a');en.fillStyle=eg;en.fillRect(0,0,256,128);
      en.fillStyle='#a7b1b5';en.shadowColor='#bfc5c1';en.shadowBlur=14;en.fillRect(22,30,22,62);en.fillStyle='#d4ac76';en.fillRect(154,24,48,8);en.shadowBlur=0;
      const env=new T.CanvasTexture(envCanvas);env.mapping=T.EquirectangularReflectionMapping;env.colorSpace=T.SRGBColorSpace;
      const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(env);scene.environment=environment.texture;env.dispose();pmrem.dispose();

      ownedMaterials.forEach(m=>{m.envMap=environment.texture;m.envMapIntensity=m.metalness>.35?.70:.28;});

      let activeView = options.initialView && views[options.initialView] ? options.initialView : 'entry';
      let transition = null, disposed = false;
      function applyView(name) {
        const view = views[name];
        ceiling.visible = name !== 'tabletop'; ceilingJoinery.visible = name !== 'tabletop';
        pendant.visible = name !== 'tabletop';
        camera.up.fromArray(view.up || [0, 1, 0]);
        camera.position.fromArray(view.position);
        lookTarget.fromArray(view.target);
        camera.fov = view.fov; camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
        camera.updateProjectionMatrix(); camera.lookAt(lookTarget);
        return view;
      }
      function size() {
        const rect = container.getBoundingClientRect();
        const width = Math.max(1, rect.width || innerWidth), height = Math.max(1, rect.height || innerHeight);
        if (!shared) renderer.setSize(width, height, false);
        camera.aspect = width / height; camera.updateProjectionMatrix();
      }
      function render() { if (!disposed && !shared) renderer.render(scene, camera); }
      function setView(name) {
        if (!views[name]) throw new RangeError(`Unknown room camera: ${name}`);
        transition?.cancel(); transition = null; activeView = name; applyView(name); render(); return activeView;
      }
      function transitionTo(name, duration = 900) {
        if (!views[name]) return Promise.reject(new RangeError(`Unknown room camera: ${name}`));
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || duration <= 0) { setView(name); return Promise.resolve(); }
        transition?.cancel();
        const from = { p: camera.position.clone(), t: lookTarget.clone(), q: camera.quaternion.clone(), fov: camera.fov };
        const to = views[name], endP = new T.Vector3(...to.position), endT = new T.Vector3(...to.target);
        if (name === 'tabletop') { ceiling.visible = false; ceilingJoinery.visible=false; pendant.visible = false; }
        const endCamera = new T.PerspectiveCamera(to.fov, camera.aspect, camera.near, camera.far);
        endCamera.position.copy(endP); endCamera.up.fromArray(to.up || [0, 1, 0]); endCamera.lookAt(endT);
        const endQuaternion = endCamera.quaternion.clone();
        const started = performance.now(); let cancelled = false;
        const job = { cancel: () => { cancelled = true; } }; transition = job;
        return new Promise(resolve => {
          function frame(now) {
            if (disposed || cancelled) { resolve(); return; }
            const t = clamp((now - started) / duration), e = ease(t);
            camera.position.lerpVectors(from.p, endP, e); lookTarget.lerpVectors(from.t, endT, e);
            camera.fov = from.fov + (to.fov - from.fov) * e;
            camera.quaternion.slerpQuaternions(from.q, endQuaternion, e); camera.updateProjectionMatrix(); render();
            if (t < 1) requestAnimationFrame(frame);
            else { activeView = name; camera.up.fromArray(to.up || [0, 1, 0]); camera.quaternion.copy(endQuaternion);
              ceiling.visible = name !== 'tabletop'; ceilingJoinery.visible = name !== 'tabletop'; pendant.visible = name !== 'tabletop'; transition = null; render(); resolve(); }
          }
          requestAnimationFrame(frame);
        });
      }
      function onResize() { size(); render(); }
      function onContextLost(event) { event.preventDefault(); canvas.hidden = true; container.dataset.roomRenderer = 'unavailable'; }
      function onContextRestored() { canvas.hidden = false; renderer.shadowMap.needsUpdate = true; size(); render(); container.dataset.roomRenderer = 'webgl'; }
      if (!shared) {
      canvas.addEventListener('webglcontextlost', onContextLost);
      canvas.addEventListener('webglcontextrestored', onContextRestored);
      window.addEventListener('resize', onResize, { passive: true });
      container.append(canvas);
      }
      size(); applyView(activeView);
      if (renderer.compileAsync) await deadline(renderer.compileAsync(scene, camera), 7000);
      render();
      if (renderer.getContext().isContextLost() || renderer.info.programs.some(program => program.diagnostics?.runnable === false))
        throw new Error('Room renderer did not produce a valid first frame');
      ready = true; container.dataset.roomRenderer = 'webgl'; container.dataset.roomView = activeView;
      return Object.freeze({
        getScene: () => scene,
        views: Object.freeze(Object.keys(views)),
        setView(name) { const result = setView(name); container.dataset.roomView = result; return result; },
        transitionTo(name, duration) { return transitionTo(name, duration).then(() => { container.dataset.roomView = activeView; }); },
        getView: () => activeView,
        getObjects: () => Object.freeze({ table, investigatorChair: scene.getObjectByName('investigator-chair'), subjectChair: scene.getObjectByName('subject-chair'), mainLight }),
        resize: onResize,
        dispose() {
          if (disposed) return; disposed = true; transition?.cancel();
          window.removeEventListener('resize', onResize);
          canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
          environment.dispose();
          textures.forEach(group => Object.values(group).forEach(texture => texture.dispose()));
          geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(value => value.dispose());
          if (!shared) { renderer.dispose(); canvas.remove(); } delete container.dataset.roomRenderer; delete container.dataset.roomView;
        }
      });
    } catch (error) {
      if (!ready) { textures.forEach(group => Object.values(group).forEach(texture => texture.dispose())); geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(value => value.dispose()); }
      if (!shared) { renderer.dispose(); canvas.remove(); } console.warn('Interrogation room:', error.message); return null;
    }
  }
  window.HNJInterrogationRoom = Object.freeze({ create, views });
})();
