// Pantalla de inicio. Orden de las secciones:
//   1. Buscador (en el encabezado).
//   2. Novedades de tus favoritos: solo con cuenta personal y avisos encendidos.
//   3. Recomendados: los productos con stock más baratos. No depende de la persona.
//   4. Para vos: la mejor oferta de lo que la persona buscó o miró hace poco (historialService).
//   5. Compará precios: un producto de ejemplo con sus precios en varios comercios.
//   6. Ofertas y descuentos.
// La búsqueda lleva a resultados.html.

import { LIMITES, RUTAS } from "../core/constants.js";
import { validarBusqueda, normalizarTexto } from "../core/validators.js";
import { manejarError } from "../core/errores.js";
import { verificarConfiguracion } from "../services/authService.js";
import { cargarCatalogo } from "../services/preciosService.js";
import { leerHistorial, borrarHistorial } from "../services/historialService.js";
import { prepararBarraPublica } from "../guards/sessionGuard.js";
import {
  escaparHTML,
  precioTexto,
  mostrarCargando,
  mostrarError,
  mostrarVacio,
  mostrarAviso,
  prepararBuscador
} from "../ui/feedback.js";
import { crearTarjetaResumen, crearTarjetaProducto, rutaDetalleProducto } from "../ui/components/tarjetaProducto.js";
import { crearComparadorPrecios } from "../ui/components/comparadorPrecios.js";

const CANTIDAD_RECOMENDADOS = 5;
const CANTIDAD_PARA_VOS = 5;
const $ = (id) => document.getElementById(id);

const elementos = {
  barra: $("barra-publica"),
  buscador: {
    formulario: $("form-busqueda"),
    input: $("input-busqueda"),
    limpiar: $("boton-limpiar"),
    error: $("error-busqueda")
  },
  novedades: $("novedades-favoritos"),
  listaNovedades: $("lista-novedades"),
  recomendados: $("lista-recomendados"),
  seccionParaVos: $("para-vos"),
  paraVos: $("lista-para-vos"),
  botonMenuParaVos: $("boton-menu-para-vos"),
  menuParaVos: $("menu-para-vos"),
  botonBorrarHistorial: $("boton-borrar-historial"),
  destacados: $("contenido-destacados"),
  ofertas: $("lista-ofertas")
};

const estado = {
  productos: []
};

// ---------- Novedades de los favoritos ----------

function textoNovedad({ tipo, antes, ahora, descuento }) {
  const conDescuento = descuento > 0 ? ` Tiene ${descuento}% de descuento.` : "";
  if (tipo === "bajo") return `bajó de ${precioTexto(antes)} a <strong>${precioTexto(ahora)}</strong>.${conDescuento}`;
  if (tipo === "subio") return `subió de ${precioTexto(antes)} a <strong>${precioTexto(ahora)}</strong>.`;
  if (tipo === "sin-stock") return "se quedó sin stock en todos los comercios.";
  return `volvió a tener stock, desde <strong>${precioTexto(ahora)}</strong>.${conDescuento}`;
}

function mostrarNovedades(cambios) {
  elementos.novedades.hidden = false;
  elementos.listaNovedades.innerHTML = cambios
    .slice(0, 3)
    .map(
      (cambio) => `
        <li class="novedad novedad--${cambio.tipo}">
          <a href="${rutaDetalleProducto(cambio.productoId)}">${escaparHTML(cambio.producto.nombre)}</a>
          ${textoNovedad(cambio)}
        </li>`
    )
    .join("");
  if (cambios.length > 3) {
    elementos.listaNovedades.insertAdjacentHTML(
      "beforeend",
      `<li class="novedad">Y ${cambios.length - 3} más en tus favoritos.</li>`
    );
  }
}

// ---------- Recomendados ----------

// Los productos con stock más baratos.
function renderizarRecomendados() {
  const conStock = estado.productos.filter((r) => r.hayStock);
  if (conStock.length === 0) {
    mostrarVacio(elementos.recomendados, "Todavía no hay productos con stock");
    return;
  }
  const lista = [...conStock].sort((a, b) => a.precioDesde - b.precioDesde).slice(0, CANTIDAD_RECOMENDADOS);
  elementos.recomendados.replaceChildren(...lista.map(crearTarjetaResumen));
}

// ---------- Para vos ----------
// Cada búsqueda y cada producto visto se convierten en un término ("yerba").
// Para cada término se busca, entre los productos con stock que coinciden, el de mayor descuento
// y, si empatan, el más barato. Así, si la persona miró una yerba cara, se le sugiere la yerba
// con la mejor oferta.

function primeraPalabra(nombre) {
  return normalizarTexto(nombre).split(" ").find((palabra) => palabra.length >= 3) ?? "";
}

function mejorOferta(candidatos) {
  return [...candidatos].sort((a, b) => b.descuento - a.descuento || a.precioDesde - b.precioDesde)[0];
}

