import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { Player } from './human.js'

export const CHUNK_SIZE = 64;
const VERTICES = 64
export const RENDER_DISTANCE = 20

//plus petit, plus fluide mais lent à charger
const CHUNK_BATCH = 20
// const MIN_LOADING_TIME = 30
const MIN_LOADING_TIME = 3

export const loader = new GLTFLoader()

// loading scene
const loadingScene = new THREE.Scene()
loadingScene.background = new THREE.Color(0x000000)
const loadingCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
loadingCamera.position.set(100, 100, 75)

let pourcentage = 0
const loadingOverlay = document.createElement('div')
loadingOverlay.style.position = "absolute"
loadingOverlay.style.top = '50%'
loadingOverlay.style.left = '50%'
loadingOverlay.style.transform = 'translate(-50%, 120px)'
loadingOverlay.style.width = '350px'
loadingOverlay.style.height = '30px'
loadingOverlay.style.borderRadius = "10px"
loadingOverlay.style.background = "linear-gradient(to left, green"+pourcentage+"%, transparent "+pourcentage+"%)"
loadingOverlay.style.border = '2px solid white'
loadingOverlay.style.zIndex = "10"

document.body.appendChild(loadingOverlay)

loadingScene.add(new THREE.AmbientLight(0xffffff, 2))
const loadingDirectional = new THREE.DirectionalLight(0xffffff, 5)
loadingDirectional.position.set(10, 20, 10)
loadingScene.add(loadingDirectional)

const gltf2 = await loader.loadAsync('loadingTotos.glb')
const character = gltf2.scene
character.position.set(0, 0, 0)
character.scale.set(50, 50, 50)
loadingScene.add(character)

const loadingMixer = new THREE.AnimationMixer(character)
if (gltf2.animations.length > 0) {
  const action = loadingMixer.clipAction(gltf2.animations[0])
  action.play()
}
loadingCamera.lookAt(character.position)

export const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000)
camera.position.set(-250, 50, -50)
// camera.position.set(-350, 300, -50)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)
scene.background = new THREE.Color(0x000000)
// scene.add(new THREE.AxesHelper(500, 500, 500))
const controls = new OrbitControls(camera, renderer.domElement)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);
let worldReady = false

const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(50, 50, 50);
scene.add(sunLight);

// scene.fog = new THREE.Fog(0x87b5ff, 200, 1800);
// scene.background = new THREE.Color(0x87b5ff)

const gltf = await loader.loadAsync(import.meta.env.BASE_URL + 'totosAnim.glb');
// gltf.scene.position.set(0, 10, 0)
gltf.scene.position.set(200, 400, 0)
gltf.scene.rotation.y = Math.PI / -1.25
gltf.scene.scale.set(20, 20, 20)
scene.add(gltf.scene)
const godsMixer = new THREE.AnimationMixer(gltf.scene)

const actions = []
gltf.animations[1].tracks = gltf.animations[1].tracks = gltf.animations[1].tracks.filter(track => {return !(track.name.includes('.position'));});
gltf.animations.forEach(clip => {
  const action = godsMixer.clipAction(clip)
  actions.push(action)
})

export let playerModel = null
async function loadAssets() {
  playerModel = await loader.loadAsync(import.meta.env.BASE_URL + 'humainAnim.glb')
}
await loadAssets()

const players = []
for(let i = 0; i <  5; i++){
  const player = new Player()
  player.init()
  players.push(player)
}

