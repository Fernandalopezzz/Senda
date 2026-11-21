// Manejo centralizado de errores.
// Traduce los códigos de Firebase Authentication, Firestore y de SENDA a mensajes en español.

const MENSAJES_ERROR = {
  // Firebase Authentication
  "auth/invalid-credential": "El correo o la contraseña no son correctos.",
  "auth/wrong-password": "El correo o la contraseña no son correctos.",
  "auth/user-not-found": "El correo o la contraseña no son correctos.",
  "auth/invalid-email": "El correo electrónico no es válido.",
  "auth/missing-email": "Ingresá tu correo electrónico.",
  "auth/user-disabled": "Esta cuenta está deshabilitada.",
  "auth/too-many-requests": "Hubo demasiados intentos. Esperá unos minutos y volvé a probar.",
  "auth/network-request-failed": "No hay conexión. Revisá tu internet y volvé a intentar.",
  "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar.",
  "auth/cancelled-popup-request": "Se canceló el inicio de sesión con Google.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes.",
  "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Iniciá sesión.",
  "auth/weak-password": "La contraseña tiene que tener al menos 6 caracteres.",
  "auth/requires-recent-login": "Por seguridad, volvé a ingresar tu contraseña e intentá de nuevo.",
  "auth/missing-password": "Ingresá tu contraseña.",
  "auth/user-mismatch": "Elegí la misma cuenta de Google con la que iniciaste sesión.",
  "auth/operation-not-allowed": "Este método de inicio de sesión no está habilitado en Firebase.",

  // Cloud Firestore
  "permission-denied": "No tenés permisos para realizar esta acción.",
  "unavailable": "No se pudo conectar con el servidor. Revisá tu conexión.",
  "not-found": "El dato que buscás ya no existe.",
  "failed-precondition": "La consulta necesita una configuración adicional en Firestore.",

  // Cloud Storage
  "storage/unauthorized": "No tenés permiso para subir o ver este archivo.",
  "storage/canceled": "Se canceló la subida del archivo.",
  "storage/quota-exceeded": "Se superó el espacio disponible en Storage. Revisá el plan de Firebase.",
  "storage/retry-limit-exceeded": "La subida tardó demasiado. Revisá tu conexión y volvé a intentar.",
  "storage/object-not-found": "El archivo ya no existe.",
  "storage/unknown": "No se pudo usar Storage. Revisá que esté activado en el proyecto de Firebase.",

  // Errores propios de SENDA
  "senda/imagen-grande": "La imagen tiene demasiado detalle para guardarla. Probá con otra imagen o recortala.",
  "senda/sin-configuracion": "Firebase todavía no está configurado. Completá los datos en js/config/firebase.js.",
  "senda/sin-cuenta": "Esta cuenta no está registrada en SENDA. Creá una cuenta personal o registrá tu comercio.",
  "senda/usuario-repetido": "Ese nombre de usuario ya está en uso. Probá con otro.",
  "senda/pendiente": "Tu comercio todavía está pendiente de validación. Te avisamos cuando esté aprobado.",
  "senda/rechazado": "La solicitud de tu comercio no fue aprobada. Comunicate con soporte.",
  "senda/ya-registrado": "Esta cuenta ya está registrada en SENDA. Iniciá sesión.",
  "senda/nombre-repetido": "Ya hay un comercio registrado con ese nombre.",
  "senda/producto-repetido": "Ese producto ya está publicado en tu comercio.",
  "senda/sin-datos-prueba": "Esta copia del proyecto no tiene el archivo de datos de prueba (js/core/datosPrueba.js).",
  "senda/bloqueado": "Esta cuenta está bloqueada por no cumplir las normas de SENDA. Comunicate con soporte técnico.",
  "senda/en-lista-bloqueo": "Este correo o teléfono pertenece a una cuenta eliminada por no cumplir las normas. La cuenta quedó bloqueada. Comunicate con soporte técnico.",
  "senda/ya-reportado": "Ya reportaste esto. El equipo de SENDA lo va a revisar.",
  "senda/empleado-deshabilitado": "Esta cuenta está deshabilitada. Comunicate con soporte técnico para volver a usarla.",
  "senda/correo-en-uso": "Ese correo ya tiene una cuenta en SENDA. Usá otro correo para el empleado.",
  "senda/sin-conexion": "No se pudo conectar con la base de datos. Revisá tu conexión a internet y recargá la página."
};

const MENSAJE_GENERICO = "Ocurrió un error inesperado. Intentá de nuevo.";

export class ErrorSenda extends Error {
  constructor(code) {
    super(MENSAJES_ERROR[code] ?? MENSAJE_GENERICO);
    this.name = "ErrorSenda";
    this.code = code;
  }
}

// Sin conexión, Firestore no siempre falla: puede devolver una lista vacía guardada en memoria.
// Si la lista llegó vacía y no vino del servidor, se avisa que falta conexión
// en lugar de mostrar "no hay productos".
export function exigirRespuestaDelServidor(snapshot) {
  if (snapshot.empty && snapshot.metadata?.fromCache) throw new ErrorSenda("senda/sin-conexion");
  return snapshot;
}

export function obtenerMensajeError(error) {
  return MENSAJES_ERROR[error?.code] ?? MENSAJE_GENERICO;
}

// Registra el error en consola (para depurar) y devuelve el mensaje para el usuario.
export function manejarError(error, contexto = "") {
  console.error(`[SENDA] ${contexto}`, error);
  return obtenerMensajeError(error);
}
