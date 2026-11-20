// Operaciones sobre la colección "notificaciones".
// Son avisos de SENDA para un comercio. Hoy hay un solo tipo, "producto-eliminado",
// que se crea cuando el administrador elimina una publicación (ver preciosService.js).
// El comercio los ve la próxima vez que abre la aplicación y, al cerrarlos, quedan como leídos.

import {
  doc,
  getDocs,
  collection,
  query,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES } from "../core/constants.js";

// Avisos sin leer de un comercio, del más viejo al más nuevo.
export async function listarNotificacionesPendientes(comercioId) {
  const consulta = query(
    collection(db, COLECCIONES.NOTIFICACIONES),
    where("comercioId", "==", comercioId),
    where("leida", "==", false)
  );
  const snapshot = await getDocs(consulta);
  return snapshot.docs
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .sort((a, b) => (a.fecha?.toMillis?.() ?? 0) - (b.fecha?.toMillis?.() ?? 0));
}

export async function marcarNotificacionesLeidas(ids) {
  if (ids.length === 0) return;
  const lote = writeBatch(db);
  ids.forEach((id) => lote.update(doc(db, COLECCIONES.NOTIFICACIONES, id), { leida: true }));
  await lote.commit();
}
