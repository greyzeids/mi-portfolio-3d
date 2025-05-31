// 1. Importar Three.js
import * as THREE from "three";
import * as CANNON from "cannon-es";

// --- Configuración Esencial de Three.js ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#bg"),
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// --- Configuración del Mundo Físico (Cannon-es) ---
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

// Ajustes del Solver para Colisiones Más Robustas
world.solver.iterations = 30; // Aumentado de 20 a 30
world.solver.tolerance = 0.001; // Un valor más pequeño puede mejorar la precisión (default es 0.01)
// world.solver.contactEquationStiffness = 1e7; // Default es 1e6. Aumentar puede hacer los contactos más "duros".
// world.solver.contactEquationRelaxation = 4;  // Default es 3. Aumentar puede ayudar a estabilizar.

const defaultMaterial = new CANNON.Material("default");
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.2, // Aumentado ligeramente de 0.1
        restitution: 0.2, // Reducido ligeramente de 0.3 para menos rebote errático
    }
);
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial;

// --- Arrays para Múltiples Objetos ---
const donutsVisuals = [];
const donutsBodies = [];
const numberOfDonuts = 10;

// --- Crear Múltiples Donuts ---
const donutGeometry = new THREE.TorusGeometry(0.5, 0.2, 16, 32);
const donutBaseMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
});

console.log("Creando donuts...");

for (let i = 0; i < numberOfDonuts; i++) {
    const visualMaterial = donutBaseMaterial.clone();
    visualMaterial.color.setHSL(Math.random(), 0.7, 0.6);
    const visual = new THREE.Mesh(donutGeometry, visualMaterial);

    const initialSpreadFactor = 8;
    const posX = (Math.random() - 0.5) * initialSpreadFactor;
    const posY = (Math.random() - 0.5) * initialSpreadFactor;
    const posZ = (Math.random() - 0.5) * initialSpreadFactor;
    visual.position.set(posX, posY, posZ);
    // console.log(`Donut ${i} visual position: x=${posX.toFixed(2)}, y=${posY.toFixed(2)}, z=${posZ.toFixed(2)}`);

    visual.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    scene.add(visual);
    donutsVisuals.push(visual);

    const vertices = visual.geometry.attributes.position.array;
    const indices = visual.geometry.index.array;
    const shape = new CANNON.Trimesh(vertices, indices);

    const body = new CANNON.Body({
        mass: 1,
        shape: shape,
        position: new CANNON.Vec3(posX, posY, posZ),
        quaternion: new CANNON.Quaternion().copy(visual.quaternion),
        material: defaultMaterial,
        linearDamping: 0.8, // Aumentado para más frenado
        angularDamping: 0.8, // Aumentado para más frenado
    });
    world.addBody(body);
    donutsBodies.push(body);
}

// --- Iluminación ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// --- Variables para Interacción del Ratón ---
const mousePositionNormalized = new THREE.Vector2();
let mousePositionWorld = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const planeForMouseIntersection = new THREE.Plane(
    new THREE.Vector3(0, 0, 1),
    0
);

// --- Variables para la Atracción al Centro ---
const centerOfAttraction = new CANNON.Vec3(0, 0, 0);
const attractionStrength = 0.8; // Reducido aún más
const idealRestingDistance = 2.0; // Aumentado para darles más espacio
const minAttractionDistance = 0.5; // Distancia mínima para que la atracción empiece a disminuir/invertirse

// --- Reloj para el Delta Time ---
const clock = new THREE.Clock();

// --- Bucle de Animación ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (deltaTime > 0) {
        // Aumentar maxSubSteps para mayor precisión en la física si deltaTime es grande
        world.step(1 / 60, deltaTime, 10); // timeStep, deltaTime, maxSubSteps
    }

    for (let i = 0; i < numberOfDonuts; i++) {
        const visual = donutsVisuals[i];
        const body = donutsBodies[i];

        if (body) {
            // Lógica de Atracción al Centro MODIFICADA
            const vectorToCenter = new CANNON.Vec3();
            centerOfAttraction.vsub(body.position, vectorToCenter);
            const distanceToCenter = vectorToCenter.length();
            let forceMagnitude = 0;

            if (distanceToCenter > idealRestingDistance) {
                // Si está más lejos de la distancia ideal, atrae
                forceMagnitude =
                    attractionStrength *
                    (distanceToCenter - idealRestingDistance) *
                    0.05; // Factor de atracción más suave
            } else if (
                distanceToCenter < minAttractionDistance &&
                distanceToCenter > 0.01
            ) {
                // Si está MUY cerca del centro (menos que minAttractionDistance),
                // aplicar una PEQUEÑA fuerza de REPULSIÓN del centro.
                forceMagnitude =
                    -attractionStrength *
                    (minAttractionDistance - distanceToCenter) *
                    0.2; // Fuerza negativa = repulsión, factor pequeño
            }
            // Si está entre minAttractionDistance e idealRestingDistance, la fuerza de atracción es muy débil o nula.

            if (Math.abs(forceMagnitude) > 0.001) {
                vectorToCenter.normalize();
                vectorToCenter.scale(forceMagnitude, vectorToCenter);
                body.applyForce(vectorToCenter, body.position);
            }

            // Aplicar Fuerza de Repulsión del Ratón
            if (mousePositionWorld.lengthSq() > 0.001) {
                const mouseRepulsionStrength = 80; // Puede necesitar ser más fuerte ahora
                const influenceRadius = 3.0;

                const mousePosCannon = new CANNON.Vec3(
                    mousePositionWorld.x,
                    mousePositionWorld.y,
                    mousePositionWorld.z
                );
                const vectorFromMouseToBody = new CANNON.Vec3();
                body.position.vsub(mousePosCannon, vectorFromMouseToBody);

                const distanceToMouse = vectorFromMouseToBody.length();
                if (
                    distanceToMouse < influenceRadius &&
                    distanceToMouse > 0.01
                ) {
                    const repulsionMagnitude =
                        mouseRepulsionStrength *
                        (1 - distanceToMouse / influenceRadius);
                    vectorFromMouseToBody.normalize();
                    vectorFromMouseToBody.scale(
                        repulsionMagnitude,
                        vectorFromMouseToBody
                    );
                    body.applyForce(vectorFromMouseToBody, body.position);
                }
            }

            visual.position.copy(body.position);
            visual.quaternion.copy(body.quaternion);
        }
    }

    renderer.render(scene, camera);
}

animate();

// --- Manejo de Redimensionamiento de Ventana ---
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});

// --- Event Listener para el Movimiento del Ratón ---
window.addEventListener("mousemove", (event) => {
    mousePositionNormalized.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePositionNormalized.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mousePositionNormalized, camera);
    const intersects = raycaster.ray.intersectPlane(
        planeForMouseIntersection,
        mousePositionWorld
    );
    if (!intersects) {
        mousePositionWorld.set(0, 0, -Infinity);
    }
});

window.addEventListener("mouseout", () => {
    mousePositionWorld.set(0, 0, -Infinity);
});
