// Pantalla de inicio. Orden de las secciones:
//   1. Buscador (en el encabezado).
//   2. Novedades de tus favoritos: solo con cuenta personal y avisos encendidos.
//   3. Recomendados: los productos con stock más baratos. No depende de la persona.
//   4. Para vos: la mejor oferta de lo que la persona buscó o miró hace poco (historialService).
//   5. Compará precios: un producto de ejemplo con sus precios en varios comercios.
//   6. Ofertas y descuentos.
//   7. Comercios de tu zona: los comercios de la localidad de la cuenta (o la elegida en el selector)
//      con sus productos. Los visitantes eligen la localidad y queda guardada en el navegador.
// La búsqueda lleva a resultados.html.

import { LIMITES, RUTAS, ROLES, LOCALIDADES, LOCALIDAD_PREDETERMINADA, ALMACENAMIENTO } from "../core/constants.js";
import { validarBusqueda, normalizarTexto } from "../core/validators.js";
import { manejarError } from "../core/errores.js";
import { verificarConfiguracion } from "../services/authService.js";
import { cargarCatalogo } from "../services/preciosService.js";
import { leerHistorial, borrarHistorial } from "../services/historialService.js";
import { prepararBarraPublica, obtenerCuentaActual } from "../guards/sessionGuard.js";
import { obtenerMiCuenta } from "../services/clientesService.js";
import { obtenerComercio } from "../services/comerciosService.js";
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
import { rutaPerfilComercio, htmlAvatarComercio, htmlActualizadoHoy, htmlNoValidado } from "../ui/components/tarjetaComercio.js";

// Seis por sección: es la cantidad de tarjetas que entra en una fila (ver .grilla-ofertas).
const CANTIDAD_RECOMENDADOS = 6;
const CANTIDAD_PARA_VOS = 6;
const PRODUCTOS_POR_COMERCIO = 6;
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
  ofertas: $("lista-ofertas"),
  selectorLocalidad: $("selector-localidad"),
  bajadaZona: $("bajada-comercios-zona"),
  comerciosZona: $("lista-comercios-zona")
};

