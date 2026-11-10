/* Windowless walnut records room. Metre-scale set, shared corridor renderer and live camera views. */
(() => {
  'use strict';
  const ROOM = Object.freeze({ width: 6.4, depth: 6.8, height: 3.05, fov: 46 });
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = t => t * t * (3 - 2 * t);
  const DESK_Z = -2.64;
  const views = Object.freeze({
    entry: Object.freeze({ position: [0, 1.70, 3.10], target: [0, 1.10, -.55], fov: 48 }),
    seated: Object.freeze({ position: [0, 1.48, DESK_Z + .91], target: [0, 1.05, DESK_Z - .45], fov: 46 }),
    tabletop: Object.freeze({ position: [0, 1.48, DESK_Z + .91], target: [0, .81, DESK_Z + .01], fov: 46 }),
    tape: Object.freeze({ position: [.41, 1.15, DESK_Z + .06], target: [.43, .84, DESK_Z - .38], fov: 44 }),
    reading: Object.freeze({ position: [-.20, 1.62, DESK_Z + .25], target: [-.20, .817, DESK_Z + .185], fov: 35 })
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
      const images = [...document.querySelectorAll('[data-pbr], [data-room], [data-board-print], [data-chair], [data-table], [data-cassette]')];
      await deadline(Promise.all(images.map(image => image.decode())), 20000);
      if (!shared) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      window.HNJCinema?.install(renderer);
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
        const minimum=role==='floor'||role==='parquet'?.72:role==='wall'?.90:role==='leather'?.68:.48;
        value.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,${minimum.toFixed(2)});`);
          if(role==='joinery')shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat timberL=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=vec3(.80,.65,.49)*(timberL*.48+.014);');};
        value.customProgramCacheKey=()=> 'room-cinema-v1-'+role+'-'+minimum;
        ownedMaterials.add(value); return value;
      }
      const wood = material('joinery', '#c4b29c', .68, .21, .55, .8);
      const woodDark = material('joinery', '#9f8b74', .72, .20, .45, .75);
      const woodTrim = material('joinery', '#b0a08b', .66, .17, .5, .45);
      // Keep the scanned walnut albedo and grain; do not pass the hero top through the joinery color override.
      const tableFinish=material('wood','#a17658',.64,.20,1.0,.58);
      for(const m of [woodDark])for(const t of [m.map,m.normalMap,m.roughnessMap]){t.center.set(.5,.5);t.rotation=Math.PI/2;}
      const wall = material('wall', '#72766e', .96, .10, 3.2, 1.7);
      const floor = material('parquet', '#9f9c8b', .85, .15, 2.7, 3.0);
      const ceilingMaterial = material('wall', '#5c6059', 1, .025, 2.3, 1.4);
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
      // Keep this lining on the room side of the threshold. Positive world Z would cover the corridor reader.
      for (const sign of [-1, 1]) box((ROOM.width-1.30)/2,ROOM.height,.16,sign*(1.30/2+(ROOM.width-1.30)/4),ROOM.height/2,halfD-.08,woodDark);
      box(1.30,ROOM.height-2.48,.16,0,2.48+(ROOM.height-2.48)/2,halfD-.08,woodDark);

      // Restrained chair rail and base trim keep the room dimensional without a crime-scene set dressing.
      for (const sign of [-1, 1]) {
        box(.095, .20, ROOM.depth - .14, sign * (halfW - .105), .10, 0, woodTrim);
        box(.052, .055, ROOM.depth - .10, sign * (halfW - .13), .96, 0, woodDark);
        box(.028, .035, ROOM.depth - .10, sign * (halfW - .13), 1.02, 0, woodTrim);
      }
      box(ROOM.width - .24, .20, .055, 0, .10, -halfD + .07, woodTrim);
      for(const side of [-1,1]){
        const skirtingWidth=(ROOM.width-.24-1.30)/2;
        box(skirtingWidth,.20,.055,side*(.65+skirtingWidth/2),.10,halfD-.07,woodTrim);
      }
      for (const y of [1.0, 1.035]) box(ROOM.width - .30, .043, .032, 0, y, -halfD + .09, woodTrim);

      // No exterior window: a shallow recessed records alcove replaces the old blind.
      const alcove=new T.Group();alcove.position.set(-3.04,1.83,-.82);alcove.rotation.y=Math.PI/2;scene.add(alcove);
      box(1.45,1.36,.06,0,0,0,charcoal,alcove,.006);
      for(const x of [-.76,.76])box(.075,1.50,.15,x,0,.05,woodTrim,alcove,.007);
      for(const y of [-.72,.72])box(1.56,.075,.15,0,y,.05,woodTrim,alcove,.007);
      for(const y of [-.31,.10,.49]){
        box(1.42,.035,.18,0,y,.08,wood,alcove,.004);
        for(let i=0;i<9;i++){
          const h=.24+(i%3)*.025,x=-.60+i*.145;
          const folder=box(.105,h,.12,x,y+h/2+.020,.09,binderCloth[i%3],alcove,.003);folder.rotation.z=(i%3-1)*.025;
          box(.055,.023,.002,x,y+h*.65,.153,binderLabel,alcove);
        }
      }

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

      if(window.HNJTableAsset){
        table.children.forEach(m=>m.visible=false);
        const model=window.HNJStaticModel.create(window.HNJTableAsset,'table',{anisotropy,materials:ownedMaterials,geometries,textures});
        model.rotation.y=Math.PI/2;model.scale.set(1.143,.99,1.25);table.add(model);
        // A real, rounded walnut top over the retained asset frame. Six mm
        // edge radii catch the key light geometrically, not in a painted image.
        const top=box(1.46,.045,2.36,0,.7575,0,tableFinish,table,.006);
        top.name='beveled-walnut-tabletop';
      }

      // 2.39 x 1.38 m worktable: retained licensed furniture frame, shorter depth and a wide working edge.
      table.scale.set(1.64,1,.585);
      table.position.z = DESK_Z;
      // The sole chair faces the wall-mounted evidence board.
      const chairLeather=material('leather','#9e8068',.64,.40,1.2,1.2);
      function chair(z, facing) {
        const g = new T.Group(); g.position.z = z; g.rotation.y = facing > 0 ? 0 : Math.PI; g.name = 'investigator-chair'; scene.add(g);
        box(.58, .075, .53, 0, .49, 0, chairLeather, g, .025);
        box(.56, .045, .51, 0, .445, 0, woodDark, g, .006);
        box(.58, .68, .075, 0, .84, -.235, wood, g, .012);
        const cushion=box(.47,.49,.083,0,.84,-.165,chairLeather,g,.035);cushion.rotation.x=-.06;
        for(const sign of [-1,1]){
          const piping=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(sign*.222,.62,-.115),new T.Vector3(sign*.232,.84,-.104),new T.Vector3(sign*.222,1.06,-.130)]),24,.0026,8,false),chairLeather);g.add(piping);geometries.set('piping-'+geometries.size,piping.geometry);
        }
        for(const x of [-.13,.13])for(const y of [.74,.94]){const button=cylinder(.009,.009,.006,x,y,-.141,woodDark,g,12);button.rotation.x=Math.PI/2;}
        box(.034, .64, .045, -.25, .83, -.205, woodTrim, g, .004);
        box(.034, .64, .045, .25, .83, -.205, woodTrim, g, .004);
        for (const x of [-.23, .23]) for (const zz of [-.19, .19]) box(.052, .45, .052, x, .245, zz, woodDark, g, .004);
        for(const x of [-.31,.31]) { box(.065,.055,.49,x,.69,.015,wood,g,.009); box(.035,.20,.035,x,.58,.17,woodTrim,g,.004); }
        return g;
      }
      if(window.HNJChairAsset){
        const model=window.HNJStaticModel.create(window.HNJChairAsset,'chair',{anisotropy,materials:ownedMaterials,geometries,textures});
        model.traverse(o=>{if(o.isMesh){o.material.roughness=.9;o.material.normalScale?.set(.35,.35);o.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,.68);');};o.material.customProgramCacheKey=()=> 'room-chair-soft-leather-v2';}});
        const inspector=model.clone();inspector.name='investigator-chair';inspector.rotation.y=Math.PI;inspector.position.z=DESK_Z+.92;scene.add(inspector);
      }else{chair(DESK_Z+.92,-1);}

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
      for (const y of [.36, .86, 1.36, 1.86]) {
        box(.73, .46, .018, 0, y, .323, cabinetFront, tall, .008);
        box(.16,.018,.025,0,y+.14,.350,brass,tall,.003);
        box(.15,.055,.008,0,y-.03,.343,brass,tall,.002);box(.13,.037,.010,0,y-.03,.349,wall,tall,.001);
      }
      box(.88, .065, .68, 0, 2.20, 0, cabinetPaint, tall, .010);
      // Folded steel plinth, leveling feet and drawer reveals give the cabinet a
      // manufactured construction, rather than a tall solid block on the floor.
      box(.77,.060,.57,0,.055,0,darkMetal,tall,.006);
      for(const x of [-.32,.32])for(const z of [-.23,.23])cylinder(.022,.025,.025,x,.0125,z,darkMetal,tall,20);
      for(const y of [.60,1.10,1.60,2.10])box(.75,.012,.022,0,y,.319,cabinetPaint,tall,.002);
      const lock=cylinder(.011,.011,.006,.28,.49,.340,brass,tall,24);lock.rotation.x=Math.PI/2;
      box(.0018,.009,.001,.28,.49,.344,charcoal,tall);
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
      const pendant = new T.Group(); pendant.position.set(0, 2.86, DESK_Z + .30); scene.add(pendant); pendant.name = 'table-pendant';
      cylinder(.012, .012, .20, 0, .08, 0, darkMetal, pendant, 12);
      const lampShade = new T.Mesh(new T.CylinderGeometry(.23, .36, .18, 36, 1, true), brass);
      lampShade.position.y = -.07; lampShade.castShadow = true; pendant.add(lampShade);
      const diffuser = new T.Mesh(new T.CircleGeometry(.29, 36), shade); diffuser.rotation.x = -Math.PI / 2; diffuser.position.y = -.16; pendant.add(diffuser);
      const mainLight = new T.SpotLight('#fff1e0', 29, 3.35, .67, .68, 1.7);
      mainLight.position.set(-.18, 2.66, DESK_Z + .44); mainLight.target.position.set(0, .78, DESK_Z + .08); mainLight.castShadow = true;
      mainLight.shadow.mapSize.set(2048, 2048); mainLight.shadow.bias = -.00016; mainLight.shadow.normalBias = .0025;
      mainLight.shadow.radius = 5; mainLight.shadow.camera.near = .1; mainLight.shadow.camera.far = 8; scene.add(mainLight, mainLight.target);
      const warmBounce = new T.PointLight('#e4dcd0', 1.32, 2.8, 2); warmBounce.position.set(.8, 1.88, DESK_Z+.72); scene.add(warmBounce);
      const sideLightLevel = .24;
      const wallBounce = new T.DirectionalLight('#c2bfb9', .252 * sideLightLevel); wallBounce.position.set(-.8, 2.45, -2.55); scene.add(wallBounce);
      const sideFill = new T.DirectionalLight('#d4d0c8', .1785 * sideLightLevel); sideFill.position.set(-3.0, 2.2, -1.2); scene.add(sideFill);
      const ambient = new T.HemisphereLight('#c5c1ba', '#49423a', .12); scene.add(ambient);
      scene.add(new T.AmbientLight('#c2b5a1', .035));
      const wallGraze=new T.PointLight('#d1cac0',1.925 * sideLightLevel,3.8,2);wallGraze.position.set(-1.9,2.30,-2.0);scene.add(wallGraze);
      const windowFill=new T.SpotLight('#ded9ce',2.04 * sideLightLevel,6.5,1.0,1,2);windowFill.position.set(-2.82,2.05,-.82);windowFill.target.position.set(.3,.78,0);scene.add(windowFill,windowFill.target);

      // Reference look: layered walnut joinery, coffered ceiling, warm practicals and a working records wall.
      const details = new T.Group(); details.name='room-dressing'; scene.add(details);
      const paper = new T.MeshStandardMaterial({color:'#a4936e',roughness:.97,bumpMap:paperMicro,bumpScale:.00035}); ownedMaterials.add(paper);
      const leather = new T.MeshStandardMaterial({color:'#51392b',roughness:.72,bumpMap:leatherMicro,bumpScale:.0007}); ownedMaterials.add(leather);
      function canvasMaterial(width,height,paint,roughness=.94) {
        const c=document.createElement('canvas');c.width=width;c.height=height;paint(c.getContext('2d'),width,height);
        const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=anisotropy;
        const m=new T.MeshStandardMaterial({map:t,roughness});ownedMaterials.add(m);
        textures.set('detail-'+textures.size,{color:t});return m;
      }
      // Controlled, deterministic surface variation; no heavy full-screen grain or random flicker.
      let seed=6143; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      const cork=canvasMaterial(1024,640,(c,w,h)=>{c.fillStyle='#79502e';c.fillRect(0,0,w,h);for(let i=0;i<48000;i++){const a=random();c.fillStyle=a>.5?'#b8885244':'#25180f33';c.fillRect(random()*w,random()*h,1+random()*3,1+random()*2);}});
      const board = new T.Group();
      board.name = 'records-board';
      board.position.set(0, 1.39, -3.17);
      details.add(board);
      box(2.46,1.12,.045,0,0,0,cork,board);
      for (const x of [-1.26,1.26]) box(.065,1.25,.075,x,0,.02,woodTrim,board,.006);
      for (const y of [-.59,.59]) box(2.58,.065,.075,0,y,.02,woodTrim,board,.006);
      // Each slot is an independent print, replaceable through the image bank in index.html.
      const prints = [
        { id:'wanted', title:'WANTED', x:-.69, y:-.16, w:.35, h:.48, angle:-.064, photo:true },
        { id:'portrait', title:'PHOTO / 01', x:-.42, y:-.37, w:.19, h:.21, angle:.13, photo:true },
        { id:'records', title:'CASE NOTES', x:-.12, y:-.06, w:.32, h:.37, angle:-.08 },
        { id:'reference', title:'REFERENCE', x:.45, y:-.15, w:.24, h:.26, angle:.09, photo:true },
        { id:'memo', title:'MEMO', x:.31, y:-.35, w:.13, h:.12, angle:-.14 },
        { id:'index', title:'HNJ / INDEX', x:.79, y:-.30, w:.24, h:.30, angle:.025 },
        { id:'intake', title:'INTAKE LOG', x:-.92, y:.20, w:.28, h:.27, angle:.08 },
        { id:'field', title:'FIELD NOTE', x:-.44, y:.27, w:.24, h:.25, angle:-.11 },
        { id:'dispatch', title:'DISPATCH', x:.17, y:.30, w:.30, h:.23, angle:.07 },
        { id:'archive', title:'CONTACT SHEET', x:.63, y:.20, w:.34, h:.30, angle:-.055, photo:true },
        { id:'locator', title:'CROSS REF.', x:.97, y:.11, w:.18, h:.14, angle:.16 },
        { id:'followup', title:'FOLLOW UP', x:-.06, y:-.40, w:.21, h:.12, angle:.09 }
      ];
      for (const [i, print] of prints.entries()) {
        const source = document.querySelector('[data-board-print="' + print.id + '"]');
        const mat = canvasMaterial(384,480,(c,w,h)=>{
          c.fillStyle = ['#d2c4a9','#d9cfb7','#c5ab71','#cbbda1'][i%4];
          c.fillRect(0,0,w,h);
          if (source?.naturalWidth) {
            const scale = Math.min(w/source.naturalWidth,h/source.naturalHeight);
            const iw = source.naturalWidth*scale, ih = source.naturalHeight*scale;
            c.drawImage(source,(w-iw)/2,(h-ih)/2,iw,ih);
            return;
          }
          c.fillStyle='#473d32';c.font='bold 38px Georgia';c.fillText(print.title,30,68,w-60);
          if (print.photo) {
            c.strokeStyle='#7b705f';
            c.strokeRect(30,100,w-60,260);
            c.beginPath();c.moveTo(30,100);c.lineTo(w-30,360);c.moveTo(w-30,100);c.lineTo(30,360);c.stroke();
            c.fillStyle='#5f5447';c.font='18px monospace';c.fillText('ARCHIVE PRINT / RESERVED',34,400);
          } else {
            c.fillStyle='#746b5955';
            for (let y=110;y<408;y+=26) c.fillRect(30,y,w-75-(y%52),2);
          }
          c.fillStyle='#5f5447';c.font='20px monospace';
          c.fillText('HNJ / RECORD '+String(i+1).padStart(2,'0'),30,450);
        });
        mat.bumpMap = paperMicro;
        mat.bumpScale = .00015;
        const sheet = box(print.w,print.h,.002,print.x,print.y,.025+i*.0012,mat,board);
        sheet.rotation.z = print.angle;
        const pin = cylinder(.005,.005,.008,print.x-print.h*.44*Math.sin(print.angle),
          print.y+print.h*.44*Math.cos(print.angle),.032+i*.0012,brass,board,12);
        pin.rotation.x = Math.PI/2;
      }
      const thread = new T.MeshStandardMaterial({color:'#713b2a',roughness:.95});
      ownedMaterials.add(thread);
      for(const [from,to] of [[0,2],[2,3],[2,7],[3,9],[8,9]]){
        const anchor = i => {
          const p=prints[i], offset=p.h*.44;
          return new T.Vector3(p.x-offset*Math.sin(p.angle),p.y+offset*Math.cos(p.angle),.043+i*.0012);
        };
        const a=anchor(from), b=anchor(to), mid=a.clone().lerp(b,.5);mid.y-=.016;
        const geometry=new T.TubeGeometry(new T.QuadraticBezierCurve3(a,mid,b),20,.0011,5,false);
        geometries.set('board-thread-'+from+'-'+to,geometry);
        board.add(new T.Mesh(geometry,thread));
      }
      for(const sign of [-1,1])for(let z=-2.8;z<3.3;z+=1.05){if(sign<0&&z>-1.7&&z<.1)continue;box(.032,1.67,1.02,sign*3.12,2.15,z,wood,details,.003);}
      for(let x=-2.65;x<3;x+=1.06)box(1.035,1.67,.032,x,2.15,-3.30,wood,details,.003);
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
      for(let x=-2.40;x<3;x+=1.60)box(.055,.065,6.65,x,3.015,0,woodTrim,ceilingJoinery,.004);
      for(let z=-2.8;z<3.3;z+=1.60)box(6.25,.065,.055,0,3.015,z,woodTrim,ceilingJoinery,.004);

      // A low pile rug: woven pattern, dull colors and slight physical edge lift.
      const rugMat=canvasMaterial(1024,1024,(c,w,h)=>{
        c.fillStyle='#29231f';c.fillRect(0,0,w,h);c.strokeStyle='#514334';c.lineWidth=6;
        for(const inset of [26,46,76])c.strokeRect(inset,inset,w-inset*2,h-inset*2);
        for(let y=106;y<940;y+=48)for(let x=106;x<940;x+=48){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.strokeStyle=(x+y)%96?'#483e31':'#42342b';c.lineWidth=3;c.strokeRect(-11,-11,22,22);c.restore();}
        for(let i=0;i<42000;i++){c.fillStyle=random()>.5?'#d3b28a12':'#00000016';c.fillRect(random()*w,random()*h,1,3);}
      });
      rugMat.bumpMap=leatherMicro;rugMat.bumpScale=.0007;rugMat.roughness=1;
      const rug=box(3.0,.012,2.52,0,.008,0,rugMat,details,.003);rug.castShadow=false;
      // Bound ledgers with visible page blocks and individual cover thicknesses.
      const pageEdges=canvasMaterial(256,256,(c,w,h)=>{c.fillStyle='#c2b79b';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=3){c.fillStyle=y%9?'#6e634a33':'#ebe3cb55';c.fillRect(0,y,w,1);}});
      pageEdges.bumpMap=paperMicro;pageEdges.bumpScale=.0002;
      function ledger(x,y,z,w=.28,d=.22,h=.045,parent=details,cover=leather){
        const book=new T.Group();book.position.set(x,y,z);book.rotation.y=(random()-.5)*.13;parent.add(book);
        box(w,h*.70,d,0,0,0,pageEdges,book,.0018);
        for(const sign of [-1,1])box(w+.014,.007,d+.014,0,sign*h*.45,0,cover,book,.0025);
        box(.012,h,d+.014,-w/2,0,0,cover,book,.003);
        for(const zz of [-d*.36,d*.36])box(.014,h*.65,.004,-w/2-.002,0,zz,brass,book,.001);
      }
      function archiveBinder(x,y,z,w,d,h,color,number,angle){
        const binder=new T.Group();
        binder.position.set(x,y,z);
        binder.rotation.y=angle+(random()-.5)*.055;
        details.add(binder);
        const cover=leather.clone();
        cover.color.set(color);
        cover.roughness=.94;
        cover.bumpMap=leatherMicro;
        cover.bumpScale=.00035;
        ownedMaterials.add(cover);

        const board=.0032;
        for(const sign of [-1,1]){
          box(w,board,d,0,sign*(h-board)/2,0,cover,binder,.0009);
        }
        box(w-.001,h,.007,0,0,d/2-.0035,cover,binder,.0014);
        box(w-.016,h*.62,d-.020,.002,-.003,-.004,pageEdges,binder,.0008);
        box(w-.020,.0012,d-.012,-.002,h*.31-.0024,-.005,paper,binder,.0002);
        const edge=cover.clone();
        edge.color.multiplyScalar(1.17);
        ownedMaterials.add(edge);
        box(w-.012,.00075,.001,0,(h-board)/2+.0013,-d/2+.0008,edge,binder,.0002);

        const label=canvasMaterial(512,128,(c,width,height)=>{
          c.fillStyle='#a39a82';c.fillRect(0,0,width,height);
          c.strokeStyle='#746a58';c.strokeRect(8,8,width-16,height-16);
          c.fillStyle='#3e382e';c.font='bold 36px monospace';
          c.fillText('ARCHIVE / '+number,24,60);
          c.font='23px monospace';c.fillText('REFERENCE COPY',25,97);
        });
        const plate=new T.Mesh(new T.PlaneGeometry(.116,.026),label);
        geometries.set('archive-label-'+number,plate.geometry);
        plate.position.set(-w*.15,0,d/2+.0003);
        plate.receiveShadow=true;
        binder.add(plate);

        const recess=cylinder(.0061,.0061,.0007,w*.31,0,d/2+.0004,darkMetal,binder,24);
        recess.rotation.x=Math.PI/2;
        const ringGeometry=new T.TorusGeometry(.0062,.00075,8,24);
        geometries.set('archive-pull-'+number,ringGeometry);
        const ring=new T.Mesh(ringGeometry,brass);
        ring.position.set(w*.31,0,d/2+.0008);
        ring.receiveShadow=true;
        binder.add(ring);
      }
      archiveBinder(-.51,.862,-.76,.31,.23,.045,'#343332','01',-.055);
      archiveBinder(-.48,.900,-.735,.274,.207,.031,'#343b32','02',.07);
      const penCup=new T.Group();
      penCup.position.set(.57,.8405,-.74);
      details.add(penCup);
      const cupSteel=new T.MeshStandardMaterial({color:'#393735',metalness:.42,roughness:.62});
      ownedMaterials.add(cupSteel);
      const meshCanvas=document.createElement('canvas');
      meshCanvas.width=1024;
      meshCanvas.height=256;
      const meshInk=meshCanvas.getContext('2d');
      meshInk.strokeStyle='#c0c0c0';
      meshInk.lineWidth=3.5;
      for(let x=-320;x<=1344;x+=32){
        for(const slope of [-320,320]){
          meshInk.beginPath();
          meshInk.moveTo(x,0);
          meshInk.lineTo(x+slope,256);
          meshInk.stroke();
        }
      }
      const meshTexture=new T.CanvasTexture(meshCanvas);
      meshTexture.anisotropy=anisotropy;
      textures.set('pen-cup-mesh',{map:meshTexture});
      const meshSteel=cupSteel.clone();
      meshSteel.map=meshTexture;
      meshSteel.alphaTest=.33;
      meshSteel.side=T.DoubleSide;
      ownedMaterials.add(meshSteel);
      const sideGeometry=new T.CylinderGeometry(.041,.036,.084,48,1,true);
      geometries.set('pen-cup-side',sideGeometry);
      const meshWall=new T.Mesh(sideGeometry,meshSteel);
      meshWall.position.y=.049;
      meshWall.castShadow=meshWall.receiveShadow=true;
      penCup.add(meshWall);
      cylinder(.037,.035,.006,0,.003,0,cupSteel,penCup,48);
      for(const [radius,height,wire] of [[.0365,.007,.0018],[.041,.091,.0023]]){
        const geometry=new T.TorusGeometry(radius,wire,10,48);
        geometries.set('pen-cup-rim-'+height,geometry);
        const rim=new T.Mesh(geometry,cupSteel);
        rim.rotation.x=-Math.PI/2;
        rim.position.y=height;
        rim.castShadow=rim.receiveShadow=true;
        penCup.add(rim);
      }

      for(const {foot,edge,length,radius,body} of [
        {foot:[-.012,.006],edge:[-.032,.016],length:.143,radius:.0035,body:darkMetal},
        {foot:[.012,-.005],edge:[.027,-.024],length:.159,radius:.0041,body:charcoal}
      ]){
        const pen=new T.Group();
        pen.position.set(foot[0],.007,foot[1]);
        const axis=new T.Vector3(edge[0]-foot[0],.084,edge[1]-foot[1]).normalize();
        pen.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis);
        penCup.add(pen);
        cylinder(radius,radius*.83,length,0,length/2,0,body,pen,16);
        cylinder(radius*1.13,radius*1.13,.023,0,length-.012,0,body,pen,16);
        cylinder(radius*1.12,radius*1.12,.0014,0,length-.024,0,cupSteel,pen,16);
        box(.0014,.018,.0027,radius*1.14,length-.013,0,cupSteel,pen,.0004);
      }
      const folderMat=canvasMaterial(512,768,(c,w,h)=>{
        const stock=c.createLinearGradient(0,0,w,h);stock.addColorStop(0,'#766146');stock.addColorStop(.28,'#ae966f');stock.addColorStop(1,'#927753');c.fillStyle=stock;c.fillRect(0,0,w,h);
        for(let i=0;i<18000;i++){c.fillStyle=i%2?'#f4e6c00c':'#342a1c0b';c.fillRect(random()*w,random()*h,1,2);}
        const rim=c.createRadialGradient(w*.46,h*.43,h*.16,w*.48,h*.44,h*.64);
        rim.addColorStop(0,'#69462600');rim.addColorStop(1,'#53382091');
        c.fillStyle=rim;c.fillRect(0,0,w,h);
        c.strokeStyle='#b8976840';c.lineWidth=2;
        for(let i=0;i<96;i++){
          const side=i%2,x=side?w-random()*17:random()*17,y=random()*h;
          c.beginPath();c.moveTo(x,y);c.lineTo(x+(side?-1:1)*(3+random()*15),y+random()*9);c.stroke();
        }
        c.fillStyle='#c6b591';
        c.beginPath();c.moveTo(38,72);c.lineTo(474,68);c.lineTo(469,254);c.lineTo(40,258);c.closePath();c.fill();c.strokeStyle='#74654b';c.lineWidth=2;c.strokeRect(48,80,416,165);
        c.fillStyle='#35372f';c.font='18px monospace';c.fillText('SPECIAL INVESTIGATION UNIT',68,117);c.font='bold 37px Georgia';c.fillText('CASE FILE : HNJ',68,180);c.font='17px monospace';c.fillText('RESTRICTED / PERSONNEL ONLY',68,223);
        c.strokeStyle='#89734d';c.beginPath();c.moveTo(17,15);c.lineTo(17,h-15);c.stroke();
      },.94);
      folderMat.bumpMap = paperMicro;
      folderMat.bumpScale = .00055;
      const caseFile=new T.Group();caseFile.name='case-file';caseFile.position.set(-.02,.844,.48);caseFile.rotation.y=-.055;details.add(caseFile);
      const binding = new T.MeshStandardMaterial({
        color: '#645039', roughness: .94, bumpMap: paperMicro, bumpScale: .00035
      });
      ownedMaterials.add(binding);
      box(.265,.0016,.371,0,.0008,0,binding,caseFile,.0007);
      box(.006,.011,.355,-.126,.006,0,binding,caseFile,.002);
      const cover=new T.Mesh(new T.PlaneGeometry(.253,.355,16,20),folderMat);cover.rotation.x=-Math.PI/2;cover.position.y=.009;const coverVertices=cover.geometry.attributes.position;for(let i=0;i<coverVertices.count;i++){const x=coverVertices.getX(i),y=coverVertices.getY(i);coverVertices.setZ(i,.0014*Math.pow(Math.max(0,(x+.1265)/.253),4)*Math.pow(Math.max(0,(.1775-y)/.355),2));}cover.geometry.computeVertexNormals();cover.castShadow=true;caseFile.add(cover);geometries.set('case-cover',cover.geometry);

      // A dark leather blotter grounds the folder and separates the wood from loose papers.
      const blotter=material('leather','#665c4c',.88,.08,3.2,2.0);
      const blotterMesh=box(1.04,.004,.68,0,.841,.21,blotter,details,.006);
      // Place the blotter below the folder; all paper geometry stays above the tabletop.
      caseFile.position.y=.8445;
      for(const sign of [-1,1])box(.003,.001,.63,sign*.36,.845,.21,darkMetal,details,.001);
      // Wall practicals: frosted cylindrical lamps, nickel/bronze mount and a real warm falloff.
      for(const x of [-2.95,2.95]){
        const fixture=new T.Group();fixture.position.set(x,2.15,-3.21);details.add(fixture);
        box(.105,.31,.035,0,0,0,darkMetal,fixture,.009);
        const glowMat=new T.MeshStandardMaterial({color:'#ddcfad',emissive:'#ffdeac',emissiveIntensity:1.1 * sideLightLevel,roughness:.5});ownedMaterials.add(glowMat);
        cylinder(.047,.047,.25,0,.03,.09,glowMat,fixture,48);
        for(const y of [-.11,.17])cylinder(.062,.062,.022,0,y,.09,brass,fixture,32);
        const glow=new T.PointLight('#ffdfae',1.6 * sideLightLevel,3.3,2);glow.position.set(x,2.17,-2.97);scene.add(glow);
      }
      // Adjustable task lamp on a side records desk; its separate light pools over papers and the board.
      const sideDesk=new T.Group();sideDesk.position.set(-1.95,0,-2.45);details.add(sideDesk);
      box(1.50,.08,.65,0,.85,0,wood,sideDesk,.012);
      for(const x of [-.63,.63])box(.12,.80,.53,x,.42,0,woodDark,sideDesk,.006);
      cylinder(.14,.16,.025,.36,.907,-.10,darkMetal,sideDesk,32);
      function rod(a,b,r,mat,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b);const m=cylinder(r,r,av.distanceTo(bv),0,0,0,mat,parent,12);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...b).sub(new T.Vector3(...a)).normalize());return m;}
      rod([.36,.92,-.1],[.20,1.47,-.1],.014,darkMetal,sideDesk);rod([.20,1.47,-.1],[.47,1.70,-.1],.013,darkMetal,sideDesk);
      const taskShade=new T.Mesh(new T.ConeGeometry(.16,.20,32,1,true),darkMetal);taskShade.position.set(.47,1.61,-.10);taskShade.rotation.z=-.25;sideDesk.add(taskShade);
      const taskLight=new T.SpotLight('#ffe0bc',5.6,2.6,.78,.9,2);taskLight.position.set(-1.48,1.57,-2.55);taskLight.target.position.set(-1.9,.85,-2.5);scene.add(taskLight,taskLight.target);
      for(let i=0;i<3;i++)ledger(-.35+i*.025,.93+i*.05,.03,.34,.25,.05,sideDesk);
      // Archive boxes, open shelving and varied binders are background detail rather than navigation UI.
      for(let i=0;i<3;i++){
        const x=1.66+(i%2)*.54,z=-2.58+(i===2?.55:0),y=.18;
        box(.46,.35,.42,x,y,z,paper,details,.006);box(.48,.035,.44,x,.37,z,woodTrim,details,.003);box(.11,.035,.004,x,.25,z+.213,charcoal,details,.002);
      }
      const boardLight=new T.SpotLight('#ebd7bd',2.3,3.0,.69,.68,2);
      boardLight.position.set(.15,2.62,-2.17);
      boardLight.target.position.set(0,1.39,-3.17);
      scene.add(boardLight,boardLight.target);
      // Small real hardware, surface intersections and restrained wear: all at the existing prop locations.
      function tubeHandle(x,y,z,width,parent){
        const path=new T.CatmullRomCurve3([new T.Vector3(x-width/2,y,z),new T.Vector3(x-width/2,y,z+.027),new T.Vector3(x+width/2,y,z+.027),new T.Vector3(x+width/2,y,z)]);
        const geo=new T.TubeGeometry(path,24,.006,10,false);geometries.set('handle-'+geometries.size,geo);const m=new T.Mesh(geo,brass);m.castShadow=true;parent.add(m);
        for(const dx of [-width/2,width/2]){const screw=cylinder(.008,.008,.005,x+dx,y,z,brass,parent,16);screw.rotation.x=Math.PI/2;}
      }
      for(const y of [.36,.86,1.36,1.86])tubeHandle(0,y+.14,.355,.15,tall);
      for(const y of [.31,.57,.83])tubeHandle(0,y+.035,.368,.14,low);
      // Static contact occlusion only, attached to the receiving surfaces. It remains below the soft key-light shadows.
      const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
      const sc=shadowCanvas.getContext('2d'),sg=sc.createRadialGradient(64,64,9,64,64,63);sg.addColorStop(0,'rgba(0,0,0,.58)');sg.addColorStop(.45,'rgba(0,0,0,.28)');sg.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);
      const contactMap=new T.CanvasTexture(shadowCanvas);textures.set('contact-map',{map:contactMap});
      function contact(w,d,x,y,z,opacity=.4,parent=details){const mat=new T.MeshBasicMaterial({map:contactMap,color:'#17130f',transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});ownedMaterials.add(mat);
        const geo=new T.PlaneGeometry(w,d);geometries.set('contact-'+geometries.size,geo);const mesh=new T.Mesh(geo,mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.renderOrder=1;parent.add(mesh);}
      for(const x of [-1.0168,1.0168])for(const z of [-.55,.55])contact(.28,.28,x,.023,z+DESK_Z,.62);
      contact(.88,.92,0,.023,DESK_Z+.92,.44);
      contact(1.18,.9,-2.30,.003,-.10,.48);contact(1.12,.87,2.38,.003,-.54,.50);
      contact(.39,.32,-.55,.8405,-.76,.42);contact(.103,.106,.57,.8395,-.74,.43);
      contact(1.8,.9,-1.95,.003,-2.45,.35);

      // A 778 mm real tabletop (instead of the old 838 mm slab). Keep all tabletop
      // props and their contact planes on that surface; leave floor and wall dressing alone.
      if(window.HNJTableAsset)for(const child of details.children){
        if(Math.abs(child.position.x)<.85&&Math.abs(child.position.z)<1.2&&child.position.y>=.839&&child.position.y<1.15)child.position.y-=.059;
      }

      // Re-space only objects on the working surface, not wall/cabinet dressing.
      for(const child of details.children){if(Math.abs(child.position.x)<.85&&Math.abs(child.position.z)<1.2&&child.position.y>=.77&&child.position.y<1.10){if(child.position.x>=.32&&child.position.z>=.59&&child.position.y<.94){child.position.x+=.214;child.position.z-=.902;}child.position.x*=1.42;child.position.z*=.55;}}
      const workSurface = new T.Group();
      workSurface.position.z = DESK_Z;
      const surfacePieces = details.children.filter(child => Math.abs(child.position.x)<1.18 && Math.abs(child.position.z)<.72 && child.position.y>=.77 && child.position.y<1.10);
      details.add(workSurface);
      workSurface.add(...surfacePieces);
      // The coaster, foot ring and coffee surface share the same metre-scale origin.
      const mugSet = new T.Group();
      mugSet.name = 'cream-stoneware-mug';
      mugSet.position.set(-.613,window.HNJTableAsset ? .780 : .8375,-.066);
      workSurface.add(mugSet);
      const cup = new T.Group();
      const coasterTop = .006;
      cup.position.set(.003,coasterTop,-.001);
      cup.rotation.set(0,.82,0);
      mugSet.add(cup);
      function potteryPart(name,profile,material,parent) {
        const geometry=new T.LatheGeometry(profile.map(point=>new T.Vector2(...point)),96);
        geometries.set(name,geometry);
        const mesh=new T.Mesh(geometry,material);
        mesh.castShadow=mesh.receiveShadow=true;
        parent.add(mesh);
        return mesh;
      }
      const coffee = new T.MeshPhysicalMaterial({
        color:'#160704',roughness:.29,ior:1.34,
        specularIntensity:.37,specularColor:'#f8dfbf'
      });
      const coaster = new T.MeshStandardMaterial({
        color:'#483327',roughness:.86,bumpMap:leatherMicro,bumpScale:.00032
      });
      const cutEdge = new T.MeshStandardMaterial({
        color:'#30231c',roughness:.96,bumpMap:leatherMicro,bumpScale:.00025
      });
      const foot = new T.MeshStandardMaterial({color:'#b9a992',roughness:.7});
      for(const mat of [coffee,coaster,cutEdge,foot]) ownedMaterials.add(mat);
      potteryPart('mug-coaster-cut-edge',[
        [0,0],[.078,0],[.0805,.0007],[.0815,.002],[.0814,.0043],[.0806,.005],[0,.005]
      ],cutEdge,mugSet);
      potteryPart('mug-coaster-leather',[
        [.0806,.0046],[.081,.0049],[.0802,.0056],[.0789,coasterTop],
        [.0755,coasterTop],[.0747,.0057],[.074,.0057],[.0733,coasterTop],[0,coasterTop]
      ],coaster,mugSet);
      const source = window.HNJMugAsset;
      const ceramic = new T.MeshPhysicalMaterial({
        color:'#d9cdb8',metalness:source.pbr.metallicFactor,
        roughness:.34,ior:1.48,clearcoat:.24,clearcoatRoughness:.29,
        bumpMap:paperMicro,bumpScale:.000035,
        side:T.DoubleSide
      });
      ownedMaterials.add(ceramic);
      const mugGeometry = new T.BufferGeometry();
      mugGeometry.setAttribute('position',new T.Float32BufferAttribute(source.positions,3));
      mugGeometry.setAttribute('normal',new T.Float32BufferAttribute(source.normals,3));
      mugGeometry.setIndex(source.indices);
      geometries.set('coffee-cart-white-mug',mugGeometry);
      const mug = new T.Mesh(mugGeometry,ceramic);
      mug.castShadow = mug.receiveShadow = true;
      cup.scale.setScalar(.86);
      // The imported rim and base are already level. Lift the body only by the foot height.
      mug.position.y = .0015;
      cup.add(mug);
      potteryPart('mug-ceramic-foot',[
        [.043,.0017],[.043,0],[.0485,0],[.050,.0007],[.0505,.0017]
      ],foot,cup);
      // Raise only the last millimetres at the wall to form a restrained meniscus.
      const liquid = potteryPart('mug-coffee-meniscus',[
        [.0481,.0932],[.0477,.0922],[.0471,.0917],[.046,.0915],[.044,.0914],[0,.0914]
      ],coffee,cup);
      liquid.castShadow = false;
      contact(.196,.188,.002,.00025,.002,.58,mugSet);
      contact(.122,.117,.003,coasterTop+.00022,-.001,.76,mugSet);
      const vaporCanvas=document.createElement('canvas');
      vaporCanvas.width=vaporCanvas.height=64;
      const vaporContext=vaporCanvas.getContext('2d');
      const mist=vaporContext.createRadialGradient(32,32,0,32,32,31);
      mist.addColorStop(0,'#fff');
      mist.addColorStop(.45,'#ffffff55');
      mist.addColorStop(1,'#ffffff00');
      vaporContext.fillStyle=mist;
      vaporContext.fillRect(0,0,64,64);
      const vaporMap=new T.CanvasTexture(vaporCanvas);
      textures.set('coffee-vapor',{map:vaporMap});
      const wisps=Array.from({length:10},()=>{
        const material=new T.SpriteMaterial({map:vaporMap,color:'#eee2d1',transparent:true,opacity:0,depthWrite:false});
        ownedMaterials.add(material);
        const wisp=new T.Sprite(material);
        wisp.visible=false;
        cup.add(wisp);
        return wisp;
      });
      function animateSteam(seconds){
        wisps.forEach((wisp,index)=>{
          const age=(seconds/(2.4+index*.11)+index/wisps.length)%1;
          const drift=Math.sin(seconds*1.7+index*2.4);
          wisp.visible=true;
          wisp.position.set(drift*(.004+age*.018),.094+age*.17,Math.sin(index*3+seconds)*.012);
          wisp.scale.set(.014+age*.035,.035+age*.048,1);
          wisp.material.opacity=.155*Math.sin(Math.PI*age)*(1-age);
        });
      }
      const newsprint = canvasMaterial(512,640,(ctx,w,h)=>{
        ctx.fillStyle='#bcb19a';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle='#3a3530';
        ctx.font='bold 40px Georgia';
        ctx.fillText('EVENING EDITION',24,58);
        ctx.fillRect(24,110,w-48,2);
        ctx.fillRect(24,76,w-48,2);
        for(let column=0;column<3;column++){
          const x=24+column*159;
          for(let row=0;row<34;row++){
            ctx.fillStyle=row%7===0?'#4a4136':'#51493f89';
            ctx.fillRect(x,130+row*14,139-(row*17+column*11)%35,row%7===0?5:2);
          }
        }
      });
      newsprint.side=T.DoubleSide;
      newsprint.bumpMap=paperMicro;
      newsprint.bumpScale=.00018;
      const loosePaper=pageEdges.clone();
      loosePaper.side=T.DoubleSide;
      ownedMaterials.add(loosePaper);
      const deskTop=window.HNJTableAsset ? .780 : .8375;
      function paperStack(name,x,z,angle,layers){
        const stack=new T.Group();
        stack.position.set(x,deskTop,z);
        stack.rotation.y=angle;
        workSurface.add(stack);
        const [baseWidth,baseDepth]=layers[0];
        contact(baseWidth*1.22,baseDepth*1.20,x,deskTop+.0002,z,.51,workSurface);
        let height=0;
        for(const [i,[width,depth,dx,dz,rotation,thickness]] of layers.entries()){
          const bundle=new T.Group();
          bundle.position.set(dx,height+thickness,dz);
          bundle.rotation.y=rotation;
          stack.add(bundle);
          box(width-.0015,thickness,depth-.0015,0,-thickness/2,0,pageEdges,bundle,.00025);
          const top=new T.PlaneGeometry(width,depth,12,10);
          const points=top.attributes.position;
          const curl=i===layers.length-1?.0032:0;
          for(let n=0;n<points.count;n++){
            const u=points.getX(n)/width+.5;
            const v=points.getY(n)/depth+.5;
            points.setZ(n,.00012+curl*u**6*v**3);
          }
          top.computeVertexNormals();
          geometries.set('desk-newspaper-'+name+'-'+i,top);
          const sheet=new T.Mesh(top,i%2?newsprint:loosePaper);
          sheet.rotation.x=-Math.PI/2;
          sheet.castShadow=sheet.receiveShadow=true;
          bundle.add(sheet);
          height+=thickness+.00012;
        }
      }
      // Larger working packet on the left, with a shorter set of reference slips on the right.
      paperStack('working',-.535,-.225,-.13,[
        [.223,.167,0,0,-.025,.0034],
        [.210,.153,.008,-.004,.055,.0028],
        [.227,.159,-.008,.006,-.077,.0041],
        [.202,.149,.012,.003,.092,.0025],
        [.214,.156,-.004,-.009,-.047,.0036],
        [.189,.137,-.016,.010,.11,.0023],
        [.207,.147,.009,-.004,-.10,.0032],
        [.174,.124,.016,.009,.071,.0022]
      ]);
      paperStack('reference',.578,.095,.19,[
        [.165,.119,0,0,.015,.0025],
        [.153,.112,-.011,.004,-.085,.0020],
        [.171,.121,.008,-.008,.105,.0028],
        [.142,.101,-.013,.007,-.045,.0019]
      ]);
      for(const [i,[x,z,r]] of [[-.62,.19,.032],[-.54,.32,.023],[.87,.45,.024]].entries()){
        const soften=i<2;
        const geometry=new T.IcosahedronGeometry(1,3);
        const vertices=geometry.attributes.position;
        for(let n=0;n<vertices.count;n++){
          const a=vertices.getX(n),b=vertices.getY(n),c=vertices.getZ(n);
          const fold=.8+.24*Math.sin(a*16+b*11+c*13+i)*Math.cos(b*17-c*13)+.16*Math.sin(a*7-c*11);
          if(soften){
            const ridge=Math.abs(Math.sin(a*8+b*3-c*6+i*1.7));
            const volume=.82+.085*Math.sin(a*4.2+b*3.1+c*2.5+i)
              +.045*Math.sin(c*9-a*5+b*4)-.085*ridge**3;
            vertices.setXYZ(n,a*volume*r,b*volume*r*(i===0?1.02:.91),c*volume*r*(i===0?.91:1.02));
          }else vertices.setXYZ(n,a*fold*r,b*fold*r*1.12,c*fold*r*.89);
        }
        geometry.computeBoundingBox();
        geometry.computeVertexNormals();
        if(soften){
          const normals=geometry.attributes.normal;
          const sums=new Map();
          const key=i=>[vertices.getX(i),vertices.getY(i),vertices.getZ(i)]
            .map(value=>Math.round(value*1e6)).join('/');
          const normal=new T.Vector3();
          for(let n=0;n<normals.count;n++){
            const id=key(n);
            if(!sums.has(id))sums.set(id,new T.Vector3());
            sums.get(id).add(normal.fromBufferAttribute(normals,n));
          }
          for(let n=0;n<normals.count;n++){
            normal.fromBufferAttribute(normals,n).lerp(sums.get(key(n)).normalize(),.72).normalize();
            normals.setXYZ(n,normal.x,normal.y,normal.z);
          }
        }
        geometry.translate(0,-geometry.boundingBox.min.y,0);
        geometries.set('desk-crumpled-paper-'+i,geometry);
        const wad=new T.Mesh(geometry,i===1?newsprint:loosePaper);
        wad.position.set(x,deskTop,z);
        wad.rotation.y=.8+i*1.6;
        wad.castShadow=wad.receiveShadow=true;
        workSurface.add(wad);
        contact(r*(soften?2.15:2.6),r*(soften?1.95:2.4),x,deskTop+.0002,z,soften?.54:.62,workSurface);
      }
      caseFile.position.set(.018,.7855,.18);
      const readingFileScale=1.12;
      const deskFileScale=readingFileScale*1.15;
      caseFile.scale.setScalar(readingFileScale);
      // Desk evidence is real metre-scale geometry. Text uses local canvas labels, never a scene plate.
      const deskItems={};
      function deskCard(key,label,x,z,pw,ph,color){
        const cv=document.createElement('canvas'),portrait=key.startsWith('photo');cv.width=portrait?512:768;cv.height=portrait?768:512;const c=cv.getContext('2d'),w=cv.width,h=cv.height;
        c.fillStyle=color;c.fillRect(0,0,w,h);for(let i=0;i<6500;i++){c.fillStyle=i%2?'#ffffff06':'#30291e06';c.fillRect(random()*w,random()*h,1,1);}if(portrait){c.fillStyle='#73736b';c.fillRect(30,30,w-60,h-180);c.strokeStyle='#9b9788';c.strokeRect(30,30,w-60,h-180);}else{c.strokeStyle='#958770';c.strokeRect(24,24,w-48,h-48);}
        c.fillStyle='#34332d';c.font=portrait?'20px monospace':'28px monospace';c.textAlign='center';c.fillText(label,w/2,portrait?h-85:h/2,w-70);
        const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;textures.set('desk-'+key,{color:tex});
        const mat=new T.MeshStandardMaterial({map:tex,roughness:.94,bumpMap:paperMicro,bumpScale:.00018,side:T.DoubleSide});ownedMaterials.add(mat);
        const geo=new T.PlaneGeometry(pw,ph,12,16),vertices=geo.attributes.position;for(let i=0;i<vertices.count;i++){const u=vertices.getX(i)/pw+.5,v=vertices.getY(i)/ph+.5;const curl = key==='note' ? .0018 : .0025;vertices.setZ(i,curl*Math.pow(u,6)*Math.pow(1-v,3));}geo.computeVertexNormals();geometries.set('desk-'+key,geo);const mesh=new T.Mesh(geo,mat);
        mesh.rotation.x=-Math.PI/2;mesh.position.set(x,key==='photo'?.786:key==='photo3'?.787:key==='photo2'?.785:.791,z);mesh.castShadow=mesh.receiveShadow=true;workSurface.add(mesh);deskItems[key]=mesh;if(key==='photo'&&window.HNJCaseData?.photo){const image=new Image();image.onload=()=>{c.fillStyle='#e5dfd0';c.fillRect(0,0,w,h);const scale=Math.min((w-48)/image.width,(h-48)/image.height);c.drawImage(image,(w-image.width*scale)/2,(h-image.height*scale)/2,image.width*scale,image.height*scale);tex.needsUpdate=true;};image.src=window.HNJCaseData.photo;}return mesh;
      }
      deskCard('photo','PHOTO / ASSET PENDING',.280,.240,.126,.165,'#b7b2a4').rotation.z=.27;
      const note = deskCard('note','',.37,.06,.133,.114,'#c4b48e');
      note.rotation.z=-.25;
      note.position.y=.7879;
      const pad = new T.Group();
      pad.position.set(note.position.x,.782,note.position.z);
      pad.rotation.y=-.25;
      deskItems.fitNoteToDesk=()=>{
        const narrow=container.clientWidth/Math.max(1,container.clientHeight)<.65;
        note.position.x=pad.position.x=narrow?.135:.37;
        note.position.z=pad.position.z=narrow?-.075:.06;
      };
      deskItems.fitNoteToDesk();
      workSurface.add(pad);
      for(let i=0;i<7;i++){
        box(.133,.0008,.114,(i%3-1)*.00026,.0004+i*.0008,0,i%2?pageEdges:paper,pad,.00015);
      }
      const noteVertices=note.geometry.attributes.position;
      const noteRest=Float32Array.from({length:noteVertices.count},(_,i)=>noteVertices.getZ(i));
      deskItems.curlNote = lift => {
        for(let i=0;i<noteVertices.count;i++){
          const u=noteVertices.getX(i)/.133+.5;
          const v=noteVertices.getY(i)/.114+.5;
          noteVertices.setZ(i,noteRest[i]+lift*u**3*(1-v)**2);
        }
        noteVertices.needsUpdate=true;
        note.geometry.computeVertexNormals();
      };
      deskItems.writeNote = value => {
        const texture=note.material.map;
        const ctx=texture.image.getContext('2d');
        ctx.fillStyle='#c4b48e';
        ctx.fillRect(0,0,768,512);
        ctx.fillStyle='#423a2a';
        ctx.font='28px serif';
        ctx.textAlign='left';
        const lines=value.match(/[^\n]{1,22}|\n/g)||[];
        lines.filter(line=>line!=='\n').slice(0,8).forEach((line,i)=>ctx.fillText(line,52,87+i*47,664));
        texture.needsUpdate=true;
      };
      deskCard('photo2','PHOTO / 02',-.358,.062,.148,.181,'#b9b4a7').rotation.z=-.29;
      deskCard('photo3','PHOTO / 03',-.456,.116,.128,.159,'#b5b0a2').rotation.z=.095;
      const wireMetal=new T.MeshStandardMaterial({color:'#aaa496',metalness:.76,roughness:.32});
      ownedMaterials.add(wireMetal);
      function fastenerWire(name,parent,points,radius=.00085){
        const curve=new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)));
        const geometry=new T.TubeGeometry(curve,48,radius,8,false);
        geometries.set(name,geometry);
        const wire=new T.Mesh(geometry,wireMetal);
        wire.castShadow=true;
        parent.add(wire);
      }
      // The outer loop crosses the top edge and returns beneath the paper.
      fastenerWire('folder-paperclip',caseFile,[
        [-.081,.012,-.137],[-.081,.012,-.192],[-.076,.010,-.201],
        [-.070,.005,-.196],[-.070,.004,-.146],[-.064,.005,-.139],
        [-.059,.009,-.146],[-.059,.012,-.181]
      ]);
      const binder=new T.Group();
      binder.position.set(.133,.007,.051);
      caseFile.add(binder);
      box(.014,.013,.029,.006,0,0,darkMetal,binder,.001);
      for(const side of [-1,1]){
        const jaw=box(.018,.0015,.028,-.003,side*.004,0,darkMetal,binder,.0006);
        jaw.rotation.z=side*.16;
        fastenerWire('folder-binder-handle-'+side,binder,[
          [.005,side*.006,-.011],[-.009,side*.009,-.008],
          [-.028,side*.011,-.005],[-.034,side*.012,0],
          [-.028,side*.011,.005],[-.009,side*.009,.008],[.005,side*.006,.011]
        ],.00075);
      }
      const cassette = new T.Group();
      cassette.name = 'cassette-player';
      cassette.position.set(.53,.782,-.37);
      const deckScale=1.416;
      cassette.scale.setScalar(deckScale);
      cassette.rotation.y = -.10;
      workSurface.add(cassette);

      // The well is built from rails, so the tape can physically sit below the rim.
      box(.28,.025,.177,0,.0125,0,darkMetal,cassette,.006);
      const fascia = canvasMaterial(1024,128,(ctx,w,h)=>{
        ctx.fillStyle='#8e897b';ctx.fillRect(0,0,w,h);
        for(let y=0;y<h;y++){
          ctx.fillStyle=y%3?'#e5ded719':'#39352c19';ctx.fillRect(0,y,w,1);
        }
        ctx.fillStyle='#302e28';ctx.fillRect(0,98,w,24);
        ctx.font='bold 25px monospace';ctx.fillText('CASSETTE RECORDER',35,42);
        ctx.font='16px monospace';ctx.fillText('PORTABLE / MONO',36,71);
        ctx.textAlign='center';
        ['STOP','REW','PLAY','REC'].forEach((name,i)=>ctx.fillText(name,315+i*148,72));
        ctx.fillStyle='#722c22';ctx.fillRect(884,35,10,10);
      },.55);
      fascia.metalness=.26;
      box(.28,.036,.037,0,.042,.069,darkMetal,cassette,.004);
      const fasciaFace = new T.Mesh(new T.PlaneGeometry(.270,.028),fascia);
      fasciaFace.position.set(0,.043,.0876);
      fasciaFace.receiveShadow=true;
      geometries.set('cassette-fascia',fasciaFace.geometry);
      cassette.add(fasciaFace);
      for(const x of [-.127,.127]){
        const screw=cylinder(.0025,.0025,.002,x,.034,.088,brass,cassette,12);
        screw.rotation.x=Math.PI/2;
      }
      box(.28,.033,.023,0,.041,-.077,darkMetal,cassette,.003);
      box(.066,.033,.137,-.107,.041,-.007,darkMetal,cassette,.003);
      box(.025,.033,.137,.127,.041,-.007,darkMetal,cassette,.003);
      // The 100.5 × 64.7 mm cassette seats in a 127 × 82 mm pocket.
      const pocket = { x:.029, y:.033, z:-.009, width:.127, depth:.082 };
      const carrier = new T.MeshStandardMaterial({
        color:'#3c3933',roughness:.72,metalness:.24
      });
      ownedMaterials.add(carrier);
      box(.155,.004,.112,pocket.x,.030,pocket.z,charcoal,cassette);
      for (const sign of [-1,1]) {
        box(.017,.017,.112,pocket.x+sign*(pocket.width/2+.0085),.040,pocket.z,carrier,cassette,.002);
        box(pocket.width,.017,.014,pocket.x,.040,pocket.z+sign*(pocket.depth/2+.007),carrier,cassette,.002);
        const guide = cylinder(.0018,.0018,.006,pocket.x+sign*.056,.035,pocket.z-.026,brass,cassette,12);
        guide.castShadow = false;
      }
      for (const offset of [-.0276,.0276]) {
        const hub = pocket.x+offset;
        cylinder(.010,.010,.002,hub,.0335,pocket.z-.005,darkMetal,cassette,24);
        cylinder(.003,.003,.006,hub,.036,pocket.z-.005,brass,cassette,16);
      }
      const head = box(.012,.006,.006,pocket.x,.035,pocket.z+.038,brass,cassette,.001);
      head.castShadow = false;
      cylinder(.003,.003,.007,pocket.x+.031,.035,pocket.z+.035,charcoal,cassette,20);
      box(.052,.003,.108,-.107,.058,-.009,carrier,cassette,.0015);
      for (let i=0;i<9;i++) {
        box(.043,.0007,.0032,-.107,.0598,-.056+i*.011,charcoal,cassette,.00025);
      }
      for(const x of [-.048,.105]){
        const hingePin=cylinder(.004,.004,.018,x,.060,-.066,brass,cassette,16);
        hingePin.rotation.z=Math.PI/2;
      }
      const playCap = new T.MeshStandardMaterial({
        color:'#514c40',roughness:.52,metalness:.28
      });
      ownedMaterials.add(playCap);
      let playKey;
      for (let i=0;i<4;i++) {
        const key=box(.024,.006,.019,-.052+i*.039,.062,.069,i===2?playCap:darkMetal,cassette,.002);
        if(i===2) playKey=key;
      }
      const playLegend = canvasMaterial(128,64,(ctx,w,h)=>{
        ctx.fillStyle='#514c40';ctx.fillRect(0,0,w,h);
        ctx.fillStyle='#e4d9bc';ctx.font='bold 29px monospace';
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('▶',w/2,h/2);
      },.58);
      const legend = new T.Mesh(new T.PlaneGeometry(.016,.013),playLegend);
      geometries.set('cassette-play-legend',legend.geometry);
      legend.rotation.x=-Math.PI/2;
      legend.position.y=.00315;
      legend.receiveShadow=true;
      playKey.add(legend);

      const statusLight = new T.MeshStandardMaterial({
        color:'#6f3b28',emissive:'#ed6133',emissiveIntensity:0,roughness:.48
      });
      ownedMaterials.add(statusLight);
      box(.004,.002,.005,.111,.059,.062,statusLight,cassette,.0005);

      const lid = new T.Group();
      lid.position.set(.029,.059,-.066);
      cassette.add(lid);
      for (const x of [-.081,.081]) box(.017,.009,.121,x,0,.06,darkMetal,lid,.0015);
      for (const z of [.007,.113]) box(.17,.009,.016,0,0,z,darkMetal,lid,.0015);
      const glass = new T.MeshStandardMaterial({
        color:'#766953',transparent:true,opacity:.22,roughness:.25,depthWrite:false
      });
      ownedMaterials.add(glass);
      box(.145,.0015,.092,0,0,.06,glass,lid);

      const tape = new T.Group();
      tape.name = 'cassette-tape';
      const tapeRest = new T.Vector3(.215,.789,-.33);
      tape.position.copy(tapeRest);
      tape.rotation.y = .23;
      workSurface.add(tape);
      const tapeModel = window.HNJStaticModel.create(window.HNJTapeAsset,'cassette',
        {anisotropy,materials:ownedMaterials,geometries,textures});
      tapeModel.position.y = .0036;
      tape.scale.setScalar(deckScale*1.2);
      tape.add(tapeModel);
      // Spindles sit inside the two apertures of the scanned cassette mesh.
      const reels = [-.0216,.0216].map(x=>{
        const reel=new T.Group();
        reel.position.set(x,.0013,-.0031);
        tapeModel.add(reel);
        cylinder(.0038,.0038,.0007,0,0,0,charcoal,reel,20);
        for(let tooth=0;tooth<3;tooth++){
          const angle=tooth*2*Math.PI/3;
          const spoke=box(.0009,.0005,.0028,Math.sin(angle)*.0018,.00055,Math.cos(angle)*.0018,
            brass,reel,.0001);
          spoke.rotation.y=angle;
        }
        return reel;
      });
      let running=false;
      deskItems.tape = tape;
      deskItems.tapeDeck = {
        lidAt(progress) { lid.rotation.x = -1.15 * progress; },
        playKey,
        insertAt(progress) {
          const seat = new T.Vector3(pocket.x,pocket.y,pocket.z);
          cassette.localToWorld(seat);
          workSurface.worldToLocal(seat);
          const lift=ease(clamp(progress/.24));
          const slide=ease(clamp((progress-.20)/.48));
          const drop=ease(clamp((progress-.68)/.32));
          const clearance=seat.y+.080;
          tape.position.copy(tapeRest).lerp(seat,slide);
          tape.position.y=T.MathUtils.lerp(T.MathUtils.lerp(tapeRest.y,clearance,lift),seat.y,drop);
          tape.rotation.set(-.24*lift*(1-slide),T.MathUtils.lerp(.23,-.10,slide),0);
        },
        pressKey(depth) {
          playKey.position.y=.062-.0045*depth;
        },
        setPlaying(playing) {
          running=playing;
          statusLight.emissiveIntensity=playing?.85:0;
        },
        advanceReels(seconds) {
          if(!running)return false;
          reels[0].rotation.y-=seconds*1.8;
          reels[1].rotation.y-=seconds*2.2;
          return true;
        }
      };
      const liner = new T.MeshStandardMaterial({
        color:'#ab9068',roughness:.96,bumpMap:paperMicro,bumpScale:.00022
      });
      const leafPaper = new T.MeshStandardMaterial({
        color:'#c6b591',roughness:.96,bumpMap:paperMicro,bumpScale:.00014
      });
      const insertPaper = leafPaper.clone();
      insertPaper.color.set('#c9b99d');
      ownedMaterials.add(liner);ownedMaterials.add(leafPaper);ownedMaterials.add(insertPaper);
      const coverHinge = new T.Group();
      coverHinge.position.set(-.1265,.013,0);
      caseFile.add(coverHinge);
      const backing = box(.253,.0016,.355,.1265,-.00125,0,binding,coverHinge,.001);
      backing.castShadow=false;
      box(.242,.0007,.345,.1265,-.0025,0,liner,coverHinge,.0005);
      coverHinge.add(cover);
      cover.position.set(.1265,0,0);
      box(.067,.0014,.022,.061,-.00065,-.186,liner,coverHinge,.001);

      // The projected reader is the top leaf. A few offset inserts sit directly
      // beneath it, with some retained on the inside cover as it turns.
      const inserts = [
        [coverHinge,.239,.351,.129,-.0034,-.004,.023,insertPaper],
        [coverHinge,.232,.343,.122,-.0043,.003,-.016,leafPaper],
        [caseFile,.244,.355,.006,.0054,.004,-.021,leafPaper],
        [caseFile,.238,.360,.010,.0064,-.006,.027,insertPaper],
        [caseFile,.232,.344,.002,.0074,.003,-.014,leafPaper]
      ];
      for(const [parent,width,depth,x,y,z,angle,stock] of inserts){
        const sheet=box(width,.00055,depth,x,y,z,stock,parent,.00015);
        sheet.rotation.y=angle;
      }
      deskItems.readingFileScale=readingFileScale;
      deskItems.setFileOpen=amount=>{
        const aspect=container.clientWidth/Math.max(1,container.clientHeight);
        const fittedDeskScale=deskFileScale*Math.min(1,aspect/.62);
        const scale=T.MathUtils.lerp(fittedDeskScale,readingFileScale,amount);
        caseFile.scale.x=caseFile.scale.z=scale;
        coverHinge.rotation.z=Math.PI*amount;
      };
      deskItems.setFileOpen(0);
      deskItems.file=caseFile;deskItems.cassette=cassette;

      // Loose forms and a capped pen sit clear of the projected click targets.
      for (let i=0;i<3;i++) {
        const form = box(.205,.0007,.146,-.66+i*.018,.782+i*.001,-.28+i*.012,
          pageEdges,workSurface,.0002);
        form.rotation.y = -.24+i*.09;
      }
      const pen = new T.Group();
      const capRadius=.0052;
      const matTop=blotterMesh.position.y+.002;
      pen.position.set(.305,matTop+capRadius,.414);
      pen.rotation.y=1.34;
      deskItems.pen=pen;
      workSurface.add(pen);
      const barrel = cylinder(.0045,.0047,.091,0,0,-.014,darkMetal,pen,24);
      barrel.rotation.x = Math.PI/2;
      const cap = cylinder(capRadius,capRadius,.043,0,0,.047,charcoal,pen,24);
      cap.rotation.x = Math.PI/2;
      const collar = cylinder(.0049,.0049,.004,0,0,.025,brass,pen,24);
      collar.rotation.x = Math.PI/2;
      const tip = cylinder(.0038,.0012,.012,0,0,-.065,brass,pen,20);
      tip.rotation.x = -Math.PI/2;
      box(.0023,.001,.028,0,.0054,.047,brass,pen,.0004);

      // Blurred light cards provide subdued metal/leather reflections without an external HDR asset.
      const envCanvas=document.createElement('canvas');envCanvas.width=256;envCanvas.height=128;
      const en=envCanvas.getContext('2d'),eg=en.createLinearGradient(0,0,0,128);eg.addColorStop(0,'#34312a');eg.addColorStop(.5,'#28251f');eg.addColorStop(1,'#100d0a');en.fillStyle=eg;en.fillRect(0,0,256,128);
      en.fillStyle='#a99d87';en.shadowColor='#c4b69d';en.shadowBlur=14;en.fillRect(22,30,22,62);en.fillStyle='#d4ac76';en.fillRect(154,24,48,8);en.shadowBlur=0;
      const env=new T.CanvasTexture(envCanvas);env.mapping=T.EquirectangularReflectionMapping;env.colorSpace=T.SRGBColorSpace;
      const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(env);scene.environment=environment.texture;env.dispose();pmrem.dispose();

      ownedMaterials.forEach(m=>{m.envMap=environment.texture;m.envMapIntensity=m.metalness>.35?.38:.12;});
      ceramic.envMapIntensity=.24;
      coffee.envMapIntensity=.16;

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
        getDeskItems:()=>deskItems, animateSteam,
        getViewPose: name => views[name],
        views: Object.freeze(Object.keys(views)),
        setView(name) { const result = setView(name); container.dataset.roomView = result; return result; },
        transitionTo(name, duration) { return transitionTo(name, duration).then(() => { container.dataset.roomView = activeView; }); },
        getView: () => activeView,
        getObjects: () => Object.freeze({ table, investigatorChair: scene.getObjectByName('investigator-chair'), mainLight }),
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
