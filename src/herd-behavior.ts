import { CapySimulation, shortestAngle, type Point } from './simulation.ts';
import { dryGroundPoint, isDryGround, trees } from './terrain.ts';
import { NightRoutine } from './night-routine.ts';

type Moment='sniff'|'follow'|'nap';
type Pair={id:number;a:CapySimulation;b:CapySimulation;kind:Moment;phase:'approach'|'together';target:Point;heading:number;age:number;together:number};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const clearRoute=(a:Point,b:Point)=>distance(b,dryGroundPoint(b.x,b.z))<.01&&[0,.2,.4,.6,.8,1].every(t=>{
  const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  return isDryGround(x,z)&&trees.every(([tx,tz])=>Math.hypot(x-tx,z-tz)>.85);
});

/** One quiet social moment at a time; direct commands always own their animal. */
export class HerdBehavior {
  animals:readonly CapySimulation[];
  random:()=>number;
  pair:Pair|null=null;
  wait=4;
  pondWait=20;
  nextMoment=0;
  serial=0;
  moments={sniffs:0,follows:0,naps:0};
  night:NightRoutine;
  constructor(animals:readonly CapySimulation[],random:()=>number=Math.random){this.animals=animals;this.random=random;this.night=new NightRoutine(animals);}
  private available(animal:CapySimulation){
    return !animal.paused&&!animal.held&&!animal.dropping&&!animal.nightRest&&animal.jumpAge<0&&!animal.food&&!animal.trip&&!animal.social&&!animal.autonomousPond&&animal.autonomyCooldown<=0&&animal.waterBlend<.01&&['idle','walking','grazing'].includes(animal.activity);
  }
  private waitHere(animal:CapySimulation){animal.activity='idle';animal.destination=null;animal.timer=60;}
  private walkTo(animal:CapySimulation,target:Point){animal.activity='walking';animal.destination={...target};animal.walkTime=0;}
  private face(animal:CapySimulation,target:Point,dt:number){animal.heading+=shortestAngle(animal.heading,Math.atan2(target.x-animal.position.x,target.z-animal.position.z))*Math.min(1,dt*2.8);}
  private finish(){
    const pair=this.pair;if(!pair)return;
    for(const animal of [pair.a,pair.b])if(animal.socialGroup===pair.id){
      animal.social=null;animal.socialGroup=null;animal.socialLook=null;animal.autonomyCooldown=9+this.random()*6;
      this.waitHere(animal);animal.timer=1.5+this.random()*2;animal.nibbleNext=true;
    }
    this.pair=null;this.wait=6+this.random()*5;
  }
  /** Returns false when the space is unsuitable, without changing either animal. */
  startMoment(a:CapySimulation,b:CapySimulation,kind:Moment){
    if(this.pair||a===b||!this.available(a)||!this.available(b))return false;
    const d=distance(a.position,b.position);if(d<.01||d>4.8||!clearRoute(a.position,b.position))return false;
    const dx=(a.position.x-b.position.x)/d,dz=(a.position.z-b.position.z)/d;
    let target:Point,heading=b.heading;
    if(kind==='sniff'){
      const gap=(a.size+b.size)*1.65+.13;
      target={x:b.position.x+dx*gap,z:b.position.z+dz*gap};
    }else if(kind==='nap'){
      const gap=(a.size+b.size)*.66+.22;
      const sides=[1,-1].map(side=>({x:b.position.x+Math.cos(heading)*gap*side,z:b.position.z-Math.sin(heading)*gap*side})).sort((p,q)=>distance(a.position,p)-distance(a.position,q));
      const spot=sides.find(p=>clearRoute(a.position,p)&&this.animals.every(other=>other===a||other===b||distance(p,other.position)>a.radius+other.radius+.2));
      if(!spot)return false;target=spot;
    }else{
      const forward=Math.atan2(-dx,-dz);
      const options=[0,.55,-.55,1.1,-1.1,1.8,-1.8].map(offset=>({x:b.position.x+Math.sin(forward+offset)*2.6,z:b.position.z+Math.cos(forward+offset)*2.6}));
      const spot=options.find(p=>clearRoute(b.position,p)&&this.animals.every(other=>other===a||other===b||distance(p,other.position)>b.radius+other.radius));
      if(!spot)return false;target=spot;
    }
    if(kind!=='follow'&&!clearRoute(a.position,target))return false;
    const id=++this.serial;
    this.pair={id,a,b,kind,phase:kind==='follow'?'together':'approach',target,heading,age:0,together:0};
    a.socialGroup=b.socialGroup=id;
    a.social=b.social=kind==='nap'?'settling':'approaching';
    this.waitHere(b);this.walkTo(a,target);
    if(kind==='follow'){a.social='following';b.social='leading';this.walkTo(b,target);this.waitHere(a);this.moments.follows++;}
    return true;
  }
  step(delta:number,timeOfDay=0){
    if(this.animals.every(animal=>animal.paused))return;
    const dt=Math.max(0,Math.min(delta,.05));
    if(this.night.updatePeriod(timeOfDay)&&this.night.active){this.finish();this.animals.forEach(animal=>{if(animal.autonomousPond)animal.autonomyCooldown=0;});}
    if(this.night.active){this.night.step(dt);return;}
    if(this.pair){
      const p=this.pair,{a,b}=p;
      if(a.socialGroup!==p.id||b.socialGroup!==p.id||a.held||b.held||a.food||b.food||a.trip||b.trip){this.finish();}
      else if(!a.paused&&!b.paused){
        p.age+=dt;
        a.socialLook={...b.position};b.socialLook=p.kind==='follow'?null:{...a.position};
        if(p.kind==='follow'){
          const d=distance(a.position,b.position),gap=(a.size+b.size)*1.5+.35;
          if(d>gap+.15){
            const target={x:b.position.x+(a.position.x-b.position.x)/d*gap,z:b.position.z+(a.position.z-b.position.z)/d*gap};
            if(clearRoute(a.position,target))this.walkTo(a,target);else this.waitHere(a);
          }else{this.waitHere(a);this.face(a,b.position,dt);}
          if(p.age>11||distance(a.position,b.position)>5.5)this.finish();
        }else if(p.phase==='approach'){
          if(p.kind==='sniff')this.face(b,a.position,dt);
          if(distance(a.position,p.target)<.16){
            p.phase='together';this.waitHere(a);this.waitHere(b);
            if(p.kind==='sniff'){a.social=b.social='sniffing';this.moments.sniffs++;}
            else{a.social=b.social='resting-together';a.activity=b.activity='resting';this.moments.naps++;}
          }else if(p.age>19)this.finish();
        }else{
          p.together+=dt;
          if(p.kind==='sniff'){this.face(a,b.position,dt);this.face(b,a.position,dt);}
          else{for(const animal of [a,b])animal.heading+=shortestAngle(animal.heading,p.heading)*Math.min(1,dt*2.5);}
          if(p.together>(p.kind==='sniff'?4.5:13))this.finish();
        }
      }
    }else{
      this.wait-=dt;
      if(this.wait<=0){
        const available=this.animals.filter(animal=>this.available(animal));
        const pairs=available.flatMap((a,i)=>available.slice(i+1).map(b=>({a,b,d:distance(a.position,b.position)}))).sort((a,b)=>a.d-b.d);
        const kinds:Moment[]=['sniff','follow','nap'];
        for(const {a,b} of pairs)if(this.startMoment(a,b,kinds[this.nextMoment%3])){this.nextMoment++;break;}
        this.wait=3;
      }
    }
    this.pondWait-=dt;
    if(this.pondWait<=0&&!this.animals.some(animal=>animal.autonomousPond)){
      const available=this.animals.filter(animal=>this.available(animal));
      const animal=available[Math.floor(this.random()*available.length)];
      this.pondWait=animal?.visitPondOnOwn()?30+this.random()*22:4;
    }
  }
}
