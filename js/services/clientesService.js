// Operaciones sobre las cuentas personales (rol "cliente").
//   clientes/{uid}:  perfil público. Nombre de usuario y foto. Se muestra junto a sus comentarios.
//   clientesPrivados/{uid}: nombre real. Solo lo lee su dueño.
//   favoritos/{uid}: lista privada de productos guardados y el último precio visto de cada uno.
// El correo no se guarda en Firestore. Queda en Firebase Authentication y solo lo ve la persona.

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  writeBatch,
  deleteField
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, ROLES } from "../core/constants.js";
import { normalizarNombreUsuario } from "../core/validators.js";
import { prepararImagen } from "./imagenesService.js";

// Perfil público: { id, usuario, foto } o null.
export async function obtenerCliente(uid) {
  const snapshot = await getDoc(doc(db, COLECCIONES.CLIENTES, uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

// Perfil completo de la propia cuenta: público más el nombre privado.
export async function obtenerMiCuenta(uid) {
  const [publico, privado] = await Promise.all([
    obtenerCliente(uid),
    getDoc(doc(db, COLECCIONES.CLIENTES_PRIVADOS, uid))
  ]);
  if (!publico) return null;
  return { ...publico, nombre: privado.exists() ? privado.data().nombre : "" };
}

// Perfiles de varios clientes a la vez (autores de comentarios). Devuelve un Map uid → perfil.
export async function obtenerClientes(uids) {
  const unicos = [...new Set(uids)];
  const perfiles = await Promise.all(unicos.map((uid) => obtenerCliente(uid).catch(() => null)));
  return new Map(unicos.map((uid, i) => [uid, perfiles[i]]));
}

export async function existeNombreUsuario(usuario) {
  const consulta = query(
    collection(db, COLECCIONES.CLIENTES),
    where("usuario", "==", normalizarNombreUsuario(usuario))
  );
  return !(await getDocs(consulta)).empty;
}

// Crea el rol y el perfil en una sola escritura en lote: se guardan los dos o ninguno.
export async function crearCuentaPersonal(uid, { nombre, usuario }) {
  const lote = writeBatch(db);
  lote.set(doc(db, COLECCIONES.USUARIOS, uid), { rol: ROLES.CLIENTE });
  lote.set(doc(db, COLECCIONES.CLIENTES, uid), {
    usuario: normalizarNombreUsuario(usuario),
    foto: ""
  });
  lote.set(doc(db, COLECCIONES.CLIENTES_PRIVADOS, uid), { nombre: nombre.trim() });
  await lote.commit();
}

export function actualizarNombreCliente(uid, nombre) {
  return setDoc(doc(db, COLECCIONES.CLIENTES_PRIVADOS, uid), { nombre: nombre.trim() });
}

// Achica la foto, la guarda en el perfil y devuelve el data URL.
export async function subirFotoCliente(uid, archivo) {
  const url = await prepararImagen(archivo, "foto");
  await updateDoc(doc(db, COLECCIONES.CLIENTES, uid), { foto: url });
  return url;
}

// ---------- Favoritos de la cuenta ----------

// Documento completo: { productos: [ids], precios: { productoId: último mejor precio visto } }.
export async function leerDocumentoFavoritos(uid) {
  const snapshot = await getDoc(doc(db, COLECCIONES.FAVORITOS, uid));
  const datos = snapshot.exists() ? snapshot.data() : {};
  const productos = Array.isArray(datos.productos) ? datos.productos.filter((id) => typeof id === "string") : [];
  const precios = datos.precios && typeof datos.precios === "object" ? datos.precios : {};
  return { productos, precios, avisos: datos.avisos !== false };
}

export async function leerFavoritosDeCuenta(uid) {
  return (await leerDocumentoFavoritos(uid)).productos;
}

// Guarda la lista. Los productos quitados también pierden su precio de referencia,
// así, si se vuelven a guardar, el aviso empieza de cero.
export function guardarFavoritosDeCuenta(uid, productos, quitados = []) {
  const datos = { productos };
  if (quitados.length > 0) datos.precios = Object.fromEntries(quitados.map((id) => [id, deleteField()]));
  return setDoc(doc(db, COLECCIONES.FAVORITOS, uid), datos, { merge: true });
}

// Avisos de precio encendidos (true) o apagados (false). Por defecto están encendidos
// y se leen junto con los favoritos en leerDocumentoFavoritos.
export function guardarPreferenciaAvisos(uid, activos) {
  return setDoc(doc(db, COLECCIONES.FAVORITOS, uid), { avisos: Boolean(activos) }, { merge: true });
}

// Actualiza el precio de referencia de algunos productos. cambios: { productoId: precio | null }.
export function guardarPreciosDeReferencia(uid, cambios) {
  if (Object.keys(cambios).length === 0) return Promise.resolve();
  return setDoc(doc(db, COLECCIONES.FAVORITOS, uid), { precios: cambios }, { merge: true });
}

// ---------- Comentarios propios y eliminación de la cuenta ----------

export async function listarComentariosDeCliente(uid) {
  const snapshot = await getDocs(
    query(collection(db, COLECCIONES.COMENTARIOS), where("clienteId", "==", uid))
  );
  return snapshot.docs
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
}

// Borra todos los datos de la cuenta personal en Firestore: comentarios, reacciones, favoritos,
// perfil público, datos privados y rol. Se hace en una sola escritura en lote, mientras el rol "cliente" todavía existe,
// porque las reglas lo necesitan para autorizar cada borrado. Después hay que borrar la cuenta
// de Authentication (eliminarUsuarioActual en authService.js).
export async function eliminarDatosDeCuenta(uid) {
  const [comentarios, reacciones] = await Promise.all([
    getDocs(query(collection(db, COLECCIONES.COMENTARIOS), where("clienteId", "==", uid))),
    getDocs(query(collection(db, COLECCIONES.REACCIONES), where("clienteId", "==", uid)))
  ]);
  const lote = writeBatch(db);
  comentarios.forEach((documento) => lote.delete(documento.ref));
  reacciones.forEach((documento) => lote.delete(documento.ref));
  lote.delete(doc(db, COLECCIONES.FAVORITOS, uid));
  lote.delete(doc(db, COLECCIONES.CLIENTES, uid));
  lote.delete(doc(db, COLECCIONES.CLIENTES_PRIVADOS, uid));
  lote.delete(doc(db, COLECCIONES.USUARIOS, uid));
  await lote.commit();
}
