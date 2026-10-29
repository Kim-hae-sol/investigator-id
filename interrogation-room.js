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
    const canvas = document.createElement('canvas');
    canvas.className = 'interrogation-room-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '따뜻한 조명 아래 책상과 서로 마주 보는 두 의자가 있는 조사실');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch { return null; }

    const geometries = new Map(), textures = new Map(), ownedMaterials = new Set();
    try {
      const images = [...document.querySelectorAll('[data-pbr]')];
      await deadline(Promise.all(images.map(image => image.decode())), 7000);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;

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
        ownedMaterials.add(value); return value;
      }
      const wood = material('wood', '#72513a', .88, .11, .72, .54);
      const woodDark = material('wood', '#49372a', .92, .10, .85, .62);
      const woodTrim = material('wood', '#5a402d', .90, .08, 1.2, .72);
      const wall = material('wall', '#aaa69b', 1, .045, 2.8, 1.35);
      const floor = material('floor', '#817f77', .96, .035, 2.4, 2.4);
      const ceilingMaterial = material('wall', '#76736b', 1, .025, 2.3, 1.4);
      const charcoal = new T.MeshStandardMaterial({ color: '#282622', roughness: .94 }); ownedMaterials.add(charcoal);
      const upholstery = new T.MeshStandardMaterial({ color: '#29251f', roughness: .96 }); ownedMaterials.add(upholstery);
      const brass = new T.MeshStandardMaterial({ color: '#806947', metalness: .64, roughness: .57 }); ownedMaterials.add(brass);
      const darkMetal = new T.MeshStandardMaterial({ color: '#37352f', metalness: .45, roughness: .69 }); ownedMaterials.add(darkMetal);
      const shade = new T.MeshStandardMaterial({ color: '#ead7ac', emissive: '#c29450', emissiveIntensity: .48, roughness: .84 }); ownedMaterials.add(shade);
      const windowGlow = new T.MeshStandardMaterial({ color: '#b9b4a6', emissive: '#948d7c', emissiveIntensity: .8, roughness: 1 }); ownedMaterials.add(windowGlow);

      function box(w, h, d, x, y, z, mat, parent = scene, bevel = 0) {
        const key = `${w}/${h}/${d}/${bevel}`;
        if (!geometries.has(key)) {
          let geometry;
          if (bevel) {
            const shape = new T.Shape(), a = w / 2 - bevel, b = h / 2 - bevel;
            shape.moveTo(-a, -b); shape.lineTo(a, -b); shape.lineTo(a, b); shape.lineTo(-a, b); shape.closePath();
            geometry = new T.ExtrudeGeometry(shape, { depth: d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel,
              bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
            geometry.translate(0, 0, -d / 2 + bevel);
          } else geometry = new T.BoxGeometry(w, h, d);
          geometries.set(key, geometry);
        }
        const mesh = new T.Mesh(geometries.get(key), mat);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
        return mesh;
      }
      function cylinder(radiusTop, radiusBottom, height, x, y, z, mat, parent = scene, radial = 18) {
        const key = `c:${radiusTop}/${radiusBottom}/${height}/${radial}`;
        if (!geometries.has(key)) geometries.set(key, new T.CylinderGeometry(radiusTop, radiusBottom, height, radial));
        const mesh = new T.Mesh(geometries.get(key), mat);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
      }
      // Close the space around the visitor. The entrance wall is behind the entry camera; the far wall frames the empty suspect chair.
      const halfW = ROOM.width / 2, halfD = ROOM.depth / 2;
      box(ROOM.width, .13, ROOM.depth, 0, -.065, 0, floor);
      const ceiling = box(ROOM.width, .13, ROOM.depth, 0, ROOM.height + .065, 0, ceilingMaterial);
      box(.16, ROOM.height, ROOM.depth, -halfW - .08, ROOM.height / 2, 0, wall);
      box(.16, ROOM.height, ROOM.depth, halfW + .08, ROOM.height / 2, 0, wall);
      box(ROOM.width + .16, ROOM.height, .16, 0, ROOM.height / 2, -halfD - .08, wall);
      box(ROOM.width + .16, ROOM.height, .16, 0, ROOM.height / 2, halfD + .08, woodDark);

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
      box(1.62, .105, 2.34, 0, .785, 0, wood, table, .012);
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
      function chair(z, facing) {
        const g = new T.Group(); g.position.z = z; g.rotation.y = facing > 0 ? 0 : Math.PI; g.name = facing > 0 ? 'investigator-chair' : 'subject-chair'; scene.add(g);
        box(.58, .075, .53, 0, .49, 0, upholstery, g, .02);
        box(.56, .045, .51, 0, .445, 0, woodDark, g, .006);
        box(.58, .68, .075, 0, .84, -.235, wood, g, .012);
        box(.47, .48, .018, 0, .84, -.187, woodDark, g, .004);
        box(.034, .64, .045, -.25, .83, -.205, woodTrim, g, .004);
        box(.034, .64, .045, .25, .83, -.205, woodTrim, g, .004);
        for (const x of [-.23, .23]) for (const zz of [-.19, .19]) box(.052, .45, .052, x, .245, zz, woodDark, g, .004);
        box(.62, .065, .075, 0, .63, -.03, wood, g, .01);
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
        box(.145, h, .26, x, 1.06 + h / 2, -.12, i % 2 ? woodTrim : woodDark, low, .004);
        box(.018, h - .04, .008, x - .04, 1.06 + h / 2, .016, brass, low);
      }

      // Right: tall, quiet metal records cabinet, plus a narrow shelf and old case books.
      const tall = new T.Group(); tall.position.set(2.38, 0, -.54); scene.add(tall); tall.name = 'records-cabinet-tall';
      box(.82, 2.10, .62, 0, 1.12, 0, darkMetal, tall, .012);
      for (const y of [.48, 1.05, 1.62]) {
        box(.73, .51, .025, 0, y, .323, charcoal, tall, .005);
        box(.16, .018, .015, 0, y + .14, .343, brass, tall, .003);
      }
      box(.88, .065, .68, 0, 2.20, 0, darkMetal, tall, .008);
      const shelf = new T.Group(); shelf.position.set(2.40, 1.55, .66); scene.add(shelf); shelf.name = 'case-shelf';
      box(.12, .07, 1.18, 0, 0, 0, woodTrim, shelf);
      for (let i = 0; i < 5; i++) box(.15, .42 + (i % 2) * .06, .26, .04, .24 + (i % 2) * .03, -.43 + i * .19,
        i % 2 ? woodDark : wood, shelf, .003);

      // A small mechanical wall clock: no institutional emblem or labels.
      const clockFace = new T.Mesh(new T.CircleGeometry(.17, 36), new T.MeshStandardMaterial({ color: '#c3b89f', roughness: .86 }));
      ownedMaterials.add(clockFace.material); clockFace.position.set(-2.42, 2.27, -3.29); clockFace.rotation.y = -.04; scene.add(clockFace);
      cylinder(.184, .184, .055, -2.42, 2.27, -3.31, brass, scene, 36).rotation.x = Math.PI / 2;
      box(.009, .108, .012, -2.42, 2.31, -3.265, darkMetal, scene);
      box(.075, .009, .012, -2.39, 2.27, -3.264, darkMetal, scene);

      // Simple suspended tungsten shade. The downlight pools over the folio area; a weak side source separates the suspect seat from the back wall.
      const pendant = new T.Group(); pendant.position.set(0, 2.86, .10); scene.add(pendant); pendant.name = 'table-pendant';
      cylinder(.012, .012, .20, 0, .08, 0, darkMetal, pendant, 12);
      const lampShade = new T.Mesh(new T.CylinderGeometry(.23, .36, .18, 36, 1, true), brass);
      lampShade.position.y = -.07; lampShade.castShadow = true; pendant.add(lampShade);
      const diffuser = new T.Mesh(new T.CircleGeometry(.29, 36), shade); diffuser.rotation.x = -Math.PI / 2; diffuser.position.y = -.16; pendant.add(diffuser);
      const mainLight = new T.SpotLight('#ffe8c7', 29, 7.0, .56, .80, 1.55);
      mainLight.position.set(0, 2.76, .08); mainLight.target.position.set(0, .58, 0); mainLight.castShadow = true;
      mainLight.shadow.mapSize.set(1024, 1024); mainLight.shadow.bias = -.00016; mainLight.shadow.normalBias = .018;
      mainLight.shadow.radius = 4; mainLight.shadow.camera.near = .1; mainLight.shadow.camera.far = 8; scene.add(mainLight, mainLight.target);
      const warmBounce = new T.PointLight('#d8b987', 12, 6.8, 1.9); warmBounce.position.set(0, 2.55, .12); scene.add(warmBounce);
      const wallBounce = new T.DirectionalLight('#c0b7a5', 1.15); wallBounce.position.set(-.8, 2.45, -2.55); scene.add(wallBounce);
      const sideFill = new T.DirectionalLight('#c4c2b8', 1.8); sideFill.position.set(-3.0, 2.2, -1.2); scene.add(sideFill);
      const ambient = new T.HemisphereLight('#c8c7bf', '#30261c', 2.35); scene.add(ambient);
      scene.add(new T.AmbientLight('#b2aa99', .55));

      let activeView = options.initialView && views[options.initialView] ? options.initialView : 'entry';
      let transition = null, disposed = false, ready = false;
      function applyView(name) {
        const view = views[name];
        ceiling.visible = name !== 'tabletop';
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
        renderer.setSize(width, height, false);
        camera.aspect = width / height; camera.updateProjectionMatrix();
      }
      function render() { if (!disposed) renderer.render(scene, camera); }
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
        if (name === 'tabletop') { ceiling.visible = false; pendant.visible = false; }
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
              ceiling.visible = name !== 'tabletop'; pendant.visible = name !== 'tabletop'; transition = null; render(); resolve(); }
          }
          requestAnimationFrame(frame);
        });
      }
      function onResize() { size(); render(); }
      function onContextLost(event) { event.preventDefault(); canvas.hidden = true; container.dataset.roomRenderer = 'unavailable'; }
      function onContextRestored() { canvas.hidden = false; renderer.shadowMap.needsUpdate = true; size(); render(); container.dataset.roomRenderer = 'webgl'; }
      canvas.addEventListener('webglcontextlost', onContextLost);
      canvas.addEventListener('webglcontextrestored', onContextRestored);
      window.addEventListener('resize', onResize, { passive: true });
      container.append(canvas); size(); applyView(activeView);
      if (renderer.compileAsync) await deadline(renderer.compileAsync(scene, camera), 7000);
      render();
      if (renderer.getContext().isContextLost() || renderer.info.programs.some(program => program.diagnostics?.runnable === false))
        throw new Error('Room renderer did not produce a valid first frame');
      ready = true; container.dataset.roomRenderer = 'webgl'; container.dataset.roomView = activeView;
      return Object.freeze({
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
          textures.forEach(group => Object.values(group).forEach(texture => texture.dispose()));
          geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(value => value.dispose());
          renderer.dispose(); canvas.remove(); delete container.dataset.roomRenderer; delete container.dataset.roomView;
        }
      });
    } catch (error) {
      if (!ready) { textures.forEach(group => Object.values(group).forEach(texture => texture.dispose())); geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(value => value.dispose()); }
      renderer.dispose(); canvas.remove(); console.warn('Interrogation room:', error.message); return null;
    }
  }
  window.HNJInterrogationRoom = Object.freeze({ create, views });
})();
