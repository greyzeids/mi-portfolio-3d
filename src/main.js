import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// --- Configuración Esencial de Three.js ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 10;

const keysPressed = {};
window.addEventListener("keydown", (event) => {
    keysPressed[event.code] = true;
});
window.addEventListener("keyup", (event) => {
    keysPressed[event.code] = false;
});

// --- EVENT LISTENER PARA EL ZOOM CON LA RUEDA DEL RATÓN ---
window.addEventListener("wheel", (event) => {
    cameraZoomLevel += event.deltaY * ZOOM_SENSITIVITY;
    cameraZoomLevel = THREE.MathUtils.clamp(
        cameraZoomLevel,
        MIN_ZOOM,
        MAX_ZOOM
    );
});

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#bg"),
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000033);

// --- Configuración del Mundo Físico (Cannon-es) ---
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
const defaultMaterial = new CANNON.Material("default");
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.2,
        restitution: 0.1,
    }
);
world.addContactMaterial(defaultContactMaterial);

// --- Iluminación ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const loader = new GLTFLoader();
const clock = new THREE.Clock();

let player = {
    visual: null,
    body: null,
    gimbal: null,
};

// --- CONSTANTES Y VARIABLES ---
const MOVE_SPEED = 50;
const BOOST_MULTIPLIER = 3;
const ROTATION_SPEED = 2.5;
const ROLL_SPEED = 2;
const CAMERA_SMOOTH_SPEED = 0.04;
const CAMERA_LOOK_AT_SMOOTH_SPEED = 0.07;
const PHYSICS_INTERPOLATION_FACTOR = 0.3;
const TILT_AMOUNT = 0.25;
const BANK_AMOUNT = 0.5;
const VISUAL_SMOOTHING = 0.05;

// --- Variables para el Zoom ---
let cameraZoomLevel = 10;
const MIN_ZOOM = 4;
const MAX_ZOOM = 25;
const ZOOM_SENSITIVITY = 0.005;

let cameraLookAtTarget = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const targetQuaternion = new THREE.Quaternion();
let originalLinearDamping;

function loadPlayerModel() {
    return new Promise((resolve, reject) => {
        loader.load(
            "/models/mecha.glb",
            (gltf) => {
                console.log("Modelo de jugador cargado.");
                resolve(gltf.scene);
            },
            undefined,
            (error) => {
                console.error("Error cargando el modelo del jugador.", error);
                reject(error);
            }
        );
    });
}

async function initializeScene() {
    console.log("Inicializando escena...");
    createStarfield();

    try {
        const modelScene = await loadPlayerModel();

        player.visual = new THREE.Group();
        player.gimbal = new THREE.Group();
        player.visual.add(player.gimbal);
        player.gimbal.add(modelScene);

        player.visual.scale.set(0.5, 0.5, 0.5);
        player.visual.rotation.y = Math.PI;
        scene.add(player.visual);

        const playerShape = new CANNON.Sphere(0.8);
        const initialCannonQuaternion = new CANNON.Quaternion();
        initialCannonQuaternion.setFromEuler(
            player.visual.rotation.x,
            player.visual.rotation.y,
            player.visual.rotation.z
        );

        player.body = new CANNON.Body({
            mass: 5,
            shape: playerShape,
            position: new CANNON.Vec3(0, 0, 0),
            quaternion: initialCannonQuaternion,
            linearDamping: 0.3,
            angularDamping: 0.8,
        });

        world.addBody(player.body);
        cameraLookAtTarget.copy(player.visual.position);
        originalLinearDamping = player.body.linearDamping;

        console.log("Jugador creado en la escena y en el mundo físico.");
        animate();
    } catch (error) {
        console.error("No se pudo inicializar la escena.", error);
    }
}

function createStarfield() {
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = THREE.MathUtils.randFloatSpread(2000);
        const y = THREE.MathUtils.randFloatSpread(2000);
        const z = THREE.MathUtils.randFloatSpread(2000);
        starVertices.push(x, y, z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starVertices, 3)
    );
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        sizeAttenuation: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    console.log("Campo de estrellas creado.");
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (deltaTime > 0) {
        world.step(1 / 60, deltaTime, 3);
    }

    if (player.body) {
        const currentMoveSpeed = keysPressed["ShiftLeft"]
            ? MOVE_SPEED * BOOST_MULTIPLIER
            : MOVE_SPEED;
        if (keysPressed["KeyW"]) {
            const forwardForce = new CANNON.Vec3(0, 0, currentMoveSpeed);
            player.body.applyLocalForce(forwardForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["KeyS"]) {
            player.body.linearDamping = 0.95;
        } else {
            player.body.linearDamping = originalLinearDamping;
        }
        if (keysPressed["KeyX"]) {
            const backwardForce = new CANNON.Vec3(0, 0, -MOVE_SPEED / 2);
            player.body.applyLocalForce(backwardForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["Space"]) {
            const upForce = new CANNON.Vec3(0, currentMoveSpeed, 0);
            player.body.applyLocalForce(upForce, CANNON.Vec3.ZERO);
        }
        if (keysPressed["ControlLeft"]) {
            const downForce = new CANNON.Vec3(0, -currentMoveSpeed, 0);
            player.body.applyLocalForce(downForce, CANNON.Vec3.ZERO);
        }
        let yaw = 0;
        if (keysPressed["KeyA"]) yaw = ROTATION_SPEED;
        if (keysPressed["KeyD"]) yaw = -ROTATION_SPEED;
        player.body.angularVelocity.y = yaw;
        let roll = 0;
        if (keysPressed["KeyQ"]) roll = ROLL_SPEED;
        if (keysPressed["KeyE"]) roll = -ROLL_SPEED;
        const rollTorque = new CANNON.Vec3(0, 0, roll);
        player.body.applyTorque(rollTorque);
    }

    if (player.visual && player.body) {
        targetPosition.copy(player.body.position);
        targetQuaternion.copy(player.body.quaternion);
        player.visual.position.lerp(
            targetPosition,
            PHYSICS_INTERPOLATION_FACTOR
        );
        player.visual.quaternion.slerp(
            targetQuaternion,
            PHYSICS_INTERPOLATION_FACTOR
        );
    }

    if (player.gimbal) {
        let targetTilt = 0;
        if (keysPressed["KeyW"]) {
            targetTilt = -TILT_AMOUNT;
        }
        let targetBank = 0;
        if (keysPressed["KeyA"]) {
            targetBank = -BANK_AMOUNT;
        } else if (keysPressed["KeyD"]) {
            targetBank = BANK_AMOUNT;
        }
        player.gimbal.rotation.x = THREE.MathUtils.lerp(
            player.gimbal.rotation.x,
            targetTilt,
            VISUAL_SMOOTHING
        );
        player.gimbal.rotation.z = THREE.MathUtils.lerp(
            player.gimbal.rotation.z,
            targetBank,
            VISUAL_SMOOTHING
        );
    }

    if (player.visual) {
        const cameraOffset = new THREE.Vector3(0, 2.5, -cameraZoomLevel);

        cameraOffset.applyQuaternion(player.visual.quaternion);
        const targetCameraPosition = player.visual.position
            .clone()
            .add(cameraOffset);
        camera.position.lerp(targetCameraPosition, CAMERA_SMOOTH_SPEED);
        cameraLookAtTarget.lerp(
            player.visual.position,
            CAMERA_LOOK_AT_SMOOTH_SPEED
        );
        camera.lookAt(cameraLookAtTarget);
    }

    renderer.render(scene, camera);
}

initializeScene();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});
