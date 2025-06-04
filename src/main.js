// 1. Importar Three.js y Cannon-es
import * as THREE from "three";
import * as CANNON from "cannon-es";
// Volvemos a necesitar GLTFLoader
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// --- Configuración Esencial de Three.js ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75, // Campo de visión
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 3; // CAMBIO: Ajustado a 3

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
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 30;
world.solver.tolerance = 0.001;

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
world.defaultContactMaterial = defaultContactMaterial;

// --- Arrays para Múltiples Objetos ---
const objectsData = [];
const numberOfObjects = 9;

// --- Ruta a tu modelo Game Boy ---
const modelPath = "/models/gameboy.glb";
let loadedGameboyAsset = null;

// --- Iluminación ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
scene.add(directionalLight);

const loader = new GLTFLoader();

function loadGameboyModel() {
    return new Promise((resolve, reject) => {
        loader.load(
            modelPath,
            (gltf) => {
                console.log(`Modelo cargado: ${modelPath}`);
                const modelScene = gltf.scene;
                let geometryForPhysics;

                modelScene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        if (!geometryForPhysics) {
                            geometryForPhysics = child.geometry;
                        }
                    }
                });

                if (!geometryForPhysics) {
                    console.warn(
                        `No se encontró geometría usable en ${modelPath}, usando cubo de fallback para física.`
                    );
                    geometryForPhysics = new THREE.BoxGeometry(1, 1, 1);
                }
                resolve({
                    scene: modelScene,
                    geometry: geometryForPhysics,
                    originalPath: modelPath,
                });
            },
            undefined,
            (error) => {
                console.error(`Error cargando el modelo ${modelPath}:`, error);
                reject(error);
            }
        );
    });
}

async function initializeScene() {
    try {
        loadedGameboyAsset = await loadGameboyModel();
    } catch (error) {
        console.error(
            "Fallo al cargar el activo principal del Game Boy. La animación no comenzará.",
            error
        );
        return;
    }

    if (!loadedGameboyAsset) {
        console.error(
            "El activo del Game Boy no se cargó. La animación no comenzará."
        );
        return;
    }

    const vertices = loadedGameboyAsset.geometry.attributes.position.array;
    const indices = loadedGameboyAsset.geometry.index
        ? loadedGameboyAsset.geometry.index.array
        : null;

    if (vertices && indices) {
        loadedGameboyAsset.physicsShape = new CANNON.Trimesh(vertices, indices);
    } else {
        const tempVisual = loadedGameboyAsset.scene.clone();
        const boundingBox = new THREE.Box3().setFromObject(tempVisual);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        if (size.x > 0.001 && size.y > 0.001 && size.z > 0.001) {
            loadedGameboyAsset.physicsShape = new CANNON.Box(
                new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
            );
            console.warn(
                `Usando Box como forma física para ${
                    loadedGameboyAsset.originalPath
                } con tamaño: ${size.x.toFixed(2)}, ${size.y.toFixed(
                    2
                )}, ${size.z.toFixed(2)} (basado en modelo sin escalar)`
            );
        } else {
            loadedGameboyAsset.geometry.computeBoundingSphere();
            const radius = loadedGameboyAsset.geometry.boundingSphere.radius;
            loadedGameboyAsset.physicsShape = new CANNON.Sphere(radius);
            console.warn(
                `Usando Sphere como forma física para ${
                    loadedGameboyAsset.originalPath
                } (radio: ${radius.toFixed(2)}, basado en modelo sin escalar)`
            );
        }
    }

    createObjectInstances();
    animate();
}

function createObjectInstances() {
    console.log("Creando instancias de Game Boy...");
    for (let i = 0; i < numberOfObjects; i++) {
        const visual = loadedGameboyAsset.scene.clone(true);

        const modelScale = 0.2;
        visual.scale.set(modelScale, modelScale, modelScale);

        const initialSpreadFactor = 3.0;
        const posX = (Math.random() - 0.5) * initialSpreadFactor;
        const posY = (Math.random() - 0.5) * initialSpreadFactor;
        const posZ = (Math.random() - 0.5) * initialSpreadFactor * 0.5;
        visual.position.set(posX, posY, posZ);

        visual.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        scene.add(visual);

        let finalPhysicsShape = loadedGameboyAsset.physicsShape;
        if (loadedGameboyAsset.physicsShape instanceof CANNON.Box) {
            const originalHalfExtents =
                loadedGameboyAsset.physicsShape.halfExtents;
            finalPhysicsShape = new CANNON.Box(
                new CANNON.Vec3(
                    originalHalfExtents.x * modelScale,
                    originalHalfExtents.y * modelScale,
                    originalHalfExtents.z * modelScale
                )
            );
        } else if (loadedGameboyAsset.physicsShape instanceof CANNON.Sphere) {
            finalPhysicsShape = new CANNON.Sphere(
                loadedGameboyAsset.physicsShape.radius * modelScale
            );
        }

        const body = new CANNON.Body({
            mass: 5 * modelScale,
            shape: finalPhysicsShape,
            position: new CANNON.Vec3(posX, posY, posZ),
            quaternion: new CANNON.Quaternion().copy(visual.quaternion),
            material: defaultMaterial,
            linearDamping: 0.2, // CAMBIO: Reducido para un retorno más "flotante" y menos frenado
            angularDamping: 0.2,
            angularVelocity: new CANNON.Vec3(
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4
            ),
        });
        world.addBody(body);
        objectsData.push({ visual, body });
    }
}

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
const attractionStrength = 30; // CAMBIO: Ligeramente aumentado para un retorno más claro
const idealRestingDistance = 2.8; // CAMBIO: Ajustar el radio del "cluster" central
const minAttractionDistance = 1.2; // CAMBIO: Zona interna, más pequeña que idealRestingDistance

