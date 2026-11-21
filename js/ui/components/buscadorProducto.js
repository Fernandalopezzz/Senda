// Buscador de productos del panel del comercio ("Agregar producto").
//
// En lugar de una lista larga para recorrer, el comercio escribe y abajo aparecen los productos de
// SENDA que se parecen a lo escrito, con su imagen. Busca por nombre, marca, presentación o código
// de barras, sin distinguir tildes ni mayúsculas.
//   - Si elige uno, los datos del producto se completan solos y el comercio solo carga su precio.
//     Esos datos los cargó el comercio que creó el producto, y solo ese comercio los puede cambiar.
//   - Si no está, la última opción lo carga como producto nuevo con el nombre ya escrito.
//     Desde ese momento el producto aparece en la lista para el próximo comercio que lo busque.

import { escaparHTML } from "../feedback.js";
import { productoCoincide } from "../../services/productosService.js";
import { normalizarTexto } from "../../core/validators.js";

const MAXIMO_SUGERENCIAS = 6;

function miniatura(producto) {
  return producto.imagen
    ? `<img class="buscador-producto__imagen" src="${escaparHTML(producto.imagen)}" alt="">`
    : '<span class="buscador-producto__imagen buscador-producto__imagen--vacia" aria-hidden="true"></span>';
}

function detalle(producto) {
  return [producto.marca, producto.presentacion].filter(Boolean).map(escaparHTML).join(" · ");
}

// elementos: { input, lista, ayuda }
// opciones:
//   obtenerDatos(): { productos, publicados: Set de ids que ya publica el comercio, nombreCreador(id) }
//   alElegir(producto): se eligió un producto existente.
//   alCrearNuevo(texto): se eligió cargar un producto nuevo.
export function prepararBuscadorProducto({ input, lista }, { obtenerDatos, alElegir, alCrearNuevo }) {
  let opciones = [];
  let activa = -1;

  function cerrar() {
    lista.hidden = true;
    input.setAttribute("aria-expanded", "false");
    activa = -1;
  }

  function marcarActiva(indice) {
    activa = indice;
    [...lista.querySelectorAll("[role=option]")].forEach((item, i) => item.classList.toggle("buscador-producto__opcion--activa", i === indice));
  }

  function elegir(indice) {
    const opcion = opciones[indice];
    if (!opcion || opcion.deshabilitada) return;
    cerrar();
    if (opcion.producto) alElegir(opcion.producto);
    else alCrearNuevo(input.value.trim());
  }

  function mostrar() {
    const texto = input.value.trim();
    if (texto.length < 2) {
      cerrar();
      return;
    }
    const { productos, publicados, nombreCreador } = obtenerDatos();
    const buscado = normalizarTexto(texto);
    const encontrados = productos
      .filter((p) => productoCoincide(p, texto))
      // Primero los que empiezan con lo escrito, después el resto, por nombre.
      .sort(
        (a, b) =>
          Number(normalizarTexto(b.nombre).startsWith(buscado)) - Number(normalizarTexto(a.nombre).startsWith(buscado)) ||
          a.nombre.localeCompare(b.nombre, "es")
      )
      .slice(0, MAXIMO_SUGERENCIAS);

    opciones = encontrados.map((producto) => ({ producto, deshabilitada: publicados.has(producto.id) }));
    opciones.push({ producto: null, deshabilitada: false });

    lista.innerHTML =
      (encontrados.length === 0
        ? `<li class="buscador-producto__vacio">No encontrado en SENDA. Podés cargarlo como producto nuevo.</li>`
        : "") +
      opciones
        .map(({ producto, deshabilitada }, i) =>
          producto
            ? `<li class="buscador-producto__opcion${deshabilitada ? " buscador-producto__opcion--deshabilitada" : ""}" role="option" data-indice="${i}" aria-disabled="${deshabilitada}">
                ${miniatura(producto)}
                <span class="buscador-producto__textos">
                  <strong>${escaparHTML(producto.nombre)}</strong>
                  <span>${detalle(producto) || "Sin marca"}</span>
                  <span class="buscador-producto__creador">${deshabilitada ? "Ya lo publicás en tu comercio" : `Cargado por ${escaparHTML(nombreCreador(producto.creadorId))}`}</span>
                </span>
              </li>`
            : `<li class="buscador-producto__opcion buscador-producto__opcion--nuevo" role="option" data-indice="${i}">
                <span class="buscador-producto__mas" aria-hidden="true">+</span>
                <span class="buscador-producto__textos">
                  <strong>Cargar «${escaparHTML(texto)}» como producto nuevo</strong>
                  <span>${encontrados.length ? "Si ninguno de los de arriba es el tuyo." : "Lo vas a poder elegir la próxima vez desde esta lista."}</span>
                </span>
              </li>`
        )
        .join("");
    lista.hidden = false;
    input.setAttribute("aria-expanded", "true");
    marcarActiva(encontrados.length ? 0 : opciones.length - 1);
  }

  input.addEventListener("input", mostrar);
  input.addEventListener("focus", mostrar);
  input.addEventListener("keydown", (evento) => {
    if (lista.hidden) return;
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      marcarActiva(Math.min(activa + 1, opciones.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      marcarActiva(Math.max(activa - 1, 0));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      elegir(activa);
    } else if (evento.key === "Escape") {
      cerrar();
    }
  });
  // mousedown y no click: así se elige antes de que el campo pierda el foco y cierre la lista.
  lista.addEventListener("mousedown", (evento) => {
    const item = evento.target.closest("[role=option]");
    if (!item) return;
    evento.preventDefault();
    elegir(Number(item.dataset.indice));
  });
  input.addEventListener("blur", () => setTimeout(cerrar, 100));

  return { cerrar };
}

// Tarjeta del producto elegido, con los datos que cargó su creador.
export function htmlProductoElegido(producto, nombreCreador) {
  return `
    ${miniatura(producto)}
    <div class="producto-elegido__datos">
      <p class="producto-elegido__nombre">${escaparHTML(producto.nombre)}</p>
      <p class="producto-elegido__detalle">${detalle(producto) || "Sin marca"}${producto.codigoBarras ? ` · Código ${escaparHTML(producto.codigoBarras)}` : ""}</p>
      ${producto.descripcion ? `<p class="producto-elegido__descripcion">${escaparHTML(producto.descripcion)}</p>` : ""}
      ${producto.etiquetas?.length ? `<p class="producto-elegido__detalle">${producto.etiquetas.map(escaparHTML).join(" · ")}</p>` : ""}
      <p class="producto-elegido__aviso">Datos cargados por <strong>${escaparHTML(nombreCreador)}</strong>. Solo ese comercio los puede cambiar. Vos cargás tu precio, tu descuento y tu stock.</p>
    </div>
    <button class="btn btn--linea btn--chico" type="button" data-cambiar-producto>Elegir otro</button>`;
}
