// Listados de productos: tarjeta, imagen, botón de favorito, panel de filtros y orden.
// El panel de filtros lo usan el panel del comercio y el perfil público del comercio.

import { RUTAS } from "../../core/constants.js";
import { validarRangoPrecio, normalizarTexto } from "../../core/validators.js";
import { escaparHTML, precioHTML, precioTexto, mostrarAviso } from "../feedback.js";
import { precioPorUnidad } from "../../services/preciosService.js";
import { esFavorito, alternarFavorito, EVENTO_FAVORITOS } from "../../services/productosService.js";

// Imagen del producto. Si no tiene imagen o no carga, muestra la ilustración de los wireframes.
export function crearImagenProducto(url, nombre, clase = "") {
  const contenedor = document.createElement("div");
  contenedor.className = `imagen-producto ${clase}`.trim();
  if (url) {
    const imagen = document.createElement("img");
    imagen.src = url;
    imagen.alt = nombre;
    imagen.loading = "lazy";
    imagen.addEventListener("error", () => imagen.remove());
    contenedor.append(imagen);
  }
  return contenedor;
}

export function rutaDetalleProducto(productoId) {
  return `${RUTAS.DETALLE_PRODUCTO}?id=${encodeURIComponent(productoId)}`;
}

function pintarBotonFavorito(boton) {
  const activo = esFavorito(boton.dataset.productoId);
  boton.setAttribute("aria-pressed", String(activo));
  boton.setAttribute("aria-label", `${activo ? "Quitar de" : "Agregar a"} favoritos: ${boton.dataset.nombre}`);
  boton.title = activo ? "Quitar de favoritos" : "Agregar a favoritos";
}

// Un solo oyente para toda la página: cuando cambian los favoritos se actualizan todos los corazones.
window.addEventListener(EVENTO_FAVORITOS, () => {
  document.querySelectorAll(".boton-favorito").forEach(pintarBotonFavorito);
});

// Botón de corazón para agregar o quitar un producto de favoritos.
export function crearBotonFavorito(producto, clase = "") {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = `boton-favorito ${clase}`.trim();
  boton.dataset.productoId = producto.id;
  boton.dataset.nombre = producto.nombre;
  boton.innerHTML =
    '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z"/></svg>';
  pintarBotonFavorito(boton);

  boton.addEventListener("click", (evento) => {
    evento.preventDefault();
    const agregado = alternarFavorito(producto.id);
    mostrarAviso(agregado ? "Agregaste el producto a favoritos." : "Quitaste el producto de favoritos.");
  });
  return boton;
}

// "$ 2.010 por kg": permite comparar envases de distinto tamaño. Vacío si la presentación
// no indica un peso o un volumen.
export function htmlPrecioPorUnidad(precio, presentacion, clase = "precio-unidad") {
  const unidad = precioPorUnidad(precio, presentacion);
  return unidad ? `<p class="${clase}">${precioTexto(unidad.valor)} por ${unidad.unidad}</p>` : "";
}

// datos: { producto, precio, descuento, conDesde, detalle }
//   conDesde: muestra "Desde" arriba del precio (precio mínimo entre comercios)
//   detalle: texto debajo del precio, por ejemplo "en 3 comercios" o "Sin stock"
export function crearTarjetaProducto({ producto, precio, descuento = 0, conDesde = false, detalle = "", sinStock = false }) {
  const tarjeta = document.createElement("article");
  tarjeta.className = `tarjeta-producto${sinStock ? " tarjeta-producto--sin-stock" : ""}`;

  // La etiqueta y el corazón van sobre la tarjeta y no dentro de la imagen,
  // porque en celular las imágenes se ocultan.
  const imagen = crearImagenProducto(producto.imagen, producto.nombre);
  tarjeta.append(crearBotonFavorito(producto));
  if (descuento > 0) {
    tarjeta.insertAdjacentHTML("beforeend", `<span class="etiqueta-descuento">-${descuento}%</span>`);
  }

  const cuerpo = document.createElement("div");
  cuerpo.className = "tarjeta-producto__cuerpo";
  cuerpo.innerHTML = `
    <h3 class="tarjeta-producto__nombre">${escaparHTML(producto.nombre)}</h3>
    ${conDesde ? '<p class="tarjeta-producto__desde">Desde</p>' : ""}
    <p class="precio">${precioHTML(precio)}</p>
    ${htmlPrecioPorUnidad(precio, producto.presentacion)}
    ${detalle ? `<p class="tarjeta-producto__detalle">${escaparHTML(detalle)}</p>` : ""}
    <a class="btn btn--linea btn--bloque btn--chico" href="${rutaDetalleProducto(producto.id)}">Ver producto</a>`;

  tarjeta.append(imagen, cuerpo);
  return tarjeta;
}

// Tarjeta a partir de un resumen del catálogo (ver armarCatalogo en preciosService).
export function crearTarjetaResumen(resumen) {
  const cantidad = resumen.ofertas.length;
  const detalle = !resumen.hayStock
    ? "Sin stock por ahora"
    : cantidad === 1
      ? "en 1 comercio"
      : `en ${cantidad} comercios`;
  return crearTarjetaProducto({
    producto: resumen.producto,
    precio: resumen.precioDesde,
    descuento: resumen.descuento,
    conDesde: true,
    detalle,
    sinStock: !resumen.hayStock
  });
}

