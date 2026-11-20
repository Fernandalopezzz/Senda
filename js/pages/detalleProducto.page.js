// Detalle de un producto: mejor precio, comercios que lo venden, opiniones de clientes
// y productos similares (los similares se eligen por la marca del producto).
// Se abre con detalle-producto.html?id=<id del producto>.

import { RUTAS } from "../core/constants.js";
import { normalizarTexto } from "../core/validators.js";
import { manejarError } from "../core/errores.js";
import { verificarConfiguracion } from "../services/authService.js";
import { cargarCatalogo } from "../services/preciosService.js";
import {
  escaparHTML,
  precioHTML,
  precioTexto,
  textoActualizacion,
  mostrarCargando,
  mostrarError,
  mostrarVacio
} from "../ui/feedback.js";
import { crearImagenProducto, crearBotonFavorito, crearTarjetaResumen } from "../ui/components/tarjetaProducto.js";
import { rutaPerfilComercio, htmlNoValidado, htmlAvatarComercio } from "../ui/components/tarjetaComercio.js";
import { prepararBarraPublica } from "../guards/sessionGuard.js";
import { montarOpiniones } from "../ui/components/opiniones.js";
import { registrarProductoVisto } from "../services/historialService.js";

const CANTIDAD_SIMILARES = 5;
const $ = (id) => document.getElementById(id);

const elementos = {
  barra: $("barra-publica"),
  volver: $("enlace-volver"),
  contenido: $("contenido-detalle"),
  seccionComercios: $("seccion-comercios"),
  resumenDonde: $("resumen-donde"),
  listaDonde: $("lista-donde"),
  zonaVerComentarios: $("zona-ver-comentarios"),
  botonVerComentarios: $("boton-ver-comentarios"),
  seccionOpiniones: $("seccion-opiniones"),
  seccionSimilares: $("seccion-similares"),
  listaSimilares: $("lista-similares")
};

function renderizarProducto(resumen) {
  const { producto, disponibles, hayStock } = resumen;
  document.title = `${producto.nombre} · SENDA`;
  const mejor = disponibles[0];
  const descuento = Number(mejor?.precio.porcentajeDescuento) || 0;

  const tarjeta = document.createElement("article");
  tarjeta.className = "detalle tarjeta";

  const columnaImagen = document.createElement("div");
  columnaImagen.className = "detalle__imagen";
  columnaImagen.append(crearImagenProducto(producto.imagen, producto.nombre, "imagen-producto--detalle"));

  const ahorro = disponibles.length >= 2
    ? disponibles[disponibles.length - 1].precio.precioFinal - mejor.precio.precioFinal
    : 0;

  const info = document.createElement("div");
  info.className = "detalle__info";
  info.innerHTML = `
    <div class="detalle__titulo">
      <h1 class="detalle__nombre">${escaparHTML(producto.nombre)}</h1>
    </div>
    ${producto.marca || producto.presentacion
      ? `<p class="detalle__marca">${[producto.marca, producto.presentacion].filter(Boolean).map(escaparHTML).join(" · ")}</p>`
      : ""}
    ${producto.descripcion ? `<p class="detalle__descripcion">${escaparHTML(producto.descripcion)}</p>` : ""}
    ${producto.etiquetas?.length
      ? `<ul class="detalle__etiquetas" aria-label="Etiquetas del producto">${producto.etiquetas.map((e) => `<li>${escaparHTML(e)}</li>`).join("")}</ul>`
      : ""}
    <div class="opiniones__reacciones" id="reacciones-producto"></div>
    <div class="detalle__chips">
      ${descuento > 0 ? '<span class="chip chip--rechazado">En oferta</span>' : ""}
      <span class="chip ${hayStock ? "chip--aprobado" : "chip--pendiente"}">${hayStock ? "Disponible" : "Sin stock por ahora"}</span>
    </div>
    ${
      mejor
        ? `<div class="mejor-precio">
            <p class="mejor-precio__etiqueta">Mejor precio</p>
            <p class="mejor-precio__valor">
              <span class="precio precio--grande">${precioHTML(mejor.precio.precioFinal)}</span>
              ${descuento > 0 ? `<span class="precio-anterior">${precioTexto(mejor.precio.precioOriginal)}</span><span class="fila-producto__descuento">-${descuento}%</span>` : ""}
            </p>
            <p class="mejor-precio__vendedor">Vendido por <strong>${escaparHTML(mejor.comercio.nombre)}</strong> · En stock</p>
            ${htmlNoValidado(mejor.comercio)}
            <a class="btn btn--oscuro btn--chico" href="${rutaPerfilComercio(mejor.comercio.id)}">Ver comercio</a>
          </div>`
        : '<p class="mensaje mensaje--info">Ningún comercio tiene stock de este producto en este momento.</p>'
    }
    ${ahorro > 0 ? `<p class="detalle__ahorro">Ahorrás hasta <strong>${precioTexto(ahorro)}</strong> eligiendo el comercio más barato.</p>` : ""}`;

  info.querySelector(".detalle__titulo").append(crearBotonFavorito(producto, "boton-favorito--en-linea"));
  tarjeta.append(columnaImagen, info);
  elementos.contenido.replaceChildren(tarjeta);
}

