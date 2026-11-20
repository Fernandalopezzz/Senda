// Registro de comercios.
// Crea la cuenta en Firebase Authentication y, en Firestore, el usuario y el perfil del comercio.
// La cuenta queda "pendiente" hasta que un administrador revisa los datos y la valida o la bloquea.
// Cada error se muestra en rojo debajo de su campo y la cuenta no se crea hasta corregirlos.

import { ROLES, RUTAS } from "../core/constants.js";
import {
  validarEmail,
  validarPasswordNueva,
  validarTextoObligatorio,
  validarTerminos,
  validarTelefonoObligatorio
} from "../core/validators.js";
import { manejarError, obtenerMensajeError, ErrorSenda } from "../core/errores.js";
import {
  registrarConEmail,
  iniciarSesionConGoogle,
  eliminarCuentaActual,
  cerrarSesion,
  verificarConfiguracion
} from "../services/authService.js";
import { obtenerUsuario } from "../services/usuariosService.js";
import { crearSolicitudComercio, existeComercioConNombre } from "../services/comerciosService.js";
import { aplicarValidaciones, marcarErrorCampo, botonCargando, mostrarMensaje, ocultarMensaje } from "../ui/feedback.js";

const $ = (id) => document.getElementById(id);

const elementos = {
  vistaRegistro: $("vista-registro"),
  vistaExito: $("vista-exito"),
  tituloExito: $("titulo-exito"),
  textoExito: $("texto-exito"),
  bajadaExito: $("bajada-exito"),
  accionExito: $("accion-exito"),
  formulario: $("form-registro"),
  nombre: $("registro-nombre"),
  dueno: $("registro-dueno"),
  direccion: $("registro-direccion"),
  telefono: $("registro-telefono"),
  email: $("registro-email"),
  password: $("registro-password"),
  terminos: $("registro-terminos"),
  botonRegistro: $("boton-registro"),
  botonGoogle: $("boton-google"),
  mensaje: $("mensaje-registro")
};

// Errores de Firebase que corresponden a un campo y se muestran debajo de él.
const ERRORES_DE_CAMPO = {
  "auth/email-already-in-use": "email",
  "auth/invalid-email": "email",
  "auth/weak-password": "password",
  "senda/nombre-repetido": "nombre"
};

// ---------- Validaciones ----------

function validarNombre() {
  return validarTextoObligatorio(elementos.nombre.value, "el nombre del comercio");
}

// Controla en Firestore que no exista otro comercio con el mismo nombre.
async function nombreDisponible() {
  if (validarNombre()) return false;
  const repetido = await existeComercioConNombre(elementos.nombre.value);
  marcarErrorCampo(elementos.nombre, repetido ? obtenerMensajeError({ code: "senda/nombre-repetido" }) : "");
  return !repetido;
}

// Validaciones de cada campo de datos del comercio (se usan al enviar y al salir del campo).
const VALIDAR_CAMPO = {
  dueno: () => validarTextoObligatorio(elementos.dueno.value, "el nombre del dueño"),
  direccion: () => validarTextoObligatorio(elementos.direccion.value, "la dirección"),
  telefono: () => validarTelefonoObligatorio(elementos.telefono.value),
  email: () => validarEmail(elementos.email.value),
  password: () => validarPasswordNueva(elementos.password.value)
};

function validacionesFormulario({ conCuentaDeCorreo }) {
  return [
    [elementos.nombre, validarNombre()],
    [elementos.dueno, VALIDAR_CAMPO.dueno()],
    [elementos.direccion, VALIDAR_CAMPO.direccion()],
    [elementos.telefono, VALIDAR_CAMPO.telefono()],
    ...(conCuentaDeCorreo
      ? [
          [elementos.email, validarEmail(elementos.email.value)],
          [elementos.password, validarPasswordNueva(elementos.password.value)]
        ]
      : []),
    [elementos.terminos, validarTerminos(elementos.terminos.checked)]
  ];
}

// Muestra el error de Firebase debajo del campo que corresponde o, si no es de un campo, arriba del formulario.
function mostrarErrorRegistro(error, contexto) {
  const mensaje = manejarError(error, contexto);
  const campo = ERRORES_DE_CAMPO[error?.code];
  if (campo) {
    marcarErrorCampo(elementos[campo], mensaje);
    elementos[campo].focus();
    return;
  }
  const tipo = error?.code === "senda/pendiente" ? "info" : "error";
  mostrarMensaje(elementos.mensaje, mensaje, tipo);
}

// ---------- Registro ----------

