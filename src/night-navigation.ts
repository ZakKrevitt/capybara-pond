import { type CapySimulation, type Point, dryPoint } from './simulation.ts';
import { pondDistance, isDryGround, trees } from './terrain.ts';

/** Small bank-only grid, evaluated when a bedtime route starts or is obstructed. */
export function nightRoute(animal:CapySimulation,target:Point,herd:readonly CapySimulation[]):Point[]{
  const spacing=.4,cols=39,rows=27;
  const point=(id:number)=>({x:(id%cols)*spacing-7.6,z:Math.floor(id/cols)*spacing-5.2});
  const sleepers=herd.filter(other=>other!==animal&&!other.held&&other.activity==='resting');
  const clear=(p:Point)=>isDryGround(p.x,p.z)&&pondDistance(p.x,p.z)>1.46&&trees.every(([x,z])=>Math.hypot(p.x-x,p.z-z)>1.05)&&sleepers.every(other=>Math.hypot(p.x-other.position.x,p.z-other.position.z)>(animal.size+other.size)*.63+.32);
  const valid=Array.from({length:cols*rows},(_,id)=>clear(point(id)));
  const nearest=(p:Point)=>{let best=-1,distance=Infinity;valid.forEach((ok,id)=>{if(ok){const q=point(id),d=Math.hypot(q.x-p.x,q.z-p.z);if(d<distance){best=id;distance=d;}}});return best;};
  const start=nearest(dryPoint(animal.position.x,animal.position.z)),end=nearest(target);
  if(start<0||end<0)return [dryPoint(target.x,target.z)];
  const open=[start],cost=new Map([[start,0]]),previous=new Map<number,number>();
  const estimate=(id:number)=>{const p=point(id),q=point(end);return Math.hypot(p.x-q.x,p.z-q.z);};
  const closed=new Set<number>();
  while(open.length){
    open.sort((a,b)=>cost.get(a)!+estimate(a)-cost.get(b)!-estimate(b));const current=open.shift()!;
    if(current===end){
      const ids=[current];while(previous.has(ids[0]))ids.unshift(previous.get(ids[0])!);
      const route=ids.map(point);
      // Keep corners while removing straight runs of grid points.
      const corners=route.filter((p,i)=>i===0||i===route.length-1||Math.abs((p.x-route[i-1].x)*(route[i+1].z-p.z)-(p.z-route[i-1].z)*(route[i+1].x-p.x))>.001);
      if(clear(target)&&Math.hypot(point(end).x-target.x,point(end).z-target.z)<.3)corners.push({...target});
      return corners;
    }
    closed.add(current);const x=current%cols,z=Math.floor(current/cols);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const nx=x+dx,nz=z+dz,next=nz*cols+nx;
      if(nx<0||nx>=cols||nz<0||nz>=rows||!valid[next]||closed.has(next))continue;
      if(dx&&dz&&(!valid[z*cols+nx]||!valid[nz*cols+x]))continue;
      const nextCost=cost.get(current)!+Math.hypot(dx,dz)*spacing;
      if(nextCost<(cost.get(next)??Infinity)){cost.set(next,nextCost);previous.set(next,current);if(!open.includes(next))open.push(next);}
    }
  }
  return [point(start)];
}