const terrainMaterial = new THREE.MeshStandardMaterial({vertexColors: true,flatShading: true});
terrainMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.playerPosition = {value: new THREE.Vector3()};
  shader.uniforms.planetRadius = {value: 12000.0};
  shader.vertexShader =
    `
    uniform vec3 playerPosition;
    uniform float planetRadius;
    ` + shader.vertexShader;

  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
      vec3 transformed = vec3(position);

      float dx = transformed.x - playerPosition.x;
      float dz = transformed.z - playerPosition.z;

      float dist = sqrt(dx * dx + dz * dz);

      float curvature = (dist * dist) / planetRadius;

      transformed.y -= curvature;
    `
  );
  terrainMaterial.userData.shader = shader;
};


let world = new Map()
const simplex = new SimplexNoise();
let lastChunkX = null;
let lastChunkZ = null;

let keysPressed = {}
document.body.addEventListener("keydown", (e)=>{
  keysPressed[e.key] = true
})

document.body.addEventListener("keyup", (e)=>{
  keysPressed[e.key] = false
})

document.body.addEventListener("keydown", (event) => {
  updateChunk(gltf.scene.position.x, gltf.scene.position.z)
})


async function updateChunk(playerX, playerZ) {
  const currentChunkX = Math.floor(playerX / CHUNK_SIZE);
  const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);

  if (currentChunkX === lastChunkX && currentChunkZ === lastChunkZ) return;
  lastChunkX = currentChunkX;
  lastChunkZ = currentChunkZ;

  let generated = 0

  for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
    for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
      const chunkX = currentChunkX + x;
      const chunkZ = currentChunkZ + z;

      const key = `${chunkX},${chunkZ}`;

      if (!world.has(key)) {
        const distance = Math.sqrt((chunkX * CHUNK_SIZE - gltf.scene.position.x) ** 2 + (chunkZ * CHUNK_SIZE - gltf.scene.position.z) ** 2);
        const lod = getLod(distance);
        buildChunk(chunkX * CHUNK_SIZE, chunkZ * CHUNK_SIZE, key, lod);
        generated++
        if (generated % CHUNK_BATCH === 0) await new Promise(requestAnimationFrame)
        
      } else {
          const mesh = world.get(key);
          const distance = Math.sqrt((chunkX * CHUNK_SIZE - gltf.scene.position.x) ** 2 + (chunkZ * CHUNK_SIZE - gltf.scene.position.z) ** 2);
          const desiredLOD = getLod(distance);
          if (mesh.userData.lod !== desiredLOD) {
            rebuildChunk(mesh, desiredLOD);
          }
        world.get(key).visible = true;
      }
      pourcentage = generated / ((RENDER_DISTANCE*2)+1)**2 *100;
      loadingOverlay.style.background = "linear-gradient(to right, green "+pourcentage+"%, transparent "+pourcentage+"%)"
    }
  }
  world.forEach((mesh, key) => {
    const dx = mesh.userData.chunkX - currentChunkX;
    const dz = mesh.userData.chunkZ - currentChunkZ;

    const distance = Math.max(Math.abs(dx), Math.abs(dz));

    mesh.visible = distance <= RENDER_DISTANCE;
  });
}

function rebuildChunk(oldMesh, lod) {
  const chunkX = oldMesh.userData.chunkX * CHUNK_SIZE;
  const chunkZ = oldMesh.userData.chunkZ * CHUNK_SIZE;

  const key = `${oldMesh.userData.chunkX},${oldMesh.userData.chunkZ}`;

  scene.remove(oldMesh);
  oldMesh.geometry.dispose();
  buildChunk(chunkX, chunkZ, key, lod);
}

function getLod(distance){
  const totalDistance = RENDER_DISTANCE * CHUNK_SIZE;
  if(distance < totalDistance * (1/3)) return 64;
  else if(distance < totalDistance * (2/3)) return 32;
  else if(distance < totalDistance) return 16;
  else return 8;
}

//fractal Brownian motion
function getHeight1(x, z) {
  let noise = 0;
  let frequency = 0.001;
  let amplitude = 8;
  noise += simplex.noise(x * frequency, z * frequency) * amplitude;

  frequency = 0.001;
  amplitude = 1;
  noise += simplex.noise(x * frequency, z * frequency) * amplitude;

  frequency = 0.0005;
  amplitude = 0.5;
  let mountainMap = simplex.noise(x * frequency, z * frequency) * amplitude + 0.5;

  frequency = 0.005;
  amplitude = 0.5;
  let mask = simplex.noise(x * frequency, z * frequency) * amplitude;
  noise += mountainMap * mask * 10;

  return noise * 5;
  // return Math.max(noise * 5,-2);
}

function fbm(x, z, octaves) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += simplex.noise(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return total / maxValue;
}

function ridged(x, z, octaves) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    let n = simplex.noise(x * frequency, z * frequency);
    n = 1 - Math.abs(n);
    total += n * n * amplitude;
    maxValue += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return total / maxValue;
}

function getHeight2(x, z) {//domain warping
  const warpFrequency = 0.0008;
  const warpStrength = 120;
  const warpX = fbm(x * warpFrequency + 1000, z * warpFrequency + 1000, 3);
  const warpZ = fbm(x * warpFrequency - 2000, z * warpFrequency - 2000, 3);
  x += warpX * warpStrength;
  z += warpZ * warpStrength;

  let noise = 0;
  let frequency = 0.001;
  let amplitude = 8;
  // let continent = simplex.noise(x * frequency, z * frequency) * amplitude;
  let continent = fbm(x * frequency, z * frequency, 3);
  

  frequency = 0.001;
  amplitude = 1;
  let hills = fbm(x * frequency, z * frequency, 3) *6;
  // let hills = simplex.noise(x * frequency, z * frequency) * amplitude;

  // let baseHeight = continent + hills;
  let baseHeight = continent*42 + hills;
  let seaLevel = -1.5;
  let landFactor = (baseHeight - seaLevel) / 6;
  landFactor = Math.max(0, Math.min(1, landFactor));

  frequency = 0.0007;
  // let mountainMask = simplex.noise(x * frequency, z * frequency);
  let mountainMask = fbm(x * frequency, z * frequency, 2);
  mountainMask = (mountainMask + 1) * 0.5;
  mountainMask = Math.pow(mountainMask, 2);

  // RIDGED noise + amplification
  frequency = 0.004;
  let n = ridged(x * frequency, z * frequency, 3);
  n *= 75
  // let n = simplex.noise(x * frequency, z * frequency);
  // n = 1 - Math.abs(n);
  // n = n * n * (continent/1.8);
  // n = n * n ;

  let detail = ridged(x * 0.012, z * 0.012, 3)*8;
  // let detail = simplex.noise(x * 0.012, z * 0.012);
  // detail = 1 - Math.abs(detail);
  // detail = detail * detail;
  // detail *= 0.5;

  // let mountainBase = simplex.noise(x * 0.0015, z * 0.0015);
  // mountainBase = (mountainBase + 1) * 0.5;
  // mountainBase *= 18;

  let mountains = (n + detail) * mountainMask;
  // let mountains = mountainBase + (n + detail) * 25;
  // mountains *= mountainMask;
  // mountains *= landFactor;

  let finalHeight = baseHeight + mountains;
  
  // finalHeight -= 18;
  // if (finalHeight < 0) finalHeight *= 0.35;

  return finalHeight;
}

function getHeat(x, z) {
  const frequency = 0.001;
  const noise = simplex.noise(x * frequency, z * frequency);
  return (noise + 1) / 2;
}

function getMoisture(x, z) {
  const frequency = 0.0006;
  const noise = simplex.noise(x * frequency + -100, z * frequency - 100);
  return (noise + 1) / 2;
}

function buildChunk(chunkX, chunkZ, key, lod = VERTICES) {
  // const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
  // const material = new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true});
  // const mesh = new THREE.Mesh(geometry, material);

  // mesh.rotation.x = -Math.PI / 2;
  // mesh.position.set(chunkX, 0, chunkZ);
  // scene.add(mesh);
  // const positions = geometry.attributes.position;

  // for(let i = 0; i < positions.count; i++) {
  //   const x = positions.getX(i) + chunkX;
  //   const z = positions.getY(i) + chunkZ;
  //   const noise = getHeight(x, z);
  //   positions.setZ(i, noise);
  // }
  // positions.needsUpdate = true;
  const geometry = new THREE.BufferGeometry()
  const vertices = []
  const indices = []
  const colors = []

  for (let z = 0; z <= lod; z++) {
    for (let x = 0; x <= lod; x++) {
      const worldX = chunkX + (x / lod) * CHUNK_SIZE
      const worldZ = chunkZ + (z / lod) * CHUNK_SIZE
      let y = getHeight2(worldX, worldZ)
      let heat = getHeat(worldX, worldZ)
      heat = THREE.MathUtils.clamp(heat - y * 0.01, 0, 1)
      let moisture = THREE.MathUtils.clamp(getMoisture(worldX, worldZ), 0, 1)

      // const distance = Math.sqrt((worldX - gltf.scene.position.x) ** 2 + (worldZ - gltf.scene.position.z) ** 2);
      // y = y - distance * 0.1;

      // const PLANET_RADIUS = 15000;
      // const curvature = (distance * distance) / PLANET_RADIUS;
      // y = y - curvature;

      vertices.push(worldX)
      vertices.push(y)
      vertices.push(worldZ)

      let color;

      if (y < -1) {
        color = new THREE.Color(0x001a66);
      }
      else if (y > 45) {
        if(heat > 0.3) color = new THREE.Color(0x888888);
        else color = new THREE.Color(0xffffff);
      }
      else if (heat > 0.7 && moisture < 0.3) {
        color = new THREE.Color(0xd9c27a); // désert
      }
      else if (heat > 0.7 && moisture > 0.6) {
        color = new THREE.Color(0x1f5c2c); // jungle
      }
      else if (heat < 0.3 && moisture < 0.5) {
        color = new THREE.Color(0x888888); // roche froide
      }
      else if (heat < 0.3 && moisture > 0.5) {
        color = new THREE.Color(0xe8f2ff); // neige
      }
      else if (moisture > 0.6) {
        color = new THREE.Color(0x3f8f3f); // forêt
      }
      else {
        color = new THREE.Color(0x88aa55); // plaines
      }

      // if (y < -1) {
      //   color = new THREE.Color(0x000080)
      // }
      // else if (y < 1) {
      //   color = new THREE.Color(0x3a7a3a)
      // }
      // else if (y < 15) {
      //   color = new THREE.Color(0x88aa88)
      // }
      // else if (y < 40) {
      //   color = new THREE.Color(0x888888)
      // } else {
      //   color = new THREE.Color(0xffffff)
      // }
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let z = 0; z < lod; z++) {
    for (let x = 0; x < lod; x++) {
      const i = z * (lod + 1) + x

      indices.push(i)
      indices.push(i + lod + 1)
      indices.push(i + 1)

      indices.push(i + 1)
      indices.push(i + lod + 1)
      indices.push(i + lod + 2)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // const material = new THREE.MeshStandardMaterial({color: 0xffffff, flatShading: true, wireframe: true})
  // const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, wireframe: false })

  const mesh = new THREE.Mesh(geometry, terrainMaterial)
  
  const distance = Math.sqrt((gltf.scene.position.x - geometry.attributes.position.array[0]) ** 2 + (gltf.scene.position.z - geometry.attributes.position.array[2]) ** 2)
  mesh.userData.lod = getLod(distance);
  scene.add(mesh)

  mesh.userData.chunkX = chunkX / CHUNK_SIZE;
  mesh.userData.chunkZ = chunkZ / CHUNK_SIZE;
  world.set(key, mesh);
}

const cameraOffset = new THREE.Vector3(30, 60, -20)
const cameraLookOffset = new THREE.Vector3(0, -40, 0)
const clock = new THREE.Clock()
let animationDuration = 120
let factor = 1
const speed = 1

let shake = {duration: 0, strength: 0};
const originalPos = new THREE.Vector3();
function explodeShake(power = 0.5, time = 0.4) {
  shake.strength = power;
  shake.duration = time;
}

function animate() {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  if (!worldReady) {
    if (loadingMixer) {
      loadingMixer.update(delta)
    }
    renderer.render(loadingScene, loadingCamera)
    return
  }
  controls.update();
  // renderer.render(scene, camera);
  godsMixer.update(delta)
  
  players.forEach(player => {
    player.update(delta)
    player.gltf.scene.position.y = getHeight2(player.gltf.scene.position.x, player.gltf.scene.position.z) + 10
  })

  const targetPosition = gltf.scene.position.clone()
  const desiredCameraPos = targetPosition.clone().add(cameraOffset)
  // camera.position.lerp(desiredCameraPos, 0.05)
  // camera.position.lerp(desiredCameraPos, 0.01)
  const lookTarget = targetPosition.clone().add(cameraLookOffset)
  // camera.lookAt(lookTarget)

  originalPos.copy(camera.position);

  if (shake.duration > 0) {
    shake.duration -= delta;
    const currentStrength = shake.strength * (shake.duration / 0.4);
    camera.position.x += (Math.random() - 0.5) * currentStrength;
    camera.position.y += (Math.random() - 0.5) * currentStrength;
    camera.position.z += (Math.random() - 0.5) * currentStrength;
  }
  
  renderer.render(scene, camera);
  camera.position.copy(originalPos);

  animationDuration--
  if(animationDuration <= 0){
    animationDuration = 120
    factor = -factor
  }
  gltf.scene.position.y += 0.025 * factor

  const direction = new THREE.Vector3();
  if(keysPressed["Enter"] && !actions[0].isRunning() && !actions[2].isRunning()) {
    godsMixer.stopAllAction()
    actions[0].setLoop(THREE.LoopOnce, 1)
    actions[0].reset().play()
  }
  else if(keysPressed["e"] && !actions[0].isRunning() && !actions[2].isRunning()) {
    godsMixer.stopAllAction()
    actions[2].setLoop(THREE.LoopOnce, 1)
    actions[2].reset().play()
    
    explodeShake(2.5, 0.5);
  }

  if(!actions[0].isRunning() && !actions[2].isRunning()){ 
    if(keysPressed["z"]) direction.x -= speed
    if(keysPressed["s"]) direction.x += speed
    if(keysPressed["q"]) direction.z += speed
    if(keysPressed["d"]) direction.z -= speed

    if(direction.length() > 0){
      direction.normalize()
      const angle = Math.atan2(direction.x, direction.z)
      gltf.scene.rotation.y = angle
      gltf.scene.position.x += direction.x * speed;
      gltf.scene.position.z += direction.z * speed;
      actions[1].play()
    }else{
      actions[1].stop()
    }
  }


  if (terrainMaterial.userData.shader) terrainMaterial.userData.shader.uniforms.playerPosition.value.copy(gltf.scene.position);
}
animate()

async function initWorld() {
  const startTime = performance.now()
  await updateChunk(gltf.scene.position.x, gltf.scene.position.z)
  const elapsed = performance.now() - startTime

  if (elapsed < MIN_LOADING_TIME) {
    await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed))
  }

  if (loadingMixer) {
    loadingMixer.stopAllAction()
  }
  worldReady = true
  loadingOverlay.remove()
  // gltf.scene.position.y = getHeight2(gltf.scene.position.x, gltf.scene.position.z) + 10
}

initWorld()