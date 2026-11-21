// Pantalla de gestión. Muestra un panel distinto según el rol de la cuenta:
//   comercio: edición del perfil (foto y fondo) y gestión de productos, precios y stock.
//   admin:    validación de los comercios registrados (aprobar o rechazar).

import { LIMITES, ROLES, RUTAS, LOCALIDADES, LOCALIDAD_PREDETERMINADA, ORIGENES } from "../core/constants.js";
import { manejarError, ErrorSenda } from "../core/errores.js";
import {
  validarTextoObligatorio,
  validarTextoOpcional,
  validarPresentacion,
  validarEtiquetas,
  validarTelefono,
  validarPrecio,
  validarPorcentaje,
  validarImagen,
  validarLocalidad
} from "../core/validators.js";
import { protegerPagina } from "../guards/sessionGuard.js";
import { listarUsuariosPorRol, cargarComerciosDePrueba } from "../services/usuariosService.js";
import { cerrarSesion } from "../services/authService.js";
import {
  obtenerComercio,
  guardarComercio,
  subirImagenComercio,
  obtenerImagenesComercio,
  existeComercioConNombre,
  obtenerCorreoComercio,
  sincronizarCorreoComercio
} from "../services/comerciosService.js";
import {
  listarProductos,
  nuevoIdProducto,
  subirImagenProducto,
  esCreadorDelProducto,
  normalizarProducto
} from "../services/productosService.js";
import {
  listarPreciosPorComercio,
  crearPrecio,
  crearProductoConPrecio,
  actualizarProductoRevisado,
  actualizarPrecio,
  actualizarDisponibilidad,
  calcularPrecioFinal
} from "../services/preciosService.js";
import {
  escaparHTML,
  precioHTML,
  precioTexto,
  iniciales,
  textoActualizacion,
  mostrarCargando,
  mostrarError,
  mostrarVacio,
  mostrarAviso,
  mostrarMensaje,
  ocultarMensaje,
  aplicarValidaciones,
  marcarErrorCampo,
  limpiarErrores,
  botonCargando,
  abrirModal,
  cerrarModal,
  prepararModal,
  confirmar,
  llenarSelectorLocalidad
} from "../ui/feedback.js";
import { crearImagenProducto, crearFiltros, filtrarItems } from "../ui/components/tarjetaProducto.js";
import { rutaPerfilComercio } from "../ui/components/tarjetaComercio.js";
import { revisarAvisosDelComercio } from "../ui/components/avisosComercio.js";
import { revisarAvisosDeModeracion } from "../ui/components/reportar.js";
import { ELIMINAR_CUENTA, accionesPermitidas, aplicarAccionComercio } from "../ui/components/accionesComercio.js";
import {
  prepararEmpleados,
  cargarEmpleados,
  prepararHistorial,
  cargarHistorial,
  prepararCambioDeContrasena
} from "../ui/components/panelEquipo.js";
import { prepararRevision, cargarRevision } from "../ui/components/panelRevision.js";
import { obtenerActor } from "../services/moderacionService.js";

const $ = (id) => document.getElementById(id);

const elementos = {
  cargaPagina: $("carga-pagina"),
  textoCargaPagina: $("texto-carga-pagina"),
  enlacePerfilPublico: $("enlace-perfil-publico"),
  avatarEncabezado: $("avatar-encabezado"),
  avatarPerfil: $("avatar-perfil"),
  botonCerrarSesion: $("boton-cerrar-sesion"),

  formPerfil: $("form-perfil"),
  nombre: $("comercio-nombre"),
  telefono: $("comercio-telefono"),
  direccion: $("comercio-direccion"),
  localidad: $("comercio-localidad"),
  horario: $("comercio-horario"),
  botonGuardarPerfil: $("boton-guardar-perfil"),
  encabezadoPanel: $("perfil"),
  fotoComercio: $("foto-comercio"),
  archivoFoto: $("archivo-foto"),
  botonFoto: $("boton-foto"),
  archivoFondo: $("archivo-fondo"),
  botonFondo: $("boton-fondo"),

  filtros: $("filtros"),

  resumen: $("resumen-productos"),
  lista: $("lista-productos"),
  botonAgregar: $("boton-agregar"),
  botonVerMas: $("boton-ver-mas"),

  modalProducto: $("modal-producto"),
  formProducto: $("form-producto"),
  tituloModalProducto: $("titulo-modal-producto"),
  avisoCompartido: $("aviso-producto-compartido"),
  bloqueExistente: $("bloque-existente"),
  productoExistente: $("producto-existente"),
  productoNombre: $("producto-nombre"),
  productoMarca: $("producto-marca"),
  productoDescripcion: $("producto-descripcion"),
  productoPresentacion: $("producto-presentacion"),
  productoEtiquetas: $("producto-etiquetas"),
  productoImagen: $("producto-imagen"),
  vistaImagenProducto: $("vista-imagen-producto"),
  accionesImagenProducto: $("acciones-imagen-producto"),
  bloquePrecioNuevo: $("bloque-precio-nuevo"),
  nuevoPrecio: $("nuevo-precio-original"),
  nuevoDescuento: $("nuevo-descuento"),
  nuevoDisponible: $("nuevo-disponible"),
  nuevoPrecioFinal: $("nuevo-precio-final"),
  mensajeProducto: $("mensaje-producto"),
  botonGuardarProducto: $("boton-guardar-producto"),

  modalPrecio: $("modal-precio"),
  formPrecio: $("form-precio"),
  nombreProductoPrecio: $("nombre-producto-precio"),
  precioOriginal: $("precio-original"),
  precioDescuento: $("precio-descuento"),
  precioFinal: $("precio-final"),
  mensajePrecio: $("mensaje-precio"),
  botonGuardarPrecio: $("boton-guardar-precio")
};

