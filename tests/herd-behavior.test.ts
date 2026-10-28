import test from 'node:test';
import assert from 'node:assert/strict';
import { CapySimulation } from '../src/simulation.ts';
import { HerdBehavior } from '../src/herd-behavior.ts';
import { seeded } from '../src/art.ts';

function fixture(expanded=false){
  const starts=[[-1.8,1.4,.84,-.65],[-3.6,-.95,.76,1.2],[4.3,2.2,.70,-.7],[-3.8,2.2,.65,.5]];
  if(expanded)starts.push([-.8,-4.1,.72,2.3],[-5.8,.2,.55,1.4],[5.2,3.5,.61,-1.2]);
  const animals=starts.map(([x,z,size,heading],i)=>{
    const a=new CapySimulation(seeded(44+i*79));Object.assign(a,{position:{x,z},size,radius:size*.98,heading,timer:1+i*1.35});return a;
  });
  const behavior=new HerdBehavior(animals,seeded(301));
  const advance=(seconds:number)=>{for(let i=0;i<seconds*60;i++){behavior.step(1/60);animals.forEach(a=>a.step(1/60,animals));}};
  return {animals,behavior,advance};
}
test('an undisturbed herd greets, follows, naps together and takes round-trip dips',()=>{
  const {animals,behavior,advance}=fixture(true);let sharedNap=false,returned=false,followingTravel=0;
  for(let i=0;i<300*10;i++){
    const follower=animals.find(a=>a.social==='following'),before=follower&&{...follower.position};advance(.1);
    if(follower&&before)followingTravel+=Math.hypot(follower.position.x-before.x,follower.position.z-before.z);
    if(animals.filter(a=>a.social==='resting-together'&&a.activity==='resting').length===2)sharedNap=true;
    if(animals.some(a=>a.pondVisits>0&&!a.autonomousPond&&a.waterBlend===0))returned=true;
  }
  assert.ok(behavior.moments.sniffs>=2);assert.ok(behavior.moments.follows>=2);assert.ok(behavior.moments.naps>=2);
  assert.ok(followingTravel>1,'following should physically move a companion');assert.ok(sharedNap);assert.ok(returned);
  assert.ok(animals.every(a=>a.grazes>0),'socializing leaves time for independent grazing');
});
test('picking up either participant immediately cancels its social pose and frees the companion',()=>{
  for(const participant of [0,3]){
    const {animals,behavior,advance}=fixture();advance(7);assert.equal(behavior.pair?.kind,'sniff');
    const selected=animals[participant];assert.equal(selected.pickUp(),true);
    assert.equal(selected.held,true);assert.equal(selected.social,null);advance(.1);
    assert.ok(selected.lift>0,'stationary pickup lifts without dragTo');assert.equal(behavior.pair,null);
    assert.ok(animals.every(a=>a.social===null));assert.equal(selected.held,true);
  }
});
test('manual rest and feeding own the animal while other capybaras remain autonomous',()=>{
  const {animals,behavior,advance}=fixture();animals[0].rest();animals[1].feed();advance(12);
  assert.equal(animals[0].activity,'resting');assert.equal(animals[0].social,null);
  assert.equal(animals[1].meals,1);assert.equal(animals[1].social,null);
  assert.equal(behavior.startMoment(animals[0],animals[2],'sniff'),false);
});
test('shared naps expire, while a direct wake-up releases the other participant',()=>{
  const {animals,behavior,advance}=fixture();
  animals[0].heading=animals[3].heading=0;
  assert.equal(behavior.startMoment(animals[0],animals[3],'nap'),true);
  advance(12);assert.equal(animals[0].activity,'resting');assert.equal(animals[3].activity,'resting');
  animals[0].rest();advance(.1);assert.equal(behavior.pair,null);assert.equal(animals[0].activity,'idle');assert.equal(animals[3].activity,'idle');
  advance(120);assert.ok(behavior.moments.naps>=2,'later shared naps remain possible');
});
test('pause freezes social timing, individual state and automatic pond scheduling',()=>{
  const {animals,behavior,advance}=fixture();advance(7);animals.forEach(a=>a.paused=true);
  const before=JSON.stringify({animals,behavior});advance(25);assert.equal(JSON.stringify({animals,behavior}),before);
  animals.forEach(a=>a.paused=false);advance(5);assert.equal(behavior.pair,null);
});
test('autonomous swims return to land, and direct commands can interrupt them',()=>{
  const sim=new CapySimulation(()=>.5);assert.equal(sim.visitPondOnOwn(),true);
  for(let i=0;i<60*50;i++)sim.step(1/60);
  assert.equal(sim.pondVisits,1);assert.equal(sim.autonomousPond,false);assert.equal(sim.waterBlend,0);
  sim.visitPondOnOwn();sim.hop();assert.equal(sim.autonomousPond,false);assert.equal(sim.trip,null);assert.equal(sim.jumpAge,0);
  for(let i=0;i<60*2;i++)sim.step(1/60);
  sim.visitPondOnOwn();sim.visitPond();assert.equal(sim.autonomousPond,false);assert.equal(sim.trip,'bank');
});
test('an obstructed social approach times out without leaving either participant reserved',()=>{
  const {animals,behavior,advance}=fixture();assert.equal(behavior.startMoment(animals[0],animals[3],'sniff'),true);
  const target=behavior.pair!.target;
  animals[1].position={...target};animals[1].rest();advance(20);
  assert.equal(behavior.pair,null);assert.equal(animals[0].socialGroup,null);assert.equal(animals[3].socialGroup,null);
  assert.equal(animals[1].activity,'resting');
});
