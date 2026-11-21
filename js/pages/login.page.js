// Inicio de sesión de cuentas personales, comercios y administradores, y recuperación de contraseña.
// Es el mismo formulario para todos. Según el rol, la cuenta se abre después desde la barra.
// La vista de recuperación se muestra en la misma página con el ancla #recuperar.

import { RUTAS } from "../core/constants.js";
import { validarEmail, validarPassword } from "../core/validators.js";
import { manejarError } from "../core/errores.js";
import {
  iniciarSesion,
  iniciarSesionConGoogle,
  enviarEnlaceRecuperacion,
  obtenerUsuarioActual,
  verificarConfiguracion
} from "../services/authService.js";
import { resolverAcceso } from "../guards/sessionGuard.js";
import {
  aplicarValidaciones,
  limpiarErrores,
  botonCargando,
  mostrarMensaje,
  ocultarMensaje
} from "../ui/feedback.js";

const elementos = {
  vistaLogin: document.getElementById("vista-login"),
  vistaRecuperar: document.getElementById("vista-recuperar"),
  enlaceVolver: document.getElementById("enlace-volver"),
  textoVolver: document.getElementById("texto-volver"),

  formLogin: document.getElementById("form-login"),
  emailLogin: document.getElementById("login-email"),
  passwordLogin: document.getElementById("login-password"),
  botonLogin: document.getElementById("boton-login"),
  botonGoogle: document.getElementById("boton-google"),
  mensajeLogin: document.getElementById("mensaje-login"),

  formRecuperar: document.getElementById("form-recuperar"),
  emailRecuperar: document.getElementById("recuperar-email"),
  botonRecuperar: document.getElementById("boton-recuperar"),
  mensajeRecuperar: document.getElementById("mensaje-recuperar")
};

// ---------- Cambio entre vistas ----------

function mostrarVistaSegunAncla() {
  const recuperando = window.location.hash === "#recuperar";
  elementos.vistaLogin.hidden = recuperando;
  elementos.vistaRecuperar.hidden = !recuperando;
  elementos.enlaceVolver.href = recuperando ? "#" : "index.html";
  elementos.textoVolver.textContent = recuperando ? "Volver a iniciar sesión" : "Volver al inicio";
  document.title = recuperando ? "Recuperar contraseña · SENDA" : "Iniciar sesión · SENDA";

  if (recuperando && elementos.emailLogin.value && !elementos.emailRecuperar.value) {
    elementos.emailRecuperar.value = elementos.emailLogin.value;
  }
  ocultarMensaje(elementos.mensajeRecuperar);
}

// ---------- Ingreso ----------

async function ingresar(obtenerUsuario, boton, textoCargando) {
  ocultarMensaje(elementos.mensajeLogin);
  botonCargando(boton, true, textoCargando);
  elementos.botonLogin.disabled = true;
  elementos.botonGoogle.disabled = true;
  try {
    const usuario = await obtenerUsuario();
    // Al ingresar se vuelve al inicio; la cuenta se abre desde la foto y el nombre de la barra.
    const acceso = await resolverAcceso(usuario);
    // Un empleado deshabilitado va directo al aviso de su panel.
    window.location.replace(acceso.deshabilitado ? RUTAS.GESTION_COMERCIO : RUTAS.INICIO);
  } catch (error) {
    const tipo = error?.code === "senda/pendiente" ? "info" : "error";
    mostrarMensaje(elementos.mensajeLogin, manejarError(error, "Inicio de sesión"), tipo);
    botonCargando(boton, false);
    elementos.botonLogin.disabled = false;
    elementos.botonGoogle.disabled = false;
  }
}

elementos.formLogin.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const valido = aplicarValidaciones([
    [elementos.emailLogin, validarEmail(elementos.emailLogin.value)],
    [elementos.passwordLogin, validarPassword(elementos.passwordLogin.value)]
  ]);
  if (!valido) return;
  ingresar(
    () => iniciarSesion(elementos.emailLogin.value, elementos.passwordLogin.value),
    elementos.botonLogin,
    "Ingresando..."
  );
});

elementos.botonGoogle.addEventListener("click", () => {
  limpiarErrores(elementos.formLogin);
  ingresar(iniciarSesionConGoogle, elementos.botonGoogle, "Conectando con Google...");
});

// ---------- Recuperación de contraseña ----------

elementos.formRecuperar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarMensaje(elementos.mensajeRecuperar);
  const valido = aplicarValidaciones([
    [elementos.emailRecuperar, validarEmail(elementos.emailRecuperar.value)]
  ]);
  if (!valido) return;

  botonCargando(elementos.botonRecuperar, true, "Enviando...");
  try {
    await enviarEnlaceRecuperacion(elementos.emailRecuperar.value);
    // Firebase no informa si el correo existe, para no revelar qué cuentas están registradas.
    mostrarMensaje(
      elementos.mensajeRecuperar,
      "Revisá tu bandeja de entrada. Si el correo está registrado, vas a recibir el enlace para crear una contraseña nueva.",
      "exito"
    );
    elementos.formRecuperar.reset();
  } catch (error) {
    mostrarMensaje(elementos.mensajeRecuperar, manejarError(error, "Recuperación de contraseña"));
  } finally {
    botonCargando(elementos.botonRecuperar, false);
  }
});

// ---------- Inicio ----------

elementos.enlaceVolver.addEventListener("click", (evento) => {
  if (window.location.hash === "#recuperar") {
    evento.preventDefault();
    history.pushState(null, "", window.location.pathname);
    mostrarVistaSegunAncla();
  }
});

window.addEventListener("hashchange", mostrarVistaSegunAncla);
mostrarVistaSegunAncla();

// Si ya hay una sesión válida, se envía directamente al panel correspondiente.
async function comprobarSesionExistente() {
  try {
    verificarConfiguracion();
  } catch (error) {
    mostrarMensaje(elementos.mensajeLogin, manejarError(error, "Configuración"));
    return;
  }
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;
  try {
    // Al ingresar se vuelve al inicio; la cuenta se abre desde la foto y el nombre de la barra.
    const acceso = await resolverAcceso(usuario);
    // Un empleado deshabilitado va directo al aviso de su panel.
    window.location.replace(acceso.deshabilitado ? RUTAS.GESTION_COMERCIO : RUTAS.INICIO);
  } catch (error) {
    mostrarMensaje(elementos.mensajeLogin, manejarError(error, "Sesión existente"), "info");
  }
}

comprobarSesionExistente();
