// Cuenta personal (rol "cliente"). Solo la ve su dueño. Tiene una barra lateral con tres secciones:
//
//   Mi perfil (#perfil): lo que ven los demás (foto, nombre de usuario y comentarios publicados),
//     más el nombre y el correo, marcados como privados. "Editar perfil" cambia la foto y el nombre.
//   Mis favoritos (#favoritos): lista privada con buscador y los avisos de cambio de precio.
//   Configuración (#configuracion): avisos de precio, modo oscuro, idioma, y los datos de acceso
//     (correo, contraseña y eliminar la cuenta).
//
// "Cerrar sesión" está en el encabezado, arriba a la derecha, como en el panel de los comercios.
// No hay dirección, teléfono, horario ni datos de pago: SENDA compara precios, no vende.

import { ROLES, RUTAS, LOCALIDADES, LOCALIDAD_PREDETERMINADA } from "../core/constants.js";
import {
  validarEmail,
  validarPassword,
  validarPasswordNueva,
  validarTextoObligatorio,
  validarImagen,
  normalizarTexto,
  validarLocalidad
} from "../core/validators.js";
import { manejarError, obtenerMensajeError } from "../core/errores.js";
import {
  cerrarSesion,
  correoActual,
  usaContrasena,
  reautenticar,
  cambiarCorreo,
  cambiarContrasena,
  eliminarUsuarioActual
} from "../services/authService.js";
import {
  obtenerMiCuenta,
  actualizarNombreCliente,
  actualizarLocalidadCliente,
  subirFotoCliente,
  obtenerClientes,
  listarComentariosDeCliente,
  eliminarDatosDeCuenta,
  guardarPreferenciaAvisos
} from "../services/clientesService.js";
import {
  obtenerFavoritos,
  vincularFavoritosConCuenta,
  olvidarFavoritosLocales,
  EVENTO_FAVORITOS
} from "../services/productosService.js";
import { cargarCatalogo } from "../services/preciosService.js";
import { obtenerOcultos, mostrarComercio, desbloquearCuenta } from "../services/bloqueosService.js";
import { revisarCambiosDePrecio, marcarCambiosVistos } from "../services/avisosPrecioService.js";
import { eliminarComentario } from "../services/opinionesService.js";
import { borrarHistorial } from "../services/historialService.js";
import {
  escaparHTML,
  iniciales,
  precioTexto,
  mostrarCargando,
  mostrarError,
  mostrarVacio,
  mostrarAviso,
  mostrarMensaje,
  ocultarMensaje,
  marcarErrorCampo,
  aplicarValidaciones,
  botonCargando,
  confirmar,
  prepararModal,
  abrirModal,
  cerrarModal,
  llenarSelectorLocalidad
} from "../ui/feedback.js";
import { crearTarjetaResumen, rutaDetalleProducto } from "../ui/components/tarjetaProducto.js";
import { crearTarjetaComentario, htmlFotoCliente, rutaPerfilPublico } from "../ui/components/tarjetaComentario.js";
import { modoOscuroActivo, aplicarModoOscuro } from "../ui/preferencias.js";
import { protegerPagina, prepararBarraPublica } from "../guards/sessionGuard.js";

const $ = (id) => document.getElementById(id);
const SECCIONES = ["perfil", "favoritos", "configuracion"];

