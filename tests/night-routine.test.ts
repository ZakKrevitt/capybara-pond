import test from 'node:test';
import assert from 'node:assert/strict';
import { CapySimulation } from '../src/simulation.ts';
import { HerdBehavior } from '../src/herd-behavior.ts';
import { WorldState, dayDuration } from '../src/world-state.ts';
import { seeded } from '../src/art.ts';

function fixture(){
  const starts=[[-1.8,1.4,.84],[-3.6,-.95,.76],[4.3,2.2,.70],[-3.8,2.2,.65],[-.8,-4.1,.72],[-5.8,.2,.55],[5.2,3.5,.61]];
  const animals=starts.map(([x,z,size],i)=>{const sim=new CapySimulation(seeded(44+i*79));Object.assign(sim,{position:{x,z},size,radius:size*.98,timer:1+i});return sim;});
  const behavior=new HerdBehavior(animals,seeded(301));
  const advance=(seconds:number,time=1)=>{for(let i=0;i<seconds*30;i++){behavior.step(1/30,time);animals.forEach(sim=>sim.step(1/30,animals));}};
  return {animals,behavior,advance};
}
test('automatic daylight crosses night, dawn and morning, pauses, and resumes from manual time',()=>{
  const world=new WorldState();
  for(let i=0;i<dayDuration/2*30;i++)world.step(1/30);
  assert.ok(world.time>.999);assert.equal(world.period,'Nighttime');
  const phase=world.phase;for(let i=0;i<100;i++)world.step(1/30,false,true);assert.equal(world.phase,phase);
  world.automatic=false;world.setTime(.52);for(let i=0;i<100;i++)world.step(1/30);assert.ok(Math.abs(world.time-.52)<.001);
  world.setTime(1);world.automatic=true;for(let i=0;i<dayDuration/4*30;i++)world.step(1/30);assert.equal(world.period,'Dawn');
  for(let i=0;i<dayDuration/4*30;i++)world.step(1/30);assert.ok(world.time<.001);assert.equal(world.period,'Daytime');
});
test('the whole herd gathers on dry land, stays asleep, and wakes up together at dawn',()=>{
  for(const daytime of [0,60,120]){
    const {animals,behavior,advance}=fixture();advance(daytime,0);advance(150);
    for(const [i,sim] of animals.entries())assert.equal(sim.nightRest,'sleeping',`start ${daytime}s animal ${i}: ${JSON.stringify({p:sim.position,d:sim.destination,waypoints:sim.waypoints})}`);
    assert.ok(animals.every(sim=>sim.activity==='resting'&&sim.waterBlend<.01));
    const positions=animals.map(sim=>({...sim.position}));advance(30);assert.deepEqual(animals.map(sim=>sim.position),positions);
    advance(.1,.2);assert.equal(behavior.night.active,false);assert.ok(animals.every(sim=>!sim.nightRest&&sim.activity==='idle'));
    advance(15,0);assert.ok(animals.some((sim,i)=>Math.hypot(sim.position.x-positions[i].x,sim.position.z-positions[i].z)>.2));
  }
});
test('swimmers leave the water for bedtime and a manual nap remains asleep at dawn',()=>{
  const {animals,advance}=fixture();animals[0].position={x:2,z:0};animals[0].activity='swimming';animals[0].waterBlend=1;animals[1].rest();
  advance(150);assert.equal(animals[0].nightRest,'sleeping');assert.equal(animals[0].waterBlend,0);
  advance(2,0);assert.notEqual(animals[0].activity,'resting');assert.equal(animals[0].nightRest,null);assert.equal(animals[1].activity,'resting');
});
test('night routine freezes on pause and yields to pickup before rejoining the group',()=>{
  const {animals,behavior,advance}=fixture();advance(150);animals.forEach(sim=>sim.paused=true);
  const before=JSON.stringify({animals,behavior});advance(10);assert.equal(JSON.stringify({animals,behavior}),before);
  animals.forEach(sim=>sim.paused=false);const chosen=animals[2];chosen.pickUp();assert.equal(chosen.nightRest,null);advance(2);assert.equal(chosen.held,true);
  chosen.dragTo({x:-5,z:3});advance(2);chosen.drop(animals);advance(3);assert.equal(chosen.nightRest,null);
  advance(90);assert.equal(chosen.nightRest,'sleeping');
});
test('reversing to morning during an approach clears bedtime routes without waking manual rests',()=>{
  const {animals,advance}=fixture();advance(3);assert.ok(animals.some(sim=>sim.nightRest==='settling'));
  advance(.1,0);assert.ok(animals.every(sim=>!sim.nightRest&&sim.waypoints.length===0&&sim.destination===null));
});
test('two unattended day-night cycles put all seven to sleep and release them each morning',()=>{
  const {animals,behavior}=fixture(),world=new WorldState();let sleepingNights=0,mornings=0,slept=false,wasNight=false;
  for(let i=0;i<dayDuration*2*30;i++){
    world.step(1/30);behavior.step(1/30,world.time);animals.forEach(sim=>sim.step(1/30,animals));
    if(behavior.night.active&&animals.every(sim=>sim.nightRest==='sleeping')&&!slept){sleepingNights++;slept=true;}
    if(wasNight&&!behavior.night.active){mornings++;slept=false;assert.ok(animals.every(sim=>sim.nightRest===null));}
    wasNight=behavior.night.active;
  }
  assert.equal(sleepingNights,2);assert.equal(mornings,2);
});
