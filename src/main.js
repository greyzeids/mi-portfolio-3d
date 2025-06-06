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
camera.position.z = 3;

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
let currentDisplayMode = "gameboys"; // Empezamos con los Game Boys

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
                // Considerar eliminar console.log en producción
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
                    // Considerar eliminar console.warn en producción
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
                console.error(`Error cargando el modelo ${modelPath}:`, error); // Mantener para errores críticos
                reject(error);
            }
        );
    });
}

async function initializeScene() {
    try {
        loadedGameboyAsset = await loadGameboyModel();
    } catch (error) {
        // Mantener para errores críticos
        console.error(
            "Fallo al cargar el activo principal del Game Boy. La animación no comenzará.",
            error
        );
        return;
    }

    if (!loadedGameboyAsset) {
        // Mantener para errores críticos
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
            // Considerar eliminar console.warn en producción
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
            // Considerar eliminar console.warn en producción
            console.warn(
                `Usando Sphere como forma física para ${
                    loadedGameboyAsset.originalPath
                } (radio: ${radius.toFixed(2)}, basado en modelo sin escalar)`
            );
        }
    }

    createGameboyInstances(); // Renombrado de createObjectInstances
    animate();
}

function createGameboyInstances() {
    // Renombrado de createObjectInstances
    // Considerar eliminar console.log en producción
    console.log("Creando instancias de Game Boy...");
    for (let i = 0; i < numberOfObjects; i++) {
        const visual = loadedGameboyAsset.scene.clone(true);

        const modelScale = 0.1;
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
            linearDamping: 0.2,
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
const attractionStrength = 30;
const idealRestingDistance = 2.8;
const minAttractionDistance = 1.2;

// --- Reloj para el Delta Time ---
const clock = new THREE.Clock();

// --- Vectores reutilizables para cálculos en animate() ---
const _cannonVec3_1 = new CANNON.Vec3(); // Usado para vectorToTarget, vectorToCenter
const _cannonVec3_2 = new CANNON.Vec3(); // Usado para vectorFromMouseToBody
const _cannonMousePos = new CANNON.Vec3(); // Usado para mousePosCannon

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
            if (currentDisplayMode === "tech_logos" && obj.targetPosition) {
                obj.targetPosition.vsub(body.position, _cannonVec3_1);
                const forceMagnitude = _cannonVec3_1.length() * 5;
                _cannonVec3_1.normalize();
                _cannonVec3_1.scale(forceMagnitude, _cannonVec3_1);
                body.applyForce(_cannonVec3_1, body.position);
            } else {
                centerOfAttraction.vsub(body.position, _cannonVec3_1);
                const distanceToCenter = _cannonVec3_1.length();
                let forceMagnitude = 0;

                if (distanceToCenter > idealRestingDistance) {
                    forceMagnitude =
                        attractionStrength *
                        (distanceToCenter - idealRestingDistance) *
                        0.25;
                } else if (
                    distanceToCenter < minAttractionDistance &&
                    distanceToCenter > 0.05
                ) {
                    forceMagnitude =
                        -attractionStrength *
                        (minAttractionDistance - distanceToCenter) *
                        0.35;
                }

                if (Math.abs(forceMagnitude) > 0.0001) {
                    _cannonVec3_1.normalize();
                    _cannonVec3_1.scale(forceMagnitude, _cannonVec3_1);
                    body.applyForce(_cannonVec3_1, body.position);
                }
            }

            if (mousePositionWorld.lengthSq() > 0.001) {
                const mouseRepulsionStrength = 10;
                const influenceRadius = 0.8;
                _cannonMousePos.set(
                    mousePositionWorld.x,
                    mousePositionWorld.y,
                    body.position.z
                );
                body.position.vsub(_cannonMousePos, _cannonVec3_2);
                const distanceToMouse = _cannonVec3_2.length();

                if (
                    distanceToMouse < influenceRadius &&
                    distanceToMouse > 0.01
                ) {
                    const repulsionMagnitude =
                        mouseRepulsionStrength *
                        (1 - distanceToMouse / influenceRadius);
                    _cannonVec3_2.normalize();
                    _cannonVec3_2.scale(repulsionMagnitude, _cannonVec3_2);
                    body.applyForce(_cannonVec3_2, body.position);
                }
            }

            visual.position.copy(body.position);
            visual.quaternion.copy(body.quaternion);

            if (currentDisplayMode === "tech_logos") {
                visual.lookAt(camera.position);
            }
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

const cursorDot = document.querySelector("#cursor-dot");
const cursorRing = document.querySelector("#cursor-ring");
const heroSection = document.getElementById("home"); // Global heroSection

let mouseX = 0;
let mouseY = 0;
let ringX = 0;
let ringY = 0;
const delayFactor = 0.1;
cursorDot.style.opacity = "0";
cursorRing.style.opacity = "0";
let cursorInitialized = false;

window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (!cursorInitialized) {
        ringX = mouseX;
        ringY = mouseY;
        cursorDot.style.opacity = "1";
        cursorRing.style.opacity = "1";
        cursorInitialized = true;
    }
});

