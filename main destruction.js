function destroyTerrain(worldX, worldZ, radius = 35, strength = 30) {
  world.forEach((mesh) => {
    const geometry = mesh.geometry
    const positions = geometry.attributes.position
    const colors = geometry.attributes.color

    let modified = false

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i)
      const vy = positions.getY(i)
      const vz = positions.getZ(i)

      const dx = vx - worldX
      const dz = vz - worldZ
      const angle = Math.atan2(dz, dx)

      const distortion =
        simplex.noise(
          Math.cos(angle) * 2,
          Math.sin(angle) * 2
        ) * 8

      const localRadius = radius + distortion

      const distance = Math.sqrt(dx * dx + dz * dz)
            if (distance < localRadius) {
        const normalized = distance / localRadius
        const crater = Math.cos(normalized * Math.PI * 0.5) * strength
        const chaos = simplex.noise(vx * 0.08, vz * 0.08) * 4
        const rim = Math.sin(normalized * Math.PI) * 6

        let finalHeight = vy
        finalHeight -= crater
        finalHeight += chaos

        if (normalized > 0.6) {
          finalHeight += rim
        }
        const cracks =
          simplex.noise(vx * 0.03, vz * 0.03) * 8

        finalHeight -= Math.max(0, cracks)
        positions.setY(i, finalHeight)

if(normalized > 0.6 && Math.random() < 0.08){

  const color = new THREE.Color().setRGB(
    colors.getX(i),
    colors.getY(i),
    colors.getZ(i)
  )

  spawnDebris(
    vx,
    finalHeight + 3,
    vz,
    color
  )
}

        const burn = Math.max(0, 1 - normalized)
        colors.setXYZ(i, 0.1 + burn * 0.15, 0.05, 0.05)
        modified = true
      }
    }

    if (modified) {
      positions.needsUpdate = true
      colors.needsUpdate = true
      geometry.computeVertexNormals()
    }
  })
}
function spawnDebris(x, y, z, color) {

  const rock = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 + Math.random() * 6,
      2 + Math.random() * 6,
      2 + Math.random() * 6
    ),
    new THREE.MeshStandardMaterial({
      color: color
    })
  )

  rock.position.set(x, y, z)

  scene.add(rock)

  const velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 3,
    Math.random() * 4 + 2,
    (Math.random() - 0.5) * 3
  )

  let life = 1

  const interval = setInterval(() => {

    velocity.y -= 0.15

    rock.position.add(velocity)

    rock.rotation.x += 0.1
    rock.rotation.y += 0.1

    life *= 0.985

    rock.material.opacity = life
    rock.material.transparent = true

    if (rock.position.y < -100 || life < 0.02) {
      clearInterval(interval)
      scene.remove(rock)
    }

  }, 16)
}
function shockwave(worldX, worldZ) {

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5, 8, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    })
  )

  ring.rotation.x = -Math.PI / 2
  ring.position.set(worldX, 1, worldZ)
  scene.add(ring)
  let scale = 1

  const interval = setInterval(() => {
    scale += 0.2
    ring.scale.set(scale, scale, scale)
    ring.material.opacity *= 0.92

    if (ring.material.opacity < 0.02) {
      clearInterval(interval)
      scene.remove(ring)
    }
  }, 16)
}
function explosionFlash(x, z) {
  const light = new THREE.PointLight(0xff6600, 200, 300)
  light.position.set(x, 40, z)
  scene.add(light)
  let intensity = 200

  const interval = setInterval(() => {
    intensity *= 0.85
    light.intensity = intensity

    if (intensity < 1) {
      clearInterval(interval)
      scene.remove(light)
    }
  }, 16)
}

function spawnFire(x, z) {

  const fire = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 20),
    new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    })
  )

  fire.position.set(x, 10, z)
  scene.add(fire)
  let time = 0

  const interval = setInterval(() => {
    time += 0.1
    fire.scale.y = 1 + Math.sin(time * 10) * 0.2
    fire.material.opacity *= 0.995

    if (fire.material.opacity < 0.05) {
      clearInterval(interval)
      scene.remove(fire)
    }
  }, 16)
}


function animate() {
  if(keysPressed["Enter"] && !actions[0].isRunning() && !actions[2].isRunning()) {
    setTimeout(() => {
      const forward = new THREE.Vector3(0, 0, -1)
      forward.applyQuaternion(gltf.scene.quaternion)

      const impactX = gltf.scene.position.x + forward.x * 60
      const impactZ = gltf.scene.position.z + forward.z * 60

      destroyTerrain(impactX, impactZ, 50, 40)
      shockwave(impactX, impactZ)
      explosionFlash(impactX, impactZ)

      for(let i = 0; i < 10; i++) {
        const offsetX = (Math.random() - 0.5) * 30
        const offsetZ = (Math.random() - 0.5) * 30
        spawnFire(impactX + offsetX,impactZ + offsetZ)
      }
    }, 500)
  }
}