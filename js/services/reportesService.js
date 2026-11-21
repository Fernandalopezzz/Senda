// Reportes, lista de revisión y avisos de moderación.
//
// reportes/{tipo_objetivoId_autorId}: un reporte por persona y por elemento. El ID incluye al autor,
//   así cada cuenta puede reportar una sola vez lo mismo y "3 reportes" son siempre 3 personas.
// revisiones/{tipo_objetivoId}: estado de moderación de cada elemento reportado o marcado.
//   { tipo, objetivoId, objetivoNombre, duenoId, comercioId, cantidadReportes, motivos,
//     ofensivo, oculto, enRevision, estado, motivoAutomatico, resolucion, fechaActualizacion }
//   estado: "abierta" (en la lista del equipo), "resuelta" o "pedido-bloqueo" (un empleado pidió
//   al administrador que bloquee la cuenta). Es de lectura pública: las páginas la usan para ocultar
//   lo que el equipo ocultó y mostrar "En revisión" en lo reportado.
// avisosModeracion/{id}: mensajes para el dueño del contenido (en revisión, advertencia, oculto).
//   El dueño los ve la próxima vez que abre SENDA.
//
// Cómo entra algo a revisión:
//   - Con palabras ofensivas o un producto no apto (ver palabrasProhibidas.js): entra en el momento,
//     oculto y con prioridad, aunque nadie lo haya reportado.
//   - Con 3 reportes de personas distintas: entra a la lista, sigue visible con la etiqueta
//     "En revisión" y el dueño recibe un aviso con los motivos.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  updateDoc
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../config/firebase.js";
import { COLECCIONES, MOTIVOS_REPORTE, REPORTES_PARA_REVISION, TIPOS_REPORTE, ORIGENES } from "../core/constants.js";
import { ErrorSenda } from "../core/errores.js";
import { datosAccion, referenciaNuevaAccion } from "./moderacionService.js";

export const ESTADOS_REVISION = Object.freeze({
  ABIERTA: "abierta",
  RESUELTA: "resuelta",
  PEDIDO_BLOQUEO: "pedido-bloqueo"
});

const NOMBRE_TIPO = {
  [TIPOS_REPORTE.COMENTARIO]: "comentario",
  [TIPOS_REPORTE.PRODUCTO]: "producto",
  [TIPOS_REPORTE.PRECIO]: "precio publicado",
  [TIPOS_REPORTE.CUENTA]: "cuenta"
};

export function idRevision(tipo, objetivoId) {
  return `${tipo}_${objetivoId}`;
}

export function textoMotivo(clave) {
  return MOTIVOS_REPORTE.find((m) => m.clave === clave)?.texto ?? clave;
}

// "Spam o publicidad (2), Contenido ofensivo (1)"
export function textoMotivos(motivos = {}) {
  return Object.entries(motivos)
    .filter(([, cantidad]) => cantidad > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([clave, cantidad]) => `${textoMotivo(clave)} (${cantidad})`)
    .join(", ");
}

// ---------- Lectura pública ----------