function animateCursor() {
    if (cursorInitialized) {
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
        const deltaX = mouseX - ringX;
        const deltaY = mouseY - ringY;
        ringX += deltaX * delayFactor;
        ringY += deltaY * delayFactor;
        cursorRing.style.left = `${ringX}px`;
        cursorRing.style.top = `${ringY}px`;
    }
    requestAnimationFrame(animateCursor);
}
animateCursor();

document.addEventListener("mouseleave", () => {
    if (cursorDot) cursorDot.style.opacity = "0";
    if (cursorRing) cursorRing.style.opacity = "0";
    cursorInitialized = false;
});

document.addEventListener("mouseenter", () => {
    // Opacity handled by mousemove
});

const techLogoUrls = [
    "/models/tech-logos/react.glb",
    "/models/tech-logos/html5.glb",
    "/models/tech-logos/css3.glb",
];
const loadedTechLogoAssets = [];
let areTechLogosLoaded = false;
let isTransitioning = false;

const loadingIndicator = document.getElementById("loading-indicator");
const showLoadingIndicator = () => (loadingIndicator.style.display = "block");
const hideLoadingIndicator = () => (loadingIndicator.style.display = "none");

function loadModel(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, (data) => resolve(data.scene), undefined, reject);
    });
}

async function preloadTechLogos() {
    if (areTechLogosLoaded) return Promise.resolve();
    showLoadingIndicator();
    try {
        const loadedScenes = await Promise.all(
            techLogoUrls.map((url) => loadModel(url))
        );
        loadedTechLogoAssets.push(...loadedScenes);
        areTechLogosLoaded = true;
        // Considerar eliminar console.log en producción
        console.log("Todos los logos de tecnología han sido cargados.");
    } catch (error) {
        // Mantener para errores críticos
        console.error("Fallo al cargar uno o más modelos de logos.", error);
    } finally {
        hideLoadingIndicator();
    }
}

function explodeAndRemoveGameboys() {
    // Considerar eliminar console.log en producción
    console.log("Iniciando explosión de Game Boys...");
    if (heroSection) heroSection.classList.add("fade-out");

    objectsData.forEach((obj) => {
        const body = obj.body;
        const forceMagnitude = 80 + Math.random() * 40;
        const direction = new CANNON.Vec3().copy(body.position);
        if (direction.lengthSquared() < 0.0001) {
            direction.set(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            );
        }
        direction.normalize();
        body.angularVelocity.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );
        body.applyImpulse(direction.scale(forceMagnitude), body.position);
    });

    setTimeout(() => {
        // Considerar eliminar console.log en producción
        console.log(
            "Eliminando Game Boys y preparando la creación de logos..."
        );
        objectsData.forEach((obj) => {
            world.removeBody(obj.body);
            scene.remove(obj.visual);
        });
        objectsData.length = 0;
        spawnTechLogos(); // currentDisplayMode should already be "tech_logos"
        setTimeout(() => {
            isTransitioning = false;
        }, 500);
    }, 1800);
}

