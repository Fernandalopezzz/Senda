// Sección "Revisión" del panel del equipo: lo reportado y lo marcado automáticamente.
// La ven el administrador y los empleados con el permiso "Revisar reportes".
//
// Orden: primero los pedidos de bloqueo (para el administrador), después lo marcado por palabras
// no permitidas (prioridad) y después lo que tiene más reportes.
//
// Decisiones posibles:
//   Aprobar:          está todo bien. Se quita "En revisión" y se avisa al dueño.
//   Advertir:         sigue visible y el dueño recibe una advertencia con el motivo.
//   Ocultar o borrar: el comentario se borra; un producto, un precio o una cuenta se ocultan.
//   Bloquear cuenta:  el empleado se lo pide al administrador. El administrador la bloquea.
// Cada decisión pide un motivo y queda en el historial de moderación.

import { ROLES, TIPOS_REPORTE, RUTAS, COLECCIONES } from "../../core/constants.js";
import { manejarError } from "../../core/errores.js";
import { escaparHTML, mostrarCargando, mostrarError, mostrarVacio, mostrarAviso, confirmar, textoFecha } from "../feedback.js";
import {
  listarParaRevisar,
  listarReportesDe,
  decidir,
  ocultarCuentaEnLote,
  textoMotivos,
  textoMotivo,
  ESTADOS_REVISION
} from "../../services/reportesService.js";
import { obtenerUsuario } from "../../services/usuariosService.js";
import { obtenerCliente } from "../../services/clientesService.js";
import { obtenerComercio } from "../../services/comerciosService.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "../../config/firebase.js";

const $ = (id) => document.getElementById(id);

const NOMBRE_TIPO = {
  [TIPOS_REPORTE.COMENTARIO]: "Comentario",
  [TIPOS_REPORTE.PRODUCTO]: "Producto",
  [TIPOS_REPORTE.PRECIO]: "Precio publicado",
  [TIPOS_REPORTE.CUENTA]: "Cuenta"
};

const revision = {
  lista: $("lista-revision"),
  resumen: $("resumen-revision"),
  contador: $("contador-revision"),
  items: [],
  actor: null
};

function esAdmin() {
  return revision.actor?.rol === ROLES.ADMIN;
}

export async function cargarRevision() {
  mostrarCargando(revision.lista, "Cargando la lista de revisión...");
  try {
    const items = await listarParaRevisar();
    // El administrador ve primero los pedidos de bloqueo que le mandaron los empleados.
    revision.items = esAdmin()
      ? [...items].sort((a, b) => Number(b.estado === ESTADOS_REVISION.PEDIDO_BLOQUEO) - Number(a.estado === ESTADOS_REVISION.PEDIDO_BLOQUEO))
      : items;
    renderizar();
  } catch (error) {
    mostrarError(revision.lista, manejarError(error, "Lista de revisión"), cargarRevision);
  }
}

function renderizar() {
  const total = revision.items.length;
  const prioridad = revision.items.filter((r) => r.ofensivo).length;
  const pedidos = revision.items.filter((r) => r.estado === ESTADOS_REVISION.PEDIDO_BLOQUEO).length;
  revision.resumen.textContent =
    total === 0
      ? "No hay nada para revisar."
      : `${total} ${total === 1 ? "elemento" : "elementos"}` +
        (prioridad ? ` · ${prioridad} con prioridad` : "") +
        (pedidos ? ` · ${pedidos} ${pedidos === 1 ? "pedido" : "pedidos"} de bloqueo` : "");
  revision.contador.hidden = total === 0;
  revision.contador.textContent = total;
  if (total === 0) {
    mostrarVacio(revision.lista, "No hay nada para revisar", "Cuando algo tenga 3 reportes o palabras no permitidas, aparece acá.");
    return;
  }
  revision.lista.replaceChildren(...revision.items.map(crearTarjeta));
}

function etiquetas(item) {
  const lista = [];
  if (item.estado === ESTADOS_REVISION.PEDIDO_BLOQUEO) lista.push('<span class="chip chip--rechazado">Pedido de bloqueo</span>');
  if (item.ofensivo) lista.push('<span class="chip chip--rechazado">Prioridad</span>');
  if (item.oculto) lista.push('<span class="chip chip--pendiente">Oculto al público</span>');
  else if (item.enRevision) lista.push('<span class="chip chip--pendiente">Visible con "En revisión"</span>');
  else lista.push('<span class="chip">Visible</span>');
  return lista.join("");
}

