// Avisos de cambio de precio en los favoritos de una cuenta personal.
//
// SENDA usa el plan gratuito de Firebase, sin funciones en el servidor. Por eso el control se hace
// en el navegador cada vez que la persona abre SENDA con su sesión iniciada:
//   1. Para cada favorito se calcula el mejor precio actual (el más bajo entre los comercios
//      validados que tienen stock). Si ningún comercio tiene stock, el valor es null.
//   2. Se compara con el precio de referencia guardado en favoritos/{uid}.precios.
//   3. Si es distinto, hay un aviso: bajó, subió, se quedó sin stock o volvió a haber stock.
// Cuando la persona marca el aviso como visto, el precio actual pasa a ser la nueva referencia.
// Un favorito recién guardado toma como referencia el precio de ese momento y no genera aviso.

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, ROLES } from "../core/constants.js";
import { leerDocumentoFavoritos, guardarPreciosDeReferencia } from "./clientesService.js";

// Firestore admite hasta 30 valores en una consulta "in".
const TAMANO_LOTE = 30;

function enLotes(lista) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += TAMANO_LOTE) lotes.push(lista.slice(i, i + TAMANO_LOTE));
  return lotes;
}

// Map productoId → { producto, mejor, descuento } con el mejor precio actual de cada producto
// y el descuento de esa oferta.
// Solo se cuentan comercios validados, igual que en el catálogo público.
async function preciosActuales(productoIds) {
  const precios = (
    await Promise.all(
      enLotes(productoIds).map((lote) =>
        getDocs(query(collection(db, COLECCIONES.PRECIOS), where("productoId", "in", lote)))
      )
    )
  ).flatMap((snapshot) => snapshot.docs.map((d) => d.data()));

  const comercioIds = [...new Set(precios.map((p) => p.comercioId))];
  const roles = await Promise.all(
    comercioIds.map((id) => getDoc(doc(db, COLECCIONES.USUARIOS, id)).then((s) => s.data()?.rol))
  );
  const validados = new Set(comercioIds.filter((_, i) => roles[i] === ROLES.COMERCIO));

  const productos = await Promise.all(
    productoIds.map((id) =>
      getDoc(doc(db, COLECCIONES.PRODUCTOS, id)).then((s) => (s.exists() ? { id: s.id, ...s.data() } : null))
    )
  );

  const resultado = new Map();
  productoIds.forEach((id, i) => {
    const conStock = precios.filter((p) => p.productoId === id && p.disponible && validados.has(p.comercioId));
    const oferta = conStock.sort((a, b) => a.precioFinal - b.precioFinal)[0];
    resultado.set(id, {
      producto: productos[i],
      mejor: oferta ? oferta.precioFinal : null,
      descuento: oferta ? Number(oferta.porcentajeDescuento) || 0 : 0
    });
  });
  return resultado;
}

// Tipo de cambio para mostrar el aviso.
function tipoDeCambio(antes, ahora) {
  if (antes === null) return "volvio-stock";
  if (ahora === null) return "sin-stock";
  return ahora < antes ? "bajo" : "subio";
}

// Devuelve { cambios, avisosActivos }.
//   cambios: [{ productoId, producto, antes, ahora, descuento, tipo }]
//   avisosActivos: false si la persona apagó los avisos en Configuración.
// De paso, guarda la referencia de los favoritos que todavía no tenían.
export async function revisarCambiosDePrecio(uid) {
  const { productos, precios, avisos } = await leerDocumentoFavoritos(uid);
  const avisosActivos = avisos !== false;
  if (productos.length === 0) return { cambios: [], avisosActivos };

  const actuales = await preciosActuales(productos);
  const nuevasReferencias = {};
  const cambios = [];

  for (const productoId of productos) {
    const { producto, mejor, descuento } = actuales.get(productoId);
    const antes = precios[productoId];
    if (antes === undefined) {
      nuevasReferencias[productoId] = mejor;
    } else if (antes !== mejor && producto) {
      cambios.push({ productoId, producto, antes, ahora: mejor, descuento, tipo: tipoDeCambio(antes, mejor) });
    }
  }

  await guardarPreciosDeReferencia(uid, nuevasReferencias);
  return { cambios, avisosActivos };
}

// La persona ya vio los avisos: el precio actual pasa a ser la referencia.
export function marcarCambiosVistos(uid, cambios) {
  return guardarPreciosDeReferencia(
    uid,
    Object.fromEntries(cambios.map((cambio) => [cambio.productoId, cambio.ahora]))
  );
}