// ---------- Panel de filtros y orden ----------

let contador = 0;

// modoStock: "enStock" (perfil público) o "sinStock" (panel del comercio)
export function crearFiltros(contenedor, { modoStock, placeholder = "Nombre del producto", alCambiar }) {
  const id = `filtros${++contador}`;
  const textoStock = modoStock === "sinStock" ? "Solo sin stock" : "Solo productos en stock";

  contenedor.innerHTML = `
    <form class="filtros__formulario" novalidate>
      <div class="campo">
        <label class="filtros__etiqueta-chica" for="${id}-texto">Buscar producto</label>
        <input class="campo__control" id="${id}-texto" name="texto" type="search" placeholder="${escaparHTML(placeholder)}" autocomplete="off">
      </div>
      <fieldset class="filtros__grupo">
        <legend class="filtros__titulo">Mostrar</legend>
        <div class="filtros__opciones">
          <label class="opcion"><input type="checkbox" name="ofertas"> Ofertas y descuentos</label>
          <label class="opcion"><input type="checkbox" name="stock"> ${textoStock}</label>
        </div>
      </fieldset>
      <fieldset class="filtros__grupo">
        <legend class="filtros__titulo">Precio</legend>
        <div class="filtros__rango">
          <div class="campo">
            <label class="filtros__etiqueta-chica" for="${id}-desde">Desde</label>
            <input class="campo__control" id="${id}-desde" name="desde" type="number" min="0" step="any" placeholder="$ 1.000" inputmode="decimal">
          </div>
          <div class="campo">
            <label class="filtros__etiqueta-chica" for="${id}-hasta">Hasta</label>
            <input class="campo__control" id="${id}-hasta" name="hasta" type="number" min="0" step="any" placeholder="$ 10.000" inputmode="decimal">
          </div>
        </div>
        <p class="campo__error" role="alert"></p>
      </fieldset>
      <button class="btn btn--linea btn--bloque btn--chico" type="reset">Borrar filtros</button>
    </form>`;

  const formulario = contenedor.querySelector("form");
  const errorRango = formulario.querySelector(".campo__error");
  formulario.addEventListener("input", alCambiar);
  // El reset limpia los campos después del evento, por eso se avisa en el siguiente ciclo.
  formulario.addEventListener("reset", () => setTimeout(alCambiar));
  formulario.addEventListener("submit", (evento) => evento.preventDefault());

  const leerNumero = (nombre) => {
    const valor = formulario.elements[nombre].value.trim();
    return valor === "" ? null : Number(valor);
  };

  return {
    // Devuelve los filtros elegidos. Si el rango de precio es inválido, lo informa y no lo aplica.
    obtener() {
      let desde = leerNumero("desde");
      let hasta = leerNumero("hasta");
      const error = validarRangoPrecio(desde, hasta);
      errorRango.textContent = error;
      if (error) {
        desde = null;
        hasta = null;
      }
      return {
        texto: normalizarTexto(formulario.elements.texto.value),
        soloOfertas: formulario.elements.ofertas.checked,
        stock: formulario.elements.stock.checked ? modoStock : null,
        desde,
        hasta
      };
    }
  };
}

// items: [{ precio, producto }]
export function filtrarItems(items, filtros) {
  return items.filter(({ precio, producto }) => {
    if (filtros.texto && !normalizarTexto(`${producto.nombre} ${producto.marca ?? ""}`).includes(filtros.texto)) return false;
    if (filtros.soloOfertas && !(precio.porcentajeDescuento > 0)) return false;
    if (filtros.stock === "enStock" && !precio.disponible) return false;
    if (filtros.stock === "sinStock" && precio.disponible) return false;
    if (filtros.desde !== null && precio.precioFinal < filtros.desde) return false;
    if (filtros.hasta !== null && precio.precioFinal > filtros.hasta) return false;
    return true;
  });
}

export const CRITERIOS_ORDEN = Object.freeze([
  { valor: "menor", texto: "Menor precio" },
  { valor: "mayor", texto: "Mayor precio" },
  { valor: "descuento", texto: "Mayor descuento" },
  { valor: "nombre", texto: "Nombre (A-Z)" }
]);

// Ordena una lista. obtenerPrecio y obtenerDescuento indican de dónde sale cada dato en el elemento.
export function ordenarLista(lista, criterio, { obtenerPrecio, obtenerDescuento, obtenerNombre }) {
  const copia = [...lista];
  const porNombre = (a, b) => obtenerNombre(a).localeCompare(obtenerNombre(b), "es");
  if (criterio === "mayor") return copia.sort((a, b) => obtenerPrecio(b) - obtenerPrecio(a));
  if (criterio === "descuento") return copia.sort((a, b) => obtenerDescuento(b) - obtenerDescuento(a) || porNombre(a, b));
  if (criterio === "nombre") return copia.sort(porNombre);
  return copia.sort((a, b) => obtenerPrecio(a) - obtenerPrecio(b));
}

export function opcionesOrden() {
  return CRITERIOS_ORDEN.map((c) => `<option value="${c.valor}">${c.texto}</option>`).join("");
}