const estado = {
  comercioId: null,
  productos: new Map(), // todos los productos de la plataforma, por ID
  items: [], // [{ precio, producto }] publicados por este comercio
  cantidadVisible: LIMITES.PRODUCTOS_POR_PAGINA,
  filtros: null, // panel de filtros (crearFiltros)
  modoModal: "agregar",
  itemActivo: null,
  imagenActual: "", // URL guardada en productos.imagen
  archivoImagen: null, // archivo elegido para guardar en el producto
  vistaPreviaUrl: null
};

const camposDatosProducto = () => [
  elementos.productoNombre,
  elementos.productoMarca,
  elementos.productoDescripcion,
  elementos.productoPresentacion,
  elementos.productoEtiquetas,
  elementos.productoImagen
];

// ======================================================
// Perfil del comercio
// ======================================================

function actualizarAvatares(nombre) {
  const letras = iniciales(nombre);
  elementos.avatarEncabezado.textContent = letras;
  elementos.avatarPerfil.textContent = letras;
}

function aplicarFoto(url) {
  elementos.fotoComercio.hidden = !url;
  if (url) elementos.fotoComercio.src = url;
  elementos.avatarPerfil.hidden = Boolean(url);
}

function aplicarFondo(url) {
  elementos.encabezadoPanel.classList.toggle("encabezado--con-fondo", Boolean(url));
  elementos.encabezadoPanel.style.setProperty("--fondo-comercio", url ? `url("${url}")` : "none");
}

async function cargarImagenesComercio() {
  try {
    const { foto, fondo } = await obtenerImagenesComercio(estado.comercioId);
    aplicarFoto(foto);
    aplicarFondo(fondo);
  } catch (error) {
    manejarError(error, "Carga de foto y fondo del comercio");
  }
}

// tipo: "foto" o "fondo"
async function cambiarImagenComercio(tipo, input, etiqueta) {
  const archivo = input.files[0];
  input.value = "";
  if (!archivo) return;
  const error = validarImagen(archivo, true);
  if (error) {
    mostrarAviso(error, "error");
    return;
  }
  const textoOriginal = etiqueta.lastChild.textContent;
  etiqueta.lastChild.textContent = " Subiendo...";
  etiqueta.classList.add("btn--ocupado");
  try {
    const url = await subirImagenComercio(estado.comercioId, tipo, archivo);
    if (tipo === "foto") aplicarFoto(url);
    else aplicarFondo(url);
    mostrarAviso(tipo === "foto" ? "Actualizaste la foto del comercio." : "Actualizaste el fondo del perfil.");
  } catch (err) {
    mostrarAviso(manejarError(err, `Subida de ${tipo}`), "error");
  } finally {
    etiqueta.lastChild.textContent = textoOriginal;
    etiqueta.classList.remove("btn--ocupado");
  }
}

async function cargarPerfil() {
  cargarImagenesComercio();
  try {
    const comercio = await obtenerComercio(estado.comercioId);
    elementos.nombre.value = comercio?.nombre ?? "";
    elementos.telefono.value = comercio?.telefono ?? "";
    elementos.direccion.value = comercio?.direccion ?? "";
    llenarSelectorLocalidad(elementos.localidad, LOCALIDADES, { valor: comercio?.localidad || LOCALIDAD_PREDETERMINADA });
    elementos.horario.value = comercio?.horario ?? "";
    actualizarAvatares(elementos.nombre.value);
  } catch (error) {
    mostrarAviso(manejarError(error, "Carga del perfil"), "error");
  }
}

async function guardarPerfil(evento) {
  evento.preventDefault();
  const valido = aplicarValidaciones([
    [elementos.nombre, validarTextoObligatorio(elementos.nombre.value, "el nombre del comercio")],
    [elementos.telefono, validarTelefono(elementos.telefono.value)],
    [elementos.direccion, validarTextoOpcional(elementos.direccion.value, "la dirección")],
    [elementos.localidad, validarLocalidad(elementos.localidad.value, LOCALIDADES)],
    [elementos.horario, validarTextoOpcional(elementos.horario.value, "el horario")]
  ]);
  if (!valido) return;

  botonCargando(elementos.botonGuardarPerfil, true);
  try {
    if (await existeComercioConNombre(elementos.nombre.value, estado.comercioId)) {
      marcarErrorCampo(elementos.nombre, "Ya hay otro comercio registrado con ese nombre.");
      elementos.nombre.focus();
      return;
    }
    await guardarComercio(estado.comercioId, {
      nombre: elementos.nombre.value.trim(),
      telefono: elementos.telefono.value.trim(),
      direccion: elementos.direccion.value.trim(),
      localidad: elementos.localidad.value,
      horario: elementos.horario.value.trim()
    });
    actualizarAvatares(elementos.nombre.value);
    mostrarAviso("Guardamos los datos de tu comercio.");
  } catch (error) {
    mostrarAviso(manejarError(error, "Guardado del perfil"), "error");
  } finally {
    botonCargando(elementos.botonGuardarPerfil, false);
  }
}

// ======================================================
// Productos: carga, filtros y listado
// ======================================================

async function cargarProductos() {
  mostrarCargando(elementos.lista, "Cargando tus productos...");
  elementos.botonVerMas.hidden = true;
  // "Agregar producto" necesita el catálogo cargado para ofrecer los productos existentes.
  elementos.botonAgregar.disabled = true;
  try {
    const [precios, productos] = await Promise.all([
      listarPreciosPorComercio(estado.comercioId),
      listarProductos()
    ]);
    estado.productos = new Map(productos.map((producto) => [producto.id, producto]));
    estado.items = precios
      .filter((precio) => estado.productos.has(precio.productoId))
      .map((precio) => ({ precio, producto: estado.productos.get(precio.productoId) }))
      .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, "es"));
    renderizarProductos();
    elementos.botonAgregar.disabled = false;
  } catch (error) {
    elementos.resumen.textContent = "";
    mostrarError(elementos.lista, manejarError(error, "Carga de productos"), cargarProductos);
  }
}

