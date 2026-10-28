import { dryGroundPoint, constrainToIsland, waterDepth, isDryGround, pondDistance, trees } from './terrain.ts';
export const carryHeight=.72;
export type Point = { x: number; z: number };
export type Activity = 'idle' | 'walking' | 'eating' | 'grazing' | 'resting' | 'swimming';
export type SocialActivity = 'approaching' | 'sniffing' | 'following' | 'leading' | 'settling' | 'resting-together';
export function damp(from: number, to: number, speed: number, dt: number) { return from + (to - from) * (1 - Math.exp(-speed * dt)); }
export function shortestAngle(from: number, to: number) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
export function dryPoint(x: number, z: number): Point { return dryGroundPoint(x,z); }
export function dryRoute(from:Point,to:Point):Point[]{
  if([.2,.4,.6,.8].every(t=>isDryGround(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t)))return [{...to}];
  const a=Math.atan2((from.z+.2)/2.05,(from.x-2)/1.85),b=Math.atan2((to.z+.2)/2.05,(to.x-2)/1.85),turn=shortestAngle(a,b),steps=Math.max(1,Math.ceil(Math.abs(turn)/.28));
  return Array.from({length:steps+1},(_,i)=>({x:2+Math.cos(a+turn*i/steps)*1.85*1.6,z:-.2+Math.sin(a+turn*i/steps)*2.05*1.6})).concat([{...to}]);
}
// A long planted phase followed by a short, rounded swing. During stance,
// foot travel exactly opposes forward travel at the authored stride length.
export function footPose(cycle:number) {
  const p=((cycle%1)+1)%1, stance=.72, stride=.62, reach=stride*stance/2;
  if(p<stance)return {z:reach-stride*p,lift:0,planted:true};
  const u=(p-stance)/(1-stance), ease=u*u*(3-2*u);
  return {z:-reach+2*reach*ease,lift:Math.sin(Math.PI*u)**2*.13,planted:false};
}
export function jumpPose(age: number) {
  if (age < 0 || age >= .94) return { height: 0, scaleY: 1, scaleXZ: 1 };
  if (age < .13) { const t = Math.sin(age / .13 * Math.PI / 2); return { height: 0, scaleY: 1 - .13 * t, scaleXZ: 1 + .065 * t }; }
  if (age < .67) { const p = (age - .13) / .54; return { height: .68 * 4 * p * (1 - p), scaleY: 1 + .07 * Math.sin(p * Math.PI), scaleXZ: 1 - .025 * Math.sin(p * Math.PI) }; }
  const t = (age - .67) / .27;
  return { height: 0, scaleY: 1 - .15 * Math.sin(Math.PI * t) * (1 - t), scaleXZ: 1 + .075 * Math.sin(Math.PI * t) * (1 - t) };
}
export class CapySimulation {
  position: Point = { x: -1.18, z: .68 };
  heading = -.65;
  activity: Activity = 'idle';
  walkBlend = 0;
  gait = 0;
  speed = 0;
  turn = 0;
  attention = 0;
  grazes = 0;
  radius = .68;
  size = 1;
  nibbleNext = true;
  walkTime = 0;
  held = false;
  dropping = false;
  lift = 0;
  fallSpeed = 0;
  landingAge = -1;
  drops = 0;
  dragTarget:Point|null = null;
  dropTarget:Point|null = null;
  dragLean = {x:0,z:0};
  time = 0;
  jumpAge = -1;
  food: Point | null = null;
  foodAge = 0;
  eatTime = 0;
  timer = 4.8;
  destination: Point | null = null;
  jumps = 0;
  meals = 0;
  paused = false;
  waterBlend = 0;
  trip: 'pond' | 'bank' | null = null;
  waypoints: Point[] = [];
  restAfterReturn = false;
  social:SocialActivity|null = null;
  socialGroup:number|null = null;
  socialLook:Point|null = null;
  autonomyCooldown = 0;
  autonomousPond = false;
  pondReturn:Point|null = null;
  pondTimer = 0;
  pondTravelTime = 0;
  pondVisits = 0;
  petAge=-1;
  rollAge=-1;
  pets=0;
  rolls=0;
  nightRest:'settling'|'sleeping'|null=null;
  nightHeading=0;
  wakeAge=-1;
  random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }
  greet(){this.attention=2.8;this.autonomyCooldown=12;}
  pet(){
    if(this.paused||this.held||this.dropping||this.rollAge>=0)return false;
    this.interruptAutonomy();this.destination=null;this.trip=null;this.waypoints=[];this.food=null;this.activity=this.waterBlend>.1?'swimming':'idle';this.timer=5;
    this.petAge=0;this.pets++;this.greet();return true;
  }
  roll(){
    if(this.paused||this.held||this.dropping||this.waterBlend>.1||this.jumpAge>=0||this.rollAge>=0)return false;
    this.interruptAutonomy();this.destination=null;this.food=null;this.trip=null;this.waypoints=[];this.activity='idle';this.timer=5;this.speed=0;this.rollAge=0;this.rolls++;return true;
  }
  interruptAutonomy(){
    if(this.nightRest){this.nightRest=null;this.destination=null;this.waypoints=[];this.activity=waterDepth(this.position.x,this.position.z)>.01?'swimming':'idle';this.timer=3;}
    if(this.social){this.activity='idle';this.destination=null;this.timer=3;}
    if(this.autonomousPond){this.trip=null;this.waypoints=[];this.destination=null;this.activity=waterDepth(this.position.x,this.position.z)>.01?'swimming':'idle';this.timer=3;}
    this.social=null;this.socialGroup=null;this.socialLook=null;this.autonomyCooldown=12;
    this.autonomousPond=false;this.pondReturn=null;
  }
  settleForNight(point:Point,heading:number){
    this.interruptAutonomy();this.nightRest='settling';this.nightHeading=heading;this.food=null;this.trip=null;this.restAfterReturn=false;this.walkTime=0;
    const exitAngle=Math.atan2((point.z+.2)/2.05,(point.x-2)/1.85);
    const shore=dryPoint(2+Math.cos(exitAngle)*2.75,-.2+Math.sin(exitAngle)*3.05);
    this.waypoints=waterDepth(this.position.x,this.position.z)>.01?[shore,...dryRoute(shore,point)]:dryRoute(this.position,point);
    this.destination=this.waypoints.shift()!;this.activity='walking';
  }
  wakeForMorning(delay:number){
    if(!this.nightRest)return;
    this.nightRest=null;this.waypoints=[];this.destination=null;this.trip=null;this.wakeAge=0;this.timer=delay;this.autonomyCooldown=8;this.nibbleNext=true;
    if(waterDepth(this.position.x,this.position.z)>.01)this.travel([dryPoint(this.position.x,this.position.z)],'bank');
    else this.activity='idle';
  }
  hop() { if (this.paused || this.held || this.dropping || this.rollAge>=0 || this.jumpAge >= 0) return false; this.interruptAutonomy();if(this.activity==='resting'||this.activity==='grazing'){this.activity='idle';this.timer=3;} this.speed=0;this.greet();this.jumpAge = 0; this.jumps++; return true; }
  pickUp(){
    if(this.paused||this.held)return false;
    this.interruptAutonomy();
    this.petAge=-1;this.rollAge=-1;this.held=true;this.dropping=false;this.fallSpeed=0;this.landingAge=-1;this.jumpAge=-1;this.speed=0;
    this.food=null;this.trip=null;this.waypoints=[];this.destination=null;this.activity='idle';this.dragTarget={...this.position};this.greet();return true;
  }
  dragTo(point:Point){if(this.held)this.dragTarget=constrainToIsland(point.x,point.z);}
  drop(neighbors:readonly CapySimulation[]=[]){
    if(!this.held)return false;
    const point={...this.position};
    for(let pass=0;pass<4;pass++)for(const other of neighbors){if(other===this)continue;const dx=point.x-other.position.x,dz=point.z-other.position.z,d=Math.hypot(dx,dz),clearance=this.radius+other.radius;
      if(d<clearance){const angle=d<.01?this.heading:Math.atan2(dx,dz);point.x=other.position.x+Math.sin(angle)*clearance;point.z=other.position.z+Math.cos(angle)*clearance;}}
    this.dropTarget=constrainToIsland(point.x,point.z);this.held=false;this.dropping=true;this.dragTarget=null;this.fallSpeed=0;this.timer=2.5;this.drops++;return true;
  }
  travel(points:Point[], trip:'pond'|'bank') { this.waypoints=points;this.destination=this.waypoints.shift()??null;this.trip=trip;this.activity='walking'; }
  visitPond() {
    if(this.paused||this.held||this.dropping||this.rollAge>=0)return false;
    const returning=this.waterBlend>.1||this.trip==='pond';
    this.interruptAutonomy();
    this.food=null;this.restAfterReturn=false;
    if(returning)this.travel([{x:.32,z:-.18},{x:-.9,z:.55}],'bank');
    else this.travel([{x:.32,z:-.18},{x:1.72,z:-.18}],'pond');
    return true;
  }
  visitPondOnOwn(){
    if(this.paused||this.held||this.dropping||this.food||this.social||this.trip||this.activity==='resting'||this.waterBlend>.1)return false;
    const angle=Math.atan2((this.position.z+.2)/2.05,(this.position.x-2)/1.85);
    this.pondReturn=dryPoint(2+Math.cos(angle)*1.85*1.5,-.2+Math.sin(angle)*2.05*1.5);
    this.autonomousPond=true;this.pondTimer=9+this.random()*7;this.pondTravelTime=0;
    this.travel([{...this.pondReturn},{x:2+Math.cos(angle)*.65,z:-.2+Math.sin(angle)*.75}],'pond');
    return true;
  }
  rest() {
    if(this.paused||this.held||this.dropping||this.rollAge>=0)return false;
    const wasResting=this.activity==='resting';this.interruptAutonomy();
    this.food=null;this.destination=null;this.waypoints=[];
    if(wasResting){this.activity='idle';this.timer=5;return true;}
    if(this.waterBlend>.1){this.restAfterReturn=true;this.travel([{x:.32,z:-.18},{x:-.9,z:.55}],'bank');}
    else {this.trip=null;this.activity='resting';}
    return true;
  }
  feed(point?: Point) {
    if (this.paused||this.held||this.dropping||this.rollAge>=0) return false;
    this.interruptAutonomy();
    this.restAfterReturn=false;
    const anchor=this.waterBlend>.1?{x:-1.2,z:.4}:this.position;
    const angles=[0,.6,-.6,1.2,-1.2,1.9,-1.9,Math.PI];
    const candidates=angles.map(a=>dryPoint(anchor.x+Math.sin(this.heading+a)*1.75,anchor.z+Math.cos(this.heading+a)*1.75));
    this.food = point ? dryPoint(point.x, point.z) : candidates.find(p=>Math.hypot(p.x-this.position.x,p.z-this.position.z)>1.5) ?? candidates[0];
    this.foodAge = 0; this.eatTime = 0;
    if(this.waterBlend>.1)this.travel([{x:.32,z:-.18},{x:-.9,z:.55}],'bank');
    else{this.trip=null;this.waypoints=dryRoute(this.position,this.food);this.destination=this.waypoints.shift()!;this.activity='walking';}
    return true;
  }
  wander(neighbors:readonly CapySimulation[]=[]) {
    this.walkTime=0;
    let candidate:Point=this.position;
    for(let attempt=0;attempt<16;attempt++){
      candidate=dryPoint(-6.8+this.random()*13.6,-4.7+this.random()*9.4);
      // Reject routes that cut through the pond. A later stroll can go around it.
      if(![.25,.5,.75].every(t=>isDryGround(this.position.x+(candidate.x-this.position.x)*t,this.position.z+(candidate.z-this.position.z)*t)))continue;
      if(Math.hypot(candidate.x-this.position.x,candidate.z-this.position.z)>.75&&trees.every(([x,z])=>Math.hypot(candidate.x-x,candidate.z-z)>.85)&&neighbors.every(other=>other===this||Math.hypot(candidate.x-other.position.x,candidate.z-other.position.z)>this.radius+other.radius)){this.destination=candidate;this.activity='walking';return;}
    }
    this.activity='grazing';this.grazes++;this.timer=2+this.random()*2;this.destination=null;
  }
  step(delta: number, neighbors:readonly CapySimulation[]=[]) {
    if (this.paused) return;
    const dt = Math.max(0, Math.min(delta, .05));
    this.time += dt;
    if(this.wakeAge>=0){this.wakeAge+=dt;if(this.wakeAge>2)this.wakeAge=-1;}
    if(this.petAge>=0){this.petAge+=dt;if(this.petAge>3)this.petAge=-1;}
    if(this.rollAge>=0){this.rollAge+=dt;if(this.rollAge>3.6)this.rollAge=-1;else{this.walkBlend=damp(this.walkBlend,0,10,dt);return;}}
    this.attention=Math.max(0,this.attention-dt);
    this.autonomyCooldown=Math.max(0,this.autonomyCooldown-dt);
    if(this.autonomousPond){
      if(this.activity==='swimming'){
        this.pondTimer-=dt;
        if(this.pondTimer<=0&&this.pondReturn){this.pondTravelTime=0;this.travel([{...this.pondReturn}],'bank');}
      }else if(this.trip){
        this.pondTravelTime+=dt;
        // A busy bank must not leave an animal permanently committed to a route.
        if(this.pondTravelTime>28){
          if(this.trip==='pond'&&this.pondReturn&&waterDepth(this.position.x,this.position.z)>.01){this.pondTravelTime=0;this.travel([{...this.pondReturn}],'bank');}
          else if(waterDepth(this.position.x,this.position.z)>.01){
            const angle=Math.atan2((this.position.z+.2)/2.05,(this.position.x-2)/1.85)+.6;
            this.pondReturn=dryPoint(2+Math.cos(angle)*2.8,-.2+Math.sin(angle)*3.1);this.pondTravelTime=0;this.travel([{...this.pondReturn}],'bank');
          }else{this.autonomousPond=false;this.pondReturn=null;this.trip=null;this.waypoints=[];this.destination=null;this.activity='idle';this.timer=3;this.autonomyCooldown=15;}
        }
      }
    }
    this.waterBlend=damp(this.waterBlend,this.held?0:waterDepth(this.position.x,this.position.z),7,dt);
    if(this.waterBlend<.00001)this.waterBlend=0;else if(this.waterBlend>.99999)this.waterBlend=1;
    if(this.landingAge>=0){this.landingAge+=dt;if(this.landingAge>.6)this.landingAge=-1;}
    if(this.held&&this.dragTarget){
      const x=damp(this.position.x,this.dragTarget.x,15,dt),z=damp(this.position.z,this.dragTarget.z,15,dt);
      this.dragLean.x=damp(this.dragLean.x,(x-this.position.x)/Math.max(dt,.001)*.045,6,dt);this.dragLean.z=damp(this.dragLean.z,(z-this.position.z)/Math.max(dt,.001)*.045,6,dt);
      this.position={x,z};this.lift=damp(this.lift,carryHeight,11,dt);this.walkBlend=damp(this.walkBlend,0,10,dt);this.attention=2;return;
    }
    this.dragLean.x=damp(this.dragLean.x,0,5,dt);this.dragLean.z=damp(this.dragLean.z,0,5,dt);
    if(this.dropping){
      if(this.dropTarget){this.position.x=damp(this.position.x,this.dropTarget.x,10,dt);this.position.z=damp(this.position.z,this.dropTarget.z,10,dt);}
      this.fallSpeed+=dt*7;this.lift=Math.max(0,this.lift-this.fallSpeed*dt);
      if(this.lift===0){this.dropping=false;this.dropTarget=null;this.landingAge=0;this.activity=waterDepth(this.position.x,this.position.z)>.01?'swimming':'idle';this.timer=2.5;}
      return;
    }
    if (this.food) this.foodAge += dt;
    if (this.jumpAge >= 0) { this.jumpAge += dt; if (this.jumpAge >= .94) this.jumpAge = -1; }
    const moving = this.activity === 'walking' && this.jumpAge < 0;
    this.walkBlend = damp(this.walkBlend, moving ? Math.min(1,this.speed/.28) : 0, 8, dt);
    if(!moving){this.speed=damp(this.speed,0,12,dt);this.turn=damp(this.turn,0,7,dt);}
    if (this.jumpAge >= 0) return;
    if (this.activity === 'walking' && this.destination) {
      this.walkTime+=dt;
      if(!this.food&&!this.trip&&!this.social&&!this.nightRest&&this.walkTime>10){this.activity='grazing';this.grazes++;this.timer=3+this.random()*3;this.destination=null;return;}
      const dx = this.destination.x - this.position.x, dz = this.destination.z - this.position.z;
      const distance = Math.hypot(dx, dz), stop = this.trip ? .045 : this.nightRest ? (this.waypoints.length?.22:.35) : this.waypoints.length ? .06 : this.food ? 1.30*this.size : .06;
      if (distance > stop + .001) {
        let steerX=dx/distance,steerZ=dz/distance;
        for(const [x,z] of trees){const ax=this.position.x-x,az=this.position.z-z,d=Math.hypot(ax,az);if(d>0&&d<1.05){const strength=(1.05-d)*3;steerX+=ax/d*strength;steerZ+=az/d*strength;}}
        for(const other of neighbors){
          if(other===this||other.held)continue;
          const awayX=this.position.x+Math.sin(this.heading)*this.size*.28-other.position.x-Math.sin(other.heading)*other.size*.28,awayZ=this.position.z+Math.cos(this.heading)*this.size*.28-other.position.z-Math.cos(other.heading)*other.size*.28,d=Math.hypot(awayX,awayZ),clearance=this.clearance(other),margin=this.socialGroup!==null&&this.socialGroup===other.socialGroup?.12:.45;
          if(d>0&&d<clearance+margin){const strength=(clearance+margin-d)*2;steerX+=awayX/d*strength;steerZ+=awayZ/d*strength;}
        }
        const desired = Math.atan2(steerX,steerZ), angle=shortestAngle(this.heading,desired);
        const turnStep=Math.max(-dt*1.9,Math.min(dt*1.9,angle*dt*4));
        this.heading+=turnStep;this.turn=damp(this.turn,turnStep/Math.max(dt,.001),5,dt);
        const facing=Math.max(0,Math.cos(shortestAngle(this.heading,desired)));
        const targetSpeed=Math.min((this.trip ? .48 : this.food ? .48 : .32)*facing,Math.sqrt(1.0*Math.max(0,distance-stop)));
        this.speed+=Math.max(-dt*.7,Math.min(dt*.45,targetSpeed-this.speed));
        const step=Math.min(this.speed*dt,distance-stop), length=Math.hypot(steerX,steerZ)||1;
        let next={x:this.position.x+steerX/length*step,z:this.position.z+steerZ/length*step};
        if(!this.trip)next=pondDistance(this.position.x,this.position.z)>=1.42-1e-8?dryPoint(next.x,next.z):constrainToIsland(next.x,next.z);
        // Keep neighbors apart without nudging a resting or selected animal.
        if(neighbors.some(other=>{
          if(other===this||other.held)return false;
          const ox=Math.sin(this.heading)*this.size*.28-other.position.x-Math.sin(other.heading)*other.size*.28,oz=Math.cos(this.heading)*this.size*.28-other.position.z-Math.cos(other.heading)*other.size*.28;
          const nextDistance=Math.hypot(next.x+ox,next.z+oz),currentDistance=Math.hypot(this.position.x+ox,this.position.z+oz);
          // Turning can briefly overlap the generous clearance circles. Always
          // allow a step out of that overlap, so companions cannot deadlock.
          return nextDistance<this.clearance(other)*.88&&nextDistance<=currentDistance;
        })){
          this.speed=0;
          if(!this.food&&!this.trip&&!this.social&&!this.nightRest){this.activity='grazing';this.grazes++;this.timer=2.8+this.random()*2;this.destination=null;}
        }else{
          const travelled=Math.hypot(next.x-this.position.x,next.z-this.position.z);
          this.position=next;this.gait+=travelled*2*Math.PI/(.62*this.size);
        }
      } else {
        if(this.waypoints.length){this.destination=this.waypoints.shift()!;return;}
        if(this.nightRest==='settling'){this.nightRest='sleeping';this.activity='resting';this.destination=null;return;}
        if(this.trip==='pond'){this.activity='swimming';this.trip=null;this.destination=null;if(this.autonomousPond)this.pondVisits++;return;}
        if(this.trip==='bank'){this.trip=null;this.destination=null;if(this.autonomousPond){this.autonomousPond=false;this.pondReturn=null;this.autonomyCooldown=20;}if(this.restAfterReturn){this.activity='resting';this.restAfterReturn=false;}else if(this.food){this.destination={...this.food};this.activity='walking';}else{this.activity='idle';this.timer=5;}return;}
        if(this.social){this.activity='idle';this.destination=null;this.timer=60;return;}
        if (this.food) { this.heading += shortestAngle(this.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 5); this.activity = 'eating'; this.eatTime = 0; }
        else { this.activity = 'grazing'; this.grazes++; this.timer = 3.5 + this.random() * 3; }
        this.destination = null;
      }
    } else if(this.nightRest==='sleeping'){
      this.heading+=shortestAngle(this.heading,this.nightHeading)*Math.min(1,dt*2.5);
    } else if (this.activity === 'eating') {
      if(this.food)this.heading+=shortestAngle(this.heading,Math.atan2(this.food.x-this.position.x,this.food.z-this.position.z))*Math.min(1,dt*5);
      this.eatTime += dt;
      if (this.eatTime > 4) { this.food = null; this.meals++; this.activity = 'idle'; this.timer = 3.5; }
    } else if(this.activity==='grazing'){
      this.timer-=dt;
      if(this.timer<=0){this.activity='idle';this.timer=1.5+this.random()*2.5;this.nibbleNext=false;}
    } else if(this.activity==='idle') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if(this.nibbleNext){this.activity='grazing';this.grazes++;this.timer=3+this.random()*3;this.nibbleNext=false;}
        else this.wander(neighbors);
      }
    }
  }
  private clearance(other:CapySimulation){
    return (this.nightRest&&other.nightRest)||(this.socialGroup!==null&&this.socialGroup===other.socialGroup&&(this.social==='settling'||this.social==='resting-together'))?(this.size+other.size)*.63+.10:this.radius+other.radius;
  }
}
