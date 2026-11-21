// Opiniones de las cuentas personales sobre un producto.
//   reacciones/{productoId}_{uid}: "me-gusta" o "no-me-gusta". Una por persona y producto.
//   comentarios/{id}: texto corto, con el comercio del que habla o vacío si es general.
// La lectura es pública. Solo una cuenta personal puede reaccionar o comentar.

import {
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, REACCIONES, TIPOS_REPORTE } from "../core/constants.js";
import { revisarTexto } from "../core/palabrasProhibidas.js";
import { marcarEnLote } from "./reportesService.js";

function idReaccion(productoId, uid) {
  return `${productoId}_${uid}`;
}

// Cantidad de cada reacción y la reacción de la persona (o null).
export async function obtenerReacciones(productoId, uid = null) {
  const snapshot = await getDocs(
    query(collection(db, COLECCIONES.REACCIONES), where("productoId", "==", productoId))
  );
  const resumen = { [REACCIONES.ME_GUSTA]: 0, [REACCIONES.NO_ME_GUSTA]: 0, propia: null };
  snapshot.forEach((documento) => {
    const { valor, clienteId } = documento.data();
    if (valor in resumen) resumen[valor] += 1;
    if (uid && clienteId === uid) resumen.propia = valor;
  });
  return resumen;
}

// Guarda la reacción. Si la persona vuelve a tocar la misma, se quita.
export async function reaccionar(productoId, uid, valor, actual) {
  const referencia = doc(db, COLECCIONES.REACCIONES, idReaccion(productoId, uid));
  if (actual === valor) {
    await deleteDoc(referencia);
    return null;
  }
  await setDoc(referencia, { productoId, clienteId: uid, valor });
  return valor;
}

// Comentarios de un producto, del más nuevo al más viejo.
export async function listarComentarios(productoId) {
  const snapshot = await getDocs(
    query(collection(db, COLECCIONES.COMENTARIOS), where("productoId", "==", productoId))
  );
  return snapshot.docs
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() ?? Date.now()) - (a.fecha?.toMillis?.() ?? Date.now()));
}

// Si el texto tiene palabras no permitidas (ver palabrasProhibidas.js), el comentario se guarda
// igual pero queda oculto y entra con prioridad a la lista de revisión del equipo.
// Devuelve { id, enRevision }.
export async function publicarComentario({ productoId, comercioId = "", uid, texto, productoNombre = "" }) {
  const referencia = doc(collection(db, COLECCIONES.COMENTARIOS));
  const lote = writeBatch(db);
  lote.set(referencia, {
    productoId,
    comercioId,
    clienteId: uid,
    texto: texto.trim(),
    fecha: serverTimestamp()
  });
  const revision = revisarTexto(texto);
  if (revision.ofensivo || revision.noApto) {
    await marcarEnLote(lote, {
      tipo: TIPOS_REPORTE.COMENTARIO,
      objetivoId: referencia.id,
      objetivoNombre: `${texto.trim().length > 70 ? `${texto.trim().slice(0, 67)}...` : texto.trim()}${productoNombre ? ` (en ${productoNombre})` : ""}`,
      duenoId: uid,
      comercioId,
      motivoAutomatico: revision.motivo
    });
  }
  await lote.commit();
  return { id: referencia.id, enRevision: revision.ofensivo || revision.noApto };
}

// Lo usa el autor o el administrador.
export function eliminarComentario(comentarioId) {
  return deleteDoc(doc(db, COLECCIONES.COMENTARIOS, comentarioId));
}
