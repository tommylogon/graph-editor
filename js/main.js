//main.js
console.log('🚀 Main.js entry point - build:2026-02-26-2027');
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import graphStorage from './storage.js';
import GraphVisualization from './visualization.js';
import GraphUI from './ui.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2;
controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
};

const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
};

const rotateState = {
    left: false,
    right: false,
    up: false,
    down: false
};

const isInputActive = () => {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

document.addEventListener('keydown', (e) => {
    if (isInputActive()) return;
    switch (e.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': moveState.up = true; break;
        case 'KeyX': moveState.down = true; break;   // X for down (replaces Ctrl)
        case 'ArrowLeft': rotateState.left = true; break;
        case 'ArrowRight': rotateState.right = true; break;
        case 'ArrowUp': rotateState.up = true; break;
        case 'ArrowDown': rotateState.down = true; break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
        case 'Space': moveState.up = false; break;
        case 'KeyX': moveState.down = false; break;
        case 'ArrowLeft': rotateState.left = false; break;
        case 'ArrowRight': rotateState.right = false; break;
        case 'ArrowUp': rotateState.up = false; break;
        case 'ArrowDown': rotateState.down = false; break;
    }
});

// Undo/Redo shortcuts (Ctrl+Z / Ctrl+Y)
document.addEventListener('keydown', (e) => {
    if (isInputActive()) return;
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
            e.preventDefault();
            window.__ui?.undo();
        } else if (e.key === 'y' || (e.shiftKey && e.key === 'Z')) {
            e.preventDefault();
            window.__ui?.redo();
        }
    }
});

const ambientLight = new THREE.AmbientLight(0x404060);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
const d = 20;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 25;
scene.add(dirLight);

//const gridHelper = new THREE.GridHelper(50, 50, 0x88ccff, 0x335588);
//gridHelper.position.y = -0.01;
//scene.add(gridHelper);

window.addEventListener('load', async () => { // Note the 'async' here
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.05;

    const vis = new GraphVisualization(scene);
    window.__vis = vis;
    window.__controls = controls;

    const ui = new GraphUI(camera, scene, raycaster, renderer.domElement);
    window.__ui = ui;

    // Initialize Database and Load Data
    await graphStorage.init();
    await graphStorage.load();

    const panSpeed = 0.5;
    function animate() {
        requestAnimationFrame(animate);

        if (moveState.forward || moveState.backward || moveState.left || moveState.right || moveState.up || moveState.down) {
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();
            const right = new THREE.Vector3();
            right.crossVectors(camera.up, direction).normalize();

            if (moveState.forward) {
                camera.position.addScaledVector(direction, panSpeed);
                controls.target.addScaledVector(direction, panSpeed);
            }
            if (moveState.backward) {
                camera.position.addScaledVector(direction, -panSpeed);
                controls.target.addScaledVector(direction, -panSpeed);
            }
            if (moveState.right) {
                camera.position.addScaledVector(right, -panSpeed);
                controls.target.addScaledVector(right, -panSpeed);
            }
            if (moveState.left) {
                camera.position.addScaledVector(right, panSpeed);
                controls.target.addScaledVector(right, panSpeed);
            }
            if (moveState.up) {
                camera.position.y += panSpeed;
                controls.target.y += panSpeed;
            }
            if (moveState.down) {
                const is2D = vis && vis.physicsConfig && vis.physicsConfig.is2D;
                if (!is2D) {
                    camera.position.y -= panSpeed;
                    controls.target.y -= panSpeed;
                }
            }
        }

        controls.update();

        if (rotateState.left || rotateState.right || rotateState.up || rotateState.down) {
            const offset = camera.position.clone().sub(controls.target);
            const rotateSpeed = 0.03;
            if (rotateState.left) offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotateSpeed);
            if (rotateState.right) offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotateSpeed);
            if (rotateState.up || rotateState.down) {
                const verticalAngle = rotateState.up ? rotateSpeed : -rotateSpeed;
                const right = new THREE.Vector3().crossVectors(camera.up, offset).normalize();
                offset.applyAxisAngle(right, verticalAngle);
            }
            camera.position.copy(controls.target).add(offset);
        }

        vis.applyPhysics();
        renderer.render(scene, camera);
    }
    animate();
    document.body.classList.add('loaded');
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Update LineMaterial resolution for all edges
    const vis = window.__vis;
    if (vis) {
        vis.edges.forEach(entry => {
            if (entry.line.material.resolution) {
                entry.line.material.resolution.set(window.innerWidth, window.innerHeight);
            }
        });
    }
});