function bloquearBotones(bloquear) {
  elementos.botonRegistro.disabled = bloquear;
  elementos.botonGoogle.disabled = bloquear;
}

function mostrarExito(email) {
  elementos.vistaRegistro.hidden = true;
  elementos.vistaExito.hidden = false;
  elementos.tituloExito.textContent = "¡Recibimos tu solicitud!";
  elementos.textoExito.textContent = `Creamos la cuenta de ${elementos.nombre.value.trim()} con el correo ${email}. Un administrador va a revisar los datos.`;
  elementos.bajadaExito.textContent = "Cuando tu comercio esté validado, vas a poder ingresar con tu correo y tu contraseña.";
  elementos.accionExito.textContent = "Volver al inicio";
  elementos.accionExito.href = RUTAS.INICIO;
  document.title = "Cuenta creada · SENDA";
}

// Guarda los datos en Firestore con la cuenta "pendiente".
// Si algo falla, borra la cuenta recién creada para que se pueda intentar de nuevo.
async function guardarSolicitud(usuario) {
  try {
    await crearSolicitudComercio(usuario.uid, {
      nombre: elementos.nombre.value,
      dueno: elementos.dueno.value,
      direccion: elementos.direccion.value,
      telefono: elementos.telefono.value,
      correo: usuario.email ?? ""
    });
  } catch (error) {
    await eliminarCuentaActual().catch((e) => manejarError(e, "Deshacer registro"));
    throw error;
  }
  // La cuenta sale de la sesión hasta que un administrador la valide.
  await cerrarSesion();
  mostrarExito(usuario.email);
}

async function registrar({ conCuentaDeCorreo, boton, textoCargando, obtenerCuenta }) {
  ocultarMensaje(elementos.mensaje);
  if (!aplicarValidaciones(validacionesFormulario({ conCuentaDeCorreo }))) return;

  bloquearBotones(true);
  botonCargando(boton, true, "Revisando los datos...");
  try {
    if (!(await nombreDisponible())) {
      elementos.nombre.focus();
      return;
    }
    boton.textContent = textoCargando;
    const usuario = await obtenerCuenta();
    await guardarSolicitud(usuario);
  } catch (error) {
    mostrarErrorRegistro(error, "Registro de comercio");
  } finally {
    botonCargando(boton, false);
    bloquearBotones(false);
  }
}

async function cuentaDeGoogle() {
  const usuario = await iniciarSesionConGoogle();
  const existente = await obtenerUsuario(usuario.uid);
  if (existente) {
    await cerrarSesion();
    throw new ErrorSenda(existente.rol === ROLES.PENDIENTE ? "senda/pendiente" : "senda/ya-registrado");
  }
  return usuario;
}

// ---------- Eventos ----------

elementos.formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  registrar({
    conCuentaDeCorreo: true,
    boton: elementos.botonRegistro,
    textoCargando: "Creando cuenta...",
    obtenerCuenta: () => registrarConEmail(elementos.email.value, elementos.password.value)
  });
});

elementos.botonGoogle.addEventListener("click", () => {
  // Con Google no se usan el correo ni la contraseña del formulario.
  marcarErrorCampo(elementos.email, "");
  marcarErrorCampo(elementos.password, "");
  registrar({
    conCuentaDeCorreo: false,
    boton: elementos.botonGoogle,
    textoCargando: "Conectando con Google...",
    obtenerCuenta: cuentaDeGoogle
  });
});

// Cada campo se revisa al salir de él, así el error aparece en rojo sin esperar al botón.
elementos.nombre.addEventListener("blur", async () => {
  const error = validarNombre();
  marcarErrorCampo(elementos.nombre, error);
  if (!error) {
    try {
      await nombreDisponible();
    } catch (e) {
      manejarError(e, "Control de nombre repetido");
    }
  }
});
for (const campo of ["dueno", "direccion", "telefono", "email", "password"]) {
  const input = elementos[campo];
  // Al salir del campo: si escribió algo (o es un dato obligatorio ya tocado), se muestra el error.
  input.addEventListener("blur", () => {
    if (input.value) marcarErrorCampo(input, VALIDAR_CAMPO[campo]());
  });
  // Mientras se escribe, el error desaparece apenas el valor queda bien.
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true" && !VALIDAR_CAMPO[campo]()) marcarErrorCampo(input, "");
  });
}
elementos.terminos.addEventListener("change", () => {
  if (elementos.terminos.checked) marcarErrorCampo(elementos.terminos, "");
});


try {
  verificarConfiguracion();
} catch (error) {
  mostrarMensaje(elementos.mensaje, manejarError(error, "Configuración"));
}