function renderizarResumen() {
  const total = estado.items.length;
  const sinStock = estado.items.filter(({ precio }) => !precio.disponible).length;
  const textoTotal = total === 1 ? "1 producto publicado" : `${total} productos publicados`;
  elementos.resumen.textContent = `${textoTotal} · ${sinStock} sin stock`;
}

function renderizarProductos() {
  renderizarResumen();

  if (estado.items.length === 0) {
    mostrarVacio(elementos.lista, "Todavía no publicaste productos", "Usá «Agregar producto» para cargar el primero.");
    elementos.botonVerMas.hidden = true;
    return;
  }

  const filtrados = filtrarItems(estado.items, estado.filtros.obtener());
  if (filtrados.length === 0) {
    mostrarVacio(elementos.lista, "Ningún producto coincide con los filtros", "Probá con otros filtros o borralos.");
    elementos.botonVerMas.hidden = true;
    return;
  }

  const visibles = filtrados.slice(0, estado.cantidadVisible);
  elementos.lista.replaceChildren(...visibles.map(crearFilaProducto));
  elementos.botonVerMas.hidden = filtrados.length <= estado.cantidadVisible;
}

function crearFilaProducto(item) {
  const { precio, producto } = item;
  const fila = document.createElement("article");
  fila.className = "fila-producto";

  const descuento = Number(precio.porcentajeDescuento) || 0;
  const info = document.createElement("div");
  info.className = "fila-producto__info";
  info.innerHTML = `
    <h2 class="fila-producto__nombre">${escaparHTML(producto.nombre)}</h2>
    <p class="fila-producto__precio">
      <span class="precio">${precioHTML(precio.precioFinal)}</span>
      ${descuento > 0 ? `<span class="precio-anterior">${precioTexto(precio.precioOriginal)}</span><span class="fila-producto__descuento">-${descuento}%</span>` : ""}
    </p>
    <p class="fila-producto__fecha">${textoActualizacion(precio.fechaActualizacion)}</p>`;

  const stock = document.createElement("div");
  stock.className = "fila-producto__stock";
  stock.innerHTML = `
    <span class="fila-producto__pregunta" id="stock-${precio.id}">¿En stock?</span>
    <div class="interruptor" role="group" aria-labelledby="stock-${precio.id}">
      <button type="button" class="interruptor__opcion interruptor__opcion--si" aria-pressed="${precio.disponible === true}">Sí</button>
      <button type="button" class="interruptor__opcion interruptor__opcion--no" aria-pressed="${precio.disponible !== true}">No</button>
    </div>`;
  const [botonSi, botonNo] = stock.querySelectorAll("button");
  botonSi.addEventListener("click", () => cambiarStock(item, true, [botonSi, botonNo]));
  botonNo.addEventListener("click", () => cambiarStock(item, false, [botonSi, botonNo]));

  const acciones = document.createElement("div");
  acciones.className = "fila-producto__acciones";
  // Solo el comercio que cargó el producto edita sus datos. Los demás cambian su precio y su stock.
  let botonEditar;
  if (esCreadorDelProducto(producto, estado.comercioId)) {
    botonEditar = document.createElement("button");
    botonEditar.type = "button";
    botonEditar.className = "btn btn--suave btn--chico";
    botonEditar.textContent = "Editar producto";
    botonEditar.addEventListener("click", () => abrirEditarProducto(item));
  } else {
    botonEditar = document.createElement("p");
    botonEditar.className = "fila-producto__nota";
    botonEditar.textContent = "Lo cargó otro comercio. Podés cambiar tu precio y tu stock.";
  }
  const botonPrecio = document.createElement("button");
  botonPrecio.type = "button";
  botonPrecio.className = "btn btn--linea btn--chico";
  botonPrecio.textContent = "Actualizar precio";
  botonPrecio.addEventListener("click", () => abrirActualizarPrecio(item));
  acciones.append(botonEditar, botonPrecio);

  fila.append(crearImagenProducto(producto.imagen, producto.nombre, "imagen-producto--miniatura"), info, stock, acciones);
  return fila;
}

// Fecha local para mostrar "Actualizado hoy" sin volver a leer Firestore.
const fechaLocalAhora = () => ({ toDate: () => new Date() });

async function cambiarStock(item, disponible, botones) {
  if (item.precio.disponible === disponible) return;
  botones.forEach((boton) => (boton.disabled = true));
  try {
    await actualizarDisponibilidad(item.precio.id, disponible);
    item.precio.disponible = disponible;
    item.precio.fechaActualizacion = fechaLocalAhora();
    renderizarProductos();
    mostrarAviso(disponible ? "Marcaste el producto con stock." : "Marcaste el producto sin stock.");
  } catch (error) {
    botones.forEach((boton) => (boton.disabled = false));
    mostrarAviso(manejarError(error, "Cambio de stock"), "error");
  }
}

// ======================================================
// Modal de producto (agregar / editar)
// ======================================================

function mostrarVistaPrevia(url) {
  if (estado.vistaPreviaUrl) URL.revokeObjectURL(estado.vistaPreviaUrl);
  estado.vistaPreviaUrl = null;
  elementos.vistaImagenProducto.replaceChildren();
  if (url) {
    const imagen = document.createElement("img");
    imagen.src = url;
    imagen.alt = "Vista previa de la imagen del producto";
    elementos.vistaImagenProducto.append(imagen);
  }
}

function alElegirImagenProducto() {
  const archivo = elementos.productoImagen.files[0] ?? null;
  const error = validarImagen(archivo);
  marcarErrorCampo(elementos.productoImagen, error);
  if (error) {
    elementos.productoImagen.value = "";
    estado.archivoImagen = null;
    return;
  }
  estado.archivoImagen = archivo;
  mostrarVistaPrevia(archivo ? URL.createObjectURL(archivo) : estado.imagenActual);
  if (archivo) estado.vistaPreviaUrl = elementos.vistaImagenProducto.querySelector("img").src;
}