// Todas las revisiones en un Map por ID (<tipo>_<objetivoId>).
export async function mapaDeRevisiones() {
  const snapshot = await getDocs(collection(db, COLECCIONES.REVISIONES));
  return new Map(snapshot.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
}

// Estado de un elemento para mostrarlo: { oculto, enRevision }.
export function estadoDe(revisiones, tipo, objetivoId) {
  const revision = revisiones?.get(idRevision(tipo, objetivoId));
  return { oculto: Boolean(revision?.oculto), enRevision: Boolean(revision?.enRevision && !revision?.oculto) };
}

// ---------- Reportar ----------

// true si la cuenta ya reportó este elemento.
export async function yaReporto(tipo, objetivoId, uid) {
  const snapshot = await getDoc(doc(db, COLECCIONES.REPORTES, `${idRevision(tipo, objetivoId)}_${uid}`));
  return snapshot.exists();
}

// datos: { tipo, objetivoId, objetivoNombre, duenoId, comercioId, motivo, detalle }
// Guarda el reporte y suma uno en la revisión del elemento, todo en la misma escritura.
// Si con este reporte llega a 3, el elemento pasa a "En revisión" y el dueño recibe un aviso.
export async function reportar(datos, uid) {
  const { tipo, objetivoId, objetivoNombre = "", duenoId, comercioId = "", motivo, detalle = "" } = datos;
  const referenciaRevision = doc(db, COLECCIONES.REVISIONES, idRevision(tipo, objetivoId));
  const referenciaReporte = doc(db, COLECCIONES.REPORTES, `${idRevision(tipo, objetivoId)}_${uid}`);
  const [reporteAnterior, revisionAnterior] = await Promise.all([getDoc(referenciaReporte), getDoc(referenciaRevision)]);
  if (reporteAnterior.exists()) throw new ErrorSenda("senda/ya-reportado");

  const lote = writeBatch(db);
  lote.set(referenciaReporte, {
    tipo,
    objetivoId,
    comercioId,
    autorId: uid,
    motivo,
    detalle: detalle.trim().slice(0, 200),
    fecha: serverTimestamp()
  });

  if (!revisionAnterior.exists()) {
    lote.set(referenciaRevision, {
      tipo,
      objetivoId,
      objetivoNombre: String(objetivoNombre).slice(0, 160),
      duenoId,
      comercioId,
      cantidadReportes: 1,
      motivos: { [motivo]: 1 },
      ofensivo: false,
      oculto: false,
      enRevision: false,
      estado: ESTADOS_REVISION.ABIERTA,
      motivoAutomatico: "",
      resolucion: "",
      fechaActualizacion: serverTimestamp()
    });
  } else {
    const anterior = revisionAnterior.data();
    const cantidad = (anterior.cantidadReportes ?? 0) + 1;
    const motivos = { ...(anterior.motivos ?? {}), [motivo]: (anterior.motivos?.[motivo] ?? 0) + 1 };
    const enRevision = Boolean(anterior.enRevision) || cantidad >= REPORTES_PARA_REVISION;
    lote.update(referenciaRevision, {
      cantidadReportes: cantidad,
      motivos,
      enRevision,
      estado: anterior.estado === ESTADOS_REVISION.PEDIDO_BLOQUEO ? ESTADOS_REVISION.PEDIDO_BLOQUEO : ESTADOS_REVISION.ABIERTA,
      fechaActualizacion: serverTimestamp()
    });
    // Recién llegó a revisión: se avisa al dueño, con los motivos.
    if (enRevision && !anterior.enRevision) {
      lote.set(doc(collection(db, COLECCIONES.AVISOS_MODERACION)), {
        destinatarioId: anterior.duenoId,
        revisionId: referenciaRevision.id,
        tipo: "en-revision",
        texto:
          `Tu ${NOMBRE_TIPO[tipo]} «${String(anterior.objetivoNombre).slice(0, 80)}» recibió ${cantidad} reportes y está en revisión. ` +
          `Motivos: ${textoMotivos(motivos)}. Sigue visible con la etiqueta "En revisión" hasta que el equipo de SENDA lo revise. ` +
          "Si creés que es un error, comunicate con soporte técnico.",
        fecha: serverTimestamp(),
        leida: false
      });
    }
  }
  await lote.commit();
}

// ---------- Marcado automático (palabras ofensivas o producto no apto) ----------

// Agrega al lote la revisión de un contenido propio que tiene palabras no permitidas.
// Queda oculto y con prioridad en la lista del equipo. Lo llama quien publica, en la misma
// escritura que guarda el comentario o el producto.
export async function marcarEnLote(lote, { tipo, objetivoId, objetivoNombre, duenoId, comercioId = "", motivoAutomatico }) {
  const referencia = doc(db, COLECCIONES.REVISIONES, idRevision(tipo, objetivoId));
  const anterior = await getDoc(referencia);
  const datos = {
    objetivoNombre: String(objetivoNombre).slice(0, 160),
    ofensivo: true,
    oculto: true,
    enRevision: true,
    estado: ESTADOS_REVISION.ABIERTA,
    motivoAutomatico: motivoAutomatico.slice(0, 200),
    fechaActualizacion: serverTimestamp()
  };
  if (anterior.exists()) {
    lote.update(referencia, datos);
  } else {
    lote.set(referencia, {
      tipo,
      objetivoId,
      duenoId,
      comercioId,
      cantidadReportes: 0,
      motivos: {},
      resolucion: "",
      ...datos
    });
  }
}

// ---------- Lista de revisión (equipo) ----------

// Lo que está esperando al equipo: primero lo marcado automáticamente (prioridad), después lo que
// tiene más reportes. Los pedidos de bloqueo van aparte (los atiende el administrador).
export async function listarParaRevisar() {
  const snapshot = await getDocs(
    query(collection(db, COLECCIONES.REVISIONES), where("estado", "in", [ESTADOS_REVISION.ABIERTA, ESTADOS_REVISION.PEDIDO_BLOQUEO]))
  );
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    // Con menos de 3 reportes todavía no entra a la lista (salvo un pedido de bloqueo).
    .filter((r) => r.enRevision || r.estado === ESTADOS_REVISION.PEDIDO_BLOQUEO)
    .sort(
      (a, b) =>
        Number(b.ofensivo) - Number(a.ofensivo) ||
        b.cantidadReportes - a.cantidadReportes ||
        (b.fechaActualizacion?.toMillis?.() ?? 0) - (a.fechaActualizacion?.toMillis?.() ?? 0)
    );
}

// Detalle escrito por cada persona que reportó (solo el equipo puede leerlos).
export async function listarReportesDe(revision) {
  const snapshot = await getDocs(
    query(
      collection(db, COLECCIONES.REPORTES),
      where("tipo", "==", revision.tipo),
      where("objetivoId", "==", revision.objetivoId)
    )
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const RESET_REPORTES = { cantidadReportes: 0, motivos: {} };

function aviso(revision, tipo, texto) {
  return {
    destinatarioId: revision.duenoId,
    revisionId: revision.id,
    tipo,
    texto: texto.slice(0, 500),
    fecha: serverTimestamp(),
    leida: false
  };
}

function registro(revision, accion, motivo) {
  return {
    accion,
    objetivoTipo: revision.tipo,
    objetivoId: revision.objetivoId,
    objetivoNombre: revision.objetivoNombre,
    motivo,
    origen: ORIGENES.REVISION
  };
}

// Aplica una decisión del equipo sobre un elemento de la lista. Todo en una sola escritura:
// la revisión, el aviso al dueño (si corresponde) y la acción en el historial.
//   decision: "aprobar" | "advertir" | "ocultar" | "pedir-bloqueo" | "rechazar-pedido" | "bloqueada"
//   extra(lote, idAccion): agrega otras escrituras (por ejemplo, borrar el comentario o cambiar el
//   rol de la cuenta). idAccion es el ID de la acción del historial, por si hace falta referenciarla.
export async function decidir(revision, decision, motivo, actor, extra = null) {
  const nombre = `${NOMBRE_TIPO[revision.tipo]} «${String(revision.objetivoNombre).slice(0, 80)}»`;
  const referencia = doc(db, COLECCIONES.REVISIONES, revision.id);
  const lote = writeBatch(db);
  const base = { fechaActualizacion: serverTimestamp() };
  let accion;

  if (decision === "aprobar") {
    accion = "Reporte aprobado";
    lote.update(referencia, { ...base, ...RESET_REPORTES, estado: ESTADOS_REVISION.RESUELTA, enRevision: false, oculto: false, ofensivo: false, resolucion: `Aprobado: ${motivo}` });
    lote.set(doc(collection(db, COLECCIONES.AVISOS_MODERACION)), aviso(revision, "aprobado", `El equipo de SENDA revisó tu ${nombre} y está todo bien. Ya no está en revisión.`));
  } else if (decision === "advertir") {
    accion = "Advertencia enviada";
    lote.update(referencia, { ...base, ...RESET_REPORTES, estado: ESTADOS_REVISION.RESUELTA, enRevision: false, oculto: false, resolucion: `Advertencia: ${motivo}` });
    lote.set(doc(collection(db, COLECCIONES.AVISOS_MODERACION)), aviso(revision, "advertencia", `Advertencia del equipo de SENDA sobre tu ${nombre}: ${motivo}. Si se repite, la cuenta puede ser bloqueada.`));
  } else if (decision === "ocultar") {
    accion = revision.tipo === TIPOS_REPORTE.COMENTARIO ? "Comentario borrado" : "Contenido ocultado";
    lote.update(referencia, { ...base, estado: ESTADOS_REVISION.RESUELTA, enRevision: false, oculto: true, resolucion: `Ocultado: ${motivo}` });
    lote.set(doc(collection(db, COLECCIONES.AVISOS_MODERACION)), aviso(revision, "oculto", `El equipo de SENDA ${revision.tipo === TIPOS_REPORTE.COMENTARIO ? "borró" : "ocultó"} tu ${nombre}. Motivo: ${motivo}. Si creés que es un error, comunicate con soporte técnico.`));
  } else if (decision === "pedir-bloqueo") {
    accion = "Pedido de bloqueo";
    lote.update(referencia, { ...base, estado: ESTADOS_REVISION.PEDIDO_BLOQUEO, resolucion: `Pedido de bloqueo: ${motivo}` });
  } else if (decision === "rechazar-pedido") {
    accion = "Pedido de bloqueo rechazado";
    lote.update(referencia, { ...base, estado: ESTADOS_REVISION.ABIERTA, resolucion: `Bloqueo rechazado: ${motivo}` });
  } else if (decision === "bloqueada") {
    accion = "Cuenta bloqueada";
    lote.update(referencia, { ...base, estado: ESTADOS_REVISION.RESUELTA, enRevision: false, oculto: true, resolucion: `Cuenta bloqueada: ${motivo}` });
  }
  const referenciaAccion = referenciaNuevaAccion();
  if (extra) extra(lote, referenciaAccion.id);
  lote.set(referenciaAccion, datosAccion(actor, registro(revision, accion, motivo)));
  await lote.commit();
}

// Agrega al lote la revisión de la cuenta, oculta. Se usa al bloquear una cuenta: así sus
// comentarios y su perfil dejan de mostrarse aunque el reporte haya sido sobre otra cosa.
export function ocultarCuentaEnLote(lote, { uid, nombre, motivo }) {
  lote.set(
    doc(db, COLECCIONES.REVISIONES, idRevision(TIPOS_REPORTE.CUENTA, uid)),
    {
      tipo: TIPOS_REPORTE.CUENTA,
      objetivoId: uid,
      objetivoNombre: String(nombre).slice(0, 160),
      duenoId: uid,
      comercioId: "",
      cantidadReportes: 0,
      motivos: {},
      ofensivo: false,
      oculto: true,
      enRevision: false,
      estado: ESTADOS_REVISION.RESUELTA,
      motivoAutomatico: "",
      resolucion: `Cuenta bloqueada: ${motivo}`.slice(0, 400),
      fechaActualizacion: serverTimestamp()
    },
    { merge: true }
  );
}

// ---------- Avisos para el dueño del contenido ----------

export async function listarAvisosSinLeer(uid) {
  const snapshot = await getDocs(
    query(collection(db, COLECCIONES.AVISOS_MODERACION), where("destinatarioId", "==", uid), where("leida", "==", false))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function marcarAvisoLeido(id) {
  return updateDoc(doc(db, COLECCIONES.AVISOS_MODERACION, id), { leida: true });
}
