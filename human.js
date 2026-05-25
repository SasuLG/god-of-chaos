import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { loader, scene, CHUNK_SIZE, RENDER_DISTANCE } from './main.js'

// const size = (RENDER_DISTANCE*CHUNK_SIZE *2) -RENDER_DISTANCE*CHUNK_SIZE
export class Player{
    constructor(){
        this.gltf = null
        this.mixer = null
    }

    async init(){
        this.gltf = await loader.loadAsync(import.meta.env.BASE_URL + 'humainAnim.glb')
        // this.gltf.scene.position.set(Math.random() * size - size/2, 20, Math.random() * size - size/2)
        this.gltf.scene.position.set(0, 20, 0)
        // this.gltf.scene.rotation.y = Math.PI / -2
        this.gltf.scene.scale.set(20, 20, 20)
        this.mixer = new THREE.AnimationMixer(this.gltf.scene)
        scene.add(this.gltf.scene)
    }

    update(delta){
        // if attack
        move()
        if(this.mixer) this.mixer.update(delta)
    }

    mvoe(){

    }
}