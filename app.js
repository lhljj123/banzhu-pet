import * as THREE from 'three';

const canvas = document.querySelector('#petCanvas');
const reminder = document.querySelector('#reminder');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2.35, 2.35, 2.8, -2.8, .1, 50);
camera.position.set(0, 2.1, 8);
camera.lookAt(0, 1.35, 0);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.setClearColor(0, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xfff9ef, 0x718078, 2.7));
const light = new THREE.DirectionalLight(0xffedda, 4);
light.position.set(-4, 7, 6);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
scene.add(light);
const fill = new THREE.DirectionalLight(0xb9dcff, 1.6);
fill.position.set(4, 3, 4);
scene.add(fill);

const mat = {
  cream: new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: .88 }),
  white: new THREE.MeshStandardMaterial({ color: 0xfffbf4, roughness: .9 }),
  gray: new THREE.MeshStandardMaterial({ color: 0x827872, roughness: .86 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x322e2c, roughness: .5 }),
  blue: new THREE.MeshPhysicalMaterial({ color: 0x67b7e8, roughness: .16, clearcoat: 1 }),
  pink: new THREE.MeshStandardMaterial({ color: 0xdc96a2, roughness: .72 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd7aa4f, metalness: .55, roughness: .32 })
};

function make(geometry, material, position, scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

const cat = new THREE.Group();
cat.position.y = -1.35;
scene.add(cat);

const body = make(new THREE.SphereGeometry(1, 40, 30), mat.cream, [0, 1.15, 0], [.82, 1.12, .68]);
cat.add(body);
const hips = make(new THREE.SphereGeometry(1, 36, 26), mat.cream, [0, .62, -.12], [.78, .42, .62]);
cat.add(hips);
const belly = make(new THREE.SphereGeometry(.55, 32, 24), mat.white, [0, 1.05, .58], [.8, 1, .16]);
cat.add(belly);

const headRig = new THREE.Group();
headRig.position.set(0, 2.55, .04);
cat.add(headRig);
headRig.add(make(new THREE.SphereGeometry(1, 44, 34), mat.cream, [0, 0, 0], [.94, .83, .78]));

function addEar(x) {
  const group = new THREE.Group();
  group.position.set(x, .7, -.03);
  const outer = make(new THREE.ConeGeometry(.4, .9, 4), mat.gray, [0, 0, 0], [1, 1, .55]);
  outer.rotation.y = Math.PI / 4;
  outer.rotation.z = x < 0 ? -.1 : .1;
  const inner = make(new THREE.ConeGeometry(.22, .54, 4), mat.pink, [0, -.01, .2], [1, 1, .22]);
  inner.rotation.y = Math.PI / 4;
  inner.rotation.z = outer.rotation.z;
  group.add(outer, inner);
  headRig.add(group);
  return group;
}
const leftEar = addEar(-.58);
const rightEar = addEar(.58);

const eyes = [];
function addEye(x) {
  const rig = new THREE.Group();
  rig.position.set(x, .05, .75);
  rig.add(make(new THREE.SphereGeometry(.14, 24, 18), mat.blue, [0, 0, 0], [1, 1.05, .38]));
  rig.add(make(new THREE.SphereGeometry(.065, 18, 12), mat.dark, [0, 0, .055], [.7, 1.2, .35]));
  rig.add(make(new THREE.SphereGeometry(.024, 10, 8), mat.white, [-.04, .05, .08]));
  headRig.add(rig);
  eyes.push(rig);
}
addEye(-.32); addEye(.32);

const muzzleLeft = make(new THREE.SphereGeometry(.28, 24, 18), mat.white, [-.2, -.25, .75], [1, .7, .38]);
const muzzleRight = muzzleLeft.clone(); muzzleRight.position.x = .2;
headRig.add(muzzleLeft, muzzleRight);
headRig.add(make(new THREE.SphereGeometry(.1, 18, 12), mat.dark, [0, -.18, .91], [1, .7, .5]));

const whiskers = new THREE.Group();
function whisker(side, y, tilt) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * .11, y + .02, .99),
    new THREE.Vector3(side * .56, y + tilt * .05, 1.01),
    new THREE.Vector3(side * 1.02, y + tilt, .94)
  ]);
  whiskers.add(make(new THREE.TubeGeometry(curve, 14, .009, 5, false), mat.white, [0, 0, 0]));
}
[-1, 1].forEach(side => { whisker(side, -.20, .13); whisker(side, -.29, 0); whisker(side, -.38, -.12); });
headRig.add(whiskers);

const collar = make(new THREE.TorusGeometry(.52, .07, 12, 32), mat.pink, [0, 1.93, .02], [1, .72, 1]);
collar.rotation.x = Math.PI / 2;
cat.add(collar);
cat.add(make(new THREE.SphereGeometry(.1, 18, 12), mat.gold, [0, 1.75, .65]));

const hindPaws = [];
function hindPaw(x) {
  const paw = make(new THREE.SphereGeometry(.3, 26, 18), mat.white, [x, .24, .45], [1.25, .55, 1.25]);
  cat.add(paw);
  hindPaws.push(paw);
}
hindPaw(-.43); hindPaw(.43);

