import * as THREE from 'three';
import { seeded } from './art';
import { WorldState } from './world-state';

export class Atmosphere {
  root=new THREE.Group();
  uniforms={time:{value:0},strength:{value:.035},tint:{value:new THREE.Color('#ffe4ad')}};
  fireflies:THREE.Points;
  rain:THREE.LineSegments;
  constructor(){
    // Intersecting, feathered slices suggest light scattering through a small
    // volume. Fixed geometry keeps this cheaper than a full-screen ray march.
    const material=new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 vUv; varying vec3 vP; void main(){vUv=uv;vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
      fragmentShader:`uniform float time;uniform float strength;uniform vec3 tint;varying vec2 vUv;varying vec3 vP;
      void main(){float edge=pow(max(0.,sin(vUv.x*3.14159)),2.);float ends=smoothstep(0.,.18,vUv.y)*(1.-smoothstep(.7,1.,vUv.y));float wisps=.7+.3*sin(vP.x*3.+vP.z*2.+time*.2);gl_FragColor=vec4(tint,edge*ends*wisps*strength);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    for(let i=0;i<7;i++)for(const turn of [0,Math.PI/2]){
      const beam=new THREE.Mesh(new THREE.PlaneGeometry(.65+(i%3)*.22,7.5),material);beam.position.set(-5+i*1.7,3.2,-2.4+Math.sin(i*2)*1.4);beam.rotation.z=-.40;beam.rotation.y=turn;this.root.add(beam);
    }
    const random=seeded(788),positions=new Float32Array(72*3);
    for(let i=0;i<72;i++){positions[i*3]=(random()-.5)*13;positions[i*3+1]=.3+random()*1.6;positions[i*3+2]=(random()-.5)*8;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const lights=new THREE.ShaderMaterial({uniforms:{night:{value:0},time:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'uniform float time; varying float glow; void main(){vec3 p=position;p.x+=sin(time*.4+position.z)*.18;p.y+=sin(time*.7+position.x)*.13;glow=.35+.65*pow(.5+.5*sin(time*1.5+position.x*3.),2.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=8.;}',
      fragmentShader:'uniform float night;varying float glow;void main(){float d=length(gl_PointCoord-.5);float a=pow(max(0.,1.-d*2.),2.);gl_FragColor=vec4(1.,.88,.43,a*glow*night);}' });
    this.fireflies=new THREE.Points(geometry,lights);this.root.add(this.fireflies);
    const rainGeo=new THREE.BufferGeometry(),rainPositions=new Float32Array(360*6),rainHeights=new Float32Array(360*2);
    for(let i=0;i<360;i++){const x=(random()-.5)*16,z=(random()-.5)*11,y=random()*6;rainPositions.set([x,y,z,x+.045,y-.17,z],i*6);rainHeights.set([y,y],i*2);}
    rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
    rainGeo.setAttribute('startHeight',new THREE.BufferAttribute(rainHeights,1));
    const rainMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},night:{value:0}},transparent:true,depthWrite:false,
      vertexShader:'uniform float time;attribute float startHeight;void main(){vec3 p=position;p.y=mod(startHeight-time*3.,6.)+position.y-startHeight;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader:'uniform float night;void main(){gl_FragColor=vec4(mix(vec3(.58,.68,.67),vec3(.55,.66,.85),night),.34);}' });
    this.rain=new THREE.LineSegments(rainGeo,rainMat);this.rain.visible=false;this.root.add(this.rain);
  }
  update(time:number,world:WorldState,reduced:boolean){
    this.uniforms.time.value=reduced?0:time;
    this.uniforms.strength.value=world.haze?(.018+world.dusk*.065+world.night*.026)*(world.rain?.4:1):0;
    this.uniforms.tint.value.set('#ffe4ad').lerp(new THREE.Color('#91b9e8'),world.night);
    const fire=this.fireflies.material as THREE.ShaderMaterial;fire.uniforms.night.value=world.night;fire.uniforms.time.value=reduced?0:time;
    this.fireflies.visible=world.night>.01;this.rain.visible=world.rain&&!reduced;
    const rain=this.rain.material as THREE.ShaderMaterial;rain.uniforms.time.value=time;rain.uniforms.night.value=world.night;
  }
}
