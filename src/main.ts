import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Capybara } from './capybara';
import { Environment } from './environment';
import { CapySimulation, damp } from './simulation';
import { seeded } from './art';
import { Bird } from './bird';
import { HerdBehavior } from './herd-behavior';
import { LandscapeDetails } from './landscape-details';
import { Atmosphere } from './atmosphere';
import { WorldState } from './world-state';
import { Wildlife } from './wildlife';
import { dryGroundPoint, constrainToIsland, terrainHeight } from './terrain';

const svg=(body:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const icons={
  hop:svg('<path d="M7 16c-1-6 1-11 5-11s6 5 5 11M8 8l4-4 4 4M5 20h4m6 0h4"/>'),
  feed:svg('<path d="M6 18C1 8 10 3 20 4c1 10-4 17-14 14ZM5 20 15 10m-6 6v-5m3 2h5"/>'),
  closer:svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4M8 10.5h5m-2.5-2.5v5"/>'),
  back:svg('<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M9 12h6"/>'),
  reset:svg('<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>'),
  rest:svg('<path d="M4 17h16M6 14v-3a3 3 0 0 1 3-3h5a4 4 0 0 1 4 4v2M6 11H4v3h14M15 4h4l-4 3h4"/>'),
  pond:svg('<path d="M3 16c3-4 5 4 9 0s6 3 9 0M3 20c3-4 5 4 9 0s6 3 9 0M12 3v9m-3-3 3 3 3-3"/>'),
  pause:svg('<path d="M8 5v14M16 5v14"/>'),
  play:svg('<path d="m8 5 11 7-11 7Z"/>'),
  muted:svg('<path d="M11 5 6 9H3v6h3l5 4ZM16 9l5 6m0-6-5 6"/>'),
  sound:svg('<path d="M11 5 6 9H3v6h3l5 4ZM15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>')
};
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const jumpButton=el<HTMLButtonElement>('jump'),feedButton=el<HTMLButtonElement>('feed'),closerButton=el<HTMLButtonElement>('closer'),pauseButton=el<HTMLButtonElement>('pause'),soundButton=el<HTMLButtonElement>('sound');
const animalPet=el<HTMLButtonElement>('animal-pet'),animalRoll=el<HTMLButtonElement>('animal-roll'),animalFeed=el<HTMLButtonElement>('animal-feed');
const resetButton=el<HTMLButtonElement>('reset-view'),animalMenu=el('animal-menu'),animalHop=el<HTMLButtonElement>('animal-hop'),animalRest=el<HTMLButtonElement>('animal-rest'),animalPond=el<HTMLButtonElement>('animal-pond');
animalPet.querySelector('.menu-icon')!.innerHTML=svg('<path d="M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 4-2 6-6 6H9l-5-6a2 2 0 0 1 3-3l2 2"/>');animalRoll.querySelector('.menu-icon')!.innerHTML=svg('<path d="M5 8a8 8 0 1 1-1 8M3 4v5h5M9 12a3 3 0 1 1 3 3"/>');animalFeed.querySelector('.menu-icon')!.innerHTML=icons.feed;
resetButton.innerHTML=icons.reset;animalHop.querySelector('.menu-icon')!.innerHTML=icons.hop;animalRest.querySelector('.menu-icon')!.innerHTML=icons.rest;animalPond.querySelector('.menu-icon')!.innerHTML=icons.pond;
jumpButton.querySelector('.icon')!.innerHTML=icons.hop;feedButton.querySelector('.icon')!.innerHTML=icons.feed;closerButton.querySelector('.icon')!.innerHTML=icons.closer;pauseButton.innerHTML=icons.pause;soundButton.innerHTML=icons.muted;
feedButton.removeAttribute('aria-pressed');
let renderer:THREE.WebGLRenderer;
try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'}); }
catch(error) { el('loading').hidden=true;el('error').hidden=false;el('reload').onclick=()=>location.reload();jumpButton.disabled=true;feedButton.disabled=true;closerButton.disabled=true;pauseButton.disabled=true;soundButton.disabled=true;throw error; }
renderer.setClearColor('#eff0df');renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
el('world').append(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Seven capybaras at the pond. E pets, O rolls in grass. Press a capybara to lift it immediately, drag to carry, and release to put down. A short click opens actions. Use left and right bracket keys to choose a capybara, then Enter for actions. G picks up, arrow keys carry, G puts down. Drag ground to orbit, right-drag to pan, scroll to zoom. Space to hop, L to lie down, V to visit the pond, R to reset the camera.');
const scene=new THREE.Scene();
const skyLight=new THREE.HemisphereLight('#fff4d7','#8d9a79',2.0);scene.add(skyLight);
const world=new WorldState();const atmosphere=new Atmosphere();scene.add(atmosphere.root);
const rim=new THREE.DirectionalLight('#9fbdcc',.35);rim.position.set(4,5,-5);scene.add(rim);
const sun=new THREE.DirectionalLight('#fff0c5',2.5);sun.position.set(-4,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;sun.shadow.camera.near=.5;sun.shadow.camera.far=25;sun.shadow.normalBias=.035;sun.shadow.bias=-.0003;sun.shadow.radius=3;scene.add(sun);
const environment=new Environment();scene.add(environment.root);scene.add(new LandscapeDetails().root);
const wildlife=new Wildlife();scene.add(wildlife.root);
const herd=[
  {x:-1.8,z:1.4,size:.84,heading:-.65},
  {x:-3.6,z:-.95,size:.76,heading:1.2},
  {x:4.3,z:2.2,size:.70,heading:-.7},
  {x:-3.8,z:2.2,size:.65,heading:.5},
  {x:-.8,z:-4.1,size:.72,heading:2.3},
  {x:-5.8,z:.2,size:.55,heading:1.4},
  {x:5.2,z:3.5,size:.61,heading:-1.2}
].map((config,i)=>{
  const capy=new Capybara(i),sim=new CapySimulation(seeded(44+i*79));
  capy.root.scale.setScalar(config.size);capy.picking.userData.capyIndex=i;scene.add(capy.root);
  sim.position={x:config.x,z:config.z};sim.heading=config.heading;sim.size=config.size;sim.radius=config.size*.98;sim.time=i*1.73;sim.timer=1+i*1.35;sim.gait=i*1.5;
  const food=i===0?environment.food:environment.food.clone(true);if(i>0)scene.add(food);
  return {capy,sim,food};
});
const neighbors=herd.map(animal=>animal.sim);
const herdBehavior=new HerdBehavior(neighbors,seeded(301));
let selectedIndex=0,hoverIndex=-1,capy=herd[0].capy,sim=herd[0].sim;
const birds=[new Bird(),new Bird(991,17,.58),new Bird(105,24,.66)];birds.forEach(b=>scene.add(b.root));const bird=birds[0];
let worldTime=0;
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');let reducedMotion=reducedQuery.matches;
reducedQuery.addEventListener('change',()=>{reducedMotion=reducedQuery.matches;});
const camera=new THREE.OrthographicCamera(-8,8,4.5,-4.5,.1,100);
const cameraOffset=new THREE.Vector3(7.6,10.6,14),cameraTarget=new THREE.Vector3(0,.1,0),overview=new THREE.Vector3(0,.1,0),desiredTarget=new THREE.Vector3();
let desiredZoom=1,close=false,hovered=false,interacted=false,ready=false,selected=false,autoFraming=false,resetOrientation=false;
function resize(){const w=innerWidth,h=innerHeight,aspect=w/h;const halfHeight=Math.max(7.0,11.5/aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.setSize(w,h);}
resize();addEventListener('resize',resize);
herd.forEach(animal=>animal.capy.update(animal.sim,0,reducedMotion));
camera.position.copy(cameraTarget).add(cameraOffset);camera.lookAt(cameraTarget);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(cameraTarget);controls.enableDamping=true;controls.dampingFactor=.075;controls.rotateSpeed=.55;controls.panSpeed=.65;controls.zoomSpeed=.65;controls.minZoom=.7;controls.maxZoom=4.5;controls.minPolarAngle=.28;controls.maxPolarAngle=1.34;controls.update();
controls.listenToKeyEvents(renderer.domElement);controls.keyPanSpeed=14;
controls.addEventListener('start',()=>{autoFraming=false;close=false;closerButton.setAttribute('aria-pressed','false');closerButton.querySelector('.icon')!.innerHTML=icons.closer;closerButton.querySelector('.button-label')!.textContent='Look closer';interactedNow();});

const announce=(text:string)=>{el('announcement').textContent=text;};
function interactedNow(){interacted=true;el('invitation').classList.remove('visible');}
const worldPanel=el('world-panel'),worldToggle=el<HTMLButtonElement>('world-toggle');
worldToggle.onclick=()=>{worldPanel.hidden=!worldPanel.hidden;worldToggle.setAttribute('aria-expanded',String(!worldPanel.hidden));interactedNow();};
el('world-close').onclick=()=>{worldPanel.hidden=true;worldToggle.setAttribute('aria-expanded','false');worldToggle.focus();};
function setTime(value:number){world.setTime(value/100);el<HTMLInputElement>('time-of-day').value=String(value);document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.time)===value)));}
document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(button=>button.onclick=()=>{setTime(Number(button.dataset.time));announce(`${button.textContent} at the pond.`);});
el('automatic-time').onclick=()=>{world.automatic=!world.automatic;el('automatic-time').setAttribute('aria-pressed',String(world.automatic));announce(world.automatic?'The days are flowing again.':'Time will stay here.');};
el<HTMLInputElement>('time-of-day').oninput=event=>setTime(Number((event.target as HTMLInputElement).value));
el<HTMLInputElement>('breeze').oninput=event=>{world.wind=Number((event.target as HTMLInputElement).value)/100;el('breeze-value').textContent=world.wind<.2?'Still':world.wind<.65?'Gentle':'Breezy';};
el('light-shafts').onclick=()=>{world.haze=!world.haze;el('light-shafts').setAttribute('aria-pressed',String(world.haze));};
el('rain').onclick=()=>{world.rain=!world.rain;el('rain').setAttribute('aria-pressed',String(world.rain));announce(world.rain?'A passing shower.':'The shower has passed.');};
el('wake-frogs').onclick=()=>{if(sim.paused)return;wildlife.frogs.forEach((_,i)=>wildlife.hop(i));announce('The frogs are up and about.');};
el('gather').onclick=()=>{if(sim.paused)return;herd.forEach((animal,i)=>{const angle=i/herd.length*Math.PI*2;animal.sim.feed(dryGroundPoint(-3+Math.sin(angle)*2.1,.6+Math.cos(angle)*2.1));});announce('Greens for everyone. The herd is coming over.');};
function chooseAnimal(index:number){if(dragging&&index!==selectedIndex)return;selectedIndex=index;capy=herd[index].capy;sim=herd[index].sim;sim.greet();selected=true;animalMenu.hidden=false;animalMenu.setAttribute('aria-label',`Actions for capybara ${index+1}`);interactedNow();if(close)autoFraming=true;announce(`Capybara ${index+1} selected. Choose an action, or press G to pick up.`);}
function hop(){if(sim.hop()){interactedNow();announce('A little hop.');audio.plop();}}
function feed(){if(sim.feed()){interactedNow();announce('A little snack. The capybara is coming over for greens.');}}
function setClose(next:boolean){close=next;desiredZoom=close?3:1;autoFraming=true;resetOrientation=false;closerButton.setAttribute('aria-pressed',String(close));closerButton.querySelector('.icon')!.innerHTML=close?icons.back:icons.closer;closerButton.querySelector('.button-label')!.textContent=close?'Step back':'Look closer';interactedNow();}
function resetView(){setClose(false);resetOrientation=true;selected=false;animalMenu.hidden=true;announce('Camera returned to the overview.');}
function rest(){if(sim.rest()){interactedNow();announce(sim.activity==='resting'?'Settling down for a rest.':sim.trip==='bank'?'Returning to the bank for a rest.':'Up and about again.');}}
function visitPond(){if(sim.visitPond()){interactedNow();announce(sim.trip==='pond'?'Taking a little dip.':'Heading back to the grassy bank.');}}
function togglePause(){const paused=!sim.paused;herd.forEach(animal=>animal.sim.paused=paused);pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.innerHTML=paused?icons.play:icons.pause;pauseButton.setAttribute('aria-label',paused?'Resume the pond':'Pause the pond');pauseButton.title=paused?'Resume the pond':'Pause the pond';jumpButton.disabled=paused;feedButton.disabled=paused;animalHop.disabled=paused;animalRest.disabled=paused;animalPond.disabled=paused;audio.setPaused(paused);announce(paused?'The pond is paused.':'The pond is moving again.');}
jumpButton.onclick=hop;feedButton.onclick=feed;closerButton.onclick=()=>setClose(!close);pauseButton.onclick=togglePause;resetButton.onclick=resetView;animalHop.onclick=hop;animalRest.onclick=rest;animalPond.onclick=visitPond;animalFeed.onclick=feed;animalPet.onclick=()=>{if(sim.pet())announce('That is the spot.');};animalRoll.onclick=()=>{if(sim.roll())announce('A happy roll in the grass.');};
const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
const pickTargets=herd.map(animal=>animal.capy.picking);
function pick(event:PointerEvent){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickTargets)[0];return hit?Number(hit.object.userData.capyIndex):-1;}
renderer.domElement.addEventListener('pointermove',event=>{
  if(pointerStart&&Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>6)pointerStart.moved=true;
  if(pointerStart&&pointerStart.index>=0&&!sim.paused){
    if(dragging){pick(event);if(raycaster.ray.intersectPlane(dragPlane,dragPoint))sim.dragTo(constrainToIsland(dragPoint.x+grabOffset.x,dragPoint.z+grabOffset.z));renderer.domElement.style.cursor='grabbing';return;}
  }
  hoverIndex=pick(event);hovered=hoverIndex>=0;renderer.domElement.style.cursor=hovered?'grab':'default';
});
renderer.domElement.addEventListener('pointerleave',()=>{hovered=false;hoverIndex=-1;});
let pointerStart:{x:number;y:number;index:number;moved:boolean}|null=null,dragging=false,keyboardCarry=false;
const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.13),dragPoint=new THREE.Vector3(),grabOffset={x:0,z:0};
renderer.domElement.addEventListener('pointerdown',event=>{
  if(event.button!==0||pointerStart||keyboardCarry||!event.isPrimary)return;
  const index=pick(event);pointerStart={x:event.clientX,y:event.clientY,index,moved:false};
  if(index>=0){
    controls.enabled=false;renderer.domElement.setPointerCapture(event.pointerId);
    if(raycaster.ray.intersectPlane(dragPlane,dragPoint)){grabOffset.x=herd[index].sim.position.x-dragPoint.x;grabOffset.z=herd[index].sim.position.z-dragPoint.z;}
    chooseAnimal(index);dragging=sim.pickUp();
    if(dragging){animalMenu.hidden=true;controls.dispatchEvent({type:'start'});renderer.domElement.style.cursor='grabbing';announce('Picked up. Drag to a new spot and release.');}
  }
},true);
function releaseAnimal(){if(dragging){sim.drop(neighbors);announce('A soft landing.');}dragging=false;keyboardCarry=false;pointerStart=null;controls.enabled=true;renderer.domElement.style.cursor='default';}
renderer.domElement.addEventListener('pointerup',event=>{
  if(event.button!==0)return;
  const clicked=pointerStart&&!pointerStart.moved&&Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)<6?pointerStart.index:null;
  releaseAnimal();
  if(clicked!==null){if(clicked>=0)chooseAnimal(clicked);else{selected=false;animalMenu.hidden=true;if(!sim.paused){pick(event);const frog=raycaster.intersectObjects(wildlife.picking)[0];if(frog&&wildlife.hop(Number(frog.object.userData.frog)))announce('A little frog leap.');}}interactedNow();}
  if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('lostpointercapture',()=>{if(pointerStart)releaseAnimal();});
renderer.domElement.addEventListener('pointercancel',releaseAnimal);addEventListener('blur',releaseAnimal);
addEventListener('keydown',event=>{
  if(event.key==='Escape'){el('world-panel').hidden=true;el('world-toggle').setAttribute('aria-expanded','false');releaseAnimal();selected=false;animalMenu.hidden=true;setClose(false);return;}
  if(event.target instanceof HTMLInputElement)return;
  if(event.key.toLowerCase()==='e'){animalPet.click();return;}
  if(event.key.toLowerCase()==='o'){animalRoll.click();return;}
  if(event.key.toLowerCase()==='g'){
    event.preventDefault();if(dragging)releaseAnimal();else if(sim.pickUp()){dragging=true;keyboardCarry=true;controls.enabled=false;controls.dispatchEvent({type:'start'});animalMenu.hidden=true;announce('Picked up. Use arrow keys to move, then G to put down.');}return;
  }
  if(keyboardCarry&&event.key.startsWith('Arrow')){event.preventDefault();const target=sim.dragTarget??sim.position;sim.dragTo({x:target.x+(event.key==='ArrowRight'?.45:event.key==='ArrowLeft'?-.45:0),z:target.z+(event.key==='ArrowDown'?.45:event.key==='ArrowUp'?-.45:0)});return;}
  if(event.code==='Space'){if(event.target instanceof HTMLButtonElement)return;event.preventDefault();hop();}else if(event.key.toLowerCase()==='f')feed();else if(event.key.toLowerCase()==='c'&&!dragging)setClose(!close);else if(event.key.toLowerCase()==='p')togglePause();else if(event.key.toLowerCase()==='l')rest();else if(event.key.toLowerCase()==='v')visitPond();else if(event.key.toLowerCase()==='r'&&!dragging)resetView();else if(event.key==='['||event.key===']'){event.preventDefault();chooseAnimal((selectedIndex+(event.key===']'?1:herd.length-1))%herd.length);}else if(event.key==='Enter'&&event.target===renderer.domElement&&!dragging){event.preventDefault();chooseAnimal(selectedIndex);animalHop.focus();}
});

class PondAudio {
  context:AudioContext|null=null;gain:GainNode|null=null;enabled=false;paused=false;nextBird=0;
  async toggle(){
    if(!this.context){this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);
      const buffer=this.context.createBuffer(1,this.context.sampleRate*4,this.context.sampleRate),data=buffer.getChannelData(0),rng=seeded(501);for(let i=0;i<data.length;i++)data[i]=(rng()-.5)*.16;
      const noise=this.context.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;noise.connect(filter);filter.connect(this.gain);noise.start();
    }
    await this.context.resume();this.enabled=!this.enabled;this.apply();return this.enabled;
  }
  apply(){if(this.context&&this.gain)this.gain.gain.setTargetAtTime(this.enabled&&!this.paused?.38:0,this.context.currentTime,.3);}
  setPaused(paused:boolean){this.paused=paused;this.apply();}
  plop(){if(!this.context||!this.gain||!this.enabled||this.paused)return;const t=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();o.type='sine';o.frequency.setValueAtTime(260,t);o.frequency.exponentialRampToValueAtTime(85,t+.16);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+.25);o.onended=()=>{o.disconnect();g.disconnect();};}
  tick(time:number){if(!this.context||!this.gain||!this.enabled||this.paused||time<this.nextBird)return;this.nextBird=time+9+Math.random()*8;const t=this.context.currentTime;const o=this.context.createOscillator(),g=this.context.createGain();o.frequency.setValueAtTime(1400,t);o.frequency.linearRampToValueAtTime(1950,t+.12);o.frequency.linearRampToValueAtTime(1500,t+.24);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.018,t+.03);g.gain.linearRampToValueAtTime(0,t+.25);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+.3);o.onended=()=>{o.disconnect();g.disconnect();};}
}
const audio=new PondAudio();
soundButton.onclick=async()=>{try{const enabled=await audio.toggle();soundButton.innerHTML=enabled?icons.sound:icons.muted;soundButton.setAttribute('aria-pressed',String(enabled));soundButton.setAttribute('aria-label',enabled?'Turn sound off':'Turn sound on');soundButton.title=enabled?'Turn sound off':'Turn sound on';}catch{announce('Sound is not available in this browser.');}};

