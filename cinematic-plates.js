/* Photographic projection on metre-scale geometry. Assets and camera calibration
   are intentionally separate from the ID, authentication and scene director. */
(() => {
  'use strict';
  const T=window.THREE;
  const assets=Object.freeze({
    corridor:'assets/cinematic/corridor-wide-v1.png',
    arrival:'assets/cinematic/corridor-door-clean-v1.png',
    room:'assets/cinematic/room-clean-v1.png',
    subject:'assets/cinematic/room-seated-v1.png',
    desk:'assets/cinematic/room-desk-v1.png',
    entry:'assets/cinematic/room-entry-v1.png'
  });
  function projector(position,target,fov){
    const c=new T.PerspectiveCamera(fov,16/9,.06,45);
    c.position.fromArray(position);c.lookAt(...target);c.updateMatrixWorld();
    return new T.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse);
  }
  async function texture(url){
    const key=Object.keys(assets).find(key=>assets[key]===url);
    let image=document.querySelector(`[data-cinematic="${key}"]`);
    if(!image){image=new Image();image.src=url;}
    let timer;
    try{await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Cinematic plate loading timed out')),12000);})]);}
    finally{clearTimeout(timer);}
    const map=new T.Texture(image);map.colorSpace=T.SRGBColorSpace;
    map.anisotropy=4;map.needsUpdate=true;return map;
  }
  async function bake(scene,options){
    const [wide,detail]=await Promise.all([texture(options.wide),options.near&&options.near!==options.wide?texture(options.near):Promise.resolve(null)]);
    const near=detail||wide;
    scene.updateMatrixWorld(true);
    const materials=[],saved=[],blend={value:0},enabled={value:1},screenMode={value:0},screenSize={value:new T.Vector2(1,1)},screenScale={value:1},jitter={value:new T.Vector2()};
    const a=projector(...options.camera),b=projector(...(options.nearCamera||options.camera));
    scene.traverse(mesh=>{
      if(!mesh.isMesh||options.exclude?.(mesh))return;
      const original=mesh.material;
      // Physical shadows/reflections are already photographed into the plate.
      // Transparent contact decals must not stamp the entire plate a second time.
      if((Array.isArray(original)?original:[original]).some(m=>m.transparent)){
        saved.push([mesh,original,mesh.visible]);mesh.visible=false;return;
      }
      const material=new T.ShaderMaterial({toneMapped:false,side:T.DoubleSide,
        uniforms:{wide:{value:wide},near:{value:near},blend,enabled,screenMode,screenSize,screenScale,jitter,
          bindWide:{value:new T.Matrix4().multiplyMatrices(a,mesh.matrixWorld)},
          bindNear:{value:new T.Matrix4().multiplyMatrices(b,mesh.matrixWorld)}},
        vertexShader:`varying vec4 uvWide,uvNear;uniform mat4 bindWide,bindNear;
          void main(){vec4 p=vec4(position,1.);
          #ifdef USE_INSTANCING
          p=instanceMatrix*p;
          #endif
          uvWide=bindWide*p;uvNear=bindNear*p;
          gl_Position=projectionMatrix*modelViewMatrix*p;}`,
        fragmentShader:`varying vec4 uvWide,uvNear;uniform sampler2D wide,near;uniform float blend,enabled,screenMode,screenScale;uniform vec2 screenSize,jitter;
          void main(){vec2 a=uvWide.xy/uvWide.w*.5+.5,b=uvNear.xy/uvNear.w*.5+.5;
            if(screenMode>.5){
              vec2 uv=gl_FragCoord.xy/screenSize-.5;float aspect=screenSize.x/screenSize.y;
              uv.x*=min(1.,aspect/(16./9.));uv.y*=min(1.,(16./9.)/aspect);
              uv=uv/screenScale+.5+jitter;a=uv;b=uv;
            }
            vec3 x=texture2D(wide,clamp(a,vec2(.001),vec2(.999))).rgb;
            vec3 y=texture2D(near,clamp(b,vec2(.001),vec2(.999))).rgb;
            gl_FragColor=vec4(mix(x,y,blend)*enabled,0.);
            #include <colorspace_fragment>
          }`});
      saved.push([mesh,original,mesh.visible]);materials.push(material);mesh.material=material;
    });
    return {setBlend:v=>{blend.value=v;},setScreen:(active,size,scale=1,x=0,y=0)=>{screenMode.value=active?1:0;screenSize.value.copy(size);screenScale.value=scale;jitter.value.set(x,y);},setLight:v=>{enabled.value=v;},dispose(){
      for(const [mesh,material,visible] of saved){mesh.material=material;mesh.visible=visible;}
      materials.forEach(m=>m.dispose());wide.dispose();if(detail)detail.dispose();
    }};
  }
  async function waitingFigure(scene){
    // Anonymous, face-obscured stand-in. Replace this image and contour together
    // with an approved actor plate; it never claims to depict the real subject.
    const camera=new T.PerspectiveCamera(46,16/9,.06,45);
    camera.position.set(0,1.27,1.72);camera.lookAt(0,1.13,-1.54);camera.updateMatrixWorld();
    const outline=[[.450,.325],[.468,.315],[.492,.315],[.515,.325],[.526,.345],[.525,.40],
      [.515,.448],[.535,.475],[.560,.480],[.578,.515],[.602,.55],[.634,.59],[.640,.658],
      [.600,.660],[.570,.651],[.550,.655],[.466,.655],[.451,.678],[.426,.680],
      [.400,.668],[.374,.642],[.372,.615],[.377,.575],[.392,.529],[.411,.490],
      [.446,.472],[.452,.449],[.450,.400],[.445,.365]];
    const points=outline.map(([u,v])=>{
      const p=new T.Vector3(u*2-1,1-v*2,.5).unproject(camera),d=p.sub(camera.position);
      return new T.Vector2(camera.position.x+d.x*(-1.32-camera.position.z)/d.z,camera.position.y+d.y*(-1.32-camera.position.z)/d.z);
    });
    const mesh=new T.Mesh(new T.ShapeGeometry(new T.Shape(points)),new T.MeshBasicMaterial());
    mesh.position.z=-1.32;mesh.name='anonymous-waiting-figure';
    const group=new T.Group();group.add(mesh);scene.add(group);
    return bake(group,{wide:assets.subject,near:assets.subject,
      camera:[[0,1.27,1.72],[0,1.13,-1.54],46],nearCamera:[[0,1.27,1.72],[0,1.13,-1.54],46]});
  }
  window.HNJPlates=Object.freeze({assets,bake,waitingFigure,texture});
})();
