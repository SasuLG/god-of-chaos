import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { loader, scene, CHUNK_SIZE, RENDER_DISTANCE, playerModel } from './main.js'

// const size = (RENDER_DISTANCE*CHUNK_SIZE *2) -RENDER_DISTANCE*CHUNK_SIZE
export class Player{//le faire stop + accelerer
    constructor(){
        this.gltf = null
        this.mixer = null
        this.speed = 1
        this.direction = new THREE.Vector3(1, 0, 0)
        this.targetDirection = this.direction.clone()
        this.directionTimer = 0
        this.clip = null
        this.action = null
        // this.animTimer = 0
    }

    async init(){
        // this.gltf = await loader.loadAsync(import.meta.env.BASE_URL + 'humainAnim.glb')
        const model = SkeletonUtils.clone(playerModel.scene)
        this.gltf = {scene: model, animations: playerModel.animations}

        // this.gltf.scene.position.set(Math.random() * size - size/2, 20, Math.random() * size - size/2)
        this.gltf.scene.position.set(0, 20, 0)
        this.gltf.scene.scale.set(10, 10, 10)
        this.mixer = new THREE.AnimationMixer(this.gltf.scene)
        scene.add(this.gltf.scene)
        this.clip = this.gltf.animations[0]

        this.clip.tracks = this.clip.tracks.filter(track => {
            return !track.name.includes('Hips.position');
        });
        this.action = this.mixer.clipAction(this.clip)
        this.action.play()
        // this.action.timeScale = 0.5
    }

    update(delta){
        // if attack
        this.move(delta)
        // this.animTimer += delta
        // if(this.animTimer > 1/30){
        //     this.mixer.update(this.animTimer)
        //     this.animTimer = 0
        // }
        if(this.mixer) this.mixer.update(delta)
    }

    move(delta = 0){
        // this.action.play()
        this.directionTimer -= delta
        if(this.directionTimer <= 0){
            this.directionTimer = 2 + Math.random() * 3
            const angle = Math.random() * Math.PI * 2
            this.targetDirection.set(Math.cos(angle), 0, Math.sin(angle)).normalize()
        }
        this.direction.lerp(this.targetDirection, delta)

        this.gltf.scene.position.x += this.direction.x * this.speed
        this.gltf.scene.position.z += this.direction.z * this.speed
        // pos.add(this.direction.clone().multiplyScalar(this.speed * delta))
        const angle = Math.atan2(this.direction.x, this.direction.z)
        this.gltf.scene.rotation.y = angle
    }
}