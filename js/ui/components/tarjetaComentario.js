// Tarjeta de un comentario en un perfil (público o propio).
// Muestra el autor, debajo del autor el producto donde se publicó (y el comercio, si lo indicó),
// el texto y la fecha. El producto lleva al detalle con los comentarios abiertos.

import { RUTAS } from "../../core/constants.js";
import { escaparHTML, iniciales, textoFecha } from "../feedback.js";
import { rutaDetalleProducto } from "./tarjetaProducto.js";

const ICONO_BORRAR =
  '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';

export function rutaPerfilPublico(uid) {
  return `${RUTAS.PERFIL_PUBLICO}?id=${encodeURIComponent(uid)}`;
}

// Foto o iniciales de una cuenta personal.
export function htmlFotoCliente(cliente, clase = "") {
  return cliente?.foto
    ? `<img class="${clase}" src="${escaparHTML(cliente.foto)}" alt="">`
    : `<span class="avatar ${clase}" aria-hidden="true">${escaparHTML(iniciales(cliente?.usuario || "?"))}</span>`;
}

// alBorrar: si se pasa, aparece el tachito (comentarios propios).
export function crearTarjetaComentario({ comentario, autor, producto, comercio, alBorrar = null }) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta-comentario tarjeta";
  const destino = producto
    ? `<a href="${rutaDetalleProducto(producto.id)}#comentarios">${escaparHTML(producto.nombre)}</a>`
    : "un producto que ya no está publicado";

  tarjeta.innerHTML = `
    <header class="tarjeta-comentario__cabecera">
      ${htmlFotoCliente(autor, "tarjeta-comentario__foto")}
      <div class="tarjeta-comentario__autor">
        <a class="tarjeta-comentario__usuario" href="${rutaPerfilPublico(comentario.clienteId)}">@${escaparHTML(autor?.usuario ?? "")}</a>
        <p class="tarjeta-comentario__donde">
          <svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          en ${destino}${comercio ? ` · Sobre ${escaparHTML(comercio.nombre)}` : ""}
        </p>
      </div>
      <span class="tarjeta-comentario__fecha">${escaparHTML(textoFecha(comentario.fecha))}</span>
    </header>
    <p class="tarjeta-comentario__texto">${escaparHTML(comentario.texto)}</p>`;

  if (alBorrar) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton-icono boton-icono--rechazar tarjeta-comentario__borrar";
    boton.title = "Borrar mi comentario";
    boton.setAttribute("aria-label", "Borrar mi comentario");
    boton.innerHTML = ICONO_BORRAR;
    boton.addEventListener("click", () => alBorrar(comentario));
    tarjeta.querySelector(".tarjeta-comentario__cabecera").append(boton);
  }
  return tarjeta;
}
