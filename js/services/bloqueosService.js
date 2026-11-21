// Bloqueos.
//
// 1) Lista de bloqueo permanente (listaBloqueo/{tipo_valor}), solo del administrador.
//    Cuando el administrador elimina una cuenta de comercio, su correo y su teléfono quedan acá.
//    Si alguien se registra de nuevo con ese correo o ese teléfono, la cuenta nace bloqueada
//    (las reglas de usuarios lo exigen). El nombre del comercio sí se puede volver a usar.
//    IDs: "correo_nombre@gmail.com" y "telefono_2966123456" (solo números).
//
// 2) Lo que cada cuenta personal decide no ver (ocultos/{uid}), privado:
//    comercios: comercios que ocultó de las comparaciones (se deshace desde Configuración).
//    cuentas:   cuentas personales que bloqueó (no ve sus comentarios ni su perfil).

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES } from "../core/constants.js";

// ---------- Lista de bloqueo permanente ----------

export function normalizarCorreo(correo) {
  return String(correo ?? "").trim().toLowerCase();
}

export function normalizarTelefono(telefono) {
  return String(telefono ?? "").replace(/[^0-9]/g, "");
}

function claveCorreo(correo) {
  return `correo_${normalizarCorreo(correo)}`;
}

function claveTelefono(telefono) {
  return `telefono_${normalizarTelefono(telefono)}`;
}

// true si el correo o el teléfono están en la lista. El teléfono cuenta desde 6 números.
export async function estaEnListaDeBloqueo({ correo = "", telefono = "" }) {
  const consultas = [];
  if (normalizarCorreo(correo)) consultas.push(getDoc(doc(db, COLECCIONES.LISTA_BLOQUEO, claveCorreo(correo))));
  if (normalizarTelefono(telefono).length >= 6) {
    consultas.push(getDoc(doc(db, COLECCIONES.LISTA_BLOQUEO, claveTelefono(telefono))));
  }
  const resultados = await Promise.all(consultas);
  return resultados.some((snapshot) => snapshot.exists());
}

// Agrega al lote el correo y el teléfono de una cuenta eliminada.
export function agregarAListaEnLote(lote, { correo = "", telefono = "", motivo = "" }) {
  const datos = (tipo, valor) => ({ tipo, valor, motivo: motivo.slice(0, 200), fecha: serverTimestamp() });
  if (normalizarCorreo(correo)) {
    lote.set(doc(db, COLECCIONES.LISTA_BLOQUEO, claveCorreo(correo)), datos("correo", normalizarCorreo(correo)));
  }
  if (normalizarTelefono(telefono).length >= 6) {
    lote.set(doc(db, COLECCIONES.LISTA_BLOQUEO, claveTelefono(telefono)), datos("telefono", normalizarTelefono(telefono)));
  }
}

// ---------- Ocultos de cada cuenta personal ----------

export async function obtenerOcultos(uid) {
  if (!uid) return { comercios: [], cuentas: [] };
  const snapshot = await getDoc(doc(db, COLECCIONES.OCULTOS, uid));
  const datos = snapshot.exists() ? snapshot.data() : {};
  return { comercios: datos.comercios ?? [], cuentas: datos.cuentas ?? [] };
}

function cambiar(uid, campo, id, agregar) {
  return setDoc(
    doc(db, COLECCIONES.OCULTOS, uid),
    { [campo]: agregar ? arrayUnion(id) : arrayRemove(id) },
    { merge: true }
  );
}

export const ocultarComercio = (uid, comercioId) => cambiar(uid, "comercios", comercioId, true);
export const mostrarComercio = (uid, comercioId) => cambiar(uid, "comercios", comercioId, false);
export const bloquearCuenta = (uid, cuentaId) => cambiar(uid, "cuentas", cuentaId, true);
export const desbloquearCuenta = (uid, cuentaId) => cambiar(uid, "cuentas", cuentaId, false);
