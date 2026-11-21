// Botón "Reportar" y tarjeta para elegir el motivo. Lo usan los comentarios, el detalle del producto
// (producto y precio de cada comercio), el perfil del comercio y el perfil público de una cuenta.
// También muestra los avisos de moderación que recibe el dueño de un contenido.
//
// Quién puede reportar: las cuentas personales y los comercios validados. Nadie reporta lo propio
// y cada cuenta reporta una sola vez el mismo elemento.

import { MOTIVOS_REPORTE, ROLES } from "../../core/constants.js";
import { manejarError } from "../../core/errores.js";
import { escaparHTML, mostrarAviso, marcarErrorCampo } from "../feedback.js";
import { obtenerCuentaActual } from "../../guards/sessionGuard.js";
import { reportar, yaReporto, listarAvisosSinLeer, marcarAvisoLeido } from "../../services/reportesService.js";

const ICONO_BANDERA =
  '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';

const TITULOS = {
  comentario: "Reportar comentario",
  producto: "Reportar producto",
  precio: "Reportar precio",
  cuenta: "Reportar cuenta"
};

// datos: { tipo, objetivoId, objetivoNombre, duenoId, comercioId }
// opciones: { texto: texto visible (si no, solo ícono), clase }
export function crearBotonReportar(datos, { texto = "", clase = "" } = {}) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = texto ? `btn btn--linea btn--chico boton-reportar ${clase}` : `boton-icono boton-reportar ${clase}`;
  boton.title = TITULOS[datos.tipo];
  boton.setAttribute("aria-label", `${TITULOS[datos.tipo]}${datos.objetivoNombre ? `: ${datos.objetivoNombre}` : ""}`);
  boton.innerHTML = texto ? `${ICONO_BANDERA}<span>${escaparHTML(texto)}</span>` : ICONO_BANDERA;
  boton.addEventListener("click", () => abrirReporte(datos));
  return boton;
}

export async function abrirReporte(datos) {
  const cuenta = await obtenerCuentaActual();
  if (!cuenta) {
    mostrarAviso("Para reportar, iniciá sesión con tu cuenta personal o la de tu comercio.", "error");
    return;
  }
  if (![ROLES.CLIENTE, ROLES.COMERCIO].includes(cuenta.rol)) {
    mostrarAviso("Reportan las cuentas personales y los comercios. El equipo de SENDA revisa desde su panel.", "error");
    return;
  }
  if (cuenta.uid === datos.duenoId) {
    mostrarAviso("No podés reportar algo publicado por tu propia cuenta.", "error");
    return;
  }
  try {
    if (await yaReporto(datos.tipo, datos.objetivoId, cuenta.uid)) {
      mostrarAviso("Ya reportaste esto. El equipo de SENDA lo va a revisar.");
      return;
    }
  } catch (error) {
    manejarError(error, "Consulta de reporte anterior");
  }
  const elegido = await pedirMotivo(datos);
  if (!elegido) return;
  try {
    await reportar({ ...datos, ...elegido }, cuenta.uid);
    mostrarAviso("Gracias. Tu reporte le llegó al equipo de SENDA.");
  } catch (error) {
    mostrarAviso(manejarError(error, "Reporte"), "error");
  }
}