function crearTarjeta(item) {
  const tarjeta = document.createElement("article");
  tarjeta.className = `revision__item tarjeta${item.ofensivo ? " revision__item--prioridad" : ""}`;
  const motivos = textoMotivos(item.motivos);
  tarjeta.innerHTML = `
    <header class="revision__cabecera">
      <span class="revision__tipo">${NOMBRE_TIPO[item.tipo] ?? item.tipo}</span>
      ${etiquetas(item)}
      <span class="revision__cantidad">${item.cantidadReportes} ${item.cantidadReportes === 1 ? "reporte" : "reportes"}</span>
    </header>
    <p class="revision__nombre">${escaparHTML(item.objetivoNombre || "Sin nombre")}</p>
    ${item.motivoAutomatico ? `<p class="revision__dato"><strong>Marcado automáticamente.</strong> ${escaparHTML(item.motivoAutomatico)}</p>` : ""}
    ${motivos ? `<p class="revision__dato"><strong>Motivos:</strong> ${escaparHTML(motivos)}</p>` : ""}
    ${item.resolucion ? `<p class="revision__dato"><strong>Última decisión:</strong> ${escaparHTML(item.resolucion)}</p>` : ""}
    <p class="revision__dato revision__fecha">Actualizado ${escaparHTML(textoFecha(item.fechaActualizacion))}</p>
    <details class="revision__reportes">
      <summary>Ver lo que escribió cada persona</summary>
      <ul class="revision__lista-reportes"><li>Cargando...</li></ul>
    </details>
    <div class="revision__acciones"></div>`;

  tarjeta.querySelector("details").addEventListener("toggle", (evento) => {
    if (evento.target.open) cargarReportes(item, tarjeta.querySelector(".revision__lista-reportes"));
  }, { once: true });

  const acciones = tarjeta.querySelector(".revision__acciones");
  const ver = document.createElement("button");
  ver.type = "button";
  ver.className = "btn btn--linea btn--chico";
  ver.textContent = "Ver";
  ver.addEventListener("click", () => abrirContenido(item));
  acciones.append(ver);

  const pedido = item.estado === ESTADOS_REVISION.PEDIDO_BLOQUEO;
  if (pedido && !esAdmin()) {
    acciones.insertAdjacentHTML("beforeend", '<span class="revision__espera">Esperando al administrador</span>');
    return tarjeta;
  }
  const botones = pedido
    ? [
        ["Bloquear cuenta", "btn--peligro", () => bloquear(item)],
        ["Rechazar pedido", "btn--linea", () => aplicar(item, "rechazar-pedido")]
      ]
    : [
        ["Aprobar", "btn--primario", () => aplicar(item, "aprobar")],
        ["Advertir", "btn--amarillo", () => aplicar(item, "advertir")],
        [item.tipo === TIPOS_REPORTE.COMENTARIO ? "Borrar" : "Ocultar", "btn--peligro", () => aplicar(item, "ocultar")],
        [esAdmin() ? "Bloquear cuenta" : "Pedir bloqueo de la cuenta", "btn--linea", () => (esAdmin() ? bloquear(item) : aplicar(item, "pedir-bloqueo"))]
      ];
  for (const [texto, clase, alHacerClic] of botones) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = `btn btn--chico ${clase}`;
    boton.textContent = texto;
    boton.addEventListener("click", alHacerClic);
    acciones.append(boton);
  }
  return tarjeta;
}

async function cargarReportes(item, lista) {
  try {
    const reportes = await listarReportesDe(item);
    lista.innerHTML = reportes.length
      ? reportes
          .map((r) => `<li><strong>${escaparHTML(textoMotivo(r.motivo))}</strong>${r.detalle ? `: ${escaparHTML(r.detalle)}` : ""} <span class="revision__fecha">· ${escaparHTML(textoFecha(r.fecha))}</span></li>`)
          .join("")
      : "<li>No tiene reportes: lo marcó el sistema por sus palabras.</li>";
  } catch (error) {
    lista.innerHTML = `<li>${escaparHTML(manejarError(error, "Reportes de un elemento"))}</li>`;
  }
}

// Abre en otra pestaña la página donde se ve el contenido.
async function abrirContenido(item) {
  const ventana = window.open("about:blank", "_blank");
  try {
    let destino = RUTAS.INICIO;
    if (item.tipo === TIPOS_REPORTE.PRODUCTO) destino = `${RUTAS.DETALLE_PRODUCTO}?id=${encodeURIComponent(item.objetivoId)}`;
    if (item.tipo === TIPOS_REPORTE.PRECIO) destino = `${RUTAS.PERFIL_COMERCIO}?id=${encodeURIComponent(item.duenoId)}`;
    if (item.tipo === TIPOS_REPORTE.COMENTARIO) {
      const comentario = await getDoc(doc(db, COLECCIONES.COMENTARIOS, item.objetivoId));
      destino = comentario.exists()
        ? `${RUTAS.DETALLE_PRODUCTO}?id=${encodeURIComponent(comentario.data().productoId)}#comentarios`
        : `${RUTAS.PERFIL_PUBLICO}?id=${encodeURIComponent(item.duenoId)}`;
    }
    if (item.tipo === TIPOS_REPORTE.CUENTA) {
      const usuario = await obtenerUsuario(item.objetivoId);
      destino = [ROLES.CLIENTE, ROLES.BLOQUEADO].includes(usuario?.rol)
        ? `${RUTAS.PERFIL_PUBLICO}?id=${encodeURIComponent(item.objetivoId)}`
        : `${RUTAS.PERFIL_COMERCIO}?id=${encodeURIComponent(item.objetivoId)}`;
    }
    if (ventana) ventana.location.href = destino;
    else window.location.href = destino;
  } catch (error) {
    ventana?.close();
    mostrarAviso(manejarError(error, "Abrir contenido reportado"), "error");
  }
}

