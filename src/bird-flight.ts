export class BirdFlight {
  elapsed = 0;
  wait = 9;
  active = false;
  passes = 0;
  direction = 1;
  duration = 8;
  private random:()=>number;
  constructor(random:()=>number=Math.random){this.random=random;}
  step(delta:number){
    const dt=Math.max(0,Math.min(delta,.05));
    if(!this.active){this.wait-=dt;if(this.wait<=0){this.active=true;this.elapsed=0;this.direction=this.random()>.5?1:-1;}}
    else{this.elapsed+=dt;if(this.elapsed>=this.duration){this.active=false;this.passes++;this.wait=28+this.random()*24;}}
  }
  get progress(){return Math.min(1,this.elapsed/this.duration);}
}
