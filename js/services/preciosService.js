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
import { COLECCIONES, ROLES, ROLES_COMERCIO_ACTIVO, TIPOS_NOTIFICACION, LOCALIDAD_PREDETERMINADA, TIPOS_REPORTE } from "../core/constants.js";
import { revisarTexto } from "../core/palabrasProhibidas.js";
import { marcarEnLote, mapaDeRevisiones, estadoDe } from "./reportesService.js";
import { obtenerOcultos } from "./bloqueosService.js";
import { obtenerUsuarioActual } from "./authService.js";
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
// Si los datos tienen palabras no permitidas o un producto no apto, el producto se publica igual,
// pero queda oculto y entra con prioridad a la lista de revisión (ver palabrasProhibidas.js).
// Devuelve { productoId, enRevision }.
export async function crearProductoConPrecio(productoId, datosProducto, datosPrecio) {
  const lote = writeBatch(db);
  const referenciaProducto = doc(db, COLECCIONES.PRODUCTOS, productoId);
  const referenciaPrecio = doc(collection(db, COLECCIONES.PRECIOS));
  const producto = normalizarProducto(datosProducto);
  lote.set(referenciaProducto, { ...producto, creadorId: datosPrecio.comercioId });
  lote.set(referenciaPrecio, armarPrecioNuevo({ ...datosPrecio, productoId: referenciaProducto.id }));
  const enRevision = await marcarProductoSiHaceFalta(lote, productoId, producto, datosPrecio.comercioId);
  await lote.commit();
  return { productoId: referenciaProducto.id, enRevision };
}

// Edición de los datos de un producto por el comercio que lo creó. Devuelve { enRevision }.
export async function actualizarProductoRevisado(productoId, datosProducto, comercioId) {
  const lote = writeBatch(db);
  const producto = normalizarProducto(datosProducto);
  lote.update(doc(db, COLECCIONES.PRODUCTOS, productoId), producto);
  const enRevision = await marcarProductoSiHaceFalta(lote, productoId, producto, comercioId);
  await lote.commit();
  return { enRevision };
}

async function marcarProductoSiHaceFalta(lote, productoId, producto, comercioId) {
  const revision = revisarTexto(producto.nombre, producto.marca, producto.descripcion, producto.etiquetas ?? []);
  if (!revision.ofensivo && !revision.noApto) return false;
  await marcarEnLote(lote, {
    tipo: TIPOS_REPORTE.PRODUCTO,
    objetivoId: productoId,
    objetivoNombre: producto.nombre,
    duenoId: comercioId,
    comercioId,
    motivoAutomatico: revision.motivo
  });
  return true;
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

// ---------- Precio por kilo o por litro ----------

// Lee la presentación ("500 g", "1 kg", "3 L", "900 ml") y devuelve la cantidad en kilos o litros.
// Devuelve null si la presentación no tiene un peso o un volumen, por ejemplo "6 unidades".
export function cantidadDePresentacion(presentacion) {
  const coincidencia = String(presentacion ?? "")
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|ml|cc)$/);
  if (!coincidencia) return null;
  const numero = Number(coincidencia[1].replace(",", "."));
  if (!numero) return null;
  const unidad = coincidencia[2];
  if (unidad === "kg") return { cantidad: numero, unidad: "kg" };
  if (unidad === "g" || unidad === "gr") return { cantidad: numero / 1000, unidad: "kg" };
  if (unidad === "l" || unidad === "lt") return { cantidad: numero, unidad: "L" };
  return { cantidad: numero / 1000, unidad: "L" };
}

// Precio por kilo o por litro, para comparar envases de distinto tamaño.
// Ejemplo: $1.005 por 500 g → { valor: 2010, unidad: "kg" }.
export function precioPorUnidad(precio, presentacion) {
  const medida = cantidadDePresentacion(presentacion);
  if (!medida || !(precio > 0)) return null;
  return { valor: Math.round(precio / medida.cantidad), unidad: medida.unidad };
}

