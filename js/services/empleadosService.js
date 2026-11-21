// Cuentas de empleados de SENDA.
//
// El administrador crea cada cuenta con un correo y una contraseña inicial. El empleado puede
// cambiar la contraseña después. Cada empleado tiene dos documentos:
//   usuarios/{uid}:  { rol: "empleado" }, igual que el resto de las cuentas.
//   empleados/{uid}: { nombre, correo, permisos, activo, fechaAlta }. Lo leen el administrador y el
//                    propio empleado. Solo el administrador lo modifica.
// Un empleado no se borra: se deshabilita. Así su nombre sigue apareciendo en el historial de
// moderación junto a las acciones que hizo.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { db, firebaseConfig } from "../config/firebase.js";
import { COLECCIONES, ROLES, PERMISOS_EMPLEADO, ORIGENES } from "../core/constants.js";
import { ErrorSenda } from "../core/errores.js";
import { referenciaNuevaAccion, datosAccion } from "./moderacionService.js";

const NOMBRE_CONEXION_ALTAS = "senda-alta-empleados";

// Todos los permisos en false. Se usa al deshabilitar una cuenta.
export function permisosVacios() {
  return Object.fromEntries(PERMISOS_EMPLEADO.map(({ clave }) => [clave, false]));
}

// Deja solo las claves conocidas y con valor true o false.
function limpiarPermisos(permisos = {}) {
  return Object.fromEntries(PERMISOS_EMPLEADO.map(({ clave }) => [clave, permisos[clave] === true]));
}

export async function obtenerEmpleado(uid) {
  const snapshot = await getDoc(doc(db, COLECCIONES.EMPLEADOS, uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

// Primero los habilitados y después los deshabilitados, cada grupo por nombre.
export async function listarEmpleados() {
  const snapshot = await getDocs(collection(db, COLECCIONES.EMPLEADOS));
  return snapshot.docs
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, "es"));
}

// Segunda conexión de Firebase. Crear una cuenta inicia sesión con ella; si se hiciera con la
// conexión principal, el administrador perdería su sesión.
function conexionDeAltas() {
  const app = getApps().find((a) => a.name === NOMBRE_CONEXION_ALTAS) ?? initializeApp(firebaseConfig, NOMBRE_CONEXION_ALTAS);
  return getAuth(app);
}

// actor: { uid, nombre, correo } de quien hace la acción (el administrador).
export async function crearEmpleado({ nombre, correo, password, permisos }, actor) {
  const authAltas = conexionDeAltas();
  let uid;
  try {
    uid = (await createUserWithEmailAndPassword(authAltas, correo.trim(), password)).user.uid;
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") throw new ErrorSenda("senda/correo-en-uso");
    throw error;
  } finally {
    await signOut(authAltas).catch(() => {});
  }

  const datos = {
    nombre: nombre.trim(),
    correo: correo.trim().toLowerCase(),
    permisos: limpiarPermisos(permisos),
    activo: true,
    fechaAlta: serverTimestamp()
  };
  const lote = writeBatch(db);
  lote.set(doc(db, COLECCIONES.USUARIOS, uid), { rol: ROLES.EMPLEADO });
  lote.set(doc(db, COLECCIONES.EMPLEADOS, uid), datos);
  lote.set(
    referenciaNuevaAccion(),
    datosAccion(actor, {
      accion: "Alta de empleado",
      objetivoTipo: "empleado",
      objetivoId: uid,
      objetivoNombre: `${datos.nombre} (${datos.correo})`,
      motivo: "Cuenta creada por el administrador",
      origen: ORIGENES.EMPLEADOS
    })
  );
  await lote.commit();
  return { id: uid, ...datos };
}

// Guarda los permisos y deja constancia en el historial.
export async function actualizarPermisos(empleado, permisos, actor) {
  const limpios = limpiarPermisos(permisos);
  const activos = PERMISOS_EMPLEADO.filter(({ clave }) => limpios[clave]).map(({ nombre }) => nombre);
  const lote = writeBatch(db);
  lote.update(doc(db, COLECCIONES.EMPLEADOS, empleado.id), { permisos: limpios });
  lote.set(
    referenciaNuevaAccion(),
    datosAccion(actor, {
      accion: "Cambio de permisos",
      objetivoTipo: "empleado",
      objetivoId: empleado.id,
      objetivoNombre: `${empleado.nombre} (${empleado.correo})`,
      motivo: activos.length ? `Permisos: ${activos.join(", ")}` : "Sin permisos",
      origen: ORIGENES.EMPLEADOS
    })
  );
  await lote.commit();
  return limpios;
}

// Deshabilitar quita todos los permisos. El empleado ya no puede usar el panel.
// Volver a habilitar no devuelve los permisos: el administrador los elige de nuevo.
export async function cambiarEstadoEmpleado(empleado, activo, actor) {
  const lote = writeBatch(db);
  lote.update(doc(db, COLECCIONES.EMPLEADOS, empleado.id), activo ? { activo } : { activo, permisos: permisosVacios() });
  lote.set(
    referenciaNuevaAccion(),
    datosAccion(actor, {
      accion: activo ? "Empleado habilitado" : "Empleado deshabilitado",
      objetivoTipo: "empleado",
      objetivoId: empleado.id,
      objetivoNombre: `${empleado.nombre} (${empleado.correo})`,
      motivo: activo ? "Cuenta habilitada sin permisos" : "Se quitaron todos los permisos",
      origen: ORIGENES.EMPLEADOS
    })
  );
  await lote.commit();
}
