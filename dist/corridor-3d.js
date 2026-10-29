/* Real, metre-scale corridor. Static architecture; only the first-person camera moves.
   No door/reader interactions in this scene. PBR maps are local CC0 assets (assets/pbr/).
   Canvas textures below contain lighting/contact shading, not repainted photographs. */
(() => {
  'use strict';
  const SPACE = Object.freeze({ width: 2.48, height: 2.94, length: 13.8, doorPitch: 2.10,
    eye: 1.61, startZ: 7.25, endZ: 3.20, fov: 58, targetY: 1.41 });
  const clamp = x => Math.max(0, Math.min(1, x));
  // Short cosine acceleration, a steady walking pace, then a longer soft stop.
  // The integrated velocity has no speed discontinuity at either end of the four-second shot.
  const travelAt = value => {
    const t = clamp(value), a = .10, b = .18, v = 1 / (1 - (a + b) / 2);
    if (t < a) return v * .5 * (t - a / Math.PI * Math.sin(Math.PI * t / a));
    if (t > 1 - b) { const r = 1 - t; return 1 - v * .5 * (r - b / Math.PI * Math.sin(Math.PI * r / b)); }
    return v * (t - a / 2);
  };
  let active = null;

  async function create(stage) {
    if (active) return active;
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
      await Promise.all([...document.querySelectorAll('[data-pbr]')].map(image => image.decode()));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
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
          metalness: 0, envMapIntensity: .35 });
      }
      // The same local maps are reused at physical scales, rather than stretched over a whole wall.
      const wood = pbr('wood', '#805b3f', .88, .14, 1.3, .8, true);
      const woodPanel = pbr('wood', '#856047', .90, .13, 1.3, .8, true);
      const woodRail = pbr('wood', '#6c4d35', .90, .12, 1.8, 1, false);
      const woodTrim = pbr('wood', '#62452f', .88, .12, 1, 1, true);
      const wallSide = pbr('wall', '#b8b6ae', 1, .055, SPACE.length / 1.2, SPACE.height / 1.2);
      const wallEnd = pbr('wall', '#bdbab1', 1, .055, SPACE.width / 1.2, SPACE.height / 1.2);
      const ceiling = pbr('wall', '#a6a59d', 1, .035, SPACE.width, SPACE.length);
      const floor = pbr('floor', '#92948e', .94, .09, SPACE.width / 2.56, SPACE.length / 2.56);
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
            `#include <map_fragment>\nfloat neutral = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));\ndiffuseColor.rgb = mix(vec3(neutral), diffuseColor.rgb, ${saturation.toFixed(2)});`);
          if (timber) {
            // All three PBR maps shift together per repeated door; no altered bitmap assets are needed.
            shader.vertexShader = '#ifdef USE_INSTANCING\nattribute vec2 textureShift;\n#endif\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',
              '#include <uv_vertex>\n#ifdef USE_INSTANCING\nvMapUv += textureShift;\nvNormalMapUv += textureShift;\nvRoughnessMapUv += textureShift;\n#endif');
          }
        };
        material.customProgramCacheKey = () => `hnj-surface-${minimumRoughness}-${saturation}-${timber}`;
      }
      woodMaterials.forEach(m => finishSurface(m, .63, .89, true));
      finishSurface(floor, .70, .46);
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
            const shape = new T.Shape(); const a = w / 2 - bevel, b = h / 2 - bevel;
            shape.moveTo(-a, -b); shape.lineTo(a, -b); shape.lineTo(a, b); shape.lineTo(-a, b); shape.closePath();
            g = new T.ExtrudeGeometry(shape, { depth: d - 2 * bevel, bevelEnabled: true,
              bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
            g.translate(0, 0, -d / 2 + bevel);
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
      function rectangleFrame(parent, w, h, y, z, thickness, material) {
        box(thickness, h, .025, -w / 2 + thickness / 2, y, z, material, parent, .004);
        box(thickness, h, .025, w / 2 - thickness / 2, y, z, material, parent, .004);
        box(w - 2 * thickness, thickness, .025, 0, y + h / 2 - thickness / 2, z, material, parent, .004);
        box(w - 2 * thickness, thickness, .025, 0, y - h / 2 + thickness / 2, z, material, parent, .004);
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
          new T.Vector3(.40, 1.035, .155), new T.Vector3(.28, 1.035, .155)
        ]), 18, .0105, 8, false));
        const lever = new T.Mesh(geometry.get('door-lever'), brass); lever.castShadow = true; g.add(lever);
        for (const y of [1.014, 1.066]) {
          const screw = cylinder(.004, .004, .004, .45, y, .086, brass, g, 12); screw.rotation.x = Math.PI / 2;
          box(.0045, .0008, .001, .45, y, .089, gap, g);
        }
        for (const y of [.35, 1.2, 2.06]) cylinder(.011, .011, .083, -.576, y, .063, brass, g, 12);
        if (!geometry.has('door-contact')) geometry.set('door-contact', new T.PlaneGeometry(1.70, 2.75));
        const halo = new T.Mesh(geometry.get('door-contact'), haloMaterial);
        halo.position.set(0,1.28,-.004); g.add(halo);
        if (!main) { g.userData.variant = sideDoors.length; sideDoors.push(g); }
        return g;
      }

      // Geometry, repetition and proportions change together; SPACE controls the complete corridor.
      box(SPACE.width + .32, SPACE.height + .16, .16, 0, SPACE.height / 2, -.13, wallEnd);
      box(.16, SPACE.height + .16, SPACE.length, -half - .08, SPACE.height / 2, centreZ, wallSide);
      box(.16, SPACE.height + .16, SPACE.length, half + .08, SPACE.height / 2, centreZ, wallSide);
      box(SPACE.width + .32, .12, SPACE.length, 0, SPACE.height + .06, centreZ, ceiling);
      box(SPACE.width + .12, .10, SPACE.length, 0, -.05, centreZ, floor);
      for (const sign of [-1, 1]) {
        box(.065, .145, SPACE.length, sign * (half - .026), .0725, centreZ, woodTrim);
        box(.032, .032, SPACE.length, sign * (half - .053), .158, centreZ, woodRail);
        box(.035, .045, SPACE.length, sign * (half - .03), .91, centreZ, woodRail);
        box(.12, .10, SPACE.length, sign * (half - .06), SPACE.height - .06, centreZ, ceiling);
        box(.055, .045, SPACE.length, sign * (half - .07), SPACE.height - .135, centreZ, ceiling);
        for (let z = 1.35; z < SPACE.length - .8; z += SPACE.doorPitch)
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
      scene.add(new T.HemisphereLight('#e1e2db', '#393831', .21));
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
        const diffuser = cylinder(.178,.178,.012,0,y-.104,z,bulb,scene,32); diffuser.castShadow = false;
        if (z > SPACE.startZ + 1.8) return;
        const point = new T.PointLight('#fff0d9',4.8,4.3,2);
        point.position.set(0,y-.16,z); scene.add(point);
        const spot = new T.SpotLight('#fff1de',19,5.4,.58,.85,2);
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
      // A small practical picture light, above the investigation-room door, rather than a theatrical cone.
      box(.34,.035,.07,0,2.72,.075,darkMetal,scene,.004);
      box(.39,.045,.13,0,2.685,.15,brass,scene,.005);
      const doorDiffuser = box(.32,.008,.085,0,2.661,.17,bulb); doorDiffuser.castShadow = false;
      const doorGlow = new T.PointLight('#fff0db',.7,2.7,2); doorGlow.position.set(0,2.63,.32); scene.add(doorGlow);
      const doorWash = new T.SpotLight('#fff0dd',5.4,4.0,.82,1,2);
      doorWash.position.set(0,2.63,.42); doorWash.target.position.set(0,1.25,.03);
      doorWash.castShadow = true; doorWash.shadow.mapSize.set(1024,1024);
      doorWash.shadow.bias = -.00010; doorWash.shadow.normalBias = .008; doorWash.shadow.radius = 3;
      doorWash.shadow.camera.near = .1; doorWash.shadow.camera.far = 5; scene.add(doorWash,doorWash.target);
      const doorBounce = new T.PointLight('#dedbd1',2.0,2.6,2);
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
      let progress = 0, bob = 0, sway = 0, lost = false;
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
        camera.position.set(lateral * .0014, SPACE.eye - bounce * .0028,
          T.MathUtils.lerp(SPACE.startZ, SPACE.endZ, travel));
        camera.lookAt(lateral * .0003, SPACE.targetY, 0);
        renderer.render(scene, camera);
        root.dataset.cameraZ = camera.position.z.toFixed(3);
        root.dataset.renderer = 'webgl';
        root.dataset.drawCalls = String(renderer.info.render.calls);
        root.dataset.sideDoors = String(sideDoors.length);
        root.dataset.lightFixtures = String(lampCount);
      }
      function onResize() { resize(); render(); }
      window.addEventListener('resize', onResize, { passive: true });
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); lost = true;
        canvas.hidden = true; root.dataset.renderer = 'image-fallback';
      });
      canvas.addEventListener('webglcontextrestored', () => {
        lost = false; canvas.hidden = false; renderer.shadowMap.needsUpdate = true; render();
      });
      resize(); render(0, 0, 0);
      root.classList.add('has-3d');
      active = Object.freeze({ render, resize: onResize, getCamera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
        // Future door interactions can use this actual mesh group; no listener is installed now.
        mainDoor, dispose() {
          window.removeEventListener('resize', onResize); mirror?.dispose(); environment.dispose();
          geometry.forEach(g => g.dispose()); instanceGeometries.forEach(g => g.dispose());
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
