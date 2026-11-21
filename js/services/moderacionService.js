// Historial de moderación: quién hizo cada acción del equipo de SENDA, sobre qué, cuándo,
// por qué y desde dónde. Lo ve solo el administrador.
//
// Cada acción es un documento de historialModeracion que no se edita ni se borra:
//   { actorId, actorNombre, actorCorreo, accion, objetivoTipo, objetivoId, objetivoNombre,
//     motivo, origen, fecha }
// Las reglas obligan a que actorId sea la cuenta que escribe, actorCorreo su correo real y
// fecha la hora del servidor, así nadie puede registrar una acción a nombre de otra persona.
// Cuando un empleado cambia el estado de un comercio, las reglas exigen además que la acción
// quede registrada en la misma escritura (ver usuarios en firestore.rules).

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, ROLES } from "../core/constants.js";
import { obtenerEmpleado } from "./empleadosService.js";

// Nombre que aparece en el historial para las acciones del administrador.
export const NOMBRE_ADMINISTRACION = "Administración";

export function referenciaNuevaAccion() {
  return doc(collection(db, COLECCIONES.HISTORIAL_MODERACION));
}

// actor: { uid, nombre, correo }.
export function datosAccion(actor, { accion, objetivoTipo, objetivoId, objetivoNombre, motivo = "", origen }) {
  return {
    actorId: actor.uid,
    actorNombre: actor.nombre,
    actorCorreo: actor.correo,
    accion,
    objetivoTipo,
    objetivoId,
    objetivoNombre: String(objetivoNombre ?? "").slice(0, 160),
    motivo: String(motivo ?? "").trim().slice(0, 300),
    origen,
    fecha: serverTimestamp()
  };
}

// Datos de quien tiene la sesión iniciada, para firmar sus acciones.
// Devuelve también el empleado (con sus permisos) si la cuenta es de un empleado.
export async function obtenerActor(usuario, rol) {
  if (rol === ROLES.ADMIN) {
    return { uid: usuario.uid, nombre: NOMBRE_ADMINISTRACION, correo: usuario.email ?? "", rol, empleado: null };
  }
  const empleado = await obtenerEmpleado(usuario.uid);
  return { uid: usuario.uid, nombre: empleado?.nombre ?? "", correo: usuario.email ?? "", rol, empleado };
}

// Guarda una acción sola (sin otros cambios en la misma escritura).
export async function registrarAccion(actor, datos) {
  const lote = writeBatch(db);
  lote.set(referenciaNuevaAccion(), datosAccion(actor, datos));
  await lote.commit();
}

// Todas las acciones, de la más nueva a la más vieja.
export async function listarHistorial() {
  const snapshot = await getDocs(collection(db, COLECCIONES.HISTORIAL_MODERACION));
  return snapshot.docs
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
}

// Cambia el estado de una cuenta (campo rol de usuarios): validar o bloquear un comercio, o bloquear
// una cuenta personal. Registra la acción en la misma escritura. historialId en usuarios apunta a esa acción: con él, las reglas comprueban que
// un empleado no pueda cambiar un estado sin dejar constancia de quién fue.
export async function cambiarRolCuenta(uid, rol, actor, registro) {
  const accion = referenciaNuevaAccion();
  const lote = writeBatch(db);
  lote.set(accion, datosAccion(actor, registro));
  lote.update(doc(db, COLECCIONES.USUARIOS, uid), { rol, historialId: accion.id });
  await lote.commit();
}