function spawnTechLogos() {
    // Considerar eliminar console.log en producción
    console.log(
        "Creando instancias de logos de tecnología en un layout de grilla..."
    );
    const numberOfColumns = 5;
    const spacingX = 2.0;
    const spacingY = 2.0;
    const normalizedLogoSize = 1.5;
    const numberOfLogos = loadedTechLogoAssets.length;
    if (numberOfLogos === 0) return;

    const numberOfRows = Math.ceil(numberOfLogos / numberOfColumns);
    const gridWidth = (Math.min(numberOfLogos, numberOfColumns) - 1) * spacingX;
    const gridHeight = (numberOfRows - 1) * spacingY;

    loadedTechLogoAssets.forEach((logoAssetScene, i) => {
        const visual = new THREE.Group();
        const logoModelInstance = logoAssetScene.clone();
        normalizeAndCenterModel(logoModelInstance, normalizedLogoSize);
        visual.add(logoModelInstance);
        scene.add(visual);

        const col = i % numberOfColumns;
        const row = Math.floor(i / numberOfColumns);
        const targetX = col * spacingX - gridWidth / 2;
        const targetY = -(row * spacingY) + gridHeight / 2;
        const targetZ = 0;
        const targetPosition = new CANNON.Vec3(targetX, targetY, targetZ);

        const spread = 12;
        const initialX = (Math.random() - 0.5) * spread;
        const initialY = (Math.random() - 0.5) * spread;
        const initialZ = (Math.random() - 0.5) * spread;
        const initialPosition = new CANNON.Vec3(initialX, initialY, initialZ);
        visual.position.copy(initialPosition);

        const logoShape = new CANNON.Sphere(normalizedLogoSize / 2);
        const body = new CANNON.Body({
            mass: 1,
            shape: logoShape,
            position: initialPosition,
            fixedRotation: true,
            angularDamping: 0.8,
            linearDamping: 0.5,
            material: defaultMaterial,
        });
        world.addBody(body);
        objectsData.push({ visual, body, targetPosition });
    });
}

function normalizeAndCenterModel(model, targetSize) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = maxDim === 0 ? 1 : targetSize / maxDim;
    model.position.sub(center);
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    model.position.multiplyScalar(scaleFactor);
}

document.addEventListener("DOMContentLoaded", () => {
    const homeLink = document.querySelector('a[href="#home"]');
    const techStackLinkFromDOM = document.querySelector(
        'a[href="#tech-stack"]'
    );

    if (techStackLinkFromDOM) {
        techStackLinkFromDOM.addEventListener("click", (e) => {
            e.preventDefault();
            switchToTechLogos();
        });
    }

    if (homeLink) {
        homeLink.addEventListener("click", (e) => {
            e.preventDefault();
            switchToGameboys();
        });
    }
});

async function switchToTechLogos() {
    if (currentDisplayMode === "tech_logos" || isTransitioning) return;
    isTransitioning = true;
    // heroSection es la variable global
    if (heroSection) heroSection.classList.add("fade-out");
    await preloadTechLogos();
    currentDisplayMode = "tech_logos"; // Cambiar modo ANTES de explotar/spawnear
    explodeAndRemoveGameboys();
}

function switchToGameboys() {
    if (currentDisplayMode === "gameboys" || isTransitioning) return;
    isTransitioning = true;
    currentDisplayMode = "gameboys";
    // heroSection es la variable global
    if (heroSection) heroSection.classList.remove("fade-out");
    objectsData.forEach((obj) => {
        world.removeBody(obj.body);
        scene.remove(obj.visual);
    });
    objectsData.length = 0;
    createGameboyInstances(); // Llamada a la función renombrada
    setTimeout(() => {
        isTransitioning = false;
    }, 500);
}