function completarDatosProducto(producto) {
  elementos.productoNombre.value = producto?.nombre ?? "";
  elementos.productoMarca.value = producto?.marca ?? "";
  elementos.productoDescripcion.value = producto?.descripcion ?? "";
  elementos.productoPresentacion.value = producto?.presentacion ?? "";
  elementos.productoEtiquetas.value = (producto?.etiquetas ?? []).join(", ");
  elementos.productoImagen.value = "";
  estado.archivoImagen = null;
  estado.imagenActual = producto?.imagen ?? "";
  mostrarVistaPrevia(estado.imagenActual);
}

function bloquearDatosProducto(bloquear) {
  camposDatosProducto().forEach((campo) => (campo.disabled = bloquear));
  elementos.accionesImagenProducto.hidden = bloquear;
}

function prepararModalProducto(modo) {
  estado.modoModal = modo;
  elementos.formProducto.reset();
  limpiarErrores(elementos.formProducto);
  ocultarMensaje(elementos.mensajeProducto);
  const agregando = modo === "agregar";
  elementos.tituloModalProducto.textContent = agregando ? "Agregar producto" : "Editar producto";
  elementos.bloqueExistente.hidden = !agregando;
  elementos.bloquePrecioNuevo.hidden = !agregando;
  elementos.avisoCompartido.hidden = agregando;
  elementos.botonGuardarProducto.textContent = agregando ? "Publicar producto" : "Guardar cambios";
  completarDatosProducto(null);
  bloquearDatosProducto(false);
}