const elementos = {
  barra: $("barra-publica"),
  botonSalir: $("boton-cerrar-sesion"),
  carga: $("carga-perfil"),
  marco: $("marco-perfil"),
  opcionesMenu: document.querySelectorAll("[data-seccion]"),
  // Mi perfil
  fotoPerfil: $("foto-perfil"),
  usuarioPerfil: $("usuario-perfil"),
  nombrePerfil: $("nombre-perfil"),
  correoPerfil: $("correo-perfil"),
  enlacePublico: $("enlace-perfil-publico"),
  botonEditar: $("boton-editar-perfil"),
  listaComentarios: $("lista-mis-comentarios"),
  // Editar perfil
  modalEditar: $("modal-editar"),
  formEditar: $("form-editar"),
  fotoEditar: $("foto-editar"),
  inputFoto: $("input-foto"),
  inputNombre: $("input-nombre"),
  inputLocalidad: $("input-localidad"),
  usuarioFijo: $("usuario-fijo"),
  botonGuardarPerfil: $("boton-guardar-perfil"),
  // Mis favoritos
  globoAvisos: $("globo-avisos"),
  bloqueAvisos: $("bloque-avisos"),
  avisoDesactivados: $("aviso-desactivados"),
  listaAvisos: $("lista-avisos"),
  botonTodosVistos: $("boton-todos-vistos"),
  resumenFavoritos: $("resumen-favoritos"),
  buscarFavoritos: $("buscar-favoritos"),
  listaFavoritos: $("lista-favoritos"),
  // Configuración
  interruptorAvisos: $("interruptor-avisos"),
  interruptorOscuro: $("interruptor-oscuro"),
  botonIdioma: $("boton-idioma"),
  modalIdioma: $("modal-idioma"),
  avisoGoogle: $("aviso-google"),
  opcionCorreo: $("opcion-correo"),
  opcionPassword: $("opcion-password"),
  formCorreo: $("form-correo"),
  correoNuevo: $("correo-nuevo"),
  correoPassword: $("correo-password"),
  mensajeCorreo: $("mensaje-correo"),
  botonCorreo: $("boton-correo"),
  formPassword: $("form-password"),
  passwordActual: $("password-actual"),
  passwordNueva: $("password-nueva"),
  passwordRepetir: $("password-repetir"),
  mensajePassword: $("mensaje-password"),
  botonPassword: $("boton-password"),
  formEliminar: $("form-eliminar"),
  campoEliminarPassword: $("campo-eliminar-password"),
  eliminarPassword: $("eliminar-password"),
  mensajeEliminar: $("mensaje-eliminar"),
  botonEliminar: $("boton-eliminar")
};

const estado = {
  uid: null,
  cuenta: null,
  catalogo: null,
  cambios: [],
  avisosActivos: true,
  comentarios: []
};

// ======================================================
// Barra lateral: cada sección tiene su ancla (#perfil, #favoritos, #configuracion)
// ======================================================

function seccionActual() {
  const ancla = window.location.hash.slice(1);
  return SECCIONES.includes(ancla) ? ancla : "perfil";
}

function mostrarSeccion() {
  const actual = seccionActual();
  for (const seccion of SECCIONES) $(`panel-${seccion}`).hidden = seccion !== actual;
  elementos.opcionesMenu.forEach((opcion) => {
    const activa = opcion.dataset.seccion === actual;
    opcion.classList.toggle("perfil-menu__opcion--activa", activa);
    if (activa) opcion.setAttribute("aria-current", "page");
    else opcion.removeAttribute("aria-current");
  });
}

window.addEventListener("hashchange", () => {
  mostrarSeccion();
  window.scrollTo({ top: 0 });
});

// ======================================================
// Mi perfil
// ======================================================

function renderizarFicha() {
  const { cuenta } = estado;
  elementos.fotoPerfil.innerHTML = htmlFotoCliente(cuenta, "perfil-tarjeta__foto");
  elementos.usuarioPerfil.textContent = `@${cuenta.usuario}`;
  elementos.nombrePerfil.textContent = cuenta.nombre || "Sin nombre";
  elementos.correoPerfil.textContent = correoActual();
  elementos.enlacePublico.href = rutaPerfilPublico(estado.uid);
  document.title = `@${cuenta.usuario} · SENDA`;
}

// Actualiza la foto de la barra sin recargar la página.
function actualizarBarra() {
  const imagen = elementos.barra.querySelector("[data-foto-sesion]");
  const letras = elementos.barra.querySelector("[data-iniciales-sesion]");
  letras.textContent = iniciales(estado.cuenta.usuario);
  imagen.hidden = !estado.cuenta.foto;
  letras.hidden = Boolean(estado.cuenta.foto);
  if (estado.cuenta.foto) imagen.src = estado.cuenta.foto;
}

function renderizarComentarios() {
  if (estado.comentarios.length === 0) {
    mostrarVacio(
      elementos.listaComentarios,
      "Todavía no publicaste comentarios",
      "Podés comentar desde el detalle de cada producto, con el botón \"Ver comentarios\"."
    );
    return;
  }
  const { productoPorId, comercioPorId } = estado.catalogo;
  elementos.listaComentarios.replaceChildren(
    ...estado.comentarios.map((comentario) =>
      crearTarjetaComentario({
        comentario,
        autor: estado.cuenta,
        producto: productoPorId.get(comentario.productoId),
        comercio: comercioPorId.get(comentario.comercioId),
        alBorrar: borrarComentario
      })
    )
  );
}

