// Bloque "Precios destacados": un producto y los comercios que lo venden, del más barato al más caro.

import { escaparHTML } from "../feedback.js";
import { crearImagenProducto, rutaDetalleProducto } from "./tarjetaProducto.js";
import { crearTarjetaComercio } from "./tarjetaComercio.js";

// datos: { producto, ofertas: [{ comercio, precio }] } con ofertas ya ordenadas por precio
export function crearComparadorPrecios({ producto, ofertas }) {
  const bloque = document.createElement("article");
  bloque.className = "comparador tarjeta";

  const columnaProducto = document.createElement("div");
  columnaProducto.className = "comparador__producto";
  columnaProducto.append(crearImagenProducto(producto.imagen, producto.nombre, "imagen-producto--grande"));
  columnaProducto.insertAdjacentHTML(
    "beforeend",
    `<h3 class="comparador__nombre">${escaparHTML(producto.nombre)}</h3>
     ${producto.marca ? `<p class="comparador__detalle">${escaparHTML(producto.marca)}</p>` : ""}
     <a class="btn btn--oscuro btn--chico" href="${rutaDetalleProducto(producto.id)}">
       <svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7Zm14 0-3 7a4 4 0 0 0 6 0l-3-7Z"/></svg>
       Comparar precios
     </a>`
  );

  const listaComercios = document.createElement("div");
  listaComercios.className = "comparador__comercios";
  ofertas.forEach(({ comercio, precio }, indice) => {
    listaComercios.append(crearTarjetaComercio({ comercio, precio, esMejorPrecio: indice === 0 }));
  });

  bloque.append(columnaProducto, listaComercios);
  return bloque;
}