function abrirAgregarProducto() {
  prepararModalProducto("agregar");
  estado.itemActivo = null;

  // Solo se ofrecen los productos que este comercio todavía no publicó.
  const publicados = new Set(estado.items.map(({ producto }) => producto.id));
  const disponibles = [...estado.productos.values()]
    .filter((producto) => !publicados.has(producto.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  elementos.productoExistente.innerHTML =
    '<option value="">Producto nuevo (cargar los datos)</option>' +
    disponibles
      .map((p) => `<option value="${escaparHTML(p.id)}">${escaparHTML(p.nombre)}${p.marca ? ` · ${escaparHTML(p.marca)}` : ""}</option>`)
      .join("");

  elementos.nuevoDescuento.value = "0";
  elementos.nuevoDisponible.checked = true;
  actualizarVistaPrevia(elementos.nuevoPrecio, elementos.nuevoDescuento, elementos.nuevoPrecioFinal);
  abrirModal(elementos.modalProducto);
}

function abrirEditarProducto(item) {
  if (!esCreadorDelProducto(item.producto, estado.comercioId)) return;
  prepararModalProducto("editar");
  estado.itemActivo = item;
  completarDatosProducto(item.producto);
  abrirModal(elementos.modalProducto);
}

function alElegirProductoExistente() {
  const producto = estado.productos.get(elementos.productoExistente.value);
  completarDatosProducto(producto);
  bloquearDatosProducto(Boolean(producto));
  camposDatosProducto().forEach((campo) => marcarErrorCampo(campo, ""));
}

function leerDatosProducto() {
  return {
    nombre: elementos.productoNombre.value,
    marca: elementos.productoMarca.value,
    descripcion: elementos.productoDescripcion.value,
    presentacion: elementos.productoPresentacion.value,
    etiquetas: elementos.productoEtiquetas.value,
    imagen: estado.imagenActual
  };
}

function validacionesDatosProducto() {
  return [
    [elementos.productoNombre, validarTextoObligatorio(elementos.productoNombre.value, "el nombre")],
    [elementos.productoMarca, validarTextoOpcional(elementos.productoMarca.value, "la marca")],
    [elementos.productoDescripcion, validarTextoOpcional(elementos.productoDescripcion.value, "la descripción", LIMITES.LARGO_TEXTO)],
    [elementos.productoPresentacion, validarPresentacion(elementos.productoPresentacion.value)],
    [elementos.productoEtiquetas, validarEtiquetas(elementos.productoEtiquetas.value)],
    [elementos.productoImagen, validarImagen(estado.archivoImagen)]
  ];
}

async function guardarProducto(evento) {
  evento.preventDefault();
  ocultarMensaje(elementos.mensajeProducto);
  if (estado.modoModal === "agregar") {
    await publicarProducto();
  } else {
    await editarProducto();
  }
}

async function publicarProducto() {
  const existenteId = elementos.productoExistente.value;
  const validaciones = [
    ...(existenteId ? [] : validacionesDatosProducto()),
    [elementos.nuevoPrecio, validarPrecio(elementos.nuevoPrecio.value)],
    [elementos.nuevoDescuento, validarPorcentaje(elementos.nuevoDescuento.value)]
  ];
  if (!aplicarValidaciones(validaciones)) return;

  const datosPrecio = {
    comercioId: estado.comercioId,
    precioOriginal: Number(elementos.nuevoPrecio.value),
    porcentajeDescuento: Number(elementos.nuevoDescuento.value || 0),
    disponible: elementos.nuevoDisponible.checked
  };

  botonCargando(elementos.botonGuardarProducto, true, "Publicando...");
  let avisoRevision = false;
  try {
    if (existenteId) {
      if (estado.items.some(({ producto }) => producto.id === existenteId)) {
        throw new ErrorSenda("senda/producto-repetido");
      }
      await crearPrecio({ ...datosPrecio, productoId: existenteId });
    } else {
      // La imagen se achica y queda guardada en el producto (campo imagen).
      const productoId = nuevoIdProducto();
      const datos = leerDatosProducto();
      if (estado.archivoImagen) {
        elementos.botonGuardarProducto.textContent = "Subiendo imagen...";
        datos.imagen = await subirImagenProducto(productoId, estado.archivoImagen);
      }
      const { enRevision } = await crearProductoConPrecio(productoId, datos, datosPrecio);
      if (enRevision) avisoRevision = true;
    }
    cerrarModal(elementos.modalProducto);
    mostrarAviso(
      avisoRevision
        ? "Publicaste el producto, pero quedó oculto y en revisión porque tiene palabras no permitidas o no es apto para la venta. El equipo de SENDA lo va a revisar."
        : "Publicaste el producto.",
      avisoRevision ? "error" : undefined
    );
    await cargarProductos();
  } catch (error) {
    mostrarMensaje(elementos.mensajeProducto, manejarError(error, "Publicación de producto"));
  } finally {
    botonCargando(elementos.botonGuardarProducto, false);
  }
}

async function editarProducto() {
  if (!aplicarValidaciones(validacionesDatosProducto())) return;
  const item = estado.itemActivo;
  const datos = leerDatosProducto();

  botonCargando(elementos.botonGuardarProducto, true);
  try {
    if (estado.archivoImagen) {
      elementos.botonGuardarProducto.textContent = "Subiendo imagen...";
      datos.imagen = await subirImagenProducto(item.producto.id, estado.archivoImagen);
    }
    const { enRevision } = await actualizarProductoRevisado(item.producto.id, datos, estado.comercioId);
    Object.assign(item.producto, normalizarProducto(datos));
    cerrarModal(elementos.modalProducto);
    renderizarProductos();
    if (enRevision) {
      mostrarAviso("Guardamos los cambios, pero el producto quedó oculto y en revisión porque tiene palabras no permitidas o no es apto para la venta.", "error");
    } else {
      mostrarAviso("Guardamos los cambios del producto.");
    }
  } catch (error) {
    mostrarMensaje(elementos.mensajeProducto, manejarError(error, "Edición de producto"));
  } finally {
    botonCargando(elementos.botonGuardarProducto, false);
  }
}

// ======================================================
// Modal de precio
// ======================================================

function actualizarVistaPrevia(inputPrecio, inputDescuento, salida) {
  const errorPrecio = validarPrecio(inputPrecio.value);
  const errorDescuento = validarPorcentaje(inputDescuento.value);
  if (errorPrecio || errorDescuento) {
    salida.textContent = "";
    return;
  }
  const descuento = Number(inputDescuento.value || 0);
  const final = calcularPrecioFinal(Number(inputPrecio.value), descuento);
  salida.innerHTML = `Precio final publicado: <strong>${precioTexto(final)}</strong>${descuento > 0 ? ` (con ${descuento}% de descuento)` : ""}`;
}

function abrirActualizarPrecio(item) {
  estado.itemActivo = item;
  elementos.formPrecio.reset();
  limpiarErrores(elementos.formPrecio);
  ocultarMensaje(elementos.mensajePrecio);
  elementos.nombreProductoPrecio.textContent = item.producto.nombre;
  elementos.precioOriginal.value = item.precio.precioOriginal ?? "";
  elementos.precioDescuento.value = item.precio.porcentajeDescuento ?? 0;
  actualizarVistaPrevia(elementos.precioOriginal, elementos.precioDescuento, elementos.precioFinal);
  abrirModal(elementos.modalPrecio);
}

async function guardarPrecio(evento) {
  evento.preventDefault();
  ocultarMensaje(elementos.mensajePrecio);
  const valido = aplicarValidaciones([
    [elementos.precioOriginal, validarPrecio(elementos.precioOriginal.value)],
    [elementos.precioDescuento, validarPorcentaje(elementos.precioDescuento.value)]
  ]);
  if (!valido) return;

  const item = estado.itemActivo;
  const precioOriginal = Number(elementos.precioOriginal.value);
  const porcentajeDescuento = Number(elementos.precioDescuento.value || 0);

  botonCargando(elementos.botonGuardarPrecio, true);
  try {
    await actualizarPrecio(item.precio.id, { precioOriginal, porcentajeDescuento });
    Object.assign(item.precio, {
      precioOriginal,
      porcentajeDescuento,
      precioFinal: calcularPrecioFinal(precioOriginal, porcentajeDescuento),
      fechaActualizacion: fechaLocalAhora()
    });
    cerrarModal(elementos.modalPrecio);
    renderizarProductos();
    mostrarAviso("Actualizaste el precio.");
  } catch (error) {
    mostrarMensaje(elementos.mensajePrecio, manejarError(error, "Actualización de precio"));
  } finally {
    botonCargando(elementos.botonGuardarPrecio, false);
  }
}

// ======================================================
// Eventos e inicio
// ======================================================

function prepararEventos() {
  elementos.formPerfil.addEventListener("submit", guardarPerfil);
  elementos.nombre.addEventListener("input", () => actualizarAvatares(elementos.nombre.value));

  elementos.botonVerMas.addEventListener("click", () => {
    estado.cantidadVisible += LIMITES.PRODUCTOS_POR_PAGINA;
    renderizarProductos();
  });

  elementos.botonAgregar.addEventListener("click", abrirAgregarProducto);
  elementos.productoExistente.addEventListener("change", alElegirProductoExistente);
  elementos.productoImagen.addEventListener("change", alElegirImagenProducto);
  elementos.archivoFoto.addEventListener("change", () => cambiarImagenComercio("foto", elementos.archivoFoto, elementos.botonFoto));
  elementos.archivoFondo.addEventListener("change", () => cambiarImagenComercio("fondo", elementos.archivoFondo, elementos.botonFondo));
  elementos.formProducto.addEventListener("submit", guardarProducto);
  elementos.formPrecio.addEventListener("submit", guardarPrecio);

  for (const [precio, descuento, salida] of [
    [elementos.nuevoPrecio, elementos.nuevoDescuento, elementos.nuevoPrecioFinal],
    [elementos.precioOriginal, elementos.precioDescuento, elementos.precioFinal]
  ]) {
    const actualizar = () => actualizarVistaPrevia(precio, descuento, salida);
    precio.addEventListener("input", actualizar);
    descuento.addEventListener("input", actualizar);
  }

  prepararModal(elementos.modalProducto);
  prepararModal(elementos.modalPrecio);

}

// ======================================================
// Panel del equipo (administrador y empleados): validación de comercios
// Un comercio se aprueba o rechaza cambiando el campo "rol" de su documento en "usuarios".
// El empleado ve las mismas pestañas, pero solo los botones de las tareas que tiene habilitadas.
// ======================================================

// El administrador ve las cuentas de comercio en tres pestañas: Pendientes, Validados y Bloqueados.
// Cada comercio ocupa un renglón y las acciones son íconos, como pidió la profesora:
//   Pendientes: ojo (ver perfil), tilde (aceptar) y tachito (rechazar).
//   Validados:  ojo y tachito (bloquear).
//   Bloqueados: ojo, tilde (volver a habilitar) y tachito (eliminar la cuenta).
// Desde el perfil del comercio (ojo) el administrador puede eliminar productos no aptos
// y también cambiar el estado de la cuenta. Las acciones están en accionesComercio.js.

const ICONOS = {
  aceptar: '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  rechazar:
    '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
  ver: '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
};

const ESTADOS_COMERCIO = [ROLES.PENDIENTE, ROLES.COMERCIO, ROLES.RECHAZADO];

const TEXTO_VACIO = {
  [ROLES.PENDIENTE]: "No hay comercios esperando validación.",
  [ROLES.COMERCIO]: "Todavía no hay comercios validados.",
  [ROLES.RECHAZADO]: "No hay comercios bloqueados."
};

const admin = {
  lista: $("lista-solicitudes"),
  pestanas: document.querySelectorAll(".pestanas__boton"),
  botonDatosPrueba: $("boton-datos-prueba"),
  progresoDatosPrueba: $("progreso-datos-prueba"),
  credenciales: $("credenciales-prueba"),
  tablaCredenciales: $("tabla-credenciales"),
  rolVisible: ROLES.PENDIENTE,
  // Quien usa el panel: { uid, nombre, correo, rol, empleado } (ver obtenerActor).
  actor: null,
  // Para cada estado, la lista de { usuario, comercio }.
  porEstado: { [ROLES.PENDIENTE]: [], [ROLES.COMERCIO]: [], [ROLES.RECHAZADO]: [] }
};

async function cargarSolicitudes() {
  mostrarCargando(admin.lista, "Cargando comercios...");
  try {
    const listas = await Promise.all(
      ESTADOS_COMERCIO.map(async (rol) => {
        const usuarios = await listarUsuariosPorRol(rol);
        const [comercios, correos] = await Promise.all([
          Promise.all(usuarios.map((usuario) => obtenerComercio(usuario.id))),
          Promise.all(usuarios.map((usuario) => obtenerCorreoComercio(usuario.id)))
        ]);
        return usuarios
          .map((usuario, i) => ({ usuario, comercio: comercios[i], correo: correos[i] }))
          .sort((a, b) => (a.comercio?.nombre ?? "").localeCompare(b.comercio?.nombre ?? "", "es"));
      })
    );
    ESTADOS_COMERCIO.forEach((rol, i) => (admin.porEstado[rol] = listas[i]));
    renderizarSolicitudes();
  } catch (error) {
    mostrarError(admin.lista, manejarError(error, "Carga de comercios"), cargarSolicitudes);
  }
}

function renderizarSolicitudes() {
  for (const rol of ESTADOS_COMERCIO) {
    document.querySelector(`[data-cantidad="${rol}"]`).textContent = admin.porEstado[rol].length;
  }
  admin.pestanas.forEach((pestana) => {
    const activa = pestana.dataset.rol === admin.rolVisible;
    pestana.setAttribute("aria-selected", String(activa));
    if (activa) admin.lista.setAttribute("aria-labelledby", pestana.id);
  });

  const lista = admin.porEstado[admin.rolVisible];
  if (lista.length === 0) {
    mostrarVacio(admin.lista, TEXTO_VACIO[admin.rolVisible]);
    return;
  }
  const tabla = document.createElement("table");
  tabla.className = "tabla-solicitudes";
  tabla.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Comercio</th>
        <th scope="col">Dueño</th>
        <th scope="col">Dirección</th>
        <th scope="col">Correo</th>
        <th scope="col">Teléfono</th>
        <th scope="col">Horario</th>
        <th scope="col"><span class="solo-lectores">Acciones</span></th>
      </tr>
    </thead>
    <tbody></tbody>`;
  tabla.tBodies[0].append(...lista.map(crearFilaSolicitud));
  admin.lista.replaceChildren(tabla);
}

admin.pestanas.forEach((pestana) =>
  pestana.addEventListener("click", () => {
    admin.rolVisible = pestana.dataset.rol;
    renderizarSolicitudes();
  })
);

function celdaDato(valor) {
  const celda = document.createElement("td");
  if (valor) celda.textContent = valor;
  else celda.innerHTML = '<span class="solicitud__falta">Sin cargar</span>';
  return celda;
}

// El correo abre el programa de correo para escribirle al comercio.
// Los comercios registrados antes de guardar el correo lo completan al entrar a su panel.
function celdaCorreo(correo) {
  const celda = document.createElement("td");
  if (correo) {
    const enlace = document.createElement("a");
    enlace.href = `mailto:${correo}`;
    enlace.textContent = correo;
    celda.append(enlace);
  } else {
    celda.innerHTML = '<span class="solicitud__falta" title="Se completa cuando el comercio entra a su panel">Sin cargar</span>';
  }
  return celda;
}

function crearFilaSolicitud(solicitud) {
  const { usuario, comercio } = solicitud;
  const nombre = comercio?.nombre || "Comercio sin datos cargados";

  const fila = document.createElement("tr");
  const celdaNombre = document.createElement("th");
  celdaNombre.scope = "row";
  celdaNombre.textContent = nombre;
  fila.append(
    celdaNombre,
    celdaDato(comercio?.dueno),
    celdaDato(comercio?.direccion),
    celdaCorreo(solicitud.correo),
    celdaDato(comercio?.telefono),
    celdaDato(comercio?.horario)
  );

  const acciones = document.createElement("td");
  acciones.className = "tabla-solicitudes__acciones";
  if (comercio) {
    const enlace = document.createElement("a");
    enlace.className = "boton-icono";
    enlace.href = rutaPerfilComercio(usuario.id);
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.title = `Ver perfil de ${nombre}`;
    enlace.setAttribute("aria-label", `Ver perfil de ${nombre}`);
    enlace.innerHTML = ICONOS.ver;
    acciones.append(enlace);
  }
  for (const { icono, texto, destino } of accionesPermitidas(admin.rolVisible, admin.actor)) {
    acciones.append(crearBotonIcono(icono, `${texto}: ${nombre}`, () => cambiarEstado(solicitud, destino)));
  }
  fila.append(acciones);
  return fila;
}

function crearBotonIcono(tipo, etiqueta, alHacerClic) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = `boton-icono boton-icono--${tipo}`;
  boton.title = etiqueta;
  boton.setAttribute("aria-label", etiqueta);
  boton.innerHTML = ICONOS[tipo];
  boton.addEventListener("click", alHacerClic);
  return boton;
}

// destino: un rol nuevo o ELIMINAR_CUENTA.
async function cambiarEstado(solicitud, destino) {
  const nombre = solicitud.comercio?.nombre || "este comercio";
  const rolAnterior = admin.rolVisible;
  admin.lista.querySelectorAll("button").forEach((boton) => (boton.disabled = true));
  try {
    const resultado = await aplicarAccionComercio({
      comercioId: solicitud.usuario.id,
      nombre,
      rolActual: rolAnterior,
      destino,
      actor: admin.actor,
      origen: ORIGENES.PANEL
    });
    if (resultado) {
      admin.porEstado[rolAnterior] = admin.porEstado[rolAnterior].filter((s) => s !== solicitud);
      if (destino !== ELIMINAR_CUENTA) {
        admin.porEstado[destino] = [...admin.porEstado[destino], solicitud].sort((a, b) =>
          (a.comercio?.nombre ?? "").localeCompare(b.comercio?.nombre ?? "", "es")
        );
      }
      mostrarAviso(resultado);
    }
    renderizarSolicitudes();
  } catch (error) {
    renderizarSolicitudes();
    mostrarAviso(manejarError(error, "Cambio de estado del comercio"), "error");
  }
}

async function cargarDatosDePrueba() {
  const aceptado = await confirmar({
    titulo: "Cargar datos de prueba",
    texto: "Se crean 3 comercios ficticios validados, con 6 productos con imagen cada uno, y 6 cuentas personales con foto, favoritos, reacciones y comentarios. Si ya existen, se actualizan sus datos.",
    textoAceptar: "Cargar"
  });
  if (!aceptado) return;

  admin.botonDatosPrueba.disabled = true;
  try {
    const cuentas = await cargarComerciosDePrueba((texto) => (admin.progresoDatosPrueba.textContent = texto));
    admin.progresoDatosPrueba.textContent = "Listo. Los datos y las imágenes quedaron guardados en Firestore.";
    admin.tablaCredenciales.innerHTML = cuentas
      .map(({ tipo, nombre, email, password }) => `<tr><td>${escaparHTML(tipo)}</td><td>${escaparHTML(nombre)}</td><td>${escaparHTML(email)}</td><td><code>${escaparHTML(password)}</code></td></tr>`)
      .join("");
    admin.credenciales.hidden = false;
    admin.rolVisible = ROLES.COMERCIO;
    await cargarSolicitudes();
    mostrarAviso("Se cargaron los 3 comercios de prueba y las 6 cuentas personales.");
  } catch (error) {
    admin.progresoDatosPrueba.textContent = manejarError(error, "Carga de datos de prueba");
  } finally {
    admin.botonDatosPrueba.disabled = false;
  }
}

// ======================================================
// Inicio
// ======================================================

// Muestra solo los elementos del panel que corresponde al rol (atributo data-panel del HTML).
function mostrarPanel(nombre) {
  document.querySelectorAll("[data-panel]").forEach((elemento) => {
    elemento.hidden = elemento.dataset.panel !== nombre;
  });
}

async function iniciarPanelComercio() {
  mostrarPanel("comercio");
  document.title = "Mi comercio · SENDA";
  elementos.enlacePerfilPublico.href = rutaPerfilComercio(estado.comercioId);
  // Guarda el correo de la cuenta para que el administrador lo vea (cuentas creadas antes de este cambio).
  sincronizarCorreoComercio(estado.comercioId, estado.correo).catch((error) => manejarError(error, "Correo del comercio"));
  estado.filtros = crearFiltros(elementos.filtros, {
    modoStock: "sinStock",
    alCambiar: () => {
      estado.cantidadVisible = LIMITES.PRODUCTOS_POR_PAGINA;
      renderizarProductos();
    }
  });
  prepararEventos();
  elementos.cargaPagina.hidden = true;
  // Si el administrador eliminó algún producto, el aviso aparece al entrar al panel.
  revisarAvisosDelComercio(estado.comercioId);
  revisarAvisosDeModeracion(estado.comercioId);
  await Promise.all([cargarPerfil(), cargarProductos()]);
}

// Textos de la cabecera de cada sección del equipo.
const SECCIONES_EQUIPO = {
  comercios: {
    titulo: "Validación de comercios",
    texto: 'Cuentas de comercio separadas por estado. El tilde acepta o vuelve a habilitar un comercio. El tachito rechaza o bloquea, y en "Bloqueados" elimina la cuenta. El ojo abre el perfil del comercio para revisar sus productos.'
  },
  empleados: {
    titulo: "Empleados",
    texto: "Cuentas del equipo de SENDA. Las casillas eligen qué tareas puede hacer cada empleado y se guardan al marcarlas. La X deshabilita la cuenta."
  },
  revision: {
    titulo: "Revisión de reportes",
    texto: "Lo que recibió 3 reportes o tiene palabras no permitidas. Primero lo marcado con prioridad y después lo más reportado. Cada decisión pide un motivo y queda en el historial."
  },
  historial: {
    titulo: "Historial de moderación",
    texto: "Quién validó, bloqueó o eliminó cada cuenta, cuándo, por qué y desde dónde. Solo lo ve el administrador."
  }
};

const seccionesCargadas = new Set();

// Muestra la sección del menú según el # de la dirección (#comercios, #empleados o #historial).
function mostrarSeccionEquipo() {
  const esAdmin = admin.actor.rol === ROLES.ADMIN;
  const puedeModerar = esAdmin || admin.actor.empleado?.permisos?.moderar === true;
  let nombre = window.location.hash.slice(1);
  const permitida = esAdmin || nombre === "comercios" || (nombre === "revision" && puedeModerar);
  if (!SECCIONES_EQUIPO[nombre] || !permitida) nombre = "comercios";
  document.querySelectorAll("[data-seccion]").forEach((seccion) => (seccion.hidden = seccion.dataset.seccion !== nombre));
  document.querySelectorAll("[data-seccion-equipo]").forEach((enlace) => {
    const activo = enlace.dataset.seccionEquipo === nombre;
    enlace.classList.toggle("navegacion__enlace--activo", activo);
    if (activo) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  });
  $("titulo-equipo").textContent = SECCIONES_EQUIPO[nombre].titulo;
  $("texto-equipo").textContent =
    esAdmin || nombre !== "comercios"
      ? SECCIONES_EQUIPO[nombre].texto
      : "Cuentas de comercio separadas por estado. Solo ves los botones de las tareas que el administrador te habilitó. El ojo abre el perfil del comercio.";
  document.title = `${SECCIONES_EQUIPO[nombre].titulo} · SENDA`;
  // Empleados e historial se leen la primera vez que se abren.
  if (seccionesCargadas.has(nombre)) return;
  seccionesCargadas.add(nombre);
  if (nombre === "empleados") cargarEmpleados();
  if (nombre === "historial") cargarHistorial();
  if (nombre === "revision") cargarRevision();
}

async function iniciarPanelAdmin(actor) {
  admin.actor = actor;
  const esAdmin = actor.rol === ROLES.ADMIN;
  mostrarPanel("admin");
  document.querySelectorAll("[data-solo-admin]").forEach((elemento) => (elemento.hidden = !esAdmin));
  document.querySelectorAll("[data-solo-empleado]").forEach((elemento) => (elemento.hidden = esAdmin));
  const puedeModerar = esAdmin || actor.empleado?.permisos?.moderar === true;
  document.querySelectorAll("[data-solo-moderador]").forEach((elemento) => (elemento.hidden = !puedeModerar));
  if (puedeModerar) {
    prepararRevision(actor);
    // El número de "Revisión" se ve desde cualquier sección.
    if (!window.location.hash.includes("revision")) cargarRevision();
  }
  $("rol-encabezado").textContent = esAdmin ? "Administración" : `Empleado · ${actor.nombre}`;

  if (esAdmin) {
    admin.botonDatosPrueba.addEventListener("click", cargarDatosDePrueba);
    prepararEmpleados(actor);
    prepararHistorial();
  } else {
    prepararCambioDeContrasena();
    // Sin el permiso "Ver pendientes" la pestaña de solicitudes nuevas no aparece.
    if (!actor.empleado.permisos?.verPendientes) {
      $("pestana-pendiente").hidden = true;
      admin.rolVisible = ROLES.COMERCIO;
    }
  }
  window.addEventListener("hashchange", mostrarSeccionEquipo);
  mostrarSeccionEquipo();
  elementos.cargaPagina.hidden = true;
  // Mensaje que deja el perfil del comercio después de eliminar una cuenta.
  try {
    const aviso = sessionStorage.getItem("senda:aviso-admin");
    if (aviso) {
      sessionStorage.removeItem("senda:aviso-admin");
      admin.rolVisible = ROLES.RECHAZADO;
      mostrarAviso(aviso);
    }
  } catch {
    // Sin sessionStorage no hay mensaje.
  }
  await cargarSolicitudes();
}

// Empleado deshabilitado: un aviso grande y el botón para cerrar sesión. Nada más.
function mostrarCuentaDeshabilitada() {
  mostrarPanel("deshabilitado");
  document.title = "Cuenta deshabilitada · SENDA";
  document.querySelector(".encabezado__acciones").hidden = true;
  elementos.cargaPagina.hidden = true;
  $("boton-salir-deshabilitado").addEventListener("click", async () => {
    await cerrarSesion().catch(() => {});
    window.location.replace(RUTAS.INICIO);
  });
}

async function iniciar() {
  let sesion;
  try {
    sesion = await protegerPagina([ROLES.COMERCIO, ROLES.ADMIN, ROLES.EMPLEADO]);
  } catch (error) {
    elementos.textoCargaPagina.textContent = manejarError(error, "Acceso al panel");
    return;
  }

  elementos.botonCerrarSesion.addEventListener("click", async () => {
    try {
      await cerrarSesion();
      window.location.replace(RUTAS.INICIO);
    } catch (error) {
      mostrarAviso(manejarError(error, "Cierre de sesión"), "error");
    }
  });

  if (sesion.perfil.rol === ROLES.ADMIN || sesion.perfil.rol === ROLES.EMPLEADO) {
    let actor;
    try {
      actor = await obtenerActor(sesion.usuario, sesion.perfil.rol);
    } catch (error) {
      elementos.textoCargaPagina.textContent = manejarError(error, "Datos del equipo");
      return;
    }
    if (actor.rol === ROLES.EMPLEADO && !actor.empleado?.activo) {
      mostrarCuentaDeshabilitada();
      return;
    }
    await iniciarPanelAdmin(actor);
  } else {
    estado.comercioId = sesion.usuario.uid;
    estado.correo = sesion.usuario.email ?? "";
    await iniciarPanelComercio();
  }
}

iniciar();
