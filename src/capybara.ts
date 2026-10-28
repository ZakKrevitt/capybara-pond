import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mesh, toon, line, seeded } from './art';
import { CapySimulation, jumpPose, damp, footPose, shortestAngle } from './simulation';
import { terrainHeight } from './terrain';

export class Capybara {
  root = new THREE.Group();
  figure = new THREE.Group();
  head = new THREE.Group();
  legs: {upper:THREE.Mesh;lower:THREE.Mesh;foot:THREE.Group;x:number;z:number}[] = [];
  ears: THREE.Group[] = [];
  eyes: THREE.Mesh[] = [];
  snout: THREE.Mesh;
  picking: THREE.Mesh;
  headTilt = 0;
  restBlend = 0;
  heldBlend = 0;
  sniffBlend = 0;
  private hip=new THREE.Vector3();
  private knee=new THREE.Vector3();
  private ankle=new THREE.Vector3();
  private direction=new THREE.Vector3();
  private up=new THREE.Vector3(0,1,0);
  constructor(variant=0) {
    const coats=['#b58a50','#a9835c','#c49c63','#ab8055','#c3a475','#987653','#c49b73'];
    const fur = toon(coats[variant%coats.length], true), lightFur = toon(new THREE.Color(coats[variant%coats.length]).offsetHSL(.008,-.03,.05), true), muzzle = toon('#a7804d', true);
    const dark = toon('#473c2e'), earInside = toon('#80613c'), footMat = toon('#96703e');
    const sphere = new THREE.SphereGeometry(1, 24, 16);
    this.root.add(this.figure);
    const bodyGeometry = new THREE.SphereGeometry(1, 40, 24);
    const positions = bodyGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
      positions.setXYZ(i, Math.sign(x)*Math.pow(Math.abs(x), .82)*.55, Math.sign(y)*Math.pow(Math.abs(y), .82)*.51, Math.sign(z)*Math.pow(Math.abs(z), .8)*.97);
    }
    bodyGeometry.computeVertexNormals();
    mesh(bodyGeometry, fur, this.figure, [0,.91,-.18]);
    mesh(sphere, fur, this.figure, [0,.94,.38], [.46,.43,.53]);
    this.figure.add(this.head); this.head.position.set(0,1.10,.65);this.head.scale.setScalar(1.065);
    mesh(new RoundedBoxGeometry(.82,.69,.93,5,.25), lightFur, this.head, [0,0,.20]);
    this.snout = mesh(new RoundedBoxGeometry(.76,.44,.53,5,.19), muzzle, this.head, [0,-.13,.67]);
    for (const side of [-1,1]) {
      const ear = new THREE.Group(); ear.position.set(side*.31,.34,-.04); ear.rotation.z=side*-.16; this.head.add(ear); this.ears.push(ear);
      mesh(sphere, fur, ear, [0,.08,0], [.145,.17,.11]);
      mesh(sphere, earInside, ear, [0,.085,.08], [.085,.11,.035]);
      mesh(sphere, lightFur, this.head, [side*.335,-.11,.38], [.12,.17,.22]);
      const eye = mesh(sphere, dark, this.head, [side*.407,.07,.42], [.038,.052,.063]); this.eyes.push(eye);
      mesh(sphere, toon('#f7edc9'), eye, [side*.75,.36,.35], [.22,.22,.20]);
      line([new THREE.Vector3(side*.396,.17,.36),new THREE.Vector3(side*.414,.19,.42),new THREE.Vector3(side*.395,.177,.48)], earInside, this.head);
      const nostril = mesh(sphere, dark, this.head, [side*.20,-.022,.925], [.041,.024,.018]); nostril.rotation.z = side*-.23;
      line([new THREE.Vector3(side*.27,-.20,.904),new THREE.Vector3(side*.12,-.247,.947),new THREE.Vector3(0,-.234,.952)], dark, this.head);
      for (let j=0;j<3;j++) {
        mesh(sphere, earInside, this.head, [side*(.22+(j%2)*.065),-.105-Math.floor(j/2)*.064,.94-(j%2)*.016], [.009,.009,.004]);
      }
    }
    line([new THREE.Vector3(0,-.17,.95),new THREE.Vector3(0,-.23,.953)],dark,this.head);
    const limbGeometry=new THREE.CapsuleGeometry(.14,.72,5,10);
    for (const z of [-.71,.51]) for (const side of [-1,1]) {
      const upper=mesh(limbGeometry,fur,this.root),lower=mesh(limbGeometry,fur,this.root);
      const foot=new THREE.Group();this.root.add(foot);
      mesh(new RoundedBoxGeometry(.29,.16,.37,3,.08), footMat, foot, [0,.08,.04]);
      this.legs.push({upper,lower,foot,x:side*.35,z});
      for (let k=-1;k<=1;k++) {
        line([new THREE.Vector3(k*.073,.045,.223),new THREE.Vector3(k*.073,.10,.215)], dark, foot);
      }
    }
    // Short, surface-following strands keep the fur legible without a fur simulation.
    const rng = seeded(27), strokes: number[] = [], colors: number[] = [];
    for (let i=0;i<340;i++) {
      const a=rng()*Math.PI*2, v=.10+rng()*.80, p=Math.acos(2*v-1);
      const rawX=Math.sin(p)*Math.cos(a), rawY=Math.cos(p), rawZ=Math.sin(p)*Math.sin(a);
      if (rawY < -.55) continue;
      const x=Math.sign(rawX)*Math.pow(Math.abs(rawX),.82)*.554;
      const y=Math.sign(rawY)*Math.pow(Math.abs(rawY),.82)*.514+.91;
      const z=Math.sign(rawZ)*Math.pow(Math.abs(rawZ),.8)*.977-.18;
      const length=.025+rng()*.045;
      strokes.push(x,y,z,x+rawX*.002,y-.008,z-length);
      const col=new THREE.Color(rng()>.5?'#805d37':'#d8b37b'); colors.push(col.r,col.g,col.b,col.r,col.g,col.b);
    }
    const furGeo=new THREE.BufferGeometry(); furGeo.setAttribute('position',new THREE.Float32BufferAttribute(strokes,3)); furGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.figure.add(new THREE.LineSegments(furGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.42})));
    const headStrokes: number[]=[];
    for(let i=0;i<22;i++) { const x=(rng()-.5)*.46,z=.02+rng()*.45; headStrokes.push(x,.334,z,x+.006,.333,z+.04); }
    const headGeo=new THREE.BufferGeometry();headGeo.setAttribute('position',new THREE.Float32BufferAttribute(headStrokes,3));this.head.add(new THREE.LineSegments(headGeo,new THREE.LineBasicMaterial({color:'#886137',transparent:true,opacity:.4})));
    this.picking = new THREE.Mesh(new THREE.BoxGeometry(1.22,1.85,2.8),new THREE.MeshBasicMaterial({visible:false}));
    this.picking.position.set(0,.8,.3);this.root.add(this.picking);
    this.root.position.y=.13;
  }
  private segment(part:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3){
    this.direction.subVectors(b,a);part.position.copy(a).add(b).multiplyScalar(.5);
    part.scale.y=this.direction.length();part.quaternion.setFromUnitVectors(this.up,this.direction.normalize());
  }
  update(sim:CapySimulation, dt:number, reduced:boolean, camera?:THREE.Vector3) {
    const t=sim.time, moving=sim.walkBlend, pose=jumpPose(sim.jumpAge), gait=sim.gait;
    this.restBlend=damp(this.restBlend,sim.activity==='resting'&&sim.jumpAge<0?1:0,4,dt);
    this.heldBlend=damp(this.heldBlend,sim.held||sim.dropping?1:0,10,dt);
    this.sniffBlend=damp(this.sniffBlend,sim.social==='sniffing'?1:0,5,dt);
    const subtle=reduced?.2:1;
    const groundHeight=terrainHeight(sim.position.x,sim.position.z);
    this.root.position.set(sim.position.x,groundHeight+.01+sim.lift-sim.waterBlend*.76*sim.size,sim.position.z);this.root.rotation.y=sim.heading;
    const roll=sim.rollAge<0?0:Math.sin(Math.PI*sim.rollAge/3.6)**2;
    const pet=sim.petAge<0?0:Math.sin(Math.PI*sim.petAge/3);
    this.root.rotation.z=-roll*1.5+Math.sin(t*9)*roll*.07*subtle;this.root.position.y+=roll*.54*sim.size;
    this.figure.position.y=pose.height*(1-sim.waterBlend*.65) + (Math.cos(gait*2+.4)*.023*moving)*subtle-this.restBlend*.31 + (reduced?0:Math.sin(t*1.9)*.025*sim.waterBlend);
    this.figure.scale.set(pose.scaleXZ,pose.scaleY,pose.scaleXZ);
    const landing=sim.landingAge<0?0:Math.sin(sim.landingAge/.6*Math.PI)*Math.exp(-sim.landingAge*5)*.25;
    this.figure.scale.y-=landing;this.figure.scale.x+=landing*.45;this.figure.scale.z+=landing*.45;
    this.figure.rotation.z=(Math.sin(gait)*.035*moving-sim.turn*.012)*subtle;
    this.figure.rotation.z+=pet*.09*subtle;
    this.figure.rotation.x=Math.sin(gait*2)*.012*moving*subtle;
    this.figure.rotation.z+=Math.max(-.22,Math.min(.22,-sim.dragLean.x));this.figure.rotation.x+=Math.max(-.16,Math.min(.16,sim.dragLean.z));
    const breath=reduced?0:Math.sin(t*(sim.nightRest==='sleeping'?1.2:1.7))*.005;
    const waking=sim.wakeAge<0?0:Math.sin(Math.PI*sim.wakeAge/2);
    this.figure.scale.y+=breath+waking*.035*subtle;
    this.legs.forEach((leg,i)=>{
      const step=footPose(gait/(2*Math.PI)+[0,.5,.25,.75][i]);
      const grounded=1-this.restBlend,jump=pose.height*(1-sim.waterBlend*.65);
      this.ankle.set(leg.x,.02+step.lift*moving*grounded+jump,leg.z+step.z*moving*grounded);
      const footX=sim.position.x+(Math.cos(sim.heading)*this.ankle.x+Math.sin(sim.heading)*this.ankle.z)*sim.size,footZ=sim.position.z+(Math.cos(sim.heading)*this.ankle.z-Math.sin(sim.heading)*this.ankle.x)*sim.size;
      this.ankle.y+=(terrainHeight(footX,footZ)-groundHeight)/sim.size*(1-this.heldBlend)*(1-sim.waterBlend);
      this.ankle.y-=this.heldBlend*.13;this.ankle.z+=Math.sin(t*4+i*1.7)*.055*this.heldBlend;
      this.ankle.z+=(i<2?.18:-.18)*this.restBlend;
      this.hip.set(leg.x-this.figure.rotation.z*.45,.59*(pose.scaleY-landing)+this.figure.position.y,leg.z);
      this.knee.copy(this.hip).lerp(this.ankle,.54);this.knee.z+=(i<2?.09:-.075)*(1-this.restBlend*.5);
      this.segment(leg.upper,this.hip,this.knee);this.segment(leg.lower,this.knee,this.ankle);
      leg.foot.position.copy(this.ankle);leg.foot.rotation.x=step.planted?0:Math.sin(gait)*.09*moving;
    });
    const eating=sim.activity==='eating'||sim.activity==='grazing',attention=Math.max(Math.min(1,sim.attention),this.sniffBlend*.7);
    this.headTilt=damp(this.headTilt,eating?.56:attention?-.07:0,5,dt);
    this.head.rotation.x=this.headTilt+this.restBlend*.10+(eating?Math.sin(t*9)*.025:Math.sin(t*1.3)*.012*subtle)-Math.sin(gait*2-.5)*.018*moving*subtle+Math.sin(t*8)*.025*this.sniffBlend*subtle;
    const lookAt=sim.socialLook&&sim.social!=='resting-together'?sim.socialLook:attention&&camera?camera:null;
    const look=lookAt?Math.max(-.42,Math.min(.42,shortestAngle(sim.heading,Math.atan2(lookAt.x-sim.position.x,lookAt.z-sim.position.z)))):Math.sin(t*.55)*.065*(1-moving)*subtle;
    this.head.rotation.y=damp(this.head.rotation.y,look-sim.turn*.06,4,dt);
    this.head.rotation.z=damp(this.head.rotation.z,(attention*.09+pet*.14)*subtle,5,dt);
    this.head.position.y=1.10-Math.max(0,this.headTilt)*.57-Math.sin(gait*2-.3)*.016*moving*subtle;
    this.head.position.z=.65+this.sniffBlend*.045*(.5+.5*Math.sin(t*6))*subtle;
    this.snout.position.y=-.13+(eating?Math.sin(t*15)*.014:0);
    this.snout.scale.y=1+(eating?Math.sin(t*15)*.025:0);
    const blinkTime=t%5.6, blink=blinkTime>4.8&&blinkTime<4.98 ? Math.max(.13,Math.abs(blinkTime-4.89)/.09):1;
    this.eyes.forEach(eye=>eye.scale.y=.052*blink*(1-this.restBlend*.84)*(1-pet*.75)*(eating?.7:1+attention*.12));
    this.ears.forEach((ear,i)=>{const twitch=reduced?0:Math.max(0,Math.sin(t*.8+i*2)-.93)*2;ear.rotation.z=(i===0?1:-1)*(.16+this.restBlend*.23-attention*.09)+Math.sin(t*22)*twitch;ear.rotation.x=-attention*.15-Math.sin(gait-.7)*.045*moving*subtle;});
  }
}
