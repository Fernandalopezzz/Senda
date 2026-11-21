// Operaciones sobre la colección "comercios".
// El ID de cada comercio es el uid de la cuenta que lo administra.
// La foto y el fondo del perfil se guardan en los campos "foto" y "fondo" del mismo documento
// (ver imagenesService.js).

import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  writeBatch,
  query,
  where
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { prepararImagen } from "./imagenesService.js";
import { COLECCIONES, ROLES } from "../core/constants.js";
import { normalizarTexto } from "../core/validators.js";
import { agregarAListaEnLote } from "./bloqueosService.js";

export async function obtenerComercio(comercioId) {
  const snapshot = await getDoc(doc(db, COLECCIONES.COMERCIOS, comercioId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listarComercios() {
  const snapshot = await getDocs(collection(db, COLECCIONES.COMERCIOS));
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

// Guarda los datos del perfil. Con merge se crea el documento si todavía no existe.
export function guardarComercio(comercioId, { nombre, direccion, telefono, horario, localidad }) {
  const datos = { nombre, direccion, telefono, horario };
  if (localidad) datos.localidad = localidad;
  return setDoc(
    doc(db, COLECCIONES.COMERCIOS, comercioId),
    datos,
    { merge: true }
  );
}

// true si otro comercio ya usa ese nombre (sin distinguir mayúsculas ni tildes).
// excluirId evita que un comercio choque con su propio nombre al editar el perfil.
export async function existeComercioConNombre(nombre, excluirId = null) {
  const buscado = normalizarTexto(nombre);
  const comercios = await listarComercios();
  return comercios.some((comercio) => comercio.id !== excluirId && normalizarTexto(comercio.nombre) === buscado);
}

// Registro de un comercio: crea su cuenta en "usuarios" con rol "pendiente" y su perfil en "comercios".
// La cuenta queda en espera hasta que un administrador la valida o la bloquea.
// Se guarda en lote para que no quede una cuenta sin comercio o un comercio sin cuenta.
// correo: el de la cuenta de Authentication. Se guarda aparte, en comerciosPrivados,
// para que el administrador lo vea sin que quede público en el perfil del comercio.
// bloqueada: el correo o el teléfono están en la lista de bloqueo (ver bloqueosService.js).
// La solicitud se guarda igual, pero la cuenta queda "rechazada" desde el principio.
export async function crearSolicitudComercio(uid, { nombre, dueno, direccion, telefono, localidad = "", correo = "", bloqueada = false }) {
  const lote = writeBatch(db);
  if (correo) lote.set(doc(db, COLECCIONES.COMERCIOS_PRIVADOS, uid), { correo });
  lote.set(doc(db, COLECCIONES.USUARIOS, uid), { rol: bloqueada ? ROLES.RECHAZADO : ROLES.PENDIENTE });
  lote.set(doc(db, COLECCIONES.COMERCIOS, uid), {
    nombre: nombre.trim(),
    dueno: dueno.trim(),
    direccion: direccion.trim(),
    telefono: telefono.trim(),
    localidad,
    horario: ""
  });
  await lote.commit();
}

// ---------- Foto y fondo del perfil ----------

// tipo: "foto" o "fondo". Achica la imagen, la guarda en el comercio y devuelve el data URL.
export async function subirImagenComercio(comercioId, tipo, archivo) {
  const url = await prepararImagen(archivo, tipo);
  await setDoc(doc(db, COLECCIONES.COMERCIOS, comercioId), { [tipo]: url }, { merge: true });
  return url;
}

export async function obtenerImagenesComercio(comercioId) {
  const comercio = await obtenerComercio(comercioId);
  return { foto: comercio?.foto || null, fondo: comercio?.fondo || null };
}

// ---------- Correo privado del comercio ----------

// Correo de un comercio, o "" si todavía no se guardó. Solo lo pueden leer el comercio y el administrador.
export async function obtenerCorreoComercio(comercioId) {
  const snapshot = await getDoc(doc(db, COLECCIONES.COMERCIOS_PRIVADOS, comercioId));
  return snapshot.exists() ? snapshot.data().correo ?? "" : "";
}

// Guarda el correo de la sesión si falta o cambió. Lo usa el panel del comercio al abrirse,
// así los comercios registrados antes de existir esta colección también quedan con su correo.
export async function sincronizarCorreoComercio(comercioId, correo) {
  if (!correo) return;
  if ((await obtenerCorreoComercio(comercioId)) === correo) return;
  await setDoc(doc(db, COLECCIONES.COMERCIOS_PRIVADOS, comercioId), { correo });
}

// ---------- Eliminación de una cuenta de comercio (solo administrador) ----------
// Solo se eliminan cuentas que ya están bloqueadas (las reglas lo exigen). Se borran:
//   - todos los precios del comercio;
//   - los productos que ningún otro comercio publica (los que comparte con otros quedan);
//   - los avisos (notificaciones) que recibió;
//   - su perfil, su correo privado y su rol.
// Sin documento en "usuarios", la cuenta ya no puede entrar a SENDA.
// La cuenta de acceso de Authentication no se puede borrar desde la página: eso necesita el
// SDK de administrador en un servidor. Se borra a mano desde la consola de Firebase.
const LIMITE_LOTE = 450;

// El correo y el teléfono de la cuenta quedan en la lista de bloqueo permanente: si alguien se
// registra de nuevo con alguno de los dos, la cuenta nace bloqueada (ver bloqueosService.js).
export async function eliminarCuentaComercio(comercioId, motivo = "") {
  const [precios, notificaciones, comercio, correo] = await Promise.all([
    getDocs(query(collection(db, COLECCIONES.PRECIOS), where("comercioId", "==", comercioId))),
    getDocs(query(collection(db, COLECCIONES.NOTIFICACIONES), where("comercioId", "==", comercioId))),
    obtenerComercio(comercioId),
    obtenerCorreoComercio(comercioId).catch(() => "")
  ]);

  // Productos que solo vende este comercio.
  const productoIds = [...new Set(precios.docs.map((d) => d.data().productoId))];
  const exclusivos = [];
  for (const productoId of productoIds) {
    const todos = await getDocs(query(collection(db, COLECCIONES.PRECIOS), where("productoId", "==", productoId)));
    if (todos.docs.every((d) => d.data().comercioId === comercioId)) exclusivos.push(productoId);
  }

  const referencias = [
    ...precios.docs.map((d) => d.ref),
    ...exclusivos.map((id) => doc(db, COLECCIONES.PRODUCTOS, id)),
    ...notificaciones.docs.map((d) => d.ref)
  ];
  // Los lotes de Firestore admiten hasta 500 escrituras. El último lote borra la cuenta,
  // porque las reglas de los anteriores necesitan que el rol "rechazado" todavía exista.
  for (let i = 0; i < referencias.length; i += LIMITE_LOTE) {
    const lote = writeBatch(db);
    referencias.slice(i, i + LIMITE_LOTE).forEach((ref) => lote.delete(ref));
    await lote.commit();
  }
  const ultimo = writeBatch(db);
  agregarAListaEnLote(ultimo, { correo, telefono: comercio?.telefono ?? "", motivo: motivo || "Cuenta de comercio eliminada" });
  ultimo.delete(doc(db, COLECCIONES.COMERCIOS, comercioId));
  ultimo.delete(doc(db, COLECCIONES.COMERCIOS_PRIVADOS, comercioId));
  ultimo.delete(doc(db, COLECCIONES.USUARIOS, comercioId));
  await ultimo.commit();

  return { precios: precios.size, productos: exclusivos.length };
}