const stats={frames:0,fps:0,frameMs:0,p95:0,drawCalls:0,triangles:0,geometries:0,zoom:1,jumps:0,meals:0,activity:'idle',paused:false,position:{x:0,z:0},waterBlend:0,restBlend:0,camera:{azimuth:0,polar:0,target:{x:0,y:0,z:0}},ready:false,selectedIndex:0,herd:[] as object[],world:{time:0,night:0,wind:0,rain:false,haze:true,automatic:true,phase:0,period:'Daytime',bedtime:false},wildlife:{frogHops:[] as number[],birds:0},social:{sniffs:0,follows:0,naps:0},bird:{active:false,passes:0,progress:0}};
const frameSamples:number[]=[];let last=performance.now(),measureStart=last,measureFrames=0,statsLast=last;
const diagnostics=new URLSearchParams(location.search).has('stats');el('performance').hidden=!diagnostics;
const metricsEvent=new CustomEvent('pond-ready');
let contextLost=false;
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;renderer.setAnimationLoop(null);el('error').querySelector('h2')!.textContent='The pond needs a moment.';el('error').querySelector('p')!.textContent='The browser paused its graphics connection. Reload to reopen the pond.';el('error').hidden=false;el('reload').onclick=()=>location.reload();});
renderer.domElement.addEventListener('webglcontextrestored',()=>{location.reload();});
const projected=new THREE.Vector3();
const followOffset=new THREE.Vector3(),resetPosition=new THREE.Vector3();
const sceneInks=['#384936','#e3e6d8'].map(css=>{const color=new THREE.Color(css);return {css,luminance:color.r*.2126+color.g*.7152+color.b*.0722};});
function frame(now:number){
  const delta=Math.min((now-last)/1000,.05);const frameMs=now-last;last=now;
  world.step(delta,reducedMotion,sim.paused);
  if(!sim.paused){worldTime+=delta;herdBehavior.step(delta,world.time);herd.forEach(animal=>{const falling=animal.sim.dropping;animal.sim.step(delta,neighbors);if(falling&&!animal.sim.dropping&&animal.sim.waterBlend>.1)environment.splash(animal.sim.position.x,animal.sim.position.z,worldTime);animal.capy.update(animal.sim,delta,reducedMotion,camera.position);});birds.forEach(b=>b.update(delta,reducedMotion));wildlife.update(delta,worldTime,reducedMotion);}
  const night=world.night,dusk=world.dusk;
  skyLight.intensity=2.0-night*1.12-dusk*.35;skyLight.color.set('#fff4d7').lerp(new THREE.Color('#d8b1bb'),dusk*.6).lerp(new THREE.Color('#96b5d7'),night);
  skyLight.groundColor.set('#859777').lerp(new THREE.Color('#253e51'),night);
  sun.intensity=2.25-night*1.35-dusk*.55;sun.color.set('#fff0c5').lerp(new THREE.Color('#ffad72'),dusk*.75).lerp(new THREE.Color('#9ab9ed'),night);
  sun.position.set(-5+night*10,9-dusk*4.5,5);rim.intensity=.25+night*.48;rim.color.set('#a8bfbb').lerp(new THREE.Color('#8d9de3'),night);
  const background=new THREE.Color('#eee9d8').lerp(new THREE.Color('#d6b9ac'),dusk*.75).lerp(new THREE.Color('#172e3c'),night);renderer.setClearColor(background);
  const backdropL=background.r*.2126+background.g*.7152+background.b*.0722,ink=sceneInks[night>.45?1:0];
  const contrast=(Math.max(backdropL,ink.luminance)+.05)/(Math.min(backdropL,ink.luminance)+.05);
  el('app').style.setProperty('--scene-text',contrast>=4.5?ink.css:backdropL>.179?'#000000':'#ffffff');
  environment.update(worldTime,reducedMotion,night,world.wind);atmosphere.update(worldTime,world,reducedMotion);
  el('app').dataset.night=String(night>.45);
  if(autoFraming){
    if(close)desiredTarget.set(sim.position.x,terrainHeight(sim.position.x,sim.position.z)+(.78-sim.waterBlend*.6)*sim.size+sim.lift,sim.position.z+.2);else desiredTarget.copy(overview);
    followOffset.copy(controls.target);controls.target.lerp(desiredTarget,reducedMotion?1:1-Math.exp(-4*delta));followOffset.sub(controls.target);camera.position.sub(followOffset);
    camera.zoom=damp(camera.zoom,desiredZoom,reducedMotion?1000:5,delta);
    if(resetOrientation){resetPosition.copy(controls.target).add(cameraOffset);camera.position.lerp(resetPosition,reducedMotion?1:1-Math.exp(-5*delta));}
    camera.updateProjectionMatrix();
    if(!close&&controls.target.distanceTo(desiredTarget)<.001&&Math.abs(camera.zoom-desiredZoom)<.001&&(!resetOrientation||camera.position.distanceTo(resetPosition)<.01))autoFraming=false;
  }
  controls.update(delta);
  const ringSim=hoverIndex>=0&&!dragging?herd[hoverIndex].sim:sim,selection=environment.selection;selection.position.set(ringSim.position.x,terrainHeight(ringSim.position.x,ringSim.position.z)+.03,ringSim.position.z+.12);selection.scale.set(ringSim.size,ringSim.size*1.22,1);selection.rotation.z=-ringSim.heading;(selection.material as THREE.MeshBasicMaterial).opacity=damp((selection.material as THREE.MeshBasicMaterial).opacity,hovered||dragging?.65:selected?.4:0,8,delta);
  herd.forEach(animal=>{animal.food.visible=!!animal.sim.food;if(animal.sim.food){animal.food.position.set(animal.sim.food.x,terrainHeight(animal.sim.food.x,animal.sim.food.z)+.015,animal.sim.food.z);animal.food.scale.setScalar(animal.sim.activity==='eating'?Math.max(.05,1-animal.sim.eatTime/4):1);}});
  if(!interacted&&sim.time>1.8&&sim.time<8){projected.set(sim.position.x,2.13*sim.size,sim.position.z).project(camera);const hint=el('invitation');hint.style.transform=`translate(${(projected.x*.5+.5)*innerWidth}px,${(-projected.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;hint.classList.add('visible');}else el('invitation').classList.remove('visible');
  if(selected){projected.set(sim.position.x,terrainHeight(sim.position.x,sim.position.z)+(1.9-sim.waterBlend*.76)*sim.size+sim.lift,sim.position.z).project(camera);const half=animalMenu.offsetWidth/2,top=(innerWidth<760?80:100)+animalMenu.offsetHeight;const x=Math.max(half+12,Math.min(innerWidth-half-12,(projected.x*.5+.5)*innerWidth)),y=Math.max(top,Math.min(innerHeight-120,(-projected.y*.5+.5)*innerHeight));animalMenu.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;}
  audio.tick(worldTime);
  renderer.render(scene,camera);
  if(!ready){ready=true;stats.ready=true;el('loading').classList.add('finished');setTimeout(()=>{el('loading').hidden=true;},550);document.dispatchEvent(metricsEvent);}
  stats.frames++;measureFrames++;
  if(frameMs<250&&frameSamples.length<360)frameSamples.push(frameMs);
  if(now-statsLast>700){
    const sorted=[...frameSamples].sort((a,b)=>a-b);stats.fps=Math.round(measureFrames*1000/(now-measureStart));stats.frameMs=+(frameSamples.reduce((a,b)=>a+b,0)/Math.max(1,frameSamples.length)).toFixed(2);stats.p95=+(sorted[Math.floor(sorted.length*.95)]||0).toFixed(2);stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.geometries=renderer.info.memory.geometries;stats.zoom=+camera.zoom.toFixed(2);stats.jumps=sim.jumps;stats.meals=sim.meals;stats.activity=sim.activity;stats.paused=sim.paused;stats.position={...sim.position};
    stats.waterBlend=+sim.waterBlend.toFixed(3);stats.restBlend=+capy.restBlend.toFixed(3);stats.camera={azimuth:+controls.getAzimuthalAngle().toFixed(3),polar:+controls.getPolarAngle().toFixed(3),target:{x:+controls.target.x.toFixed(3),y:+controls.target.y.toFixed(3),z:+controls.target.z.toFixed(3)}};
    stats.world={time:+world.time.toFixed(3),night:+world.night.toFixed(3),wind:world.wind,rain:world.rain,haze:world.haze,automatic:world.automatic,phase:+world.phase.toFixed(5),period:world.period,bedtime:herdBehavior.night.active};stats.wildlife={frogHops:wildlife.frogs.map(f=>f.hops),birds:birds.filter(b=>b.flight.active).length+2};stats.selectedIndex=selectedIndex;stats.herd=herd.map((animal,index)=>({index,activity:animal.sim.activity,position:{...animal.sim.position},jumps:animal.sim.jumps,meals:animal.sim.meals,grazes:animal.sim.grazes,speed:+animal.sim.speed.toFixed(3),gait:+animal.sim.gait.toFixed(3),paused:animal.sim.paused,held:animal.sim.held,lift:+animal.sim.lift.toFixed(3),drops:animal.sim.drops,dropping:animal.sim.dropping,pets:animal.sim.pets,rolls:animal.sim.rolls,petAge:animal.sim.petAge,rollAge:animal.sim.rollAge,nightRest:animal.sim.nightRest,social:animal.sim.social,socialGroup:animal.sim.socialGroup,autonomousPond:animal.sim.autonomousPond,pondVisits:animal.sim.pondVisits,trip:animal.sim.trip}));stats.social={...herdBehavior.moments};stats.bird={active:bird.flight.active,passes:bird.flight.passes,progress:+bird.flight.progress.toFixed(3)};
    el('app').dataset.pondState=JSON.stringify(stats);
    const timeSlider=el<HTMLInputElement>('time-of-day');if(document.activeElement!==timeSlider)timeSlider.value=String(Math.round(world.targetTime*100));timeSlider.setAttribute('aria-valuetext',world.period);el('day-period').textContent=world.period;document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(button=>button.setAttribute('aria-pressed',String(Math.abs(Number(button.dataset.time)/100-world.targetTime)<.015)));

    const actionDisabled=sim.paused||sim.held||sim.dropping||sim.rollAge>=0;[jumpButton,feedButton,animalHop,animalRest,animalPond,animalPet,animalRoll,animalFeed].forEach(button=>button.disabled=actionDisabled);animalRoll.disabled=actionDisabled||sim.waterBlend>.1;el<HTMLButtonElement>('gather').disabled=sim.paused;el<HTMLButtonElement>('wake-frogs').disabled=sim.paused;closerButton.disabled=sim.held||sim.dropping;
    const activity=sim.paused?'A moment of stillness':sim.held?'A little lift':sim.dropping?'Finding my feet':sim.rollAge>=0?'A very good patch of grass':sim.petAge>=0?'That is the spot':sim.jumpAge>=0?'A little burst of joy':sim.nightRest==='sleeping'?'Sleeping beside friends':sim.nightRest==='settling'?'Finding a bedtime spot':sim.wakeAge>=0?'A slow morning stretch':sim.social==='sniffing'?'A little hello':sim.social==='following'?'Following a friend':sim.social==='resting-together'?'Better with company':sim.social==='settling'?'Saving a spot beside you':sim.activity==='resting'?'An excellent spot for a nap':sim.activity==='swimming'?'Just a little dip':sim.trip==='pond'?'Off to the pond':sim.trip==='bank'?'Back to the bank':sim.activity==='eating'?'A very good snack':sim.activity==='grazing'?'Found a tasty little patch':sim.food?'Something smells good':sim.activity==='walking'?'Nowhere to be, really':'Taking it slow';el('activity').textContent=activity;
    animalRest.querySelector('.menu-label')!.textContent=sim.activity==='resting'?'Wake up':'Lie down';animalRest.setAttribute('aria-pressed',String(sim.activity==='resting'));
    animalPond.querySelector('.menu-label')!.textContent=sim.waterBlend>.1||sim.trip==='pond'?'Back to bank':'Visit pond';
    if(diagnostics)el('performance').textContent=`${stats.fps} fps · ${stats.frameMs} ms average · ${stats.p95} ms p95\n${stats.drawCalls} draws · ${stats.triangles.toLocaleString()} triangles`;
    measureFrames=0;measureStart=now;statsLast=now;frameSamples.length=0;
  }
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){renderer.setAnimationLoop(null);audio.setPaused(true);}else if(!contextLost){last=performance.now();measureStart=last;measureFrames=0;frameSamples.length=0;audio.setPaused(sim.paused);renderer.setAnimationLoop(frame);}});
renderer.compileAsync(scene,camera).then(()=>{last=performance.now();renderer.setAnimationLoop(frame);}).catch(error=>{console.error(error);el('loading').hidden=true;el('error').hidden=false;});
