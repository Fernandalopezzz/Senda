// Operaciones sobre la colección "productos", su imagen y los favoritos.
// Un producto es único en la plataforma y cada comercio le asigna su precio en la colección "precios".
// El campo creadorId guarda el comercio que cargó el producto. Solo ese comercio puede editar
// el nombre, la marca, la descripción y la imagen. Los demás solo publican su propio precio.

import {
  doc,
  getDocs,
  collection,
  updateDoc
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, ALMACENAMIENTO, LIMITES } from "../core/constants.js";
import { prepararImagen } from "./imagenesService.js";
import { normalizarEtiquetas, normalizarCodigoBarras, normalizarTexto } from "../core/validators.js";
import { leerFavoritosDeCuenta, guardarFavoritosDeCuenta } from "./clientesService.js";
import { manejarError } from "../core/errores.js";

// Reserva un ID para un producto nuevo antes de guardarlo.
export function nuevoIdProducto() {
  return doc(collection(db, COLECCIONES.PRODUCTOS)).id;
}

export async function listarProductos() {
  const snapshot = await getDocs(collection(db, COLECCIONES.PRODUCTOS));
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

// true si el comercio puede editar los datos del producto (lo creó él).
export function esCreadorDelProducto(producto, comercioId) {
  return Boolean(producto?.creadorId) && producto.creadorId === comercioId;
}

// creadorId no se envía: queda el que ya tiene el producto y las reglas impiden cambiarlo.
export function actualizarProducto(productoId, datos) {
  return updateDoc(doc(db, COLECCIONES.PRODUCTOS, productoId), normalizarProducto(datos));
}

// Limpia los textos antes de guardar. También la usa preciosService al crear producto y precio juntos.
// presentacion: peso o volumen ("1 kg"). etiquetas: lista corta de características ("Natural").
// codigoBarras: el número que está debajo de las barras del envase. Sirve para buscar el producto
// escribiendo o pegando ese número. Es opcional y se guarda solo con números.
export function normalizarProducto({ nombre, marca, descripcion, imagen, presentacion = "", etiquetas = [], codigoBarras = "" }) {
  return {
    nombre: nombre.trim(),
    marca: marca.trim(),
    descripcion: descripcion.trim(),
    imagen: imagen.trim(),
    presentacion: String(presentacion).trim(),
    etiquetas: normalizarEtiquetas(etiquetas),
    codigoBarras: normalizarCodigoBarras(codigoBarras)
  };
}

// true si el producto coincide con lo que se escribió. No distingue tildes ni mayúsculas y
// acepta las palabras en cualquier orden ("canarias yerba"). Si se escriben solo números
// (desde 4), también busca por código de barras.
export function productoCoincide(producto, texto) {
  const termino = normalizarTexto(texto);
  if (!termino) return true;
  const numeros = normalizarCodigoBarras(texto);
  if (numeros.length >= 4 && numeros === termino.replace(/\s/g, "") && (producto.codigoBarras ?? "").includes(numeros)) return true;
  const donde = normalizarTexto(`${producto.nombre} ${producto.marca ?? ""} ${producto.presentacion ?? ""}`);
  return termino.split(/\s+/).every((palabra) => donde.includes(palabra));
}

// Achica la imagen y devuelve el data URL que se guarda en productos.imagen.
// productoId se mantiene en la firma por si más adelante se vuelve a usar Cloud Storage.
export function subirImagenProducto(productoId, archivo) {
  return prepararImagen(archivo, "producto");
}

// ---------- Favoritos ----------
// Sin cuenta, los favoritos se guardan en el navegador (localStorage) y cada dispositivo tiene su lista.
// Con una cuenta personal, la misma lista se guarda también en Firestore (favoritos/{uid}),
// así aparece en cualquier dispositivo. Al iniciar sesión se suman los guardados sin cuenta.
// localStorage funciona como copia local para que el corazón responda al instante.

export const EVENTO_FAVORITOS = "senda:favoritos";

let cuentaDeFavoritos = null;

export function obtenerFavoritos() {
  try {
    const guardado = JSON.parse(localStorage.getItem(ALMACENAMIENTO.FAVORITOS) ?? "[]");
    return Array.isArray(guardado) ? guardado.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function guardarFavoritosLocales(favoritos) {
  try {
    localStorage.setItem(ALMACENAMIENTO.FAVORITOS, JSON.stringify(favoritos.slice(0, LIMITES.FAVORITOS_MAXIMO)));
  } catch {
    // Si el navegador bloquea el almacenamiento, el cambio dura solo mientras la página está abierta.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_FAVORITOS));
}

export function esFavorito(productoId) {
  return obtenerFavoritos().includes(productoId);
}

// Agrega o quita un producto. Devuelve true si quedó como favorito.
export function alternarFavorito(productoId) {
  const favoritos = obtenerFavoritos();
  const indice = favoritos.indexOf(productoId);
  if (indice >= 0) favoritos.splice(indice, 1);
  else favoritos.unshift(productoId);
  const lista = favoritos.slice(0, LIMITES.FAVORITOS_MAXIMO);
  guardarFavoritosLocales(lista);
  if (cuentaDeFavoritos) {
    const quitados = indice >= 0 ? [productoId] : [];
    guardarFavoritosDeCuenta(cuentaDeFavoritos, lista, quitados).catch((error) =>
      manejarError(error, "Guardado de favoritos en la cuenta")
    );
  }
  return indice < 0;
}

// Se llama cuando hay una sesión de cuenta personal. Une los favoritos de la cuenta con los del navegador.
export async function vincularFavoritosConCuenta(uid) {
  if (cuentaDeFavoritos === uid) return;
  const deCuenta = await leerFavoritosDeCuenta(uid);
  const locales = obtenerFavoritos();
  const unidos = [...new Set([...deCuenta, ...locales])].slice(0, LIMITES.FAVORITOS_MAXIMO);
  cuentaDeFavoritos = uid;
  if (unidos.length !== deCuenta.length) await guardarFavoritosDeCuenta(uid, unidos);
  guardarFavoritosLocales(unidos);
}

// Al cerrar la sesión personal se borra la copia local, para que otra persona no vea esa lista.
export function olvidarFavoritosLocales() {
  cuentaDeFavoritos = null;
  guardarFavoritosLocales([]);
}
