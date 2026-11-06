/* Real, metre-scale corridor. Static architecture; only the first-person camera moves.
   Closed-door architecture; the access module controls only the reader and camera. PBR maps are local CC0 assets (assets/pbr/).
   Canvas textures below contain lighting/contact shading, not repainted photographs. */
(() => {
  'use strict';
  const SPACE = Object.freeze({ width: 2.48, height: 2.94, length: 13.8, doorPitch: 2.10,
    eye: 1.61, startZ: 7.25, endZ: 3.20, fov: 51, targetY: 1.41 });
  const clamp = x => Math.max(0, Math.min(1, x));
  // Short cosine acceleration, a steady walking pace, then a longer soft stop.
  // The integrated velocity has no speed discontinuity at either end of the four-second shot.
  const travelAt = value => {
    const t = clamp(value), a = .14, b = .25, v = 1 / (1 - (a + b) / 2);
    if (t < a) return v * .5 * (t - a / Math.PI * Math.sin(Math.PI * t / a));
    if (t > 1 - b) { const r = 1 - t; return 1 - v * .5 * (r - b / Math.PI * Math.sin(Math.PI * r / b)); }
    return v * (t - a / 2);
  };
  let active = null;
  let pending = null;
  // A single bounded build is shared by prewarming, entry and the access module.
  function deadline(promise, ms, label) {
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})])
      .finally(()=>clearTimeout(timer));
  }
  async function create(stage) {
    if (active) return active;
    if (pending) return pending;
    pending = build(stage);
    try { return await pending; } finally { pending = null; }
  }

  async function build(stage) {
    const T = window.THREE;
    if (!T) return null;
    const canvas = document.createElement('canvas');
    canvas.className = 'corridor-webgl';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '따뜻한 조명과 월넛 문이 이어지는 입체 복도');
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch { return null; }
    try {
      await deadline(Promise.all([...document.querySelectorAll('[data-pbr]')].filter(image=>/^(joinery|wall|floor)-/.test(image.dataset.pbr)).map(image => image.decode())), 20000, 'Material loading timed out');
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      window.HNJCinema?.install(renderer);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;

      const scene = new T.Scene();
      scene.background = new T.Color('#171411');
      const camera = new T.PerspectiveCamera(SPACE.fov, 16 / 9, .06, 32);
      const geometry = new Map();
      const instanceGeometries = [];
      const sideDoors = [];
      const half = SPACE.width / 2, centreZ = SPACE.length / 2 - .05;
      const textureCache = new Map();
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      function texture(role, type, rx = 1, ry = 1, vertical = false) {
        const key = `${role}-${type}-${rx}-${ry}-${vertical}`;
        if (textureCache.has(key)) return textureCache.get(key);
        const img = document.querySelector(`[data-pbr="${role}-${type}"]`);
        const t = new T.Texture(img);
        t.colorSpace = type === 'color' ? T.SRGBColorSpace : T.NoColorSpace;
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.center.set(.5, .5);
        if (vertical) t.rotation = Math.PI / 2;
        t.anisotropy = anisotropy;
        t.needsUpdate = true;
        textureCache.set(key, t);
        return t;
      }
      function pbr(role, color, roughness, normal, rx = 1, ry = 1, vertical = false) {
        return new T.MeshStandardMaterial({ color,
          map: texture(role, 'color', rx, ry, vertical),
          normalMap: texture(role, 'normal', rx, ry, vertical), normalScale: new T.Vector2(normal, normal),
          roughnessMap: texture(role, 'roughness', rx, ry, vertical), roughness,
          metalness: 0, envMapIntensity: role==='joinery'?.18:.35 });
      }
      // The same local maps are reused at physical scales, rather than stretched over a whole wall.
      const wood = pbr('joinery', '#bdad98', .64, .22, .55, 1.15, true);
      const woodPanel = pbr('joinery', '#c4b29b', .65, .20, .48, 1.0, true);
      const woodRail = pbr('joinery', '#a9957b', .63, .16, .8, .2, false);
      const woodTrim = pbr('joinery', '#a79783', .63, .17, .35, 1, true);
      const wallSide = pbr('wall', '#72766e', 1, .055, SPACE.length / 1.2, SPACE.height / 1.2);
      const wallEnd = pbr('wall', '#85887e', 1, .055, SPACE.width / 1.2, SPACE.height / 1.2);
      const ceiling = pbr('wall', '#65675e', 1, .035, SPACE.width, SPACE.length);
      const floor = pbr('floor', '#b9b9ae', .82, .12, SPACE.width / 2.56, SPACE.length / 2.56);
      ceiling.map = null;
      const brass = new T.MeshStandardMaterial({ color: '#a58b60', metalness: .80, roughness: .42, envMapIntensity: .75 });
      const darkMetal = new T.MeshStandardMaterial({ color: '#302d26', metalness: .55, roughness: .62, envMapIntensity: .35 });
      const gap = new T.MeshStandardMaterial({ color: '#181612', roughness: 1 });
      const bulb = new T.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffedcb', emissiveIntensity: 1.9, roughness: .5 });
      const woodMaterials = new Set([wood, woodPanel, woodRail, woodTrim]);
      function finishSurface(material, minimumRoughness, saturation, timber = false) {
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${minimumRoughness.toFixed(2)});`);
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
            `#include <map_fragment>\nfloat neutral = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));\ndiffuseColor.rgb = ${timber?'vec3(.80,.65,.49)*(neutral*.48+.014)':'mix(vec3(neutral), diffuseColor.rgb, '+saturation.toFixed(2)+')'};`);
          if (timber) {
            // All three PBR maps shift together per repeated door; no altered bitmap assets are needed.
            shader.vertexShader = '#ifdef USE_INSTANCING\nattribute vec2 textureShift;\n#endif\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',
              '#include <uv_vertex>\n#ifdef USE_INSTANCING\nvMapUv += textureShift;\nvNormalMapUv += textureShift;\nvRoughnessMapUv += textureShift;\n#endif');
          }
        };
        material.customProgramCacheKey = () => `hnj-surface-${minimumRoughness}-${saturation}-${timber}`;
      }
      woodMaterials.forEach(m => finishSurface(m, .66, .72, true));
      finishSurface(floor, .68, .35);
      finishSurface(wallSide, .87, .75); finishSurface(wallEnd, .87, .75);
      finishSurface(ceiling, .90, .75);

      // Soft contact occlusion only: a few centimetres around the door casing and wall junctions.
      const haloCanvas = document.createElement('canvas'); haloCanvas.width = 256; haloCanvas.height = 512;
      const hc = haloCanvas.getContext('2d');
      hc.shadowColor = 'rgba(0,0,0,.5)'; hc.shadowBlur = 13; hc.fillStyle = '#000';
      hc.fillRect(20, 22, 216, 470); hc.shadowBlur = 0;
      hc.globalCompositeOperation = 'destination-out'; hc.fillRect(22, 24, 212, 466);
      const haloTexture = new T.CanvasTexture(haloCanvas);
      const haloMaterial = new T.MeshBasicMaterial({ map: haloTexture, transparent: true, opacity: .32, depthWrite: false });
      const edgeCanvas = document.createElement('canvas'); edgeCanvas.width = 128; edgeCanvas.height = 8;
      const ed = edgeCanvas.getContext('2d'); const eg = ed.createLinearGradient(0,0,128,0);
      eg.addColorStop(0,'rgba(0,0,0,.65)'); eg.addColorStop(.35,'rgba(0,0,0,.22)'); eg.addColorStop(1,'rgba(0,0,0,0)');
      ed.fillStyle = eg; ed.fillRect(0,0,128,8);
      const edgeTexture = new T.CanvasTexture(edgeCanvas);
      const edgeMaterial = new T.MeshBasicMaterial({ map: edgeTexture, transparent: true, opacity: .27, depthWrite: false });
      function contact(w, h, x, y, z, yaw = 0, roll = 0) {
        const m = new T.Mesh(new T.PlaneGeometry(w,h), edgeMaterial);
        m.position.set(x,y,z); m.rotation.set(0,yaw,roll); scene.add(m);
      }

      // A soft room-light environment supplies the metal/varnish response without any HDR download.
      const envCanvas = document.createElement('canvas'); envCanvas.width = 512; envCanvas.height = 256;
      const ec = envCanvas.getContext('2d');
      const gradient = ec.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, '#62574a'); gradient.addColorStop(.4, '#443a2c');
      gradient.addColorStop(.6, '#2c251d'); gradient.addColorStop(1, '#15110d');
      ec.fillStyle = gradient; ec.fillRect(0, 0, 512, 256);
      for (const x of [65, 250, 450]) {
        const glow = ec.createRadialGradient(x, 42, 2, x, 42, 65);
        glow.addColorStop(0, '#e6c68c'); glow.addColorStop(.2, '#b39b70aa'); glow.addColorStop(1, '#b39b7000');
        ec.fillStyle = glow; ec.fillRect(x - 65, 0, 130, 120);
      }
      const env = new T.CanvasTexture(envCanvas); env.mapping = T.EquirectangularReflectionMapping; env.colorSpace = T.SRGBColorSpace;
      const pmrem = new T.PMREMGenerator(renderer);
      const environment = pmrem.fromEquirectangular(env); scene.environment = environment.texture;
      env.dispose(); pmrem.dispose();

      function box(w, h, d, x, y, z, material, parent = scene, bevel = 0) {
        const key = [w, h, d, bevel].join('/');
        if (!geometry.has(key)) {
          let g;
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
            g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
            g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);
          } else g = new T.BoxGeometry(w, h, d);
          geometry.set(key, g);
        }
        const m = new T.Mesh(geometry.get(key), material); m.position.set(x, y, z);
        m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
      }
      function cylinder(r1, r2, height, x, y, z, material, parent = scene, segments = 24) {
        const key = `cylinder/${r1}/${r2}/${height}/${segments}`;
        if (!geometry.has(key)) geometry.set(key, new T.CylinderGeometry(r1, r2, height, segments));
        const m = new T.Mesh(geometry.get(key), material);
        m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
      }
      // Continuous mitred moulding: real ogee/bead cross section, not four flat strips.
      // Each rectangular ring follows the same profile so corners meet without overlap.
      function rectangleFrame(parent,w,h,y,z,thickness,material,openBottom=false){
        const key=`moulding/${w}/${h}/${thickness}/${openBottom}`;
        if(!geometry.has(key)){
          const profile=[[0,0],[.06,.001],[.13,.004],[.20,.006],[.28,.0065],[.36,.006],
            [.45,.004],[.54,.003],[.63,.004],[.70,.008],[.76,.011],[.83,.012],[.90,.010],[1,0]];
          const positions=[],uv=[],index=[];
          for(let side=0;side<4;side++){
            if(openBottom&&side===0)continue;
            const base=positions.length/3;
            for(const [inset,depth] of profile){const a=w/2-inset*thickness,b=h/2-inset*thickness;
              const corners=[[-a,-b],[a,-b],[a,b],[-a,b]];
              for(let end=0;end<2;end++){
                const [x,yy]=corners[(side+end)%4];positions.push(x,yy,depth*Math.min(2,thickness/.032));
                // Each mitred member has its own longitudinal grain, including the head.
                uv.push(end*(side%2?h:w)/.85,inset*thickness/.85);
              }
            }
            for(let j=0;j<profile.length-1;j++){const a=base+j*2,b=a+1,c=a+2,d=a+3;index.push(a,b,c,b,d,c);}
          }
          const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();geometry.set(key,g);
        }
        const m=new T.Mesh(geometry.get(key),material);m.position.set(0,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
      }
      function door(x, z, rotation = 0, main = false) {
        const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; scene.add(g);
        g.name = main ? 'investigation-door-closed' : 'office-door-closed';
        box(1.30, 2.44, .04, 0, 1.22, -.02, gap, g);
        box(1.16, 2.34, .065, 0, 1.18, .018, wood, g, .008);
        box(.89, 1.45, .016, 0, 1.48, .055, woodPanel, g, .004);
        box(.89, .43, .016, 0, .38, .055, woodPanel, g, .004);
        rectangleFrame(g, .965, 1.53, 1.48, .071, .032, woodTrim);
        rectangleFrame(g, .965, .51, .38, .071, .032, woodTrim);
        rectangleFrame(g, .904, 1.466, 1.48, .080, .009, woodRail);
        rectangleFrame(g, .904, .446, .38, .080, .009, woodRail);
        const leafGeometryEnd=g.children.length;
        box(.112, 2.48, .14, -.644, 1.24, .05, woodTrim, g, .006);
        box(.112, 2.48, .14, .644, 1.24, .05, woodTrim, g, .006);
        box(1.42, .15, .15, 0, 2.43, .05, woodRail, g, .006);
        box(.023, 2.52, .018, -.723, 1.26, .10, woodRail, g);
        box(.023, 2.52, .018, .723, 1.26, .10, woodRail, g);
        box(1.49, .026, .025, 0, 2.522, .10, woodRail, g);
        box(1.20, .012, .18, 0, .006, .04, brass, g);
        const rosette = cylinder(.043, .043, .018, .45, 1.04, .075, brass, g); rosette.rotation.x = Math.PI / 2;
        if (!geometry.has('door-lever')) geometry.set('door-lever', new T.TubeGeometry(new T.CatmullRomCurve3([
          new T.Vector3(.45, 1.04, .09), new T.Vector3(.45, 1.04, .14),
          new T.Vector3(.40, 1.035, .155), new T.Vector3(.28, 1.035, .155),new T.Vector3(.265,1.035,.143)
        ]), 32, .0105, 12, false));
        const lever = new T.Mesh(geometry.get('door-lever'), brass); lever.castShadow = true; g.add(lever);
        for (const y of [1.014, 1.066]) {
          const screw = cylinder(.004, .004, .004, .45, y, .086, brass, g, 12); screw.rotation.x = Math.PI / 2;
          box(.0045, .0008, .001, .45, y, .089, gap, g);
        }
        for (const y of [.35, 1.2, 2.06]) cylinder(.011, .011, .083, -.576, y, .063, brass, g, 12);
        if (!geometry.has('door-contact')) geometry.set('door-contact', new T.PlaneGeometry(1.70, 2.75));
        const halo = new T.Mesh(geometry.get('door-contact'), haloMaterial);
        halo.position.set(0,1.28,-.004); g.add(halo);
        if (main) {
          g.children[0].visible=false;
          const leaf=new T.Group();leaf.position.x=-.58;leaf.name='hinged-door-leaf';
          const moving=g.children.filter((m,i)=>(i>=1&&i<leafGeometryEnd)||m===lever||(m.position.x>.20&&m.position.y>.9&&m.position.y<1.12));
          g.add(leaf);for(const m of moving){g.remove(m);m.position.x+=.58;leaf.add(m);}g.userData.leaf=leaf;
        } else { g.userData.variant = sideDoors.length; sideDoors.push(g); }
        rectangleFrame(g,1.42,2.55,1.27,.122,.075,woodTrim,true);
        // Three-part jamb reveal and strike plate provide scale at the latch.
        box(.018,2.36,.030,.590,1.18,.058,woodRail,g,.002);
        box(.018,2.36,.030,-.590,1.18,.058,woodRail,g,.002);
        box(.020,.125,.035,.600,1.04,.077,brass,g,.002);
        box(.021,.034,.009,.601,1.04,.098,gap,g,.001);

        return g;
      }

      // Wall joinery stops at the outside of each jamb rather than crossing the leaf.
      const officeDoorCenters = [];
      for (let z=1.35; z<SPACE.length-.8; z+=SPACE.doorPitch) officeDoorCenters.push(z);
      const jambHalfWidth = .76;
      const wallSpans = [];
      let spanStart = 0;
      for (const z of officeDoorCenters) {
        if (z-jambHalfWidth>spanStart) wallSpans.push([spanStart,z-jambHalfWidth]);
        spanStart=z+jambHalfWidth;
      }
      if (spanStart<SPACE.length) wallSpans.push([spanStart,SPACE.length]);
      function wallStrip(width,height,x,y,material,bevel=0) {
        for (const [start,end] of wallSpans) {
          box(width,height,end-start,x,y,(start+end)/2,material,scene,bevel);
        }
      }

      // Geometry, repetition and proportions change together; SPACE controls the complete corridor.
      for(const sign of [-1,1]) box((SPACE.width+.32-1.30)/2,SPACE.height+.16,.16,sign*(.65+(SPACE.width+.32-1.30)/4),SPACE.height/2,-.13,wallEnd);
      box(1.30,SPACE.height+.16-2.48,.16,0,2.48+(SPACE.height+.16-2.48)/2,-.13,wallEnd);
      box(.16, SPACE.height + .16, SPACE.length, -half - .08, SPACE.height / 2, centreZ, wallSide);
      box(.16, SPACE.height + .16, SPACE.length, half + .08, SPACE.height / 2, centreZ, wallSide);
      box(SPACE.width + .32, .12, SPACE.length, 0, SPACE.height + .06, centreZ, ceiling);
      box(SPACE.width + .12, .10, SPACE.length, 0, -.05, centreZ, floor);
      for (const sign of [-1, 1]) {
        wallStrip(.065,.145,sign*(half-.026),.0725,woodTrim);
        wallStrip(.032,.032,sign*(half-.053),.158,woodRail);
        wallStrip(.035,.045,sign*(half-.03),.91,woodRail);
        box(.12, .10, SPACE.length, sign * (half - .06), SPACE.height - .06, centreZ, ceiling);
        box(.055, .045, SPACE.length, sign * (half - .07), SPACE.height - .135, centreZ, ceiling);
        for (const z of officeDoorCenters)
          door(sign * (half - .012), z, sign > 0 ? -Math.PI / 2 : Math.PI / 2);
        // Contact shading at the skirting and the two rear wall junctions, with a short falloff.
        contact(.18, SPACE.length, sign * (half - .004), .09, centreZ,
          sign > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI / 2);
        contact(.22, SPACE.height, sign * (half - .11), SPACE.height / 2, -.044, 0, sign > 0 ? Math.PI : 0);
      }
      box(SPACE.width, .145, .065, 0, .0725, .015, woodTrim);
      box(SPACE.width, .10, .12, 0, SPACE.height - .06, .02, ceiling);
      contact(.18, SPACE.width, 0, .09, -.044, 0, Math.PI / 2);
      const mainDoor = door(0, .045, 0, true);

      // Continuous walnut wainscot, recessed fields, stone border and restrained brass reveals.
      // These are architectural members with real thickness, not baked fake door photographs.
      for(const sign of [-1,1]){
        wallStrip(.038,1.05,sign*(half-.022),.525,woodPanel);
        wallStrip(.070,.075,sign*(half-.052),1.07,woodRail,.006);
        wallStrip(.076,.009,sign*(half-.057),1.113,brass);
        for(let z=.46;z<SPACE.length;z+=.70){
          if (!wallSpans.some(([start,end]) => z-.31>=start && z+.31<=end)) continue;
          const field=box(.018,.71,.57,sign*(half-.050),.56,z,wood,scene,.003);
          box(.028,.025,.60,sign*(half-.065),.19,z,woodTrim,scene,.003);
          box(.028,.025,.60,sign*(half-.065),.93,z,woodTrim,scene,.003);
          box(.028,.76,.025,sign*(half-.065),.56,z-.29,woodTrim,scene,.003);
        }
        wallStrip(.135,.005,sign*(half-.10),.007,darkMetal);
        for(let z=.6;z<SPACE.length;z+=SPACE.doorPitch){
          // Solid piers and stepped ceiling soffits break long, perfectly flat wall planes.
          if (officeDoorCenters.every(center => Math.abs(z-center)>jambHalfWidth+.04))
            box(.065,1.79,.075,sign*(half-.032),2.0,z,woodTrim,scene,.004);
        }
      }
      // Ceiling bays align with the doors; ivory inset fields sit behind dark cornices.
      for(let z=.58;z<SPACE.length;z+=2.15){
        box(SPACE.width,.10,.10,0,SPACE.height-.07,z,woodRail,scene,.004);
        for(const sign of [-1,1])box(.14,.12,2.12,sign*(half-.12),SPACE.height-.09,z+1.02,woodTrim,scene,.004);
      }
      const plaqueCanvas=document.createElement('canvas');plaqueCanvas.width=512;plaqueCanvas.height=128;
      const pc=plaqueCanvas.getContext('2d');pc.fillStyle='#292a25';pc.fillRect(0,0,512,128);pc.strokeStyle='#9c8865';pc.lineWidth=3;pc.strokeRect(7,7,498,114);pc.fillStyle='#c5b48f';pc.font='26px Georgia';pc.textAlign='center';pc.fillText('RECORDS  /  04',256,76);
      const plaqueMap=new T.CanvasTexture(plaqueCanvas);plaqueMap.colorSpace=T.SRGBColorSpace;textureCache.set('door-plaque',plaqueMap);
      const plaque=new T.MeshStandardMaterial({map:plaqueMap,metalness:.35,roughness:.48});
      box(.36,.09,.008,0,1.97,.093,plaque,mainDoor.userData.leaf,.003).position.x=.58;

      // STEP 03: bottom-entry nickel reader, mounted on the existing end wall.
      // The 140 mm mouth accepts the top edge of a portrait card moving upward.
      const reader = new T.Group(); reader.position.set(.97, 1.34, .035); scene.add(reader);
      reader.name = 'investigation-card-slot';
      const nickelCanvas = document.createElement('canvas'); nickelCanvas.width = 256; nickelCanvas.height = 256;
      const nc = nickelCanvas.getContext('2d'); nc.fillStyle = '#92908a'; nc.fillRect(0,0,256,256);
      for (let y=0;y<256;y++) { nc.fillStyle = `rgba(${y%3?230:30},${y%3?229:29},${y%3?223:27},${.010+(y*17%11)*.001})`; nc.fillRect(0,y,256,1); }
      const nickelMap = new T.CanvasTexture(nickelCanvas); nickelMap.colorSpace = T.SRGBColorSpace;
      const nickel = new T.MeshStandardMaterial({color:'#e3e0d7',map:nickelMap,metalness:.65,roughness:.52,envMapIntensity:1.3,emissive:'#4b463e',emissiveIntensity:.06});
      const readerFace = nickel.clone();
      box(.218,.304,.018,0,0,.007,darkMetal,reader,.008);
      box(.202,.286,.062,0,0,.038,nickel,reader,.008);
      box(.184,.262,.012,0,.004,.074,readerFace,reader,.005);
      // Bottom-facing throat and two metal lips, not a hotel-style proximity pad.
      box(.148,.012,.038,0,-.146,.053,gap,reader);
      box(.176,.010,.016,0,-.151,.087,nickel,reader,.003);
      box(.176,.008,.012,0,-.149,.023,nickel,reader,.002);
      for (const y of [-.11,.113]) for(const x of [-.076,.076]) {
        const screw = cylinder(.005,.005,.003,x,y,.083,nickel,reader,12); screw.rotation.x=Math.PI/2;
        box(.005,.0009,.001,x,y,.085,gap,reader);
      }
      const amber = new T.MeshStandardMaterial({color:'#54452d',emissive:'#b27a2b',emissiveIntensity:0,roughness:.65});
      box(.018,.006,.003,0,.104,.084,amber,reader,.001);
      // No label or display. State is a small mechanical tell and a muted amber pin light.
      function readerFeedback({hover=false,unlocked=false}={}) {
        readerFace.emissive.set(hover?'#827762':'#000000'); readerFace.emissiveIntensity=hover?.10:0;
        amber.emissiveIntensity=unlocked?.7:0; render();
      }

      // Repeated side doors share draw calls. Main door remains an independent, closed mesh group.
      const batches = new Map(); scene.updateMatrixWorld(true);
      for (const group of sideDoors) {
        const seed = group.userData.variant;
        group.traverse(mesh => {
          if (!mesh.isMesh) return;
          const key = mesh.geometry.uuid + '/' + mesh.material.uuid;
          if (!batches.has(key)) batches.set(key, { geometry: mesh.geometry, material: mesh.material, entries: [] });
          batches.get(key).entries.push({ matrix: mesh.matrixWorld.clone(), seed, cast: mesh.castShadow });
        });
        scene.remove(group);
      }
      for (const batch of batches.values()) {
        const timber = woodMaterials.has(batch.material), count = batch.entries.length;
        const geo = timber ? batch.geometry.clone() : batch.geometry;
        if (timber) {
          const offsets = new Float32Array(count * 2);
          batch.entries.forEach((entry,i) => { offsets[i*2] = (entry.seed * .173) % 1; offsets[i*2+1] = (entry.seed * .287) % 1; });
          geo.setAttribute('textureShift', new T.InstancedBufferAttribute(offsets,2)); instanceGeometries.push(geo);
        }
        const instanced = new T.InstancedMesh(geo, batch.material, count);
        batch.entries.forEach((entry,i) => {
          instanced.setMatrixAt(i,entry.matrix);
          if (timber) {
            const tones = [[.96,.95,.93],[1.02,1.00,.98],[.97,.99,1.00],[1.04,1.02,.99]];
            instanced.setColorAt(i,new T.Color().setRGB(...tones[entry.seed % tones.length]));
          }
        });
        instanced.castShadow = batch.entries.some(e => e.cast); instanced.receiveShadow = true;
        instanced.computeBoundingSphere(); scene.add(instanced);
      }

      // Neutral ambient bounce preserves visibility; practical fixtures create pools and quieter gaps.
      scene.add(new T.HemisphereLight('#c6cbd0', '#40382f', .33));
      scene.add(new T.AmbientLight('#c1c0b6', .035));
      function lamp(z, index) {
        const y = SPACE.height - .32;
        cylinder(.026, .026, .23, 0, SPACE.height - .13, z, darkMetal);
        cylinder(.055, .055, .018, 0, SPACE.height - .01, z, brass);
        const profile = [new T.Vector2(.025,.10),new T.Vector2(.07,.065),new T.Vector2(.13,-.035),
          new T.Vector2(.20,-.09),new T.Vector2(.205,-.105)];
        const shade = new T.Mesh(new T.LatheGeometry(profile.reverse(),32),darkMetal);
        shade.position.set(0,y,z); shade.castShadow = true; scene.add(shade);
        const rim = new T.Mesh(new T.TorusGeometry(.20,.005,8,32),brass);
        rim.rotation.x = Math.PI/2; rim.position.set(0,y-.103,z); scene.add(rim);
        const diffuserFinish=bulb.clone();diffuserFinish.emissiveIntensity=[1.55,1.26,1.48,1.55][index%4];
        const diffuser = cylinder(.178,.178,.012,0,y-.104,z,diffuserFinish,scene,32); diffuser.castShadow = false;
        if (z > SPACE.startZ + 1.8) return;
        const point = new T.PointLight('#ffe4bf',[4.1,2.4,3.8,3.9][index%4],4.0,2);
        point.position.set(0,y-.16,z); scene.add(point);
        const spot = new T.SpotLight('#ffe8c9',[24,14.5,21,21][index%4],5.2,.72,.97,2);
        spot.position.copy(point.position); spot.target.position.set(0,0,z-.1);
        spot.castShadow = index < 2;
        if (spot.castShadow) {
          spot.shadow.mapSize.set(1024,1024); spot.shadow.bias = -.00012; spot.shadow.normalBias = .012;
          spot.shadow.camera.near = .15; spot.shadow.camera.far = 7; spot.shadow.radius = 3;
        }
        scene.add(spot,spot.target);
      }
      let lampCount = 0;
      for (let z = 1.65; z < SPACE.length - .6; z += 2.15) lamp(z,lampCount++);
      for(const sign of [-1,1])for(let z=2.40;z<SPACE.startZ+1;z+=4.20){
        const g=new T.Group();g.position.set(sign*(half-.08),1.94,z);g.rotation.y=sign>0?-Math.PI/2:Math.PI/2;scene.add(g);
        box(.11,.29,.035,0,0,0,darkMetal,g,.008);
        box(.026,.12,.16,0,-.08,.08,brass,g,.004);
        const bay=Math.round((z-2.40)/4.20),nearKey=(bay%2===0?sign<0:sign>0);
        const glassFinish=bulb.clone();glassFinish.emissiveIntensity=nearKey?1.55:1.12;
        const glass=cylinder(.055,.055,.24,0,.04,.14,glassFinish,g,48);glass.castShadow=false;
        for(const y of [-.09,.17])cylinder(.070,.070,.025,0,y,.14,brass,g,32);
        const light=new T.PointLight('#ffe3ba',nearKey?1.7:.82,2.25,2);light.position.set(sign*(half-.28),2.0,z);scene.add(light);
      }
      // A small practical picture light, above the investigation-room door, rather than a theatrical cone.
      box(.34,.035,.07,0,2.72,.075,darkMetal,scene,.004);
      box(.39,.045,.13,0,2.685,.15,brass,scene,.005);
      const doorDiffuser = box(.32,.008,.085,0,2.661,.17,bulb); doorDiffuser.castShadow = false;
      const doorGlow = new T.PointLight('#fff0db',.9,2.7,2); doorGlow.position.set(0,2.63,.32); scene.add(doorGlow);
      const doorWash = new T.SpotLight('#fff0dd',10.6,4.2,.88,1,2);
      doorWash.position.set(0,2.63,.42); doorWash.target.position.set(0,1.25,.03);
      doorWash.castShadow = true; doorWash.shadow.mapSize.set(1024,1024);
      doorWash.shadow.bias = -.00010; doorWash.shadow.normalBias = .008; doorWash.shadow.radius = 3;
      doorWash.shadow.camera.near = .1; doorWash.shadow.camera.far = 5; scene.add(doorWash,doorWash.target);
      const doorBounce = new T.PointLight('#dedbd1',1.25,2.6,2);
      doorBounce.position.set(0,1.1,1.0); scene.add(doorBounce);

      // Faint, blurred planar reflection; diffuse stone texture and shadows remain dominant.
      let mirror = null;
      if (window.HNJReflector) {
        const shader = T.UniformsUtils.clone(window.HNJReflector.ReflectorShader.uniforms);
        const fragment = window.HNJReflector.ReflectorShader.fragmentShader.replace(
          'vec4 base = texture2DProj( tDiffuse, vUv );',
          `vec2 uv = vUv.xy / vUv.w;
           vec4 base = (texture2D(tDiffuse,uv+vec2(.002,.0015))+texture2D(tDiffuse,uv-vec2(.002,.0015))+
           texture2D(tDiffuse,uv+vec2(-.002,.0015))+texture2D(tDiffuse,uv+vec2(.002,-.0015)))*.25;`
        ).replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4( base.rgb, .065 )');
        mirror = new window.HNJReflector(new T.PlaneGeometry(SPACE.width - .02, SPACE.length - .1), {
          clipBias: .002, textureWidth: 640, textureHeight: 640, multisample: 0,
          shader: { uniforms: shader, vertexShader: window.HNJReflector.ReflectorShader.vertexShader, fragmentShader: fragment }
        });
        mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, .002, centreZ);
        mirror.material.transparent = true; mirror.material.depthWrite = false;
        scene.add(mirror);
      }
      stage.prepend(canvas);
      let progress = 0, bob = 0, sway = 0, lost = false, authProgress = 0, doorProgress = 0, entryProgress = 0, roomPose = null, roomLights = [], corridorLights = [];
      const root = document.querySelector('#opening-sequence');
      function resize() {
        const rect = stage.getBoundingClientRect();
        const w = rect.width || Math.min(innerWidth, innerHeight * 16 / 9);
        const h = rect.height || w * 9 / 16;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      function render(value = progress, bounce = bob, lateral = sway) {
        if (lost) return;
        progress = clamp(value); bob = bounce; sway = lateral;
        const travel = travelAt(progress);
        camera.position.set(lateral * .012, SPACE.eye - bounce * .009,
          T.MathUtils.lerp(SPACE.startZ, SPACE.endZ, travel));
        if (authProgress > 0) {
          camera.position.lerp(new T.Vector3(.97,1.23,.73),authProgress);
          camera.lookAt(T.MathUtils.lerp(0,.97,authProgress),T.MathUtils.lerp(SPACE.targetY,1.20,authProgress),0);
        } else camera.lookAt(lateral * .002, SPACE.targetY, 0);
        if(entryProgress>0) {
          camera.position.set(0,T.MathUtils.lerp(SPACE.eye,1.70,entryProgress),T.MathUtils.lerp(SPACE.endZ,-.30,entryProgress));
          camera.lookAt(0,T.MathUtils.lerp(SPACE.targetY,1.10,entryProgress),T.MathUtils.lerp(0,-3.95,entryProgress));
          camera.fov=T.MathUtils.lerp(SPACE.fov,48,entryProgress);camera.updateProjectionMatrix();
        }
        if(roomPose){camera.position.fromArray(roomPose.position);camera.lookAt(...roomPose.target);camera.fov=roomPose.fov;camera.updateProjectionMatrix();}
        renderer.render(scene, camera);
        root.dataset.cameraZ = camera.position.z.toFixed(3);
        root.dataset.cameraX = camera.position.x.toFixed(4);root.dataset.cameraY = camera.position.y.toFixed(4);
        root.dataset.renderer = 'webgl';root.dataset.spatialMode='realtime-geometry';
        root.dataset.drawCalls = String(renderer.userData?.worldCalls||renderer.info.render.calls);
        root.dataset.sideDoors = String(sideDoors.length);
        root.dataset.lightFixtures = String(lampCount);
        root.dataset.authCamera = authProgress.toFixed(3);
        stage.dispatchEvent(new Event('corridor:render'));
      }
      function readerProjection() {
        const rect=stage.getBoundingClientRect();
        const point=(x,y,z) => { const v=new T.Vector3(x,y,z).project(camera); return {x:(v.x+1)*rect.width/2,y:(1-v.y)*rect.height/2}; };
        const left=point(.97-.109,1.34+.152,.124),right=point(.97+.109,1.34-.152,.124);
        const ml=point(.97-.074,1.34-.151,.122),mr=point(.97+.074,1.34-.151,.122);
        return {x:left.x,y:left.y,width:right.x-left.x,height:right.y-left.y,mouthX:(ml.x+mr.x)/2,mouthY:(ml.y+mr.y)/2,mouthWidth:mr.x-ml.x};
      }
      function handleProjection() {
        const rect=stage.getBoundingClientRect(),v=new T.Vector3(.38,1.04,.20).project(camera);
        return {x:(v.x+1)*rect.width/2,y:(1-v.y)*rect.height/2};
      }
      function onResize() { resize(); render(); }
      window.addEventListener('resize', onResize, { passive: true });
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); lost = true;
        canvas.hidden = true; root.dataset.renderer = 'webgl-unavailable';
      });
      canvas.addEventListener('webglcontextrestored', () => {
        lost = false; canvas.hidden = false; renderer.shadowMap.needsUpdate = true; render();
      });
      resize();
      camera.position.set(0,SPACE.eye,SPACE.startZ); camera.lookAt(0,SPACE.targetY,0);
      // Chrome can compile dozens of PBR/shadow programs on first draw. Warm them asynchronously
      // while the issued ID remains visible, before the blackout is allowed to start.
      if (renderer.compileAsync) await deadline(renderer.compileAsync(scene,camera),7000,'Shader preparation timed out');
      render(0, 0, 0);
      const gl=renderer.getContext();
      if (gl.isContextLost() || renderer.info.programs.some(program=>program.diagnostics?.runnable===false))
        throw new Error('3D renderer did not produce a valid first frame');
      root.classList.add('has-3d');
      active = Object.freeze({ render, resize: onResize, getCamera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
        projectWorld(point){const p=new T.Vector3(...point).project(camera),r=stage.getBoundingClientRect();return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2,depth:p.z};},
        readerProjection, readerFeedback, handleProjection,
        getRenderer:()=>renderer,
        roomPose(pose){roomPose=pose;render();},
        async attachRoom(roomScene) {roomScene.position.set(0,0,-3.40);corridorLights=[];scene.traverse(o=>{if(o.isLight)corridorLights.push([o,o.intensity]);});scene.add(roomScene);
          roomLights=[];roomScene.traverse(o=>{if(o.isLight){roomLights.push([o,o.intensity]);o.intensity=0;}});
          if(renderer.compileAsync)await deadline(renderer.compileAsync(scene,camera),10000,'Connected room shader preparation timed out');
          renderer.shadowMap.autoUpdate=true;render();},
        openDoor(value){doorProgress=clamp(value);roomLights.forEach(([light,power])=>{light.intensity=power*clamp(doorProgress*3);});mainDoor.userData.leaf.rotation.y=doorProgress*Math.PI*.55;renderer.shadowMap.needsUpdate=true;render();},
        enterRoom(value){entryProgress=clamp(value);corridorLights.forEach(([light,power])=>{light.intensity=power*(1-clamp((entryProgress-.45)/.55));});render();if(entryProgress===1)renderer.shadowMap.autoUpdate=false;},
        authView(value) { authProgress=clamp(value); render(); },
        // room-entry.js gates the hinged leaf and room approach on HNJAccess.doorUnlocked.
        mainDoor, reader, dispose() {
          window.removeEventListener('resize', onResize); mirror?.dispose(); environment.dispose();
          geometry.forEach(g => g.dispose()); instanceGeometries.forEach(g => g.dispose());
          nickelMap.dispose(); nickel.dispose(); readerFace.dispose(); amber.dispose();
          haloTexture.dispose(); edgeTexture.dispose(); textureCache.forEach(t => t.dispose()); renderer.dispose(); canvas.remove(); active = null;
        } });
      return active;
    } catch (error) {
      renderer.dispose(); canvas.remove();
      console.warn('3D corridor:', error.message);
      return null;
    }
  }
  window.HNJCorridor3D = Object.freeze({ create });
})();
