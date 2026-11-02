/* Photographic room plates behind the physical doorway. Multi-view changes
   are cut inside a brief first-person blink, never dissolved or warped together. */
(() => {
  'use strict';
  const fallback=window.HNJInterrogationRoom;
  const views={
    entry:{position:[0,1.70,3.10],target:[0,1.10,-.55],fov:48},
    seated:{position:[0,1.27,1.72],target:[0,1.13,-1.54],fov:46},
    tabletop:{position:[0,1.33,1.42],target:[0,.79,.42],fov:54}
  };
  async function create(container,options={}){
    if(!window.HNJPlates)return fallback.create(container,options);
    const T=window.THREE,scene=new T.Scene();scene.name='photographic-investigation-set';
    const maps={};
    try{
      for(const [name,key] of [['entry','entry'],['seated','subject'],['tabletop','desk']])
        maps[name]=await window.HNJPlates.texture(window.HNJPlates.assets[key]);
    }catch(error){
      Object.values(maps).forEach(map=>map.dispose());
      console.warn('Photographic room fallback:',error.message);return fallback.create(container,options);
    }
    const camera=new T.PerspectiveCamera(48,16/9,.06,45);
    const uniforms={plate:{value:maps.entry},light:{value:.34},pan:{value:0}};
    const material=new T.ShaderMaterial({side:T.DoubleSide,toneMapped:false,uniforms,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform sampler2D plate;uniform float light,pan;
      void main(){vec2 uv=(vUv-.5)/1.04+.5+vec2(0.,pan);
      gl_FragColor=vec4(texture2D(plate,uv).rgb*light,0.);
      #include <colorspace_fragment>
      }`});
    const geometry=new T.PlaneGeometry(2,2),screen=new T.Mesh(geometry,material);screen.name='photographic-room-plate';scene.add(screen);
    function follow(pose,aspect=16/9){
      camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.fov=pose.fov;
      camera.aspect=aspect;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      const distance=6.4,halfHeight=Math.tan(T.MathUtils.degToRad(pose.fov)/2)*distance;
      screen.position.copy(camera.position).add(new T.Vector3(0,0,-distance).applyQuaternion(camera.quaternion));
      screen.quaternion.copy(camera.quaternion);screen.scale.set(halfHeight*Math.max(16/9,aspect),halfHeight,1);
    }
    follow(views.entry);
    let figure=null;
    const controller={
      follow,light(value){uniforms.light.value=value;figure?.setLight(value);},
      pan(value){uniforms.pan.value=value;},
      view(name){uniforms.plate.value=maps[name]||maps.entry;const actor=scene.getObjectByName('anonymous-waiting-figure');if(actor)actor.visible=name==='entry';},
      async prepare(){if(!figure)figure=await window.HNJPlates.waitingFigure(scene);figure.setLight(.34);},
      dispose(){figure?.dispose();Object.values(maps).forEach(m=>m.dispose());geometry.dispose();material.dispose();}
    };
    scene.userData.photoStage=controller;
    return Object.freeze({getScene:()=>scene,getViewPose:name=>structuredClone(views[name]||views.seated),
      getObjects:()=>({plate:screen}),dispose:controller.dispose});
  }
  window.HNJInterrogationRoom=Object.freeze({create});
})();
