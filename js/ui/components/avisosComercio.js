// Aviso que ve el comercio cuando el administrador eliminó uno o más de sus productos.
// Se muestra la primera vez que abre SENDA con su sesión iniciada después de la eliminación,
// ya sea en una página pública (barra con su cuenta) o en su panel de gestión.
// Al cerrar el aviso, las notificaciones quedan como leídas y no vuelven a aparecer.

import { manejarError } from "../../core/errores.js";
import { TIPOS_NOTIFICACION } from "../../core/constants.js";
import { escaparHTML } from "../feedback.js";
import {
  listarNotificacionesPendientes,
  marcarNotificacionesLeidas
} from "../../services/notificacionesService.js";

// Evita mostrar el aviso dos veces en la misma página.
let yaRevisado = false;

export async function revisarAvisosDelComercio(comercioId) {
  if (yaRevisado || !comercioId) return;
  yaRevisado = true;
  try {
    const avisos = (await listarNotificacionesPendientes(comercioId)).filter(
      (aviso) => aviso.tipo === TIPOS_NOTIFICACION.PRODUCTO_ELIMINADO
    );
    if (avisos.length === 0) return;
    await mostrarAvisoEliminados(avisos);
    await marcarNotificacionesLeidas(avisos.map((aviso) => aviso.id));
  } catch (error) {
    // Si falla, el aviso vuelve a aparecer la próxima vez que se abra SENDA.
    manejarError(error, "Avisos del comercio");
  }
}

function mostrarAvisoEliminados(avisos) {
  return new Promise((resolve) => {
    const uno = avisos.length === 1;
    const dialogo = document.createElement("dialog");
    dialogo.className = "modal modal--chico";
    dialogo.setAttribute("aria-labelledby", "titulo-aviso-eliminados");
    dialogo.innerHTML = `
      <div class="modal__contenido">
        <h2 class="modal__titulo" id="titulo-aviso-eliminados">${uno ? "SENDA eliminó un producto" : "SENDA eliminó algunos productos"}</h2>
        <p class="modal__texto">${uno ? "Este producto ha sido eliminado por SENDA" : "Estos productos han sido eliminados por SENDA"} y ya no se muestra en tu comercio.</p>
        <ul class="aviso-eliminados__lista">
          ${avisos.map((aviso) => `<li><strong>${escaparHTML(aviso.productoNombre || "Producto sin nombre")}</strong></li>`).join("")}
        </ul>
        <p class="modal__texto">Si considerás que pudo haber sido un error, comunicate con soporte técnico.</p>
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