async function borrarComentario(comentario) {
  const aceptado = await confirmar({
    titulo: "Borrar tu comentario",
    texto: "El comentario deja de verse para todos los clientes.",
    textoAceptar: "Borrar",
    peligro: true
  });
  if (!aceptado) return;
  try {
    await eliminarComentario(comentario.id);
    estado.comentarios = estado.comentarios.filter((c) => c !== comentario);
    renderizarComentarios();
    mostrarAviso("Se borró el comentario.");
  } catch (error) {
    mostrarAviso(manejarError(error, "Borrado de comentario propio"), "error");
  }
}

// ---------- Editar perfil (modal) ----------

elementos.botonEditar.addEventListener("click", () => {
  elementos.inputNombre.value = estado.cuenta.nombre;
  marcarErrorCampo(elementos.inputNombre, "");
  marcarErrorCampo(elementos.inputLocalidad, "");
  llenarSelectorLocalidad(elementos.inputLocalidad, LOCALIDADES, { valor: estado.cuenta.localidad || LOCALIDAD_PREDETERMINADA });
  elementos.fotoEditar.innerHTML = htmlFotoCliente(estado.cuenta, "perfil-tarjeta__foto");
  elementos.usuarioFijo.textContent = `@${estado.cuenta.usuario}. No se puede cambiar, porque identifica tus comentarios.`;
  abrirModal(elementos.modalEditar);
});

elementos.inputFoto.addEventListener("change", async () => {
  const archivo = elementos.inputFoto.files[0];
  elementos.inputFoto.value = "";
  if (!archivo) return;
  const error = validarImagen(archivo, true);
  if (error) {
    mostrarAviso(error, "error");
    return;
  }
  try {
    estado.cuenta.foto = await subirFotoCliente(estado.uid, archivo);
    elementos.fotoEditar.innerHTML = htmlFotoCliente(estado.cuenta, "perfil-tarjeta__foto");
    renderizarFicha();
    renderizarComentarios();
    actualizarBarra();
    mostrarAviso("Actualizaste tu foto.");
  } catch (e) {
    mostrarAviso(manejarError(e, "Foto de la cuenta personal"), "error");
  }
});

elementos.formEditar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const error = validarTextoObligatorio(elementos.inputNombre.value, "tu nombre", 60);
  if (!aplicarValidaciones([
    [elementos.inputNombre, error],
    [elementos.inputLocalidad, validarLocalidad(elementos.inputLocalidad.value, LOCALIDADES)]
  ])) return;
  botonCargando(elementos.botonGuardarPerfil, true);
  try {
    await actualizarNombreCliente(estado.uid, elementos.inputNombre.value);
    estado.cuenta.nombre = elementos.inputNombre.value.trim();
    if (elementos.inputLocalidad.value !== estado.cuenta.localidad) {
      await actualizarLocalidadCliente(estado.uid, elementos.inputLocalidad.value);
      estado.cuenta.localidad = elementos.inputLocalidad.value;
    }
    renderizarFicha();
    cerrarModal(elementos.modalEditar);
    mostrarAviso("Guardaste los cambios de tu perfil.");
  } catch (e) {
    marcarErrorCampo(elementos.inputNombre, manejarError(e, "Nombre de la cuenta personal"));
  } finally {
    botonCargando(elementos.botonGuardarPerfil, false);
  }
});

// ======================================================
// Mis favoritos y avisos de precio
// ======================================================

function textoCambio({ tipo, antes, ahora, descuento }) {
  const conDescuento = descuento > 0 ? ` Tiene ${descuento}% de descuento.` : "";
  if (tipo === "bajo") return `Bajó de ${precioTexto(antes)} a <strong>${precioTexto(ahora)}</strong>.${conDescuento}`;
  if (tipo === "subio") return `Subió de ${precioTexto(antes)} a <strong>${precioTexto(ahora)}</strong>.`;
  if (tipo === "sin-stock") return "Ningún comercio tiene stock en este momento.";
  return `Volvió a haber stock, desde <strong>${precioTexto(ahora)}</strong>.${conDescuento}`;
}

