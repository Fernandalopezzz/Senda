// Configuración e inicialización de Firebase (SDK modular 13.1.0).
// Es la única configuración de Firebase del proyecto (acuerdo del equipo, ver README).

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// Los datos del proyecto de Firebase están en firebaseConfig.js, que no se sube al repositorio.
// Para crearlo, copiar firebaseConfig.ejemplo.js con el nombre firebaseConfig.js y completar los
// valores desde Consola de Firebase > Configuración del proyecto > Tus apps > SDK setup and configuration.
// La protección de los datos la dan las reglas de firestore.rules.
import { firebaseConfig } from "./firebaseConfig.js";

export { firebaseConfig };

export const firebaseConfigurado = Object.values(firebaseConfig).every(
  (valor) => typeof valor === "string" && valor !== "" && valor !== "COMPLETAR"
);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
auth.languageCode = "es";

// Detección automática de "long polling". Firestore usa un canal abierto (streaming), que es lo más
// rápido. Si un antivirus, un bloqueador de anuncios o la red de la escuela corta ese canal, cambia
// solo a solicitudes HTTP comunes (long polling) y la página sigue funcionando.
// Antes se forzaba long polling siempre. Funcionaba, pero cada consulta tardaba entre 1 y 3 segundos
// y el inicio podía demorar 9 segundos en mostrar los productos. Con la detección automática las
// consultas chicas tardan menos de medio segundo.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

// Cloud Storage no se usa: el proyecto está en el plan gratuito (Spark), que no lo incluye.
// Las imágenes se guardan en Firestore (ver js/services/imagenesService.js).