// true si la fecha (Timestamp de Firestore) es de hoy.
export function esDeHoy(fecha) {
  if (!fecha?.toDate) return false;
  const dia = fecha.toDate();
  const hoy = new Date();
  return dia.getFullYear() === hoy.getFullYear() && dia.getMonth() === hoy.getMonth() && dia.getDate() === hoy.getDate();
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
// revisiones: lo que el equipo ocultó no aparece, y lo que está en revisión lleva enRevision = true.
// comerciosOcultos: comercios que la cuenta personal ocultó de sus comparaciones. Se devuelven
//   aparte (ocultosPorVos) para poder avisar "Ocultaste N comercios".
export function armarCatalogo(productos, comercios, precios, usuarios = [], { revisiones = new Map(), comerciosOcultos = [] } = {}) {
  const rolPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario.rol]));
  const productoPorId = new Map(
    productos
      .filter((producto) => !estadoDe(revisiones, TIPOS_REPORTE.PRODUCTO, producto.id).oculto)
      .map((producto) => [producto.id, { ...producto, enRevision: estadoDe(revisiones, TIPOS_REPORTE.PRODUCTO, producto.id).enRevision }])
  );
  const activos = comercios
    .filter((comercio) => ROLES_COMERCIO_ACTIVO.includes(rolPorId.get(comercio.id)))
    .filter((comercio) => !estadoDe(revisiones, TIPOS_REPORTE.CUENTA, comercio.id).oculto)
    .map((comercio) => ({
      ...comercio,
      localidad: comercio.localidad || LOCALIDAD_PREDETERMINADA,
      validado: rolPorId.get(comercio.id) === ROLES.COMERCIO,
      enRevision: estadoDe(revisiones, TIPOS_REPORTE.CUENTA, comercio.id).enRevision,
      actualizadoHoy: false
    }));
  const ocultosPorVos = activos.filter((comercio) => comerciosOcultos.includes(comercio.id));
  const comercioPorId = new Map(
    activos.filter((comercio) => !comerciosOcultos.includes(comercio.id)).map((comercio) => [comercio.id, comercio])
  );
  const validos = precios
    .filter((p) => productoPorId.has(p.productoId) && comercioPorId.has(p.comercioId))
    .filter((p) => !estadoDe(revisiones, TIPOS_REPORTE.PRECIO, p.id).oculto)
    .map((p) => ({ ...p, enRevision: estadoDe(revisiones, TIPOS_REPORTE.PRECIO, p.id).enRevision }));

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

  // "Actualizado hoy": el comercio cambió al menos un precio o un stock en el día.
  const cantidadPorComercio = new Map();
  for (const precio of validos) {
    cantidadPorComercio.set(precio.comercioId, (cantidadPorComercio.get(precio.comercioId) ?? 0) + 1);
    if (esDeHoy(precio.fechaActualizacion)) comercioPorId.get(precio.comercioId).actualizadoHoy = true;
  }
  const resumenComercios = [...cantidadPorComercio].map(([id, cantidadProductos]) => ({
    comercio: comercioPorId.get(id),
    cantidadProductos
  }));

  return { productos: resumenProductos, comercios: resumenComercios, productoPorId, comercioPorId, ocultosPorVos, revisiones };
}

// Comercios que ocultó la cuenta personal con sesión iniciada (vacío para el resto).
// usuarios: la lista de usuarios ya leída, para saber el rol sin otra consulta.
async function comerciosOcultosDeLaSesion(usuarios) {
  try {
    const usuario = await obtenerUsuarioActual();
    if (!usuario) return [];
    const rol = usuarios.find((u) => u.id === usuario.uid)?.rol;
    if (rol !== ROLES.CLIENTE) return [];
    return (await obtenerOcultos(usuario.uid)).comercios;
  } catch {
    return [];
  }
}

export async function cargarCatalogo() {
  const [productos, comercios, precios, usuarios, revisiones] = await Promise.all([
    listarProductos(),
    listarComercios(),
    listarPrecios(),
    listarUsuarios(),
    mapaDeRevisiones()
  ]);
  const comerciosOcultos = await comerciosOcultosDeLaSesion(usuarios);
  return armarCatalogo(productos, comercios, precios, usuarios, { revisiones, comerciosOcultos });
}
