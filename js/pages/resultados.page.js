// Resultados (wireframe pág. 3). Según la dirección muestra:
//   ?q=texto            búsqueda de productos y comercios; la cuenta del comercio aparece primero
//   ?vista=ofertas      todos los productos con descuento
//   ?vista=favoritos    productos guardados como favoritos en este dispositivo
//   ?vista=comercios    todos los comercios con productos publicados

import { LIMITES, RUTAS } from "../core/constants.js";
import { validarBusqueda, normalizarTexto } from "../core/validators.js";
import { manejarError } from "../core/errores.js";
import { verificarConfiguracion } from "../services/authService.js";
import { cargarCatalogo } from "../services/preciosService.js";
import { obtenerFavoritos, EVENTO_FAVORITOS } from "../services/productosService.js";
import { prepararBarraPublica } from "../guards/sessionGuard.js";
import { registrarBusqueda } from "../services/historialService.js";
import { mostrarCargando, mostrarError, mostrarVacio, prepararBuscador } from "../ui/feedback.js";
import { crearTarjetaResumen, ordenarLista, opcionesOrden } from "../ui/components/tarjetaProducto.js";
import { crearTarjetaCuentaComercio } from "../ui/components/tarjetaComercio.js";

const $ = (id) => document.getElementById(id);

const elementos = {
  barra: $("barra-publica"),
  buscador: {
    formulario: $("form-busqueda"),
    input: $("input-busqueda"),
    limpiar: $("boton-limpiar"),
    error: $("error-busqueda")
  },
  migaActual: $("miga-actual"),
  titulo: $("titulo-resultados"),
  resumen: $("resumen-resultados"),
  herramientas: $("herramientas-resultados"),
  orden: $("orden-resultados"),
  soloStock: $("solo-stock"),
  seccionComercios: $("seccion-comercios"),
  listaComercios: $("lista-comercios"),
  seccionProductos: $("seccion-productos"),
  subtituloProductos: $("subtitulo-productos"),
  listaResultados: $("lista-resultados"),
  botonMas: $("boton-mas-resultados")
};

const VISTAS = ["favoritos", "ofertas", "comercios"];

const estado = {
  catalogo: null,
  cantidadVisible: LIMITES.RESULTADOS_POR_PAGINA
};

function leerParametros() {
  const parametros = new URLSearchParams(window.location.search);
  const vista = parametros.get("vista");
  return {
    q: (parametros.get("q") ?? "").trim(),
    vista: VISTAS.includes(vista) ? vista : ""
  };
}

function coincide(texto, termino) {
  return normalizarTexto(texto).includes(termino);
}

function calcularResultados({ q, vista }) {
  const { productos, comercios } = estado.catalogo;
  const termino = normalizarTexto(q);
  let listaProductos = productos;
  let listaComercios = [];

  if (vista === "comercios") {
    listaComercios = [...comercios].sort((a, b) => a.comercio.nombre.localeCompare(b.comercio.nombre, "es"));
    return { listaProductos: [], listaComercios };
  }

  if (termino) {
    listaComercios = comercios.filter(({ comercio }) => coincide(comercio.nombre, termino));
    listaProductos = listaProductos.filter(({ producto }) =>
      coincide(`${producto.nombre} ${producto.marca ?? ""}`, termino)
    );
  }
  if (vista === "favoritos") {
    const favoritos = obtenerFavoritos();
    listaProductos = listaProductos.filter(({ producto }) => favoritos.includes(producto.id));
  }
  if (vista === "ofertas") {
    listaProductos = listaProductos.filter((resumen) => resumen.hayStock && resumen.descuento > 0);
  }
  if (elementos.soloStock.checked) {
    listaProductos = listaProductos.filter((resumen) => resumen.hayStock);
  }

  listaProductos = ordenarLista(listaProductos, elementos.orden.value, {
    obtenerPrecio: (r) => r.precioDesde,
    obtenerDescuento: (r) => r.descuento,
    obtenerNombre: (r) => r.producto.nombre
  });
  return { listaProductos, listaComercios };
}

function textosVista({ q, vista }) {
  if (vista === "favoritos") return { miga: "Favoritos", titulo: "Mis favoritos" };
  if (vista === "ofertas") return { miga: "Ofertas", titulo: "Ofertas y descuentos" };
  if (vista === "comercios") return { miga: "Comercios", titulo: "Comercios" };
  if (q) return { miga: "Resultados", titulo: `Resultados para “${q}”` };
  return { miga: "Resultados", titulo: "Todos los productos" };
}

