import { damp } from './simulation.ts';
export const dayDuration=8*60;
export class WorldState {
  time=0;
  targetTime=0;
  phase=0;
  automatic=true;
  wind=.45;
  haze=true;
  rain=false;
  setTime(value:number){
    this.targetTime=Math.max(0,Math.min(1,value));
    this.phase=Math.acos(1-2*this.targetTime)/(2*Math.PI);
  }
  step(delta:number,reduced=false,paused=false){
    const dt=Math.max(0,Math.min(.05,delta));
    if(this.automatic&&!paused){this.phase=(this.phase+dt/dayDuration)%1;this.targetTime=(1-Math.cos(this.phase*Math.PI*2))/2;}
    this.time=damp(this.time,this.targetTime,reduced?1000:2.4,dt);
  }
  get period(){return this.time<.25?'Daytime':this.time>.78?'Nighttime':this.phase>.5?'Dawn':'Dusk';}
  get night(){const t=Math.max(0,Math.min(1,(this.time-.62)/.38));return t*t*(3-2*t);}
  get dusk(){return Math.max(0,1-Math.abs(this.time-.52)/.43)*(1-this.night);}
}