const estado = {
  productos: [],
  localidad: LOCALIDAD_PREDETERMINADA
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

// ---------- Comercios de tu zona ----------

// Localidad elegida en el selector (se guarda en el navegador). Tiene prioridad porque es una
// elección explícita. Si no hay, se usa la de la cuenta y, si tampoco, Río Gallegos.
function leerLocalidadGuardada() {
  try {
    const guardada = localStorage.getItem(ALMACENAMIENTO.LOCALIDAD);
    return LOCALIDADES.includes(guardada) ? guardada : null;
  } catch {
    return null;
  }
}

async function localidadDeLaCuenta() {
  const cuenta = await obtenerCuentaActual();
  if (!cuenta) return null;
  if (cuenta.rol === ROLES.CLIENTE) return (await obtenerMiCuenta(cuenta.uid))?.localidad || null;
  if (cuenta.rol === ROLES.COMERCIO || cuenta.rol === ROLES.PENDIENTE) return (await obtenerComercio(cuenta.uid))?.localidad || null;
  return null;
}

function prepararSelectorLocalidad() {
  elementos.selectorLocalidad.innerHTML = LOCALIDADES.map(
    (localidad) => `<option value="${escaparHTML(localidad)}">${escaparHTML(localidad)}</option>`
  ).join("");
  elementos.selectorLocalidad.value = estado.localidad;
  elementos.selectorLocalidad.addEventListener("change", () => {
    estado.localidad = elementos.selectorLocalidad.value;
    try {
      localStorage.setItem(ALMACENAMIENTO.LOCALIDAD, estado.localidad);
    } catch {
      // Sin localStorage la elección dura solo mientras la página está abierta.
    }
    renderizarComerciosDeLaZona();
  });
}

// Agrupa el catálogo por comercio: Map<comercioId, { comercio, ofertas: [{ producto, precio }] }>.
function productosPorComercio() {
  const grupos = new Map();
  for (const resumen of estado.productos) {
    for (const { precio, comercio } of resumen.ofertas) {
      if (!grupos.has(comercio.id)) grupos.set(comercio.id, { comercio, ofertas: [] });
      grupos.get(comercio.id).ofertas.push({ producto: resumen.producto, precio });
    }
  }
  return grupos;
}

function crearBloqueComercio({ comercio, ofertas }) {
  const bloque = document.createElement("article");
  bloque.className = "zona__comercio tarjeta";
  const cantidad = ofertas.length === 1 ? "1 producto publicado" : `${ofertas.length} productos publicados`;
  bloque.innerHTML = `
    <header class="zona__cabecera">
      <a class="zona__logo" href="${rutaPerfilComercio(comercio.id)}" aria-hidden="true" tabindex="-1">${htmlAvatarComercio(comercio, "avatar--grande")}</a>
      <div class="zona__datos">
        <h3 class="zona__nombre"><a href="${rutaPerfilComercio(comercio.id)}">${escaparHTML(comercio.nombre)}</a> ${htmlActualizadoHoy(comercio)}</h3>
        ${htmlNoValidado(comercio)}
        <p class="zona__detalle">${escaparHTML(comercio.direccion || "Dirección sin cargar")} · ${cantidad}</p>
      </div>
      <a class="btn btn--linea btn--chico" href="${rutaPerfilComercio(comercio.id)}">Ver comercio</a>
    </header>`;
  const grilla = document.createElement("div");
  grilla.className = "grilla-ofertas";
  const elegidas = [...ofertas]
    .sort((a, b) => Number(b.precio.disponible) - Number(a.precio.disponible) || a.precio.precioFinal - b.precio.precioFinal)
    .slice(0, PRODUCTOS_POR_COMERCIO);
  grilla.append(
    ...elegidas.map(({ producto, precio }) =>
      crearTarjetaProducto({
        producto,
        precio: precio.precioFinal,
        descuento: Number(precio.porcentajeDescuento) || 0,
        detalle: precio.disponible ? "En stock" : "Sin stock",
        sinStock: !precio.disponible
      })
    )
  );
  bloque.append(grilla);
  return bloque;
}

function renderizarComerciosDeLaZona() {
  const localidad = estado.localidad;
  elementos.bajadaZona.textContent = `${localidad}. Los comercios de tu localidad y lo que venden.`;
  const comercios = [...productosPorComercio().values()]
    .filter(({ comercio }) => (comercio.localidad || LOCALIDAD_PREDETERMINADA) === localidad)
    // Primero los que actualizaron sus precios hoy y después los que publican más productos.
    .sort((a, b) => Number(b.comercio.actualizadoHoy) - Number(a.comercio.actualizadoHoy) || b.ofertas.length - a.ofertas.length);
  if (comercios.length === 0) {
    mostrarVacio(
      elementos.comerciosZona,
      `Todavía no hay comercios de ${localidad} en SENDA`,
      "Elegí otra localidad o volvé más tarde."
    );
    return;
  }
  elementos.comerciosZona.replaceChildren(...comercios.map(crearBloqueComercio));
}

async function cargarComerciosDeLaZona() {
  estado.localidad = leerLocalidadGuardada() ?? (await localidadDeLaCuenta().catch(() => null)) ?? LOCALIDAD_PREDETERMINADA;
  prepararSelectorLocalidad();
  renderizarComerciosDeLaZona();
}

async function cargar() {
  mostrarCargando(elementos.recomendados, "Buscando los mejores precios...");
  mostrarCargando(elementos.paraVos, "Armando tus recomendaciones...");
  mostrarCargando(elementos.destacados, "Comparando precios...");
  mostrarCargando(elementos.ofertas, "Cargando ofertas...");
  mostrarCargando(elementos.comerciosZona, "Buscando comercios de tu zona...");
  try {
    verificarConfiguracion();
    const { productos } = await cargarCatalogo();
    estado.productos = productos;
    renderizarRecomendados();
    await renderizarParaVos();
    renderizarDestacado(productos);
    renderizarOfertas(productos);
    await cargarComerciosDeLaZona();
  } catch (error) {
    const mensaje = manejarError(error, "Carga del inicio");
    mostrarError(elementos.recomendados, mensaje, cargar);
    [elementos.paraVos, elementos.destacados, elementos.ofertas, elementos.comerciosZona].forEach((contenedor) => mostrarError(contenedor, mensaje));
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