function textoResumen(listaProductos, listaComercios, vista) {
  const textoComercios = listaComercios.length === 1 ? "1 comercio" : `${listaComercios.length} comercios`;
  if (vista === "comercios") return `${textoComercios} con productos publicados`;

  const idsComercios = new Set(listaProductos.flatMap((r) => r.ofertas.map(({ comercio }) => comercio.id)));
  const productos = listaProductos.length === 1 ? "1 producto encontrado" : `${listaProductos.length} productos encontrados`;
  const enComercios = idsComercios.size === 1 ? "en 1 comercio" : `en ${idsComercios.size} comercios`;
  const partes = [];
  if (listaComercios.length > 0) partes.push(`${textoComercios} con ese nombre`);
  if (listaProductos.length > 0 || listaComercios.length === 0) partes.push(`${productos} ${enComercios}`);
  if (vista === "favoritos") partes.push("Guardados en este dispositivo o en tu cuenta personal");
  return partes.join(" · ");
}

function mensajeSinResultados({ q, vista }) {
  if (vista === "favoritos" && obtenerFavoritos().length === 0) {
    return ["Todavía no guardaste favoritos", "Tocá el corazón de un producto para guardarlo acá."];
  }
  if (q) return [`No encontramos “${q}”`, "Probá con otro nombre de producto, marca o comercio, o quitá los filtros."];
  if (vista === "ofertas") return ["No hay ofertas vigentes", "Volvé más tarde para ver los descuentos de los comercios."];
  return ["No hay productos para mostrar", "Probá quitando el filtro de stock."];
}

function renderizar() {
  const parametros = leerParametros();
  const { miga, titulo } = textosVista(parametros);
  elementos.migaActual.textContent = miga;
  elementos.titulo.textContent = titulo;
  document.title = `${titulo} · SENDA`;
  if (!estado.catalogo) return;

  const soloComercios = parametros.vista === "comercios";
  elementos.herramientas.hidden = soloComercios;

  const { listaProductos, listaComercios } = calcularResultados(parametros);
  elementos.resumen.textContent = textoResumen(listaProductos, listaComercios, parametros.vista);

  // La cuenta del comercio aparece primero cuando la búsqueda coincide con su nombre.
  elementos.seccionComercios.hidden = listaComercios.length === 0;
  elementos.listaComercios.replaceChildren(...listaComercios.map(crearTarjetaCuentaComercio));

  if (soloComercios) {
    elementos.seccionProductos.hidden = true;
    if (listaComercios.length === 0) {
      elementos.seccionComercios.hidden = false;
      mostrarVacio(elementos.listaComercios, "Todavía no hay comercios con productos publicados");
    }
    return;
  }

  elementos.seccionProductos.hidden = false;
  elementos.subtituloProductos.hidden = listaComercios.length === 0;
  elementos.botonMas.hidden = true;

  if (listaProductos.length === 0) {
    if (listaComercios.length > 0) {
      elementos.seccionProductos.hidden = true;
      return;
    }
    mostrarVacio(elementos.listaResultados, ...mensajeSinResultados(parametros));
    return;
  }

  elementos.listaResultados.replaceChildren(...listaProductos.slice(0, estado.cantidadVisible).map(crearTarjetaResumen));
  elementos.botonMas.hidden = listaProductos.length <= estado.cantidadVisible;
}

async function cargar() {
  mostrarCargando(elementos.listaResultados, "Buscando los mejores precios...");
  try {
    verificarConfiguracion();
    estado.catalogo = await cargarCatalogo();
    renderizar();
  } catch (error) {
    mostrarError(elementos.listaResultados, manejarError(error, "Carga de resultados"), cargar);
  }
}

function reiniciarYRenderizar() {
  estado.cantidadVisible = LIMITES.RESULTADOS_POR_PAGINA;
  renderizar();
}

const { q, vista } = leerParametros();
prepararBarraPublica(elementos.barra, { activo: vista === "ofertas" ? "ofertas" : null });
elementos.buscador.input.value = q;
elementos.buscador.limpiar.hidden = q === "";
prepararBuscador(elementos.buscador, {
  validar: validarBusqueda,
  alBuscar: (texto) => {
    window.location.href = `${RUTAS.RESULTADOS}?q=${encodeURIComponent(texto)}`;
  }
});
elementos.orden.innerHTML = opcionesOrden();
elementos.orden.addEventListener("change", reiniciarYRenderizar);
elementos.soloStock.addEventListener("change", reiniciarYRenderizar);
elementos.botonMas.addEventListener("click", () => {
  estado.cantidadVisible += LIMITES.RESULTADOS_POR_PAGINA;
  renderizar();
});
// Si se quita un favorito mientras se mira la lista de favoritos, la lista se actualiza.
window.addEventListener(EVENTO_FAVORITOS, () => {
  if (leerParametros().vista === "favoritos" && estado.catalogo) renderizar();
});
renderizar();
cargar();
// La búsqueda queda en el historial del navegador para armar "Para vos" en el inicio.
if (q) registrarBusqueda(q).catch((error) => manejarError(error, "Historial de búsqueda"));
