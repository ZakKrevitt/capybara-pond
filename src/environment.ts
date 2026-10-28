import * as THREE from 'three';
import { band, ellipsePoints, flatShape, mesh, seeded, toon } from './art';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight, islandRadius, trees, terrainZone } from './terrain';

const pondCenter = new THREE.Vector2(2.0,-.2);
export function pondDistance(x:number,z:number) { return Math.hypot((x-pondCenter.x)/1.85,(z-pondCenter.y)/2.05); }
function groundGeometry(source:THREE.BufferGeometry,depth=2){
  const p=source.attributes.position,index=source.index,vertices:number[]=[];
  function triangle(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,n:number){
    if(n){const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);triangle(a,ab,ca,n-1);triangle(ab,b,bc,n-1);triangle(ca,bc,c,n-1);triangle(ab,bc,ca,n-1);}
    else for(const v of [a,b,c])vertices.push(v.x,v.y+terrainHeight(v.x,v.z)-.12,v.z);
  }
  const count=index?index.count:p.count;
  for(let i=0;i<count;i+=3){const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j));triangle(points[0],points[1],points[2],depth);}
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));result.computeVertexNormals();source.dispose();return result;
}
export class Environment {
  root = new THREE.Group();
  water: THREE.Mesh;
  waterUniforms = { time: {value:0}, night:{value:0}, color: {value:new THREE.Color('#65b9b2')} };
  windStrength={value:.45};
  windUniform = { value:0 };
  ripples: THREE.Mesh[]=[];
  food = new THREE.Group();
  selection: THREE.Mesh;
  splashTime=-100;
  splashPoint=new THREE.Vector2();
  constructor() {
    const rng=seeded(91), outer=ellipsePoints(0,0,islandRadius.x,islandRadius.z,120,.045);
    const pond=ellipsePoints(pondCenter.x,pondCenter.y,1.85,2.05,80,.065);
    const shore=ellipsePoints(pondCenter.x,pondCenter.y,2.04,2.22,80,.065);
    const landGeo=groundGeometry(flatShape(outer,[shore],.12),3);
    const positions=landGeo.attributes.position, colors:number[]=[];
    for(let i=0;i<positions.count;i++) { const x=positions.getX(i),z=positions.getZ(i),color=new THREE.Color(terrainZone(x,z)==='ochre'?'#c9a566':terrainZone(x,z)==='grove'?'#72978a':terrainZone(x,z)==='flowers'?'#a9ac80':terrainZone(x,z)==='marsh'?'#82ad95':'#b5bc73');const v=Math.sin(x*.85+z*1.1)*.035+Math.sin(x*2.4-z*.9)*.012;color.offsetHSL(v*.25,-v*.5,v);colors.push(color.r,color.g,color.b); }
    landGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const landMat=new THREE.MeshLambertMaterial({color:'#ffffff',vertexColors:true,side:THREE.DoubleSide});
    landMat.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGround;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vGround; float paintHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float paintNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(paintHash(i),paintHash(i+vec2(1.,0.)),f.x),mix(paintHash(i+vec2(0.,1.)),paintHash(i+vec2(1.,1.)),f.x),f.y);}`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float wash=paintNoise(vGround.xz*1.8); float brush=paintNoise(vGround.xz*vec2(19.,48.)+wash*.8); float paper=paintNoise(vGround.xz*180.); float scratch=paintNoise(vGround.xz*vec2(38.,145.)+wash*3.); outgoingLight*=.80+wash*.18+brush*.18+paper*.07; outgoingLight=mix(outgoingLight,outgoingLight*vec3(1.20,1.10,.91),smoothstep(.66,.83,scratch)*.28); outgoingLight=mix(outgoingLight,outgoingLight*vec3(1.04,1.015,.88),smoothstep(.60,.88,wash)*.48);\n#include <opaque_fragment>`);
    };
    const land=mesh(landGeo,landMat,this.root);land.castShadow=false;
    const edgeOuter=outer.map(p=>p.clone().multiplyScalar(.995));
    mesh(band(outer,edgeOuter,.11,-.13),toon('#a0ab65'),this.root);
    const bottomOutline=outer.map(p=>p.clone().multiplyScalar(.965));
    mesh(band(edgeOuter,bottomOutline,-.13,-.29),toon('#b7ac79'),this.root);
    mesh(band(pond,shore,.055,.12),new THREE.MeshLambertMaterial({color:'#ccd09a',side:THREE.DoubleSide}),this.root);
    const waterGeo=flatShape(pond,[],.067);
    const waterMaterial=new THREE.ShaderMaterial({uniforms:this.waterUniforms,side:THREE.DoubleSide,vertexShader:`varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`
      uniform float time; uniform float night; uniform vec3 color; varying vec3 vWorld;
      float wave(vec2 p){return sin(p.x*2.3+p.y*3.8+time*.55)*.5+sin(p.x*4.6-p.y*1.7-time*.4)*.3;}
      void main(){
        vec2 p=vWorld.xz; float d=length((p-vec2(2.,-.2))/vec2(1.85,2.05));
        float rip=wave(p); float stripe=smoothstep(.88,.99,sin(p.y*36.+sin(p.x*5.+time*.4)*.4+time*.5));
        float broken=smoothstep(.35,.75,sin(p.x*12.+p.y*3.));
        vec3 c=mix(color*vec3(.80,.98,1.03),color*vec3(1.13,1.09,.98),smoothstep(.05,.98,d));
        c+=rip*.018; c+=stripe*broken*.065;
        c=mix(c,vec3(.68,.81,.66),smoothstep(.88,1.05,d)*.45);
        c=mix(c,c*vec3(.16,.28,.46),night); c+=stripe*broken*night*vec3(.06,.10,.14); gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.water=mesh(waterGeo,waterMaterial,this.root);this.water.castShadow=false;
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#544a60',opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.y=-.32;ground.receiveShadow=true;this.root.add(ground);

    // A few broad painted patches make the bank feel grown, not tiled.
    const patches=[[-4,-1.6,1.6,.9,'#a0b571'],[-3.4,2.7,1.8,.8,'#c4cd91'],[-.1,-3.3,1.6,.8,'#b4c185'],[-.7,3.1,1.2,.65,'#adbe7d'],[4.5,2.7,1.1,.6,'#bfc58f']];
    for(const p of patches) { const shape=ellipsePoints(p[0] as number,p[1] as number,p[2] as number,p[3] as number,35,.18);const patch=mesh(groundGeometry(flatShape(shape,[],.127),3),new THREE.MeshLambertMaterial({color:p[4] as string,side:THREE.DoubleSide,transparent:true,opacity:.35,depthWrite:false}),this.root);patch.castShadow=false; }

    // A worn bank-side trail is a translucent wash, with feathered edges.
    const trail=new THREE.CatmullRomCurve3([new THREE.Vector3(-5.7,0,.3),new THREE.Vector3(-4.1,0,1.25),new THREE.Vector3(-2.4,0,2.6),new THREE.Vector3(-.4,0,3.1),new THREE.Vector3(1.9,0,2.8),new THREE.Vector3(4.2,0,2.2)]);
    const trailVertices:number[]=[],trailColors:number[]=[],trailIndices:number[]=[];
    for(let i=0;i<=80;i++){
      const t=i/80,p=trail.getPoint(t),tangent=trail.getTangent(t),width=.27+Math.sin(t*13)*.045;
      for(const side of [-1,-.45,.45,1]){const x=p.x-tangent.z*width*side,z=p.z+tangent.x*width*side;trailVertices.push(x,terrainHeight(x,z)+.016,z);trailColors.push(1,1,1,Math.abs(side)===1?0:.62);}
      if(i<80)for(let lane=0;lane<3;lane++){const a=i*4+lane;trailIndices.push(a,a+4,a+1,a+1,a+4,a+5);}
    }
    const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(trailVertices,3));trailGeometry.setAttribute('color',new THREE.Float32BufferAttribute(trailColors,4));trailGeometry.setIndex(trailIndices);trailGeometry.computeVertexNormals();
    const wornTrail=mesh(trailGeometry,new THREE.MeshLambertMaterial({color:'#c6b487',vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide}),this.root);wornTrail.castShadow=false;

    const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute([-.017,0,0,.017,0,0,.014,.13,.014,.014,.13,.014,.017,0,0,.045,.23,.03],3));blade.computeVertexNormals();
    const grassMat=new THREE.MeshLambertMaterial({color:'#ffffff',side:THREE.DoubleSide});
    grassMat.onBeforeCompile=shader=>{shader.uniforms.windTime=this.windUniform;shader.uniforms.windStrength=this.windStrength;shader.vertexShader='uniform float windStrength; uniform float windTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(windTime*1.1 + instanceMatrix[3].x*1.4 + instanceMatrix[3].z)*position.y*position.y*(.18+windStrength*1.7);');};
    const grass=new THREE.InstancedMesh(blade,grassMat,5600);let n=0;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),v=new THREE.Vector3();
    while(n<5600) {const x=(rng()-.5)*16.8,z=(rng()-.5)*12.1; if(Math.hypot(x/8.25,z/5.95)>1||pondDistance(x,z)<1.14)continue;
      const center=Math.hypot((x+1)/2.1,(z-.5)/1.4);if(center<1&&rng()>.12)continue;
      v.set(x,terrainHeight(x,z)+.007,z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),rng()*Math.PI*2);const size=.35+rng()*.62;s.set(size,size,size);matrix.compose(v,q,s);grass.setMatrixAt(n,matrix);grass.setColorAt(n,new THREE.Color(terrainZone(x,z)==='ochre'?'#b99352':terrainZone(x,z)==='grove'?'#507d71':terrainZone(x,z)==='marsh'?'#608f7d':'#87904d').offsetHSL((rng()-.5)*.06,0,(rng()-.5)*.14));n++;
    }grass.receiveShadow=true;this.root.add(grass);

    const flowerGeo=new THREE.SphereGeometry(1,5,3),flowers=new THREE.InstancedMesh(flowerGeo,new THREE.MeshLambertMaterial({color:'#ffffff'}),190);
    for(let i=0;i<190;i++) {let x:number,z:number;do{x=(rng()-.5)*13.5;z=(rng()-.5)*9.4;}while(pondDistance(x,z)<1.22||Math.hypot(x/6.7,z/4.6)>1||Math.hypot((x+1)/1.8,(z-.6)/1.5)<1);v.set(x,terrainHeight(x,z)+.05+rng()*.05,z);s.set(.022,.019,.022).multiplyScalar(.6+rng());matrix.compose(v,q,s);flowers.setMatrixAt(i,matrix);flowers.setColorAt(i,new THREE.Color(rng()>.4?'#f1d88e':'#e8e8bc'));}this.root.add(flowers);

    // Trees sit behind the action, leaving a broad open bank for the character.
    const trunks:THREE.BufferGeometry[]=[], foliageTransforms:{p:THREE.Vector3;s:THREE.Vector3}[]=[];
    for(const tree of trees) {
      const [x,z,size]=tree,base=terrainHeight(x,z)-.12;const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,.1+base,z),new THREE.Vector3(x+.06,.7*size+base,z),new THREE.Vector3(x-.07,1.5*size+base,z-.07)]);
      trunks.push(new THREE.TubeGeometry(curve,8,.075*size,7,false));
      for(let j=0;j<14;j++){const a=rng()*Math.PI*2,r=rng()*.53*size;foliageTransforms.push({p:new THREE.Vector3(x+Math.cos(a)*r,1.55*size+rng()*.65*size+base,z+Math.sin(a)*r),s:new THREE.Vector3(.37+rng()*.17,.37+rng()*.2,.38+rng()*.18).multiplyScalar(size)});}
    }
    mesh(mergeGeometries(trunks),toon('#8c8052'),this.root);
    const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),toon('#ffffff',true),foliageTransforms.length);
    foliageTransforms.forEach((t,i)=>{q.setFromEuler(new THREE.Euler(rng(),rng(),rng()));matrix.compose(t.p,q,t.s);leaves.setMatrixAt(i,matrix);leaves.setColorAt(i,new THREE.Color(t.p.x<-4?'#b88d9e':t.p.x>3?'#5b9387':t.p.z<-4?'#d4ae66':'#91a168').offsetHSL((rng()-.5)*.025,0,(rng()-.5)*.14));});leaves.castShadow=true;leaves.receiveShadow=true;this.root.add(leaves);

    const stems:THREE.BufferGeometry[]=[],heads:THREE.BufferGeometry[]=[];
    for(const cluster of [[3.6,.9],[3.5,-1.2],[.62,-1.72],[1.2,1.65]])for(let i=0;i<7;i++){const x=cluster[0]+(rng()-.5)*.38,z=cluster[1]+(rng()-.5)*.38,h=.35+rng()*.6;const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,.08,z),new THREE.Vector3(x+.03,h*.55,z),new THREE.Vector3(x+.09,h,z+.02)]);stems.push(new THREE.TubeGeometry(curve,3,.011,3,false));if(i%2===0){const g=new THREE.CapsuleGeometry(.025,.14,2,5);g.translate(x+.09,h-.035,z+.02);heads.push(g);} }
    mesh(mergeGeometries(stems),toon('#657b42'),this.root);mesh(mergeGeometries(heads),toon('#876a46'),this.root);

    const padMaterial=toon('#63966b');padMaterial.side=THREE.DoubleSide;
    for(const [x,z,size] of [[2.95,.6,.27],[3.22,.94,.19],[2.67,.99,.13],[1.23,-1.16,.23]]) {
      const pad=new THREE.CircleGeometry(size,24,0,Math.PI*1.87);pad.rotateX(-Math.PI/2);pad.rotateY(rng()*6);const m=mesh(pad,padMaterial,this.root,[x,.077,z]);m.castShadow=false;
      const center=mesh(new THREE.SphereGeometry(.035,5,3),toon('#eadc9f'),this.root,[x,.095,z]);center.castShadow=false;
    }
    const rockMat=toon('#c3c3a0');
    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),rockMat,16);
    for(let i=0;i<16;i++){const a=rng()*6.28,x=2+Math.cos(a)*2.04,z=-.2+Math.sin(a)*2.23;v.set(x,.11,z);s.set(.05+rng()*.12,.035+rng()*.055,.06+rng()*.13);q.setFromEuler(new THREE.Euler(rng(),rng()*6,rng()));matrix.compose(v,q,s);rocks.setMatrixAt(i,matrix);}rocks.receiveShadow=true;rocks.castShadow=true;this.root.add(rocks);
    const bankRocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),toon('#a3ad96'),10);
    for(let i=0;i<10;i++){const cluster=i<6?[-4.6,2.65]:[4.4,-2.55],x=cluster[0]+(rng()-.5)*1.2,z=cluster[1]+(rng()-.5)*.7,size=.18+rng()*.28;v.set(x,terrainHeight(x,z)+size*.24,z);s.set(size*1.3,size*.65,size);q.setFromEuler(new THREE.Euler(rng()*.25,rng()*6,rng()*.2));matrix.compose(v,q,s);bankRocks.setMatrixAt(i,matrix);}bankRocks.castShadow=true;bankRocks.receiveShadow=true;this.root.add(bankRocks);

    for(let i=0;i<5;i++){const ripple=new THREE.Mesh(new THREE.RingGeometry(.96,1,64),new THREE.MeshBasicMaterial({color:'#d4eed5',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));ripple.rotation.x=-Math.PI/2;ripple.position.set(2.2,.079,-.2);this.root.add(ripple);this.ripples.push(ripple);}
    this.selection=new THREE.Mesh(new THREE.RingGeometry(.92,.94,64),new THREE.MeshBasicMaterial({color:'#f5ecc0',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));this.selection.rotation.x=-Math.PI/2;this.selection.scale.set(1,1.22,1);this.selection.position.y=.14;this.root.add(this.selection);
    const foodMat=toon('#779443');
    for(let i=0;i<7;i++){const l=mesh(new THREE.SphereGeometry(1,8,5),foodMat,this.food,[(rng()-.5)*.32,.04+rng()*.07,(rng()-.5)*.27],[.055,.025,.17]);l.rotation.y=rng()*6;l.rotation.z=(rng()-.5)*.5;}
    this.food.visible=false;this.root.add(this.food);
  }
  splash(x:number,z:number,time:number){this.splashPoint.set(x,z);this.splashTime=time;}
  update(time:number, reduced:boolean, night=0, wind=.45) {
    this.waterUniforms.night.value=night;this.windStrength.value=wind;this.waterUniforms.time.value=reduced?0:time;this.windUniform.value=reduced?0:time;
    this.ripples.forEach((ring,i)=>{
      const impact=time-this.splashTime-i*.14,splash=i<3&&impact>=0&&impact<1.6;
      const phase=splash?impact/1.6:(time*.10+i*.2)%1,scale=splash?.2+phase*.7:.12+phase*.82;
      ring.position.x=splash?this.splashPoint.x:2.2;ring.position.z=splash?this.splashPoint.y:-.2;
      ring.scale.setScalar(scale);(ring.material as THREE.MeshBasicMaterial).opacity=reduced?0:Math.sin(phase*Math.PI)*(splash?.28:.15);
    });
  }
}