function renderizarAvisos() {
  const cantidad = estado.avisosActivos ? estado.cambios.length : 0;
  elementos.bloqueAvisos.hidden = cantidad === 0;
  elementos.avisoDesactivados.hidden = estado.avisosActivos;
  elementos.globoAvisos.hidden = cantidad === 0;
  elementos.globoAvisos.textContent = cantidad;
  elementos.barra.querySelector(".cuenta-sesion__aviso")?.remove();
  if (cantidad === 0) return;

  elementos.listaAvisos.replaceChildren(
    ...estado.cambios.map((cambio) => {
      const item = document.createElement("li");
      item.className = `aviso-precio aviso-precio--${cambio.tipo}`;
      item.innerHTML = `
        <span class="aviso-precio__marca" aria-hidden="true"></span>
        <div class="aviso-precio__datos">
          <a class="aviso-precio__producto" href="${rutaDetalleProducto(cambio.productoId)}">${escaparHTML(cambio.producto.nombre)}</a>
          <p class="aviso-precio__texto">${textoCambio(cambio)}</p>
        </div>`;
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn--suave btn--chico";
      boton.textContent = "Entendido";
      boton.addEventListener("click", () => marcarVistos([cambio]));
      item.append(boton);
      return item;
    })
  );
}

async function marcarVistos(cambios) {
  try {
    await marcarCambiosVistos(estado.uid, cambios);
    estado.cambios = estado.cambios.filter((c) => !cambios.includes(c));
    renderizarAvisos();
  } catch (error) {
    mostrarAviso(manejarError(error, "Avisos de precio"), "error");
  }
}

elementos.botonTodosVistos.addEventListener("click", () => marcarVistos([...estado.cambios]));

function renderizarFavoritos() {
  const ids = obtenerFavoritos();
  const porId = new Map(estado.catalogo.productos.map((r) => [r.producto.id, r]));
  const publicados = ids.map((id) => porId.get(id)).filter(Boolean);
  const noPublicados = ids.length - publicados.length;

  const busqueda = normalizarTexto(elementos.buscarFavoritos.value);
  const visibles = busqueda
    ? publicados.filter((r) => normalizarTexto(`${r.producto.nombre} ${r.producto.marca ?? ""}`).includes(busqueda))
    : publicados;

  const partes = [`${publicados.length} ${publicados.length === 1 ? "producto guardado" : "productos guardados"}.`];
  if (noPublicados > 0) partes.push(`${noPublicados} ya no ${noPublicados === 1 ? "está publicado" : "están publicados"}.`);
  elementos.resumenFavoritos.textContent = partes.join(" ");

  if (publicados.length === 0) {
    mostrarVacio(elementos.listaFavoritos, "Todavía no guardaste favoritos", "Tocá el corazón de un producto para guardarlo acá y recibir avisos cuando cambie su precio.");
    return;
  }
  if (visibles.length === 0) {
    mostrarVacio(elementos.listaFavoritos, "Ningún favorito coincide con la búsqueda");
    return;
  }
  elementos.listaFavoritos.replaceChildren(...visibles.map(crearTarjetaResumen));
}

elementos.buscarFavoritos.addEventListener("input", renderizarFavoritos);
window.addEventListener(EVENTO_FAVORITOS, () => {
  if (estado.catalogo) renderizarFavoritos();
});

// ======================================================
// Configuración: preferencias
// ======================================================

elementos.interruptorAvisos.addEventListener("change", async () => {
  const activos = elementos.interruptorAvisos.checked;
  try {
    await guardarPreferenciaAvisos(estado.uid, activos);
    estado.avisosActivos = activos;
    renderizarAvisos();
    mostrarAviso(activos ? "Encendiste los avisos de precio." : "Apagaste los avisos de precio.");
  } catch (error) {
    elementos.interruptorAvisos.checked = !activos;
    mostrarAviso(manejarError(error, "Preferencia de avisos"), "error");
  }
});

elementos.interruptorOscuro.addEventListener("change", () => {
  aplicarModoOscuro(elementos.interruptorOscuro.checked);
});

elementos.botonIdioma.addEventListener("click", () => abrirModal(elementos.modalIdioma));

// ======================================================
// Configuración: cuenta
// ======================================================

// Al confirmar la identidad solo se pide la contraseña, por eso el mensaje habla solo de ella.
function mensajeDeCuenta(error, contexto) {
  if (["auth/invalid-credential", "auth/wrong-password"].includes(error?.code)) {
    manejarError(error, contexto);
    return "La contraseña actual no es correcta.";
  }
  return manejarError(error, contexto);
}

