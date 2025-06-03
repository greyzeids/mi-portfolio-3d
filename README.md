# Mi Portfolio 3D Interactivo ✨

¡Bienvenido/a a mi portfolio 3D interactivo! Este proyecto es una demostración de mis habilidades en desarrollo web, gráficos 3D y simulación de físicas utilizando tecnologías modernas como Three.js y Cannon-es.

## 🚀 Tecnologías Utilizadas

-   **Three.js:** Para la creación y renderizado de la escena 3D.
-   **Cannon-es:** Motor de físicas para simular interacciones realistas entre objetos.
-   **Vite:** Herramienta de desarrollo front-end moderna y rápida.
-   **JavaScript (Vanilla):** Lenguaje principal de la lógica del proyecto.
-   **HTML5 y CSS3:** Para la estructura y estilos base.
-   **Git LFS:** Para el versionado de modelos 3D de gran tamaño.

## 🌟 Características Principales

-   **Visualización de Modelos 3D:** Carga y muestra de modelos 3D detallados (ej. Game Boy, Monitor).
-   **Simulación de Físicas:** Los objetos en la escena interactúan entre sí con gravedad (o ausencia de ella), colisiones y fuerzas.
-   **Interacción con el Ratón:**
    -   Los objetos son repelidos por el cursor del ratón.
-   **Atracción Central:** Los objetos tienden a agruparse o son atraídos hacia un punto central de la escena.
-   **Escena Dinámica:** La disposición y el movimiento de los objetos cambian en tiempo real.

## 🔧 Puesta en Marcha y Desarrollo

Sigue estos pasos para configurar y ejecutar el proyecto en tu entorno local.

### Prerrequisitos

-   **Node.js:** (Versión LTS recomendada). Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
-   **npm** o **yarn:** Gestor de paquetes (npm viene con Node.js).
-   **Git:** Sistema de control de versiones.
-   **Git LFS:** Extensión de Git para manejar archivos grandes. Asegúrate de tenerlo instalado.
    -   Puedes descargarlo e instalarlo desde [git-lfs.github.com](https://git-lfs.github.com/).
    -   Tras la instalación, ejecuta `git lfs install` una vez en tu terminal para inicializar Git LFS en tu sistema.

### Instalación

1.  **Clona el repositorio:**

    ```bash
    git clone [https://github.com/greyzeids/mi-portfolio-3d.git](https://github.com/greyzeids/mi-portfolio-3d.git)
    ```

2.  **Navega al directorio del proyecto:**

    ```bash
    cd mi-portfolio-3d
    ```

3.  **Descarga los archivos grandes gestionados por Git LFS:**
    (Esto descargará los modelos 3D como `gameboy.glb` y `monitor.glb`)

    ```bash
    git lfs pull
    ```

4.  **Instala las dependencias del proyecto:**
    ```bash
    npm install
    # o si usas yarn:
    # yarn install
    ```

### Ejecución

1.  **Para iniciar el servidor de desarrollo (con Vite):**

    ```bash
    npm run dev
    # o si usas yarn:
    # yarn dev
    ```

    Abre tu navegador y visita `http://localhost:5173` (o el puerto que indique Vite).

2.  **Para construir la versión de producción:**
    ```bash
    npm run build
    # o si usas yarn:
    # yarn build
    ```
    Esto generará los archivos estáticos en la carpeta `dist/`.

## 📁 Estructura del Proyecto (Simplificada)

mi-portfolio-3d/
├── public/
│ └── models/ # Aquí se almacenan los modelos 3D (.glb)
│ ├── gameboy.glb
│ └── monitor.glb
├── src/ # Código fuente principal (si usas esta estructura con Vite)
│ └── main.js # Punto de entrada de tu aplicación JavaScript
├── index.html # Punto de entrada HTML
├── vite.config.js # Configuración de Vite (si es necesaria)
├── package.json # Dependencias y scripts del proyecto
├── .gitattributes # Configuración de Git LFS
└── README.md # Este archivo

## 👋 Contacto

Desarrollado por **Miquel Carnot Luna**.

-   GitHub: [github.com/greyzeids](https://github.com/greyzeids)

---
