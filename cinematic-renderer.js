/* Local, single-pass lens finish. Linear HDR color + depth-aware contact shading.
   No bloom, animated grain, downloaded code, or extra WebGL context. */
(() => {
  'use strict';
  function install(renderer) {
    if(renderer.userData?.cinematic)return;
    const T=window.THREE, original=renderer.render.bind(renderer);
    // Older mobile GPUs retain the ordinary ACES renderer instead of a black HDR target.
    if(!renderer.extensions.has('EXT_color_buffer_float'))return;
    const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,samples:Math.min(4,renderer.capabilities.maxSamples||0)});
    target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
    const uniforms={colorMap:{value:target.texture},depthMap:{value:target.depthTexture},inverseProjection:{value:new T.Matrix4()},resolution:{value:new T.Vector2()},exposure:{value:1.05}};
    const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms,
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`
      varying vec2 vUv; uniform sampler2D colorMap,depthMap;
      uniform mat4 inverseProjection; uniform vec2 resolution; uniform float exposure;
      vec3 viewPosition(vec2 uv){float d=texture2D(depthMap,uv).r;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){
        vec3 p=viewPosition(vUv);vec3 n=normalize(cross(dFdx(p),dFdy(p)));
        float radius=clamp(.22/max(.3,-p.z),.003,.065),occlusion=0.;
        for(int i=0;i<16;i++){
          float a=float(i)*2.39996323;float r=sqrt((float(i)+.5)/16.);
          vec2 uv=vUv+vec2(cos(a)*resolution.y/resolution.x,sin(a))*radius*r;
          vec3 delta=viewPosition(clamp(uv,vec2(.001),vec2(.999)))-p;
          float distanceTo=length(delta);
          occlusion+=max(0.,dot(n,delta/max(.0001,distanceTo))-.10)*(1.-smoothstep(.02,.42,distanceTo));
        }
        vec4 plateOrWorld=texture2D(colorMap,vUv);
        vec3 color=plateOrWorld.rgb*(1.-min(.42,occlusion*.085));
        color=aces(color*exposure);
        float l=dot(color,vec3(.2126,.7152,.0722));color=mix(vec3(l),color,.90);
        color*=mix(vec3(.94,.975,1.02),vec3(1.025,1.005,.975),smoothstep(.03,.6,l));
        vec2 edge=(vUv-.5)*vec2(1.,.8);color*=1.-.16*dot(edge,edge);
        // Projection plates are already exposed/graded. Alpha 0 is an internal
        // HDR-target tag, not canvas transparency. Real-time metal keeps ACES.
        color=mix(plateOrWorld.rgb,color,plateOrWorld.a);
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`});
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),quad=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(quad);
    // Warm the exact linear-HDR shader variants used by the world pass.
    // compileAsync gathers programs synchronously and then waits for driver completion.
    const compile=renderer.compileAsync?.bind(renderer);
    if(compile)renderer.compileAsync=(world,view,...rest)=>{
      const tone=renderer.toneMapping,previous=renderer.getRenderTarget();
      try{renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(target);return compile(world,view,...rest);}
      finally{renderer.setRenderTarget(previous);renderer.toneMapping=tone;}
    };
    let nested=false;
    renderer.render=(world,view)=>{
      // Reflector and PMREM render their own targets; they must retain the normal renderer.
      if(nested||renderer.getRenderTarget())return original(world,view);
      nested=true;const tone=renderer.toneMapping;
      try{
        const size=renderer.getDrawingBufferSize(new T.Vector2());
        if(target.width!==size.x||target.height!==size.y){target.setSize(size.x,size.y);uniforms.resolution.value.copy(size);}
        uniforms.inverseProjection.value.copy(view.projectionMatrixInverse);
        renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(target);original(world,view);
        renderer.userData.worldCalls=renderer.info.render.calls;
        renderer.setRenderTarget(null);original(scene,camera);
      }finally{renderer.setRenderTarget(null);renderer.toneMapping=tone;nested=false;}
    };
    const dispose=renderer.dispose.bind(renderer);renderer.dispose=()=>{target.dispose();material.dispose();quad.geometry.dispose();dispose();};
    renderer.userData=renderer.userData||{};renderer.userData.cinematic=true;
  }
  window.HNJCinema=Object.freeze({install});
})();
