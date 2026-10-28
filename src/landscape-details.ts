import * as THREE from 'three';
import { mesh, seeded, toon } from './art';
import { islandRadius, pondDistance, terrainHeight, terrainZone } from './terrain';

const colors={ochre:['#d9bb83','#b68b58','#e4c794'],grove:['#6e9e90','#8eb6a0','#477f78'],flowers:['#bd9bae','#d6b6b2','#8b9781'],marsh:['#94bbaa','#bad0ad','#69998f'],meadow:['#c5c886','#a4b277','#d5d498']};
export class LandscapeDetails {
  root=new THREE.Group();
  constructor(){
    const random=seeded(714),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3();
    // Broad broken pigment marks sit on the actual terrain, so they survive orbiting.
    const mark=new THREE.CircleGeometry(1,5);mark.rotateX(-Math.PI/2);
    const strokes=new THREE.InstancedMesh(mark,new THREE.MeshLambertMaterial({color:'#ffffff',side:THREE.DoubleSide}),8200);
    for(let i=0;i<8200;i++){
      let x:number,z:number;do{x=(random()-.5)*17;z=(random()-.5)*12.3;}while(Math.hypot(x/(islandRadius.x-.2),z/(islandRadius.z-.2))>1||pondDistance(x,z)<1.15);
      const zone=terrainZone(x,z),palette=colors[zone];p.set(x,terrainHeight(x,z)+.018,z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),-.5+random()*.65);
      s.set(.018+random()*.045,1,.045+random()*.12);matrix.compose(p,q,s);strokes.setMatrixAt(i,matrix);strokes.setColorAt(i,new THREE.Color(palette[Math.floor(random()*palette.length)]));
    }strokes.receiveShadow=true;this.root.add(strokes);
    const blossoms=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),toon('#ffffff'),920);
    for(let i=0;i<920;i++){
      const angle=random()*Math.PI*2,r=Math.sqrt(random()),x=-4.25+Math.cos(angle)*2.25*r,z=2.35+Math.sin(angle)*1.9*r;
      p.set(x,terrainHeight(x,z)+.05+random()*.16,z);s.set(.035+random()*.025,.03,.035+random()*.025);q.setFromEuler(new THREE.Euler(random(),random(),random()));matrix.compose(p,q,s);
      blossoms.setMatrixAt(i,matrix);blossoms.setColorAt(i,new THREE.Color(['#c882a1','#d9a9b6','#e1c6a6','#b4a3ca','#f0d7bd'][i%5]));
    }this.root.add(blossoms);
    const leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),toon('#548c77',true),480);
    for(let i=0;i<480;i++){
      const cluster=Math.floor(i/24),a=i%24/24*Math.PI*2,r=.05+(i%4)*.09,cx=4.8+Math.sin(cluster*8.1)*1.4,cz=-2.4+Math.cos(cluster*2.8)*1.4;
      const x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;p.set(x,terrainHeight(x,z)+.09+Math.sin(r*6)*.13,z);q.setFromEuler(new THREE.Euler(.4,a,.35));s.set(.045,.014,.17);matrix.compose(p,q,s);leaves.setMatrixAt(i,matrix);
    }leaves.castShadow=true;this.root.add(leaves);
    const bark=toon('#80705c',true),cut=toon('#c8ac80',true),log=new THREE.Group();log.position.set(4.9,terrainHeight(4.9,-3.2)+.22,-3.2);log.rotation.z=Math.PI/2;log.rotation.x=.3;
    mesh(new THREE.CylinderGeometry(.22,.27,1.6,11),bark,log);
    for(const side of [-1,1]){const end=mesh(new THREE.CircleGeometry(.21,16),cut,log,[0,side*.805,0]);end.rotation.x=-side*Math.PI/2;}
    this.root.add(log);
    for(let i=0;i<9;i++){
      const x=5.4+Math.sin(i*2.4)*.65,z=-2.8+Math.cos(i*1.7)*.85,h=.14+random()*.12;
      mesh(new THREE.CylinderGeometry(.025,.04,h,6),toon('#dccba6'),this.root,[x,terrainHeight(x,z)+h/2,z]);
      mesh(new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.55),toon(i%2?'#b58e83':'#b7a588',true),this.root,[x,terrainHeight(x,z)+h,z],[.12,.075,.12]);
    }
  }
}
