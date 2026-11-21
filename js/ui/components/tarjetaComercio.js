// Tarjetas de comercio: con el precio de un producto ("Precios destacados")
// y como cuenta del comercio en los resultados de búsqueda.

import { RUTAS } from "../../core/constants.js";
import { escaparHTML, iniciales, precioTexto } from "../feedback.js";

// Texto gris debajo del nombre de un comercio que saltó la validación.
// comercio.validado lo calcula armarCatalogo (preciosService) a partir del rol.
export function htmlNoValidado(comercio, clase = "") {
  return comercio.validado === false ? `<span class="no-validado ${clase}">Comercio no validado</span>` : "";
}

// Insignia verde para los comercios que actualizaron algún precio o stock en el día.
// comercio.actualizadoHoy lo calcula armarCatalogo (preciosService).
export function htmlActualizadoHoy(comercio) {
  return comercio?.actualizadoHoy
    ? '<span class="insignia-hoy" title="Este comercio actualizó sus precios hoy">Actualizado hoy</span>'
    : "";
}

// Foto del comercio o, si todavía no subió una, sus iniciales.
export function htmlAvatarComercio(comercio, clase = "") {
  return comercio?.foto
    ? `<img class="avatar avatar--foto ${clase}" src="${escaparHTML(comercio.foto)}" alt="">`
    : `<span class="avatar ${clase}" aria-hidden="true">${escaparHTML(iniciales(comercio?.nombre || "?"))}</span>`;
}

export function rutaPerfilComercio(comercioId) {
  return `${RUTAS.PERFIL_COMERCIO}?id=${encodeURIComponent(comercioId)}`;
}

// datos: { comercio, precio, esMejorPrecio }
export function crearTarjetaComercio({ comercio, precio, esMejorPrecio = false }) {
  const tarjeta = document.createElement("a");
  tarjeta.className = `tarjeta-comercio${esMejorPrecio ? " tarjeta-comercio--mejor" : ""}`;
  tarjeta.href = rutaPerfilComercio(comercio.id);
  tarjeta.innerHTML = `
    ${esMejorPrecio ? '<span class="tarjeta-comercio__sello">Mejor precio</span>' : ""}
    ${htmlAvatarComercio(comercio)}
    <span class="tarjeta-comercio__nombre">${escaparHTML(comercio.nombre)}</span>
    ${htmlNoValidado(comercio)}
    <span class="pildora-precio">${precioTexto(precio.precioFinal)}</span>
    <span class="tarjeta-comercio__stock">${precio.disponible ? "En stock" : "Sin stock"}</span>`;
  return tarjeta;
}

// datos: { comercio, cantidadProductos }
export function crearTarjetaCuentaComercio({ comercio, cantidadProductos }) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "cuenta-comercio tarjeta";
  const textoCantidad = cantidadProductos === 1 ? "1 producto publicado" : `${cantidadProductos} productos publicados`;
  tarjeta.innerHTML = `
    ${htmlAvatarComercio(comercio, "avatar--grande")}
    <div class="cuenta-comercio__datos">
      <h3 class="cuenta-comercio__nombre">${escaparHTML(comercio.nombre)}</h3>
      ${htmlActualizadoHoy(comercio)}
      ${htmlNoValidado(comercio)}
      <p class="cuenta-comercio__detalle">${escaparHTML(comercio.direccion || "Dirección sin cargar")}${comercio.localidad ? ` · ${escaparHTML(comercio.localidad)}` : ""}</p>
      <p class="cuenta-comercio__detalle">${textoCantidad}</p>
    </div>
    <a class="btn btn--primario btn--chico" href="${rutaPerfilComercio(comercio.id)}">Ver comercio</a>`;
  return tarjeta;
}
