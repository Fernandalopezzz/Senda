// Operaciones sobre la colección "precios".
// Cada documento une un producto con un comercio e incluye el descuento (no hay colección de descuentos).

import {
  doc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, ROLES, ROLES_COMERCIO_ACTIVO, TIPOS_NOTIFICACION } from "../core/constants.js";
import { exigirRespuestaDelServidor } from "../core/errores.js";
import { normalizarProducto, listarProductos } from "./productosService.js";
import { listarComercios } from "./comerciosService.js";
import { listarUsuarios } from "./usuariosService.js";

export function calcularPrecioFinal(precioOriginal, porcentajeDescuento = 0) {
  const final = precioOriginal * (1 - porcentajeDescuento / 100);
  return Math.round(final * 100) / 100;
}

export async function listarPrecios() {
  const snapshot = exigirRespuestaDelServidor(await getDocs(collection(db, COLECCIONES.PRECIOS)));
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

export async function listarPreciosPorComercio(comercioId) {
  const consulta = query(collection(db, COLECCIONES.PRECIOS), where("comercioId", "==", comercioId));
  const snapshot = await getDocs(consulta);
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

function armarPrecioNuevo({ productoId, comercioId, precioOriginal, porcentajeDescuento, disponible }) {
  return {
    productoId,
    comercioId,
    precioOriginal,
    porcentajeDescuento,
    precioFinal: calcularPrecioFinal(precioOriginal, porcentajeDescuento),
    disponible,
    fechaActualizacion: serverTimestamp()
  };
}

// Publica en un comercio un producto que ya existe en la plataforma.
export async function crearPrecio(datosPrecio) {
  const referencia = await addDoc(collection(db, COLECCIONES.PRECIOS), armarPrecioNuevo(datosPrecio));
  return referencia.id;
}

// Crea un producto nuevo y su precio en una sola escritura en lote:
// se guardan los dos o ninguno, para que no queden productos sin precio.
// El comercio que lo crea queda como creadorId y es el único que puede editar sus datos.
export async function crearProductoConPrecio(productoId, datosProducto, datosPrecio) {
  const lote = writeBatch(db);
  const referenciaProducto = doc(db, COLECCIONES.PRODUCTOS, productoId);
  const referenciaPrecio = doc(collection(db, COLECCIONES.PRECIOS));
  lote.set(referenciaProducto, { ...normalizarProducto(datosProducto), creadorId: datosPrecio.comercioId });
  lote.set(referenciaPrecio, armarPrecioNuevo({ ...datosPrecio, productoId: referenciaProducto.id }));
  await lote.commit();
  return referenciaProducto.id;
}

export function actualizarPrecio(precioId, { precioOriginal, porcentajeDescuento }) {
  return updateDoc(doc(db, COLECCIONES.PRECIOS, precioId), {
    precioOriginal,
    porcentajeDescuento,
    precioFinal: calcularPrecioFinal(precioOriginal, porcentajeDescuento),
    fechaActualizacion: serverTimestamp()
  });
}

export function actualizarDisponibilidad(precioId, disponible) {
  return updateDoc(doc(db, COLECCIONES.PRECIOS, precioId), {
    disponible,
    fechaActualizacion: serverTimestamp()
  });
}

// El administrador elimina la publicación de un producto en un comercio (no apta para la venta).
// En una sola escritura en lote:
//   1. borra el precio de ese comercio;
//   2. si ningún otro comercio publica el producto, borra también el producto;
//   3. deja un aviso en "notificaciones" que el comercio ve la próxima vez que abre SENDA.
// precio: documento de "precios". producto: documento de "productos".
export async function eliminarPublicacionPorAdmin(precio, producto) {
  const otros = await getDocs(
    query(collection(db, COLECCIONES.PRECIOS), where("productoId", "==", precio.productoId))
  );
  const quedanOtrosComercios = otros.docs.some((documento) => documento.id !== precio.id);

  const lote = writeBatch(db);
  lote.delete(doc(db, COLECCIONES.PRECIOS, precio.id));
  if (!quedanOtrosComercios) lote.delete(doc(db, COLECCIONES.PRODUCTOS, precio.productoId));
  lote.set(doc(collection(db, COLECCIONES.NOTIFICACIONES)), {
    comercioId: precio.comercioId,
    tipo: TIPOS_NOTIFICACION.PRODUCTO_ELIMINADO,
    productoNombre: String(producto?.nombre ?? "").slice(0, 120),
    fecha: serverTimestamp(),
    leida: false
  });
  await lote.commit();
  return { productoEliminado: !quedanOtrosComercios };
}

// Agrupa una lista de precios por producto: Map<productoId, precio[]>.
export function agruparPorProducto(precios) {
  const grupos = new Map();
  for (const precio of precios) {
    if (!grupos.has(precio.productoId)) grupos.set(precio.productoId, []);
    grupos.get(precio.productoId).push(precio);
  }
  return grupos;
}

// Arma el catálogo público a partir de las tres colecciones.
// productos: un resumen por producto que tenga al menos un precio publicado.
//   ofertas se ordena con los que tienen stock primero y, dentro de cada grupo, de menor a mayor precio.
// comercios: solo los activos (validados o sin validar) que publicaron al menos un precio.
//   Los pendientes y rechazados no aparecen. Cada comercio recibe la propiedad "validado"
//   (calculada a partir de su rol, no se guarda en Firestore) para mostrar "Comercio no validado".
export function armarCatalogo(productos, comercios, precios, usuarios = []) {
  const rolPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario.rol]));
  const productoPorId = new Map(productos.map((producto) => [producto.id, producto]));
  const comercioPorId = new Map(
    comercios
      .filter((comercio) => ROLES_COMERCIO_ACTIVO.includes(rolPorId.get(comercio.id)))
      .map((comercio) => [comercio.id, { ...comercio, validado: rolPorId.get(comercio.id) === ROLES.COMERCIO }])
  );
  const validos = precios.filter((p) => productoPorId.has(p.productoId) && comercioPorId.has(p.comercioId));

  const resumenProductos = [];
  for (const [productoId, preciosProducto] of agruparPorProducto(validos)) {
    const ofertas = preciosProducto
      .map((precio) => ({ precio, comercio: comercioPorId.get(precio.comercioId) }))
      .sort((a, b) => Number(b.precio.disponible) - Number(a.precio.disponible) || a.precio.precioFinal - b.precio.precioFinal);
    const disponibles = ofertas.filter(({ precio }) => precio.disponible);
    const base = disponibles.length > 0 ? disponibles : ofertas;
    resumenProductos.push({
      producto: productoPorId.get(productoId),
      ofertas,
      disponibles,
      hayStock: disponibles.length > 0,
      precioDesde: Math.min(...base.map(({ precio }) => precio.precioFinal)),
      descuento: Math.max(0, ...base.map(({ precio }) => Number(precio.porcentajeDescuento) || 0))
    });
  }

  const cantidadPorComercio = new Map();
  for (const precio of validos) {
    cantidadPorComercio.set(precio.comercioId, (cantidadPorComercio.get(precio.comercioId) ?? 0) + 1);
  }
  const resumenComercios = [...cantidadPorComercio].map(([id, cantidadProductos]) => ({
    comercio: comercioPorId.get(id),
    cantidadProductos
  }));

  return { productos: resumenProductos, comercios: resumenComercios, productoPorId, comercioPorId };
}

export async function cargarCatalogo() {
  const [productos, comercios, precios, usuarios] = await Promise.all([
    listarProductos(),
    listarComercios(),
    listarPrecios(),
    listarUsuarios()
  ]);
  return armarCatalogo(productos, comercios, precios, usuarios);
}