// --- Reloj para el Delta Time ---
const clock = new THREE.Clock();

// --- Bucle de Animación ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (deltaTime > 0) {
        world.step(1 / 60, deltaTime, 10);
    }

    for (const obj of objectsData) {
        const visual = obj.visual;
        const body = obj.body;

        if (body && visual) {
            // Lógica de Atracción al Centro (SIN CAMBIOS EN ESTA SECCIÓN)
            const vectorToCenter = new CANNON.Vec3();
            centerOfAttraction.vsub(body.position, vectorToCenter);
            const distanceToCenter = vectorToCenter.length();
            let forceMagnitude = 0;

            if (distanceToCenter > idealRestingDistance) {
                forceMagnitude =
                    attractionStrength *
                    (distanceToCenter - idealRestingDistance) *
                    0.25; // Factor de atracción un poco más fuerte
            } else if (
                distanceToCenter < minAttractionDistance &&
                distanceToCenter > 0.05
            ) {
                forceMagnitude =
                    -attractionStrength *
                    (minAttractionDistance - distanceToCenter) *
                    0.35; // Repulsión del centro un poco más fuerte
            }

            if (Math.abs(forceMagnitude) > 0.0001) {
                vectorToCenter.normalize();
                vectorToCenter.scale(forceMagnitude, vectorToCenter);
                body.applyForce(vectorToCenter, body.position);
            }

            // --- INICIO DE LA SECCIÓN MODIFICADA PARA LA FUERZA DE REPULSIÓN DEL RATÓN ---
            if (mousePositionWorld.lengthSq() > 0.001) {
                // Comprueba si mousePositionWorld es válido (no -Infinity)
                const mouseRepulsionStrength = 10;
                const influenceRadius = 0.8;

                // Se modifica cómo se define la posición Z del cursor para la interacción.
                // Ahora se usa la posición Z del cuerpo actual (body.position.z).
                // Esto hace que la 'distanceToMouse' se calcule efectivamente en el plano XY
                // relativo al objeto, mejorando la consistencia de la interacción
                // independientemente de la profundidad Z del objeto.
                const mousePosCannon = new CANNON.Vec3(
                    mousePositionWorld.x,
                    mousePositionWorld.y,
                    body.position.z // <-- CAMBIO IMPORTANTE AQUÍ
                );

                const vectorFromMouseToBody = new CANNON.Vec3();
                // Calcula el vector desde el punto del ratón (ajustado en Z) hacia el cuerpo
                body.position.vsub(mousePosCannon, vectorFromMouseToBody);
                const distanceToMouse = vectorFromMouseToBody.length();

                // Si el cuerpo está dentro del radio de influencia del ratón, se aplica la fuerza
                if (
                    distanceToMouse < influenceRadius &&
                    distanceToMouse > 0.01 // Evita problemas si la distancia es exactamente 0
                ) {
                    const repulsionMagnitude =
                        mouseRepulsionStrength *
                        (1 - distanceToMouse / influenceRadius);

                    // La dirección del vector ya es correcta (desde el ratón hacia el cuerpo = empuja lejos del ratón)
                    vectorFromMouseToBody.normalize();
                    vectorFromMouseToBody.scale(
                        repulsionMagnitude,
                        vectorFromMouseToBody
                    );
                    body.applyForce(vectorFromMouseToBody, body.position);
                }
            }
            // --- FIN DE LA SECCIÓN MODIFICADA ---

            visual.position.copy(body.position);
            visual.quaternion.copy(body.quaternion);
        }
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

// En tu src/main.js

const cursorDot = document.querySelector("#cursor-dot");
const cursorRing = document.querySelector("#cursor-ring");

let mouseX = 0;
let mouseY = 0;

let ringX = 0;
let ringY = 0;

// Factor de suavizado para el anillo (0.1 es un buen punto de partida, más bajo = más delay)
const delayFactor = 0.1; // Puedes experimentar con este valor (entre 0 y 1)

// Visibilidad inicial (opcional, para evitar que aparezcan en 0,0)
cursorDot.style.opacity = "0";
cursorRing.style.opacity = "0";
let cursorInitialized = false;

window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;

    if (!cursorInitialized) {
        // Mueve los cursores a la posición inicial del ratón la primera vez
        ringX = mouseX;
        ringY = mouseY;
        cursorDot.style.opacity = "1";
        cursorRing.style.opacity = "1";
        cursorInitialized = true;
    }
});

function animateCursor() {
    // Mover el punto central directamente con el ratón
    if (cursorInitialized) {
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;

        // Mover el anillo exterior con delay (interpolación lineal)
        const deltaX = mouseX - ringX;
        const deltaY = mouseY - ringY;

        ringX += deltaX * delayFactor;
        ringY += deltaY * delayFactor;

        cursorRing.style.left = `${ringX}px`;
        cursorRing.style.top = `${ringY}px`;
    }

    requestAnimationFrame(animateCursor);
}

// Iniciar la animación del cursor
animateCursor();

// Opcional: Ocultar el cursor personalizado si el ratón sale de la ventana
document.addEventListener("mouseleave", () => {
    if (cursorDot) cursorDot.style.opacity = "0";
    if (cursorRing) cursorRing.style.opacity = "0";
    cursorInitialized = false; // Para que se reposicione al volver a entrar
});

document.addEventListener("mouseenter", () => {
    // No es estrictamente necesario reactivar la opacidad aquí
    // ya que el mousemove lo hará, pero podría ser útil si quieres
    // que aparezca incluso si el mouse entra sin moverse.
    // if (cursorDot) cursorDot.style.opacity = '1';
    // if (cursorRing) cursorRing.style.opacity = '1';
});
