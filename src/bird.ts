import * as THREE from 'three';
import { mesh, toon, seeded } from './art';
import { BirdFlight } from './bird-flight';

export class Bird {
  root=new THREE.Group();
  flight=new BirdFlight(seeded(881));
  wings:THREE.Group[]=[];
  constructor(seed=881,wait=9,size=1){
    this.flight=new BirdFlight(seeded(seed));this.flight.wait=wait;this.root.scale.setScalar(size);
    const feather=toon('#eee9cf'),tip=toon('#777d68'),beak=toon('#bd965a');
    const sphere=new THREE.SphereGeometry(1,12,8);
    mesh(sphere,feather,this.root,[0,0,0],[.10,.10,.31]);
    mesh(sphere,feather,this.root,[0,.055,.29],[.068,.07,.18]);
    mesh(sphere,feather,this.root,[0,.10,.43],[.095,.09,.11]);
    const bill=mesh(new THREE.ConeGeometry(.035,.20,5),beak,this.root,[0,.085,.59]);bill.rotation.x=Math.PI/2;
    for(const side of [-1,1]){
      const wing=new THREE.Group();this.root.add(wing);this.wings.push(wing);
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.10,side*.42,0,.04,side*.78,0,-.25,side*.54,0,-.42,side*.12,0,-.25],3));
      geometry.setIndex([0,1,4,1,2,3,1,3,4]);geometry.computeVertexNormals();
      feather.side=THREE.DoubleSide;mesh(geometry,feather,wing);
      mesh(sphere,tip,this.root,[side*.083,.12,.45],[.012,.014,.016]);
    }
    const tail=mesh(new THREE.ConeGeometry(.10,.25,3),tip,this.root,[0,0,-.32]);tail.rotation.x=-Math.PI/2;
    this.root.visible=false;
  }
  update(dt:number,reduced:boolean){
    this.flight.step(dt);this.root.visible=this.flight.active&&!reduced;
    if(!this.root.visible)return;
    const p=this.flight.progress,d=this.flight.direction,t=this.flight.elapsed;
    this.root.position.set((-8+16*p)*d,2.8+Math.sin(p*Math.PI)*.45,-1.7+3.4*p+Math.sin(p*Math.PI)*.65);
    this.root.rotation.y=Math.atan2(16*d,3.4+Math.cos(p*Math.PI)*Math.PI*.65);
    this.root.rotation.z=Math.sin(p*Math.PI*2)*.12;
    const flap=Math.sin(t*9)*.65;
    this.wings.forEach((wing,i)=>wing.rotation.z=(i===0?-1:1)*(flap+.13));
  }
}