const TEXTOS = {
  aprobar: {
    titulo: "Aprobar",
    texto: "El contenido cumple las normas. Se quita la etiqueta \"En revisión\", vuelve a verse si estaba oculto y se le avisa al dueño.",
    textoAceptar: "Aprobar",
    motivo: { etiqueta: "Comentario para el historial", obligatorio: false }
  },
  advertir: {
    titulo: "Advertir al dueño",
    texto: "El contenido sigue visible y el dueño recibe una advertencia con este motivo la próxima vez que abra SENDA.",
    textoAceptar: "Enviar advertencia",
    motivo: { etiqueta: "Motivo de la advertencia (lo lee el dueño)", obligatorio: true }
  },
  ocultar: {
    titulo: "Ocultar o borrar",
    texto: "Un comentario se borra. Un producto, un precio o una cuenta dejan de mostrarse al público. El dueño recibe un aviso con el motivo.",
    textoAceptar: "Confirmar",
    peligro: true,
    motivo: { etiqueta: "Motivo (lo lee el dueño)", obligatorio: true }
  },
  "pedir-bloqueo": {
    titulo: "Pedir el bloqueo de la cuenta",
    texto: "El pedido le llega al administrador, que decide si bloquea la cuenta. Mientras tanto el contenido queda como está.",
    textoAceptar: "Enviar pedido",
    motivo: { etiqueta: "Motivo del pedido", obligatorio: true }
  },
  "rechazar-pedido": {
    titulo: "Rechazar el pedido de bloqueo",
    texto: "La cuenta no se bloquea y el elemento vuelve a la lista de revisión.",
    textoAceptar: "Rechazar pedido",
    motivo: { etiqueta: "Motivo", obligatorio: true }
  }
};

async function aplicar(item, decision) {
  const motivo = await confirmar(TEXTOS[decision]);
  if (motivo === null) return;
  try {
    const extra =
      decision === "ocultar" && item.tipo === TIPOS_REPORTE.COMENTARIO
        ? (lote) => lote.delete(doc(db, COLECCIONES.COMENTARIOS, item.objetivoId))
        : null;
    await decidir(item, decision, motivo || "Sin comentario", revision.actor, extra);
    mostrarAviso(
      {
        aprobar: "Aprobaste el contenido.",
        advertir: "Le enviaste la advertencia al dueño.",
        ocultar: item.tipo === TIPOS_REPORTE.COMENTARIO ? "Borraste el comentario." : "Ocultaste el contenido.",
        "pedir-bloqueo": "Le enviaste el pedido de bloqueo al administrador.",
        "rechazar-pedido": "Rechazaste el pedido de bloqueo."
      }[decision]
    );
    await cargarRevision();
  } catch (error) {
    mostrarAviso(manejarError(error, "Decisión de revisión"), "error");
  }
}

// Solo el administrador. Un comercio pasa a "rechazado" (Bloqueados) y una cuenta personal a "bloqueado".
// En los dos casos su perfil y sus comentarios dejan de mostrarse.
async function bloquear(item) {
  const motivo = await confirmar({
    titulo: "Bloquear la cuenta",
    texto: "La cuenta no va a poder ingresar a SENDA y su contenido deja de mostrarse. Un comercio bloqueado aparece en \"Bloqueados\", donde se puede volver a habilitar o eliminar.",
    textoAceptar: "Bloquear cuenta",
    peligro: true,
    grande: true,
    motivo: { etiqueta: "Motivo del bloqueo", obligatorio: true }
  });
  if (motivo === null) return;
  try {
    const usuario = await obtenerUsuario(item.duenoId);
    const esPersonal = [ROLES.CLIENTE, ROLES.BLOQUEADO].includes(usuario?.rol);
    const rolNuevo = esPersonal ? ROLES.BLOQUEADO : ROLES.RECHAZADO;
    const nombreCuenta = esPersonal
      ? `@${(await obtenerCliente(item.duenoId))?.usuario ?? "cuenta"}`
      : (await obtenerComercio(item.duenoId))?.nombre ?? "Comercio";
    await decidir(item, "bloqueada", motivo, revision.actor, (lote, idAccion) => {
      if (usuario && ![ROLES.ADMIN, ROLES.EMPLEADO].includes(usuario.rol)) {
        lote.update(doc(db, COLECCIONES.USUARIOS, item.duenoId), { rol: rolNuevo, historialId: idAccion });
      }
      if (item.tipo !== TIPOS_REPORTE.CUENTA) ocultarCuentaEnLote(lote, { uid: item.duenoId, nombre: nombreCuenta, motivo });
    });
    mostrarAviso("Bloqueaste la cuenta.");
    await cargarRevision();
  } catch (error) {
    mostrarAviso(manejarError(error, "Bloqueo de cuenta desde revisión"), "error");
  }
}

export function prepararRevision(actor) {
  revision.actor = actor;
  $("boton-actualizar-revision").addEventListener("click", cargarRevision);
}
