// Opiniones de las cuentas personales sobre un producto.
//   reacciones/{productoId}_{uid}: "me-gusta" o "no-me-gusta". Una por persona y producto.
//   comentarios/{id}: texto corto, con el comercio del que habla o vacío si es general.
// La lectura es pública. Solo una cuenta personal puede reaccionar o comentar.

import {
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, REACCIONES } from "../core/constants.js";

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

export async function publicarComentario({ productoId, comercioId = "", uid, texto }) {
  const referencia = await addDoc(collection(db, COLECCIONES.COMENTARIOS), {
    productoId,
    comercioId,
    clienteId: uid,
    texto: texto.trim(),
    fecha: serverTimestamp()
  });
  return referencia.id;
}

// Lo usa el autor o el administrador.
export function eliminarComentario(comentarioId) {
  return deleteDoc(doc(db, COLECCIONES.COMENTARIOS, comentarioId));
}
