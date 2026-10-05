import * as THREE from 'three';

const canvas = document.querySelector('#breakCanvas');
const timer = document.querySelector('#timer');
const button = document.querySelector('#continue');
const activity = document.querySelector('#activity');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcddfd6);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 50);
camera.position.set(0, 2.2, 9);
camera.lookAt(0, 1.6, 0);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xfff7e9, 0x638070, 2.8));
const light = new THREE.DirectionalLight(0xffead6, 4.5);
light.position.set(-4, 8, 6);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
scene.add(light);

const material = color => new THREE.MeshStandardMaterial({ color, roughness: .86 });
const cream = material(0xf1ece2);
const white = material(0xfffbf4);
const gray = material(0x827872);
const pink = material(0xdc96a2);
const dark = material(0x322e2c);
const blue = new THREE.MeshPhysicalMaterial({ color: 0x67b7e8, roughness: .16, clearcoat: 1 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd7aa4f, metalness: .55, roughness: .32 });

function make(geometry, mat, position, scale = [1,1,1]) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position); item.scale.set(...scale);
  item.castShadow = true; item.receiveShadow = true;
  return item;
}

const cat = new THREE.Group();
cat.position.y = -.9;
scene.add(cat);
const body = make(new THREE.SphereGeometry(1,40,30),cream,[0,1.15,0],[.82,1.12,.68]);
const hips = make(new THREE.SphereGeometry(1,36,26),cream,[0,.66,.18],[1.36,.29,.68]);
const belly = make(new THREE.SphereGeometry(.55,32,24),white,[0,1.05,.58],[.94,.84,.16]);
cat.add(body,hips,belly);
const headRig = new THREE.Group(); headRig.position.set(0,2.45,.04); cat.add(headRig);
headRig.add(make(new THREE.SphereGeometry(1,44,34),cream,[0,0,0],[.94,.83,.78]));
[-.58,.58].forEach(x=>{
  const ear=make(new THREE.ConeGeometry(.4,.9,4),gray,[x,.7,-.03],[1,1,.55]);
  ear.rotation.y=Math.PI/4; ear.rotation.z=x<0?-.1:.1; headRig.add(ear);
  const inner=make(new THREE.ConeGeometry(.22,.54,4),pink,[x,.69,.17],[1,1,.22]);
  inner.rotation.y=Math.PI/4; inner.rotation.z=ear.rotation.z; headRig.add(inner);
});
const eyes=[];
[-.32,.32].forEach(x=>{
  const rig=new THREE.Group(); rig.position.set(x,.05,.75);
  rig.add(make(new THREE.SphereGeometry(.14,24,18),blue,[0,0,0],[1,1.05,.38]));
  rig.add(make(new THREE.SphereGeometry(.065,18,12),dark,[0,0,.055],[.7,1.2,.35]));
  headRig.add(rig); eyes.push(rig);
});
const ml=make(new THREE.SphereGeometry(.28,24,18),white,[-.2,-.25,.75],[1,.7,.38]);
const mr=ml.clone(); mr.position.x=.2; headRig.add(ml,mr);
headRig.add(make(new THREE.SphereGeometry(.1,18,12),dark,[0,-.18,.91],[1,.7,.5]));
const collar=make(new THREE.TorusGeometry(.52,.07,12,32),pink,[0,1.85,.02],[1,.72,1]); collar.rotation.x=Math.PI/2; cat.add(collar);
cat.add(make(new THREE.SphereGeometry(.1,18,12),gold,[0,1.68,.65]));
const paws=[];
[-.43,.43].forEach(x=>{const paw=make(new THREE.SphereGeometry(.3,26,18),white,[x,.24,.45],[1.25,.55,1.25]);cat.add(paw);paws.push(paw)});
const arms=[];
[-.62,.62].forEach(x=>{
  const rig=new THREE.Group(); rig.position.set(x,1.55,.47);
  rig.add(make(new THREE.CapsuleGeometry(.18,.58,8,16),cream,[0,-.28,0],[1,1,.9]));
  rig.add(make(new THREE.SphereGeometry(.24,22,16),white,[0,-.65,.08],[1.05,.68,1.05]));
  cat.add(rig); arms.push(rig);
});
const tailRig=new THREE.Group(); tailRig.position.set(.64,.75,-.22);
const tailPath=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.55,.04,0),new THREE.Vector3(1,.34,.05),new THREE.Vector3(.92,.8,.12),new THREE.Vector3(.62,.98,.2)]);
tailRig.add(make(new THREE.TubeGeometry(tailPath,28,.16,10,false),gray,[0,0,0])); cat.add(tailRig);
const ground=make(new THREE.CircleGeometry(2.1,48),new THREE.ShadowMaterial({color:0x2a382f,opacity:.2}),[0,-.08,0],[1.4,.4,1]); ground.rotation.x=-Math.PI/2; cat.add(ground);
const whiskers = new THREE.Group();
function whisker(side, y, tilt) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * .18, y, .94),
    new THREE.Vector3(side * .58, y + tilt * .05, .98),
    new THREE.Vector3(side * 1.0, y + tilt, .91)
  ]);
  whiskers.add(make(new THREE.TubeGeometry(curve, 14, .009, 5, false), white, [0, 0, 0]));
}
[-1,1].forEach(side=>{whisker(side,-.25,.13);whisker(side,-.34,0);whisker(side,-.42,-.12)});
headRig.add(whiskers);

let current = { breakRemaining: 600, breakSeconds: 600 };
let blink = 0;
let nextBlink = 2;
const clock = new THREE.Clock();
function format(seconds){const v=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}
function renderState(state){current=state;timer.textContent=format(state.breakRemaining);const done=state.breakRemaining<=0;button.disabled=!done;activity.textContent=done?'猫猫恢复好了，可以继续使用电脑':'起来走走，猫猫也在慢慢恢复'}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  const flat=THREE.MathUtils.clamp(current.breakRemaining/current.breakSeconds,0,1);
  hips.scale.x+=(.84*(1+flat*.62)-hips.scale.x)*.06;
  hips.scale.y+=(.56*(1-flat*.48)-hips.scale.y)*.06;
  hips.position.y+=(.66-flat*.17-hips.position.y)*.06;
  body.scale.x+=(.82*(1+flat*.12)-body.scale.x)*.06;
  body.scale.y+=(1.12*(1-flat*.12)-body.scale.y)*.06;
  paws[0].position.x+=(-.43-flat*.28-paws[0].position.x)*.06;
  paws[1].position.x+=(.43+flat*.28-paws[1].position.x)*.06;
  cat.position.x=Math.sin(t*.35)*.7;
  cat.position.y=-.9+Math.sin(t*1.8)*.025;
  headRig.rotation.y=Math.sin(t*.7)*.16;
  tailRig.rotation.y=Math.sin(t*1.4)*.3;
  arms[0].rotation.z=-.15-Math.abs(Math.sin(t*2.5))*.35;
  arms[1].rotation.z=.12;
  arms[0].rotation.z = -.32 - Math.abs(Math.sin(t * 3.2)) * .55;
  if(t>nextBlink){blink=Math.min(1,blink+dt*14);if(blink>=1)nextBlink=t+3+Math.random()*4}else blink=Math.max(0,blink-dt*12);
  eyes.forEach(eye=>eye.scale.y=Math.max(.08,1-blink)); if(blink>=1)blink=.98;
  renderer.render(scene,camera);
}
button.addEventListener('click',async()=>{if(await window.breakControl.finish())button.disabled=true});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false)});
window.breakControl.onState(renderState);
window.breakControl.getState().then(renderState);
animate();