function arm(x) {
  const rig = new THREE.Group();
  rig.position.set(x, 1.55, .47);
  const limb = make(new THREE.CapsuleGeometry(.18, .58, 8, 16), mat.cream, [0, -.28, 0], [1, 1, .9]);
  const paw = make(new THREE.SphereGeometry(.24, 22, 16), mat.white, [0, -.65, .08], [1.05, .68, 1.05]);
  rig.add(limb, paw);
  cat.add(rig);
  return rig;
}
const leftArm = arm(-.62);
const rightArm = arm(.62);
leftArm.rotation.z = -.12;
rightArm.rotation.z = .12;


const tailRig = new THREE.Group();
tailRig.position.set(.64, .75, -.22);
const tailPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,0,0), new THREE.Vector3(.55,.04,0), new THREE.Vector3(1,.34,.05),
  new THREE.Vector3(.92,.8,.12), new THREE.Vector3(.62,.98,.2)
]);
tailRig.add(make(new THREE.TubeGeometry(tailPath, 28, .16, 10, false), mat.gray, [0,0,0]));
cat.add(tailRig);

const floor = make(new THREE.CircleGeometry(1.15, 40), new THREE.ShadowMaterial({ color: 0x2a211c, opacity: .2 }), [0, -.12, 0], [1.3, .38, 1]);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
cat.add(floor);

let state = { elapsed: 0, totalSeconds: 0, rounds: 0, paused: false };
let pointerX = 0;
let pointerY = 0;
let blink = 0;
let nextBlink = 2;
let dragging = false;
let moved = false;
let dragStart = { x: 0, y: 0 };
const clock = new THREE.Clock();

function updateState(next) {
  state = next;
  reminder.classList.toggle('show', state.elapsed >= 55 * 60 && state.elapsed < 60 * 60);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;
  const minutes = state.elapsed / 60;
  const flatten = THREE.MathUtils.clamp(state.elapsed / (state.focusSeconds || 60 * 60), 0, 1);
  let targetY = -1.35 + Math.sin(t * 2) * .012;
  cat.position.y += (targetY - cat.position.y) * .1;
  hips.scale.x += (.78 * (1 + flatten * .42) - hips.scale.x) * .08;
  hips.scale.y += (.42 * (1 - flatten * .3) - hips.scale.y) * .08;
  hips.position.y += (.62 - flatten * .13 - hips.position.y) * .08;
  body.scale.x += (.82 * (1 + flatten * .12) - body.scale.x) * .08;
  body.scale.y += (1.12 * (1 - flatten * .12) - body.scale.y) * .08;
  body.position.y += (1.15 - flatten * .1 - body.position.y) * .08;
  belly.scale.x += (.8 * (1 + flatten * .18) - belly.scale.x) * .08;
  belly.scale.y += (1 - flatten * .16 - belly.scale.y) * .08;
  headRig.position.y += (2.55 - flatten * .1 - headRig.position.y) * .08;
  hindPaws[0].position.x += (-.43 - flatten * .28 - hindPaws[0].position.x) * .08;
  hindPaws[1].position.x += (.43 + flatten * .28 - hindPaws[1].position.x) * .08;
  tailRig.rotation.y = Math.sin(t * 1.5) * .28;
  leftArm.rotation.z = -.12;
  if (minutes >= 55) leftArm.rotation.z = -.3 - Math.abs(Math.sin(t * 6)) * .55;
  const typing = minutes < 45 ? Math.sin(t * 4.4) * .035 : Math.sin(t * 1.3) * .01;
  leftArm.position.y = 1.55 + typing;
  rightArm.position.y = 1.55 - typing;
  headRig.rotation.x += (pointerY * .1 - headRig.rotation.x) * .08;
  headRig.rotation.y += (pointerX * .18 - headRig.rotation.y) * .08;
  eyes.forEach(eye => {
    eye.rotation.y += (pointerX * .1 - eye.rotation.y) * .1;
    eye.rotation.x += (-pointerY * .06 - eye.rotation.x) * .1;
  });
  leftEar.rotation.z = Math.sin(t * .65) > .97 ? -.1 : 0;
  rightEar.rotation.z = Math.sin(t * .57 + 2) > .97 ? .1 : 0;
  if (t > nextBlink) {
    blink = Math.min(1, blink + dt * 14);
    if (blink >= 1) nextBlink = t + 3 + Math.random() * 4;
  } else blink = Math.max(0, blink - dt * 12);
  eyes.forEach(eye => eye.scale.y = Math.max(.08, 1 - blink));
  if (blink >= 1) blink = .98;
  renderer.render(scene, camera);
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  dragging = true;
  moved = false;
  dragStart = { x: event.screenX, y: event.screenY };
  canvas.setPointerCapture(event.pointerId);
  window.desktopPet.beginDrag(dragStart);
});
canvas.addEventListener('pointermove', event => {
  if (dragging) {
    if (Math.hypot(event.screenX - dragStart.x, event.screenY - dragStart.y) > 4) moved = true;
    if (moved) window.desktopPet.dragTo({ x: event.screenX, y: event.screenY });
    return;
  }
  pointerX = (event.clientX / innerWidth - .5) * 2;
  pointerY = (event.clientY / innerHeight - .5) * 2;
});
canvas.addEventListener('pointerup', event => {
  dragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointerleave', () => { if (!dragging) { pointerX = 0; pointerY = 0; } });
canvas.addEventListener('contextmenu', event => { event.preventDefault(); window.desktopPet.showContextMenu(); });
window.addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight, false));

window.desktopPet.onState(updateState);
window.desktopPet.getState().then(updateState);
animate();