function prepararCuenta() {
  const conContrasena = usaContrasena();
  elementos.avisoGoogle.hidden = conContrasena;
  elementos.opcionCorreo.hidden = !conContrasena;
  elementos.opcionPassword.hidden = !conContrasena;
  // Con Google, para eliminar la cuenta se vuelve a abrir la ventana de Google en lugar de pedir contraseña.
  elementos.campoEliminarPassword.hidden = !conContrasena;
}

elementos.formCorreo.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarMensaje(elementos.mensajeCorreo);
  const nuevo = elementos.correoNuevo.value.trim();
  const errorIgual = nuevo.toLowerCase() === correoActual().toLowerCase() ? "Es el mismo correo que ya usás." : "";
  const valido = aplicarValidaciones([
    [elementos.correoNuevo, validarEmail(nuevo) || errorIgual],
    [elementos.correoPassword, validarPassword(elementos.correoPassword.value)]
  ]);
  if (!valido) return;

  botonCargando(elementos.botonCorreo, true, "Enviando...");
  try {
    await reautenticar(elementos.correoPassword.value);
    await cambiarCorreo(nuevo);
    elementos.formCorreo.reset();
    mostrarMensaje(
      elementos.mensajeCorreo,
      `Te enviamos un enlace a ${nuevo}. El correo de tu cuenta cambia cuando abras ese enlace. Después vas a tener que iniciar sesión con el correo nuevo.`,
      "exito"
    );
  } catch (error) {
    mostrarMensaje(elementos.mensajeCorreo, mensajeDeCuenta(error, "Cambio de correo"), "error");
  } finally {
    botonCargando(elementos.botonCorreo, false);
  }
});

elementos.formPassword.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarMensaje(elementos.mensajePassword);
  const nueva = elementos.passwordNueva.value;
  const errorRepetir = nueva !== elementos.passwordRepetir.value ? "Las contraseñas no coinciden." : "";
  const errorIgual = nueva && nueva === elementos.passwordActual.value ? "La contraseña nueva tiene que ser distinta de la actual." : "";
  const valido = aplicarValidaciones([
    [elementos.passwordActual, validarPassword(elementos.passwordActual.value)],
    [elementos.passwordNueva, validarPasswordNueva(nueva) || errorIgual],
    [elementos.passwordRepetir, errorRepetir]
  ]);
  if (!valido) return;

  botonCargando(elementos.botonPassword, true, "Cambiando...");
  try {
    await reautenticar(elementos.passwordActual.value);
    await cambiarContrasena(nueva);
    elementos.formPassword.reset();
    mostrarMensaje(elementos.mensajePassword, "Cambiaste tu contraseña.", "exito");
  } catch (error) {
    mostrarMensaje(elementos.mensajePassword, mensajeDeCuenta(error, "Cambio de contraseña"), "error");
  } finally {
    botonCargando(elementos.botonPassword, false);
  }
});

elementos.formEliminar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarMensaje(elementos.mensajeEliminar);
  const conContrasena = usaContrasena();
  if (conContrasena && !aplicarValidaciones([[elementos.eliminarPassword, validarPassword(elementos.eliminarPassword.value)]])) return;

  const aceptado = await confirmar({
    titulo: "Eliminar mi cuenta",
    texto: "Se borran tu perfil, tus favoritos, tus reacciones y tus comentarios. No se puede deshacer.",
    textoAceptar: "Eliminar cuenta",
    peligro: true
  });
  if (!aceptado) return;

  botonCargando(elementos.botonEliminar, true, "Eliminando...");
  try {
    // Primero se confirma la identidad, así el borrado de Authentication no falla a mitad de camino.
    await reautenticar(conContrasena ? elementos.eliminarPassword.value : "");
    await eliminarDatosDeCuenta(estado.uid);
    await borrarHistorial(estado.uid);
    await eliminarUsuarioActual();
    olvidarFavoritosLocales();
    window.location.replace(RUTAS.INICIO);
  } catch (error) {
    mostrarMensaje(elementos.mensajeEliminar, mensajeDeCuenta(error, "Eliminación de cuenta personal"), "error");
    botonCargando(elementos.botonEliminar, false);
  }
});

// ======================================================
// Cerrar sesión (encabezado)
// ======================================================

elementos.botonSalir.addEventListener("click", async () => {
  olvidarFavoritosLocales();
  await cerrarSesion();
  window.location.replace(RUTAS.INICIO);
});

