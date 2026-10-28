import { CapySimulation, type Point } from './simulation.ts';
import { nightRoute } from './night-navigation.ts';

// Two loose rows on the sheltered bank, with room for heads and folded legs.
const beds:Point[]=[{x:-4.65,z:-.45},{x:-3.35,z:-.35},{x:-2.05,z:-.4},{x:-.75,z:-.3},{x:-4,z:1.9},{x:-2.65,z:1.95},{x:-1.3,z:1.85}];
export class NightRoutine {
  active=false;
  age=0;
  assignments=new Map<CapySimulation,Point>();
  progress=new Map<CapySimulation,{position:Point;age:number}>();
  animals:readonly CapySimulation[];
  constructor(animals:readonly CapySimulation[]){this.animals=animals;}
  updatePeriod(time:number){
    const next=this.active?time>.48:time>.68;
    if(next===this.active)return false;
    this.active=next;this.age=0;
    if(next){
      const available=[...beds];this.assignments.clear();this.progress.clear();
      // Reserve the nearest unoccupied bed before anyone starts approaching.
      for(const animal of this.animals){available.sort((a,b)=>Math.hypot(a.x-animal.position.x,a.z-animal.position.z)-Math.hypot(b.x-animal.position.x,b.z-animal.position.z));this.assignments.set(animal,available.shift()??beds[0]);}
    }else this.animals.forEach((animal,i)=>animal.wakeForMorning(1.5+i*.65));
    return true;
  }
  step(dt:number){
    this.age+=dt;
    this.animals.forEach((animal,i)=>{
      const progress=this.progress.get(animal);
      if(animal.nightRest==='settling'&&progress){
        progress.age+=dt;
        if(progress.age>4){
          if(Math.hypot(animal.position.x-progress.position.x,animal.position.z-progress.position.z)<.18){animal.waypoints=nightRoute(animal,this.assignments.get(animal)!,this.animals);animal.destination=animal.waypoints.shift()!;}
          progress.age=0;progress.position={...animal.position};
        }
      }
      if(animal.paused||animal.nightRest||animal.held||animal.dropping||animal.jumpAge>=0||animal.rollAge>=0||animal.petAge>=0||animal.food||animal.activity==='resting'||animal.autonomyCooldown>0||this.age<i*.9)return;
      // Let one arrival finish before the next enters the close sleeping group.
      if(this.animals.some(other=>other.nightRest==='settling'))return;
      const target=this.assignments.get(animal)!;
      animal.settleForNight(target,[.12,-.08,.16,-.12,.10,-.13,.05][i%7]);
      animal.waypoints=nightRoute(animal,target,this.animals);animal.destination=animal.waypoints.shift()!;
      this.progress.set(animal,{position:{...animal.position},age:0});
    });
  }
}