function renderizarComercios(resumen) {
  const cantidad = resumen.ofertas.length;
  elementos.resumenDonde.textContent = `${cantidad === 1 ? "1 comercio ofrece" : `${cantidad} comercios ofrecen`} este producto. Primero los que tienen stock, de menor a mayor precio.`;
  elementos.listaDonde.innerHTML = resumen.ofertas
    .map(({ precio, comercio }, indice) => {
      const datos = [comercio.direccion, comercio.horario].filter((d) => d?.trim()).map(escaparHTML).join(" · ");
      const esMejor = indice === 0 && precio.disponible;
      return `
        <li class="fila-comercio${precio.disponible ? "" : " fila-comercio--sin-stock"}">
          ${htmlAvatarComercio(comercio)}
          <div class="fila-comercio__datos">
            <a class="fila-comercio__nombre" href="${rutaPerfilComercio(comercio.id)}">${escaparHTML(comercio.nombre)}</a>
            ${htmlNoValidado(comercio)}
            <p class="fila-comercio__detalle">${datos || "Datos de contacto sin cargar"}</p>
            <p class="fila-comercio__detalle">${textoActualizacion(precio.fechaActualizacion)}</p>
          </div>
          <span class="chip ${precio.disponible ? "chip--aprobado" : "chip--rechazado"}">${precio.disponible ? "En stock" : "Sin stock"}</span>
          <span class="${esMejor ? "pildora-precio" : "fila-comercio__precio"}">${precioTexto(precio.precioFinal)}</span>
        </li>`;
    })
    .join("");
  elementos.seccionComercios.hidden = false;
}

function renderizarSimilares(resumen, catalogo) {
  const similares = catalogo.productos
    .filter((r) => r.producto.id !== resumen.producto.id && normalizarTexto(r.producto.marca) === normalizarTexto(resumen.producto.marca))
    .sort((a, b) => Number(b.hayStock) - Number(a.hayStock) || a.precioDesde - b.precioDesde)
    .slice(0, CANTIDAD_SIMILARES);
  elementos.seccionSimilares.hidden = similares.length === 0;
  elementos.listaSimilares.replaceChildren(...similares.map(crearTarjetaResumen));
}

async function cargar() {
  const productoId = new URLSearchParams(window.location.search).get("id");
  if (!productoId) {
    mostrarVacio(elementos.contenido, "No se indicó qué producto mostrar", "Buscá el producto desde el inicio.");
    return;
  }

  mostrarCargando(elementos.contenido, "Cargando producto...");
  try {
    verificarConfiguracion();
    const catalogo = await cargarCatalogo();
    const resumen = catalogo.productos.find((r) => r.producto.id === productoId);
    if (!resumen) {
      mostrarVacio(elementos.contenido, "No encontramos este producto", "Puede que ningún comercio lo tenga publicado.");
      return;
    }
    renderizarProducto(resumen);
    registrarProductoVisto(productoId).catch((error) => manejarError(error, "Historial de productos vistos"));
    renderizarComercios(resumen);
    renderizarSimilares(resumen, catalogo);
    elementos.zonaVerComentarios.hidden = false;
    montarOpiniones(
      {
        reacciones: $("reacciones-producto"),
        zonaComentar: $("zona-comentar"),
        lista: $("lista-comentarios"),
        cantidad: $("cantidad-comentarios")
      },
      { producto: resumen.producto, comercios: resumen.ofertas.map(({ comercio }) => comercio) }
    );
  } catch (error) {
    mostrarError(elementos.contenido, manejarError(error, "Carga del detalle de producto"), cargar);
  }
}

// Los comentarios están cerrados hasta que se presiona "Ver comentarios".
// Si se llega con #comentarios en la dirección (por ejemplo, desde un perfil), se abren solos.
function mostrarComentarios(mostrar) {
  elementos.seccionOpiniones.hidden = !mostrar;
  elementos.botonVerComentarios.setAttribute("aria-expanded", String(mostrar));
  $("texto-ver-comentarios").textContent = mostrar ? "Ocultar comentarios" : "Ver comentarios";
  if (mostrar) elementos.seccionOpiniones.scrollIntoView({ behavior: "smooth", block: "start" });
}
elementos.botonVerComentarios.addEventListener("click", () => mostrarComentarios(elementos.seccionOpiniones.hidden));
if (window.location.hash === "#comentarios") {
  window.addEventListener("senda:opiniones-listas", () => mostrarComentarios(true), { once: true });
}

// "Volver" regresa a la página anterior si era de SENDA (por ejemplo, los resultados).
elementos.volver.addEventListener("click", (evento) => {
  const vieneDeSenda = document.referrer && new URL(document.referrer).origin === window.location.origin;
  if (vieneDeSenda && history.length > 1) {
    evento.preventDefault();
    history.back();
  }
});
elementos.volver.href = RUTAS.INICIO;

prepararBarraPublica(elementos.barra);
cargar();
