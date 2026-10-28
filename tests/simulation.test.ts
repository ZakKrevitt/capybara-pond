import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CapySimulation, jumpPose, dryPoint, footPose, carryHeight } from '../src/simulation.ts';
import { BirdFlight } from '../src/bird-flight.ts';
import { constrainToIsland, terrainHeight, isDryGround } from '../src/terrain.ts';
function advance(sim:CapySimulation, seconds:number){for(let t=0;t<seconds;t+=1/60)sim.step(1/60);}
test('a hop has a grounded start, airborne peak, clean landing, and cannot queue',()=>{
  const sim=new CapySimulation(()=>.5);assert.equal(sim.hop(),true);assert.equal(sim.hop(),false);assert.equal(sim.jumps,1);
  assert.equal(jumpPose(0).height,0);assert.ok(jumpPose(.4).height>.6);assert.equal(jumpPose(.94).height,0);
  advance(sim,1.1);assert.equal(sim.jumpAge,-1);assert.equal(sim.hop(),true);
});
test('feeding completes an approach, eats the food and returns to autonomous behavior',()=>{
  const sim=new CapySimulation(()=>.5);sim.feed({x:-2.4,z:-.7});advance(sim,18);
  assert.equal(sim.meals,1);assert.equal(sim.food,null);assert.notEqual(sim.activity,'eating');
});
test('pause freezes both behavior and animation time and rejects actions',()=>{
  const sim=new CapySimulation(()=>.5);advance(sim,8);sim.paused=true;const before=JSON.stringify(sim);advance(sim,50);
  assert.equal(JSON.stringify(sim),before);assert.equal(sim.hop(),false);assert.equal(sim.feed(),false);
});
test('long time gaps are bounded and wandering remains on the clear bank',()=>{
  const sim=new CapySimulation(()=>.5);sim.step(200);assert.ok(sim.time<=.05);advance(sim,600);
  assert.deepEqual(dryPoint(sim.position.x,sim.position.z),sim.position);
});
test('rest persists until woken, and a hop wakes the capybara',()=>{
  const sim=new CapySimulation(()=>.5);sim.rest();advance(sim,30);assert.equal(sim.activity,'resting');assert.equal(sim.position.x,-1.18);
  sim.hop();advance(sim,1.1);assert.equal(sim.activity,'idle');
});
test('pond travel reaches the water and can return to rest on dry land',()=>{
  const sim=new CapySimulation(()=>.5);sim.visitPond();advance(sim,25);assert.equal(sim.activity,'swimming');assert.ok(sim.waterBlend>.98);
  sim.rest();advance(sim,25);assert.equal(sim.activity,'resting');assert.equal(sim.waterBlend,0);assert.ok(sim.position.x<0);
});
test('feeding from the pond returns to land and finishes a meal',()=>{
  const sim=new CapySimulation(()=>.5);sim.visitPond();advance(sim,25);sim.feed();advance(sim,40);assert.equal(sim.meals,1);assert.equal(sim.food,null);assert.equal(sim.waterBlend,0);
});
test('a second pond command reverses a journey without getting stuck',()=>{
  const sim=new CapySimulation(()=>.5);sim.visitPond();advance(sim,2);sim.visitPond();advance(sim,25);assert.equal(sim.waterBlend,0);assert.notEqual(sim.activity,'swimming');assert.equal(sim.trip,null);
});
test('a planted foot cancels forward motion and the swing returns continuously',()=>{
  for(const phase of [.1,.3,.5]){
    const a=footPose(phase),b=footPose(phase+.01);
    assert.equal(a.lift,0);assert.ok(Math.abs((b.z-a.z)+.62*.01)<1e-9);
  }
  assert.ok(footPose(.86).lift>.12);
  for(const seam of [0,.72,1])assert.ok(Math.abs(footPose(seam-.00001).z-footPose(seam+.00001).z)<.0001);
});
test('walking builds momentum and turns before advancing toward a target behind it',()=>{
  const sim=new CapySimulation(()=>.5);sim.heading=Math.PI;sim.activity='walking';sim.destination={x:sim.position.x,z:1.7};
  const before={...sim.position};advance(sim,.1);assert.ok(Math.hypot(sim.position.x-before.x,sim.position.z-before.z)<.001);
  sim.heading=0;sim.speed=0;advance(sim,.1);assert.ok(sim.speed>0&&sim.speed<.06);
});
test('four independent capybaras wander, graze and keep their centers apart',()=>{
  const starts=[[-1.8,1.4,.84],[-3.6,-.95,.76],[4.3,2.2,.70],[-3.8,2.2,.65]];
  const herd=starts.map(([x,z,size],i)=>{let seed=44+i*79;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const sim=new CapySimulation(random);sim.position={x,z};sim.size=size;sim.radius=size*.98;sim.timer=1+i;return sim;});
  const distance=herd.map(()=>0);
  for(let frame=0;frame<60*90;frame++)herd.forEach((sim,i)=>{const before={...sim.position};sim.step(1/60,herd);distance[i]+=Math.hypot(sim.position.x-before.x,sim.position.z-before.z);assert.deepEqual(dryPoint(sim.position.x,sim.position.z),sim.position);});
  herd.forEach((sim,i)=>{assert.ok(distance[i]>1.5,`capybara ${i} should explore`);assert.ok(sim.grazes>=2,`capybara ${i} should nibble independently`);});
  for(let i=0;i<herd.length;i++)for(let j=i+1;j<herd.length;j++)assert.ok(Math.hypot(herd[i].position.x-herd[j].position.x,herd[i].position.z-herd[j].position.z)>.8);
  const counts=herd.map(sim=>sim.jumps);herd[2].hop();herd.forEach((sim,i)=>assert.equal(sim.jumps,counts[i]+(i===2?1:0)));
});
test('bird crosses occasionally with a quiet interval between passes',()=>{
  const flight=new BirdFlight(()=>.5);
  for(let i=0;i<60*8;i++)flight.step(1/60);assert.equal(flight.active,false);
  for(let i=0;i<60*3;i++)flight.step(1/60);assert.equal(flight.active,true);assert.ok(flight.progress>0&&flight.progress<1);
  for(let i=0;i<60*8;i++)flight.step(1/60);assert.equal(flight.active,false);assert.equal(flight.passes,1);assert.ok(flight.wait>28);
});
test('pickup eases upward, follows a bounded target and lands before wandering again',()=>{
  const sim=new CapySimulation(()=>.5);assert.equal(sim.pickUp(),true);advance(sim,.1);assert.ok(sim.lift>0&&sim.lift<carryHeight);
  sim.dragTo({x:-4,z:2});advance(sim,2);assert.ok(Math.hypot(sim.position.x+4,sim.position.z-2)<.001);assert.ok(sim.lift>carryHeight-.01);assert.equal(sim.hop(),false);
  assert.equal(sim.drop(),true);advance(sim,1);assert.equal(sim.lift,0);assert.equal(sim.dropping,false);assert.equal(sim.drops,1);assert.equal(sim.activity,'idle');
  const landing={...sim.position};advance(sim,15);assert.ok(Math.hypot(sim.position.x-landing.x,sim.position.z-landing.z)>.5);
});
test('dropping in the pond swims and can still return to land',()=>{
  const sim=new CapySimulation(()=>.5);sim.pickUp();sim.dragTo({x:2,z:0});advance(sim,2);sim.drop();advance(sim,2);assert.equal(sim.activity,'swimming');assert.ok(sim.waterBlend>.98);
  sim.rest();advance(sim,30);assert.equal(sim.activity,'resting');assert.equal(sim.waterBlend,0);
});
test('held capybara pauses safely and drop resolves away from a neighbor',()=>{
  const sim=new CapySimulation(()=>.5),other=new CapySimulation(()=>.5);other.position={x:-3,z:1};
  sim.pickUp();sim.dragTo(other.position);advance(sim,2);sim.paused=true;const before=JSON.stringify(sim);advance(sim,10);assert.equal(JSON.stringify(sim),before);
  sim.paused=false;sim.drop([sim,other]);advance(sim,1);assert.ok(Math.hypot(sim.position.x-other.position.x,sim.position.z-other.position.z)>1.2);
});
test('terrain has raised banks, a level shore and bounded drop locations',()=>{
  assert.ok(terrainHeight(-3.7,-1.8)>.4);assert.equal(terrainHeight(2,0),.12);
  const bounded=constrainToIsland(100,100);assert.ok(Math.hypot(bounded.x/7.8,bounded.z/5.45)<=1.00001);
  assert.equal(isDryGround(2,0),false);assert.equal(isDryGround(-3,1),true);
});
