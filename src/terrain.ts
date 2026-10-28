export type GroundPoint={x:number;z:number};
export const islandRadius={x:8.6,z:6.25};
export const trees=[[-5,-1.9,1.1],[-3.1,-3.6,.86],[3,-3.6,1],[5,-2.1,.72],[-5.2,1.7,.7],[-6.5,-2.7,.85],[.2,-4.8,1.1],[5.8,-3.4,.95],[6.5,.8,.65]];
export function terrainZone(x:number,z:number){
  if(z < -2.5 && x<1.2)return 'ochre';
  if(x>3.8&&z<1.3)return 'grove';
  if(x<-2.2&&z>.1)return 'flowers';
  if(pondDistance(x,z)<1.7)return 'marsh';
  return 'meadow';
}
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function pondDistance(x:number,z:number){return Math.hypot((x-2)/1.85,(z+.2)/2.05);}
export function terrainHeight(x:number,z:number){
  const shore=smooth(1.08,1.85,pondDistance(x,z));
  const edge=1-smooth(.76,1,Math.hypot(x/islandRadius.x,z/islandRadius.z));
  const hill=.48*Math.exp(-((x+3.7)**2/8+(z+1.8)**2/3.8))+.32*Math.exp(-((x+.8)**2/5+(z-3)**2/3))+.58*Math.exp(-((x-4.3)**2/5+(z+3.0)**2/5))+.58*Math.exp(-((x+2.4)**2/10+(z+4.3)**2/2.8));
  return .12+shore*edge*(hill+.035*(Math.sin(x*1.1+z*.7)+1));
}
export function waterDepth(x:number,z:number){return 1-smooth(.70,1.05,pondDistance(x,z));}
export function constrainToIsland(x:number,z:number,margin=.8):GroundPoint{
  const d=Math.hypot(x/(islandRadius.x-margin),z/(islandRadius.z-margin));
  return d>1?{x:x/d,z:z/d}:{x,z};
}
export function dryGroundPoint(x:number,z:number):GroundPoint{
  const p=constrainToIsland(x,z,1.05);
  const dx=(p.x-2)/1.85,dz=(p.z+.2)/2.05,d=Math.hypot(dx,dz);
  if(d<1.42-1e-8){const angle=d<.01?Math.PI:Math.atan2(dz,dx);p.x=2+Math.cos(angle)*1.85*1.42;p.z=-.2+Math.sin(angle)*2.05*1.42;}
  return constrainToIsland(p.x,p.z,1.05);
}
export function isDryGround(x:number,z:number){return pondDistance(x,z)>=1.25&&Math.hypot(x/(islandRadius.x-.7),z/(islandRadius.z-.7))<1;}
