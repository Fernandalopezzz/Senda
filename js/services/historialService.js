// Historial de búsquedas y productos vistos, para la sección "Para vos" del inicio.
//
// Se guarda solo en el navegador (localStorage), nunca en Firestore: es un dato personal que
// SENDA no necesita conservar en el servidor. Cada cuenta tiene su propio historial en el
// dispositivo (la clave incluye el uid) y los visitantes sin cuenta tienen uno aparte.
// No se muestra como sección del perfil. Se puede borrar desde el menú de "Para vos".

import { obtenerUsuarioActual } from "./authService.js";
import { auth } from "../config/firebase.js";

const MAXIMO = 10;

function clave(uid) {
  return `senda:historial:${uid ?? "visitante"}`;
}

function leer(uid) {
  try {
    const datos = JSON.parse(localStorage.getItem(clave(uid)) ?? "{}");
    return {
      busquedas: Array.isArray(datos.busquedas) ? datos.busquedas : [],
      vistos: Array.isArray(datos.vistos) ? datos.vistos : []
    };
  } catch {
    return { busquedas: [], vistos: [] };
  }
}

function guardar(uid, historial) {
  try {
    localStorage.setItem(clave(uid), JSON.stringify(historial));
  } catch {
    // Si el navegador bloquea el almacenamiento, "Para vos" queda vacío.
  }
}

// Agrega un valor al principio, sin repetir, y conserva los últimos MAXIMO.
function sumar(lista, valor) {
  return [valor, ...lista.filter((v) => v !== valor)].slice(0, MAXIMO);
}

async function uidActual() {
  const usuario = auth.currentUser ?? (await obtenerUsuarioActual());
  return usuario?.uid ?? null;
}

export async function registrarBusqueda(texto) {
  const termino = String(texto ?? "").trim().toLowerCase();
  if (termino.length < 2) return;
  const uid = await uidActual();
  const historial = leer(uid);
  guardar(uid, { ...historial, busquedas: sumar(historial.busquedas, termino) });
}

export async function registrarProductoVisto(productoId) {
  if (!productoId) return;
  const uid = await uidActual();
  const historial = leer(uid);
  guardar(uid, { ...historial, vistos: sumar(historial.vistos, productoId) });
}

export async function leerHistorial() {
  return leer(await uidActual());
}

export async function borrarHistorial(uid = undefined) {
  const dueno = uid === undefined ? await uidActual() : uid;
  try {
    localStorage.removeItem(clave(dueno));
  } catch {
    // Nada que borrar.
  }
}