async function renderizarParaVos() {
  const { busquedas, vistos } = await leerHistorial();
  const porId = new Map(estado.productos.map((r) => [r.producto.id, r]));

  const terminos = [
    ...busquedas.map((busqueda) => ({ termino: normalizarTexto(busqueda), motivo: `Porque buscaste «${busqueda}»` })),
    ...vistos
      .map((id) => porId.get(id))
      .filter(Boolean)
      .map((resumen) => ({ termino: primeraPalabra(resumen.producto.nombre), motivo: `Porque miraste ${resumen.producto.nombre}` }))
  ].filter(({ termino }) => termino);

  const elegidos = new Map();
  for (const { termino, motivo } of terminos) {
    if (elegidos.size >= CANTIDAD_PARA_VOS) break;
    const candidatos = estado.productos.filter(
      (r) => r.hayStock && !elegidos.has(r.producto.id) && normalizarTexto(`${r.producto.nombre} ${r.producto.marca ?? ""}`).includes(termino)
    );
    const mejor = mejorOferta(candidatos);
    if (mejor) elegidos.set(mejor.producto.id, { resumen: mejor, motivo });
  }

  elementos.botonMenuParaVos.hidden = terminos.length === 0;
  if (elegidos.size === 0) {
    mostrarVacio(
      elementos.paraVos,
      terminos.length === 0 ? "Buscá un producto para ver recomendaciones" : "No encontramos ofertas para lo que buscaste",
      "Acá vas a ver la mejor oferta de lo que busques y mires en SENDA."
    );
    return;
  }

  elementos.paraVos.replaceChildren(
    ...[...elegidos.values()].map(({ resumen, motivo }) =>
      crearTarjetaProducto({
        producto: resumen.producto,
        precio: resumen.precioDesde,
        descuento: resumen.descuento,
        conDesde: true,
        detalle: motivo
      })
    )
  );
}

elementos.botonMenuParaVos.addEventListener("click", () => {
  const abierto = elementos.menuParaVos.hidden;
  elementos.menuParaVos.hidden = !abierto;
  elementos.botonMenuParaVos.setAttribute("aria-expanded", String(abierto));
});

document.addEventListener("click", (evento) => {
  if (!evento.target.closest(".menu-puntos")) {
    elementos.menuParaVos.hidden = true;
    elementos.botonMenuParaVos.setAttribute("aria-expanded", "false");
  }
});

elementos.botonBorrarHistorial.addEventListener("click", async () => {
  elementos.menuParaVos.hidden = true;
  await borrarHistorial();
  await renderizarParaVos();
  mostrarAviso("Borraste tu historial de búsqueda.");
});

// ---------- Compará precios y ofertas ----------

function renderizarDestacado(productos) {
  // Se destaca el producto que más comercios tienen en stock, porque es el que mejor se compara.
  const destacado = [...productos].sort((a, b) => b.disponibles.length - a.disponibles.length)[0];
  if (!destacado || destacado.disponibles.length < 2) {
    mostrarVacio(
      elementos.destacados,
      "Todavía no hay comparaciones para mostrar",
      "Cuando dos o más comercios publiquen el mismo producto, vas a ver sus precios acá."
    );
    return;
  }
  elementos.destacados.replaceChildren(
    crearComparadorPrecios({
      producto: destacado.producto,
      ofertas: destacado.disponibles.slice(0, LIMITES.COMERCIOS_DESTACADOS)
    })
  );
}

function renderizarOfertas(productos) {
  const ofertas = productos
    .filter((resumen) => resumen.hayStock && resumen.descuento > 0)
    .sort((a, b) => b.descuento - a.descuento)
    .slice(0, LIMITES.OFERTAS_INICIO);
  if (ofertas.length === 0) {
    mostrarVacio(elementos.ofertas, "No hay ofertas vigentes", "Volvé más tarde para ver los descuentos de los comercios.");
    return;
  }
  elementos.ofertas.replaceChildren(...ofertas.map(crearTarjetaResumen));
}

async function cargar() {
  mostrarCargando(elementos.recomendados, "Buscando los mejores precios...");
  mostrarCargando(elementos.paraVos, "Armando tus recomendaciones...");
  mostrarCargando(elementos.destacados, "Comparando precios...");
  mostrarCargando(elementos.ofertas, "Cargando ofertas...");
  try {
    verificarConfiguracion();
    const { productos } = await cargarCatalogo();
    estado.productos = productos;
    renderizarRecomendados();
    await renderizarParaVos();
    renderizarDestacado(productos);
    renderizarOfertas(productos);
  } catch (error) {
    const mensaje = manejarError(error, "Carga del inicio");
    mostrarError(elementos.recomendados, mensaje, cargar);
    [elementos.paraVos, elementos.destacados, elementos.ofertas].forEach((contenedor) => mostrarError(contenedor, mensaje));
  }
}

prepararBarraPublica(elementos.barra, { activo: "inicio", alCambiarPrecios: mostrarNovedades });
prepararBuscador(elementos.buscador, {
  validar: validarBusqueda,
  alBuscar: (texto) => {
    window.location.href = `${RUTAS.RESULTADOS}?q=${encodeURIComponent(texto)}`;
  }
});
cargar();