// ======================================================
// Configuración: comercios ocultos y cuentas bloqueadas
// ======================================================

async function renderizarOcultos() {
  const lista = $("lista-ocultos");
  try {
    const ocultos = await obtenerOcultos(estado.uid);
    const nombresComercios = new Map((estado.catalogo?.ocultosPorVos ?? []).map((c) => [c.id, c.nombre]));
    const cuentas = await obtenerClientes(ocultos.cuentas);
    const filas = [
      ...ocultos.comercios.map((id) => ({ id, tipo: "comercio", nombre: nombresComercios.get(id) ?? "Comercio que ya no publica" })),
      ...ocultos.cuentas.map((id) => ({ id, tipo: "cuenta", nombre: cuentas.get(id)?.usuario ? `@${cuentas.get(id).usuario}` : "Cuenta eliminada" }))
    ];
    if (filas.length === 0) {
      lista.innerHTML = '<li class="lista-ocultos__vacio">No ocultaste comercios ni bloqueaste cuentas.</li>';
      return;
    }
    lista.replaceChildren(
      ...filas.map(({ id, tipo, nombre }) => {
        const item = document.createElement("li");
        item.className = "lista-ocultos__item";
        item.innerHTML = `<span><strong>${escaparHTML(nombre)}</strong> <span class="lista-ocultos__tipo">${tipo === "comercio" ? "Comercio oculto" : "Cuenta bloqueada"}</span></span>`;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn btn--linea btn--chico";
        boton.textContent = tipo === "comercio" ? "Volver a mostrar" : "Desbloquear";
        boton.addEventListener("click", async () => {
          boton.disabled = true;
          try {
            if (tipo === "comercio") await mostrarComercio(estado.uid, id);
            else await desbloquearCuenta(estado.uid, id);
            mostrarAviso(tipo === "comercio" ? `${nombre} vuelve a aparecer en tus comparaciones.` : `Desbloqueaste a ${nombre}.`);
            await renderizarOcultos();
          } catch (error) {
            boton.disabled = false;
            mostrarAviso(manejarError(error, "Comercios ocultos y cuentas bloqueadas"), "error");
          }
        });
        item.append(boton);
        return item;
      })
    );
  } catch (error) {
    lista.innerHTML = `<li class="lista-ocultos__vacio">${escaparHTML(manejarError(error, "Comercios ocultos"))}</li>`;
  }
}

// ======================================================
// Inicio
// ======================================================

async function cargarDatos() {
  mostrarCargando(elementos.listaFavoritos, "Cargando favoritos...");
  mostrarCargando(elementos.listaComentarios, "Cargando comentarios...");
  try {
    await vincularFavoritosConCuenta(estado.uid);
    const [catalogo, revision, comentarios] = await Promise.all([
      cargarCatalogo(),
      revisarCambiosDePrecio(estado.uid),
      listarComentariosDeCliente(estado.uid)
    ]);
    estado.catalogo = catalogo;
    estado.cambios = revision.cambios;
    estado.avisosActivos = revision.avisosActivos;
    estado.comentarios = comentarios;
    elementos.interruptorAvisos.checked = estado.avisosActivos;
    renderizarAvisos();
    renderizarFavoritos();
    renderizarComentarios();
    renderizarOcultos();
  } catch (error) {
    const mensaje = manejarError(error, "Carga de la cuenta personal");
    mostrarError(elementos.listaFavoritos, mensaje, cargarDatos);
    mostrarError(elementos.listaComentarios, mensaje);
  }
}

async function iniciar() {
  mostrarCargando(elementos.carga, "Cargando tu perfil...");
  try {
    const { usuario } = await protegerPagina([ROLES.CLIENTE]);
    estado.uid = usuario.uid;
    prepararBarraPublica(elementos.barra, { revisarPrecios: false });
    estado.cuenta = await obtenerMiCuenta(usuario.uid);
    if (!estado.cuenta) throw new Error("No se encontró el perfil de la cuenta personal.");

    elementos.carga.hidden = true;
    elementos.marco.hidden = false;
    elementos.interruptorOscuro.checked = modoOscuroActivo();
    renderizarFicha();
    prepararCuenta();
    mostrarSeccion();
    await cargarDatos();
  } catch (error) {
    mostrarError(elementos.carga, obtenerMensajeError(error), iniciar);
  }
}

prepararModal(elementos.modalEditar);
prepararModal(elementos.modalIdioma);
iniciar();
