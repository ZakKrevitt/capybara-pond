import * as THREE from 'three';
import { mesh, toon } from './art';
import { terrainHeight, waterDepth } from './terrain';

export class Wildlife {
  root=new THREE.Group();
  frogs:{root:THREE.Group;body:THREE.Mesh;eyes:THREE.Mesh[];from:THREE.Vector3;to:THREE.Vector3;age:number;wait:number;hops:number;home:THREE.Vector2}[]=[];
  picking:THREE.Object3D[]=[];
  birds:THREE.Group[]=[];
  constructor(){
    const sphere=new THREE.SphereGeometry(1,12,8),green=toon('#789a57',true),cream=toon('#c2c28a'),ink=toon('#283c34');
    for(const [i,[x,z]] of [[.15,1.0],[2.95,.6],[3.85,-.6]].entries()){
      const root=new THREE.Group(),body=mesh(sphere,green,root,[0,.1,0],[.18,.12,.24]);
      mesh(sphere,cream,root,[0,.08,.16],[.14,.08,.08]);const eyes:THREE.Mesh[]=[];
      for(const side of [-1,1]){
        mesh(sphere,green,root,[side*.125,.21,.12],[.075,.075,.07]);eyes.push(mesh(sphere,ink,root,[side*.125,.23,.18],[.027,.032,.017]));
        mesh(sphere,green,root,[side*.19,.06,-.10],[.105,.07,.14]);mesh(sphere,green,root,[side*.15,.025,.15],[.045,.025,.12]);
      }
      root.position.set(x,this.floor(x,z),z);root.rotation.y=i*2;this.root.add(root);
      const pick=new THREE.Mesh(new THREE.SphereGeometry(.35,8,6),new THREE.MeshBasicMaterial({visible:false}));pick.position.y=.1;pick.userData.frog=i;root.add(pick);this.picking.push(pick);
      this.frogs.push({root,body,eyes,from:root.position.clone(),to:root.position.clone(),age:-1,wait:4+i*5,hops:0,home:new THREE.Vector2(x,z)});
    }
    for(const [i,[x,z]] of [[-4.9,-1.85],[4.9,-3.2]].entries()){
      const bird=new THREE.Group(),feather=toon(i?'#ad7c61':'#849ead',true),beak=toon('#c7a05d');
      mesh(sphere,feather,bird,[0,.12,0],[.12,.14,.19]);mesh(sphere,feather,bird,[0,.27,.12],[.10,.105,.10]);
      const bill=mesh(new THREE.ConeGeometry(.035,.13,5),beak,bird,[0,.255,.25]);bill.rotation.x=Math.PI/2;
      for(const side of [-1,1])mesh(sphere,ink,bird,[side*.085,.29,.16],[.015,.018,.012]);
      bird.position.set(x,terrainHeight(x,z)+(i?.45:.02),z);bird.rotation.y=i?-.6:1.8;this.root.add(bird);this.birds.push(bird);
    }
  }
  private floor(x:number,z:number){return waterDepth(x,z)>.15?.083:terrainHeight(x,z)+.01;}
  hop(index:number){
    const frog=this.frogs[index];if(!frog||frog.age>=0)return false;
    frog.from.copy(frog.root.position);const angle=frog.hops*2.4+index*1.3,r=index===1?.13:.4;
    const x=frog.home.x+Math.sin(angle)*r,z=frog.home.y+Math.cos(angle)*r;
    frog.to.set(x,this.floor(x,z),z);frog.root.rotation.y=Math.atan2(x-frog.from.x,z-frog.from.z);frog.age=0;frog.hops++;return true;
  }
  update(dt:number,time:number,reduced:boolean){
    this.frogs.forEach((frog,i)=>{
      if(frog.age<0){frog.wait-=dt;if(frog.wait<0&&!reduced)this.hop(i);frog.body.scale.y=.12+(reduced?0:Math.sin(time*2+i)*.006);}
      else{frog.age+=dt;const t=Math.min(1,frog.age/.65);frog.root.position.copy(frog.from).lerp(frog.to,t);frog.root.position.y+=Math.sin(t*Math.PI)*.36;frog.body.scale.y=.12+Math.sin(t*Math.PI)*.025;if(t===1){frog.age=-1;frog.wait=8+(frog.hops*3+i*7)%11;}}
      const blink=(time+i*1.7)%6.3;frog.eyes.forEach(eye=>eye.scale.y=blink>6?.006:.032);
    });
    this.birds.forEach((bird,i)=>{bird.rotation.x=reduced?0:Math.max(0,Math.sin(time*.7+i*3)-.72)*1.1;});
  }
}
