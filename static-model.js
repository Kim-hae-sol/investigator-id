/* Adapter for the two audited, static glTF assets shipped with this project.
   It is deliberately not a general glTF loader: compressed, animated, interleaved,
   sparse or externally fetched geometry is rejected. Source glTF + binary retained. */
(() => {
  'use strict';
  function create(asset,role,{anisotropy=4,materials,geometries,textures}={}) {
    const T=window.THREE,j=asset.gltf;
    if(j.extensionsRequired?.length)throw Error('Unsupported model extensions');
    const raw=atob(asset.buffer),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const constructors={5126:Float32Array,5123:Uint16Array,5125:Uint32Array},sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
    function attribute(index){
      const a=j.accessors[index],v=j.bufferViews[a.bufferView],C=constructors[a.componentType];
      if(!C||a.sparse||v.byteStride)throw Error('Unsupported static accessor');
      return new T.BufferAttribute(new C(bytes.buffer,(v.byteOffset||0)+(a.byteOffset||0),a.count*sizes[a.type]),sizes[a.type],!!a.normalized);
    }
    const maps=new Map();
    function map(index,srgb=false){
      if(maps.has(index))return maps.get(index);
      const image=document.querySelector(`[data-${role}="${j.textures[index].source}"]`);
      if(!image?.naturalWidth)throw Error('Model texture is unavailable');
      const m=new T.Texture(image);m.flipY=false;m.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;m.anisotropy=anisotropy;m.needsUpdate=true;
      textures.set(role+'-'+index,{map:m});maps.set(index,m);return m;
    }
    const mats=j.materials.map(source=>{
      const p=source.pbrMetallicRoughness||{};
      const m=new T.MeshStandardMaterial({name:source.name,color:role==='table'?'#5c4939':role==='cassette'?'#ffffff':'#c4b9a8',roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,side:T.FrontSide});
      if(p.baseColorTexture)m.map=map(p.baseColorTexture.index,true);
      if(p.metallicRoughnessTexture){m.roughnessMap=map(p.metallicRoughnessTexture.index);m.metalnessMap=m.roughnessMap;m.aoMap=m.roughnessMap;m.aoMapIntensity=.45;}
      if(source.normalTexture){m.normalMap=map(source.normalTexture.index);const strength=role==='table'?.45:.65;m.normalScale.set(strength,strength);}
      // Retain the real PBR maps while avoiding lacquer-like highlights on wood.
      const minimum=role==='table'?.58:.46;
      m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,${minimum.toFixed(2)});`);};
      m.customProgramCacheKey=()=>`hnj-pbr-${role}-${minimum}`;
      m.envMapIntensity=.4;materials.add(m);return m;
    });
    const group=new T.Group();group.name=role+'-pbr-model';
    // Both source files have identity root transforms; mesh zero is the furniture.
    // Dining table mesh one is the unwanted checked tablecloth and is intentionally excluded.
    for(const primitive of j.meshes[0].primitives){
      const g=new T.BufferGeometry();
      for(const [semantic,index] of Object.entries(primitive.attributes)){
        const names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TANGENT:'tangent'};
        if(names[semantic])g.setAttribute(names[semantic],attribute(index));
      }
      g.setIndex(attribute(primitive.indices));g.setAttribute('uv1',g.attributes.uv.clone());g.computeBoundingSphere();
      geometries.set(role+'-'+geometries.size,g);const mesh=new T.Mesh(g,mats[primitive.material]);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    }
    return group;
  }
  window.HNJStaticModel=Object.freeze({create});
})();