// Tarjeta con los motivos posibles para ese tipo. Devuelve { motivo, detalle } o null.
function pedirMotivo(datos) {
  const motivos = MOTIVOS_REPORTE.filter((m) => m.tipos.includes(datos.tipo));
  return new Promise((resolve) => {
    const dialogo = document.createElement("dialog");
    dialogo.className = "modal modal--chico";
    dialogo.innerHTML = `
      <form class="modal__contenido" novalidate>
        <h2 class="modal__titulo">${escaparHTML(TITULOS[datos.tipo])}</h2>
        ${datos.objetivoNombre ? `<p class="modal__texto reporte__objetivo">${escaparHTML(datos.objetivoNombre)}</p>` : ""}
        <fieldset class="reporte__motivos">
          <legend class="campo__etiqueta">¿Por qué lo reportás?</legend>
          ${motivos
            .map(
              (m, i) => `
            <label class="opcion">
              <input type="radio" name="motivo" value="${m.clave}" ${i === 0 ? "checked" : ""}>
              <span>${escaparHTML(m.texto)}</span>
            </label>`
            )
            .join("")}
        </fieldset>
        <div class="campo">
          <label class="campo__etiqueta" for="reporte-detalle">Contanos un poco más <span class="reporte__opcional">(opcional)</span></label>
          <textarea class="campo__control" id="reporte-detalle" rows="3" maxlength="200"></textarea>
          <p class="campo__error" aria-live="polite"></p>
        </div>
        <p class="campo__ayuda">Con 3 reportes de personas distintas, el equipo de SENDA lo revisa. Tu reporte no se muestra a nadie más.</p>
        <div class="modal__acciones">
          <button type="button" class="btn btn--linea" value="no">Cancelar</button>
          <button type="submit" class="btn btn--peligro">Enviar reporte</button>
        </div>
      </form>`;
    document.body.append(dialogo);
    const detalle = dialogo.querySelector("#reporte-detalle");
    const opcional = dialogo.querySelector(".reporte__opcional");
    let respuesta = null;
    const motivoElegido = () => dialogo.querySelector("input[name=motivo]:checked").value;
    dialogo.querySelectorAll("input[name=motivo]").forEach((radio) =>
      radio.addEventListener("change", () => (opcional.hidden = motivoElegido() === "otro"))
    );
    dialogo.querySelector("button[value=no]").addEventListener("click", () => dialogo.close());
    dialogo.querySelector("form").addEventListener("submit", (evento) => {
      evento.preventDefault();
      // Con "Otro motivo" hay que explicar cuál.
      if (motivoElegido() === "otro" && detalle.value.trim().length < 5) {
        marcarErrorCampo(detalle, "Contanos cuál es el motivo (al menos 5 letras).");
        detalle.focus();
        return;
      }
      respuesta = { motivo: motivoElegido(), detalle: detalle.value.trim() };
      dialogo.close();
    });
    dialogo.addEventListener("close", () => {
      dialogo.remove();
      resolve(respuesta);
    });
    dialogo.showModal();
  });
}

// ---------- Avisos de moderación para el dueño del contenido ----------

const TITULOS_AVISO = {
  "en-revision": "Contenido en revisión",
  advertencia: "Advertencia del equipo de SENDA",
  oculto: "Contenido ocultado por SENDA",
  aprobado: "Revisión terminada"
};

let avisosRevisados = false;

// Muestra los avisos sin leer en una tarjeta y los marca como leídos al cerrarla.
export async function revisarAvisosDeModeracion(uid) {
  if (avisosRevisados || !uid) return;
  avisosRevisados = true;
  try {
    const avisos = await listarAvisosSinLeer(uid);
    if (avisos.length === 0) return;
    await mostrarAvisos(avisos);
    await Promise.all(avisos.map((aviso) => marcarAvisoLeido(aviso.id)));
  } catch (error) {
    manejarError(error, "Avisos de moderación");
  }
}

function mostrarAvisos(avisos) {
  return new Promise((resolve) => {
    const dialogo = document.createElement("dialog");
    dialogo.className = "modal";
    dialogo.innerHTML = `
      <div class="modal__contenido">
        <h2 class="modal__titulo">${avisos.length === 1 ? "Tenés un aviso de SENDA" : `Tenés ${avisos.length} avisos de SENDA`}</h2>
        <ul class="avisos-moderacion">
          ${avisos
            .map(
              (aviso) => `
            <li class="avisos-moderacion__item avisos-moderacion__item--${escaparHTML(aviso.tipo)}">
              <strong>${escaparHTML(TITULOS_AVISO[aviso.tipo] ?? "Aviso")}</strong>
              <p>${escaparHTML(aviso.texto)}</p>
            </li>`
            )
            .join("")}
        </ul>
        <div class="modal__acciones">
          <button type="button" class="btn btn--primario">Entendido</button>
        </div>
      </div>`;
    document.body.append(dialogo);
    dialogo.querySelector("button").addEventListener("click", () => dialogo.close());
    dialogo.addEventListener("close", () => {
      dialogo.remove();
      resolve();
    });
    dialogo.showModal();
  });
}
