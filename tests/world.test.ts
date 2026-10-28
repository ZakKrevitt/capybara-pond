import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldState } from '../src/world-state.ts';
import { CapySimulation } from '../src/simulation.ts';
import { seeded } from '../src/art.ts';
import { dryGroundPoint } from '../src/terrain.ts';

function advance(sim:CapySimulation,seconds:number){for(let i=0;i<seconds*60;i++)sim.step(1/60);}
test('daylight transitions can reverse smoothly and finish at either endpoint',()=>{
  const world=new WorldState();world.setTime(3);world.step(1/60);
  assert.ok(world.time>0&&world.time<.1);assert.equal(world.night,0);
  for(let i=0;i<600;i++)world.step(1/60);
  assert.ok(world.night>.999);assert.ok(world.dusk<.001);
  world.setTime(-1);const before=world.time;world.step(1/60);assert.ok(world.time<before&&world.time>.9);
  world.setTime(.52);world.step(.05,true);assert.ok(world.dusk>.99);assert.equal(world.night,0);
});
test('petting interrupts travel, finishes, and does not lock out carrying',()=>{
  const sim=new CapySimulation(seeded(54));sim.visitPondOnOwn();assert.equal(sim.pet(),true);
  assert.equal(sim.trip,null);assert.equal(sim.autonomousPond,false);assert.equal(sim.pets,1);
  advance(sim,3.1);assert.equal(sim.petAge,-1);
  sim.pet();sim.pickUp();assert.equal(sim.petAge,-1);advance(sim,.1);assert.ok(sim.lift>0);
});
test('rolling stays in place, rejects conflicting actions, pauses and can be picked up',()=>{
  const sim=new CapySimulation(seeded(55));const position={...sim.position};assert.equal(sim.roll(),true);
  advance(sim,1);assert.deepEqual(sim.position,position);assert.equal(sim.hop(),false);assert.equal(sim.feed(),false);
  sim.paused=true;const age=sim.rollAge;advance(sim,5);assert.equal(sim.rollAge,age);sim.paused=false;
  sim.pickUp();assert.equal(sim.rollAge,-1);sim.drop();advance(sim,1);
  assert.equal(sim.roll(),true);advance(sim,4);assert.equal(sim.rollAge,-1);assert.equal(sim.rolls,2);
  sim.pickUp();sim.dragTo({x:2,z:0});advance(sim,2);sim.drop();advance(sim,2);assert.equal(sim.roll(),false);
});
test('seven capybaras can gather from both sides of the pond and finish their snacks',()=>{
  const starts=[[-1.8,1.4,.84],[-3.6,-.95,.76],[4.3,2.2,.70],[-3.8,2.2,.65],[-.8,-4.1,.72],[-5.8,.2,.55],[5.2,3.5,.61]];
  const herd=starts.map(([x,z,size],i)=>{const sim=new CapySimulation(seeded(44+i*79));Object.assign(sim,{position:{x,z},size,radius:size*.98});return sim;});
  herd.forEach((sim,i)=>{const angle=i/herd.length*Math.PI*2;sim.feed(dryGroundPoint(-3+Math.sin(angle)*2.1,.6+Math.cos(angle)*2.1));});
  for(let i=0;i<120*60;i++)herd.forEach(sim=>sim.step(1/60,herd));
  herd.forEach((sim,i)=>assert.equal(sim.meals,1,`animal ${i} should finish its snack; ${JSON.stringify({position:sim.position,destination:sim.destination,food:sim.food})}`));
});
