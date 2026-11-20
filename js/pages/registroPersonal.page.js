// Registro de cuentas personales (rol "cliente").
// Crea la cuenta en Firebase Authentication y, en Firestore, el rol y el perfil público (nombre, usuario, foto).
// La cuenta personal no necesita validación: al terminar queda con la sesión iniciada.
// El correo no se guarda en Firestore. Queda en Authentication y solo lo ve la persona.

import { ROLES, RUTAS } from "../core/constants.js";
import {
  validarEmail,
  validarPasswordNueva,
  validarTextoObligatorio,
  validarTerminos,
  validarNombreUsuario,
  normalizarNombreUsuario
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
import { crearCuentaPersonal, existeNombreUsuario } from "../services/clientesService.js";
import { aplicarValidaciones, marcarErrorCampo, botonCargando, mostrarMensaje, ocultarMensaje } from "../ui/feedback.js";

const $ = (id) => document.getElementById(id);

const elementos = {
  formulario: $("form-registro"),
  nombre: $("registro-nombre"),
  usuario: $("registro-usuario"),
  email: $("registro-email"),
  password: $("registro-password"),
  terminos: $("registro-terminos"),
  botonRegistro: $("boton-registro"),
  botonGoogle: $("boton-google"),
  mensaje: $("mensaje-registro")
};

// Errores que corresponden a un campo y se muestran debajo de él.
const ERRORES_DE_CAMPO = {
  "auth/email-already-in-use": "email",
  "auth/invalid-email": "email",
  "auth/weak-password": "password",
  "senda/usuario-repetido": "usuario"
};

const VALIDAR_CAMPO = {
  nombre: () => validarTextoObligatorio(elementos.nombre.value, "tu nombre", 60),
  usuario: () => validarNombreUsuario(elementos.usuario.value),
  email: () => validarEmail(elementos.email.value),
  password: () => validarPasswordNueva(elementos.password.value)
};

function validacionesFormulario({ conCuentaDeCorreo }) {
  return [
    [elementos.nombre, VALIDAR_CAMPO.nombre()],
    [elementos.usuario, VALIDAR_CAMPO.usuario()],
    ...(conCuentaDeCorreo
      ? [
          [elementos.email, VALIDAR_CAMPO.email()],
          [elementos.password, VALIDAR_CAMPO.password()]
        ]
      : []),
    [elementos.terminos, validarTerminos(elementos.terminos.checked)]
  ];
}

async function usuarioDisponible() {
  const repetido = await existeNombreUsuario(elementos.usuario.value);
  if (repetido) throw new ErrorSenda("senda/usuario-repetido");
}

function mostrarErrorRegistro(error) {
  const mensaje = manejarError(error, "Registro de cuenta personal");
  const campo = ERRORES_DE_CAMPO[error?.code];
  if (campo) {
    marcarErrorCampo(elementos[campo], mensaje);
    elementos[campo].focus();
    return;
  }
  mostrarMensaje(elementos.mensaje, mensaje, "error");
}

function bloquearBotones(bloquear) {
  elementos.botonRegistro.disabled = bloquear;
  elementos.botonGoogle.disabled = bloquear;
}

// Guarda el rol y el perfil. Si falla, borra la cuenta recién creada para poder intentar de nuevo.
async function guardarPerfil(usuario) {
  try {
    await crearCuentaPersonal(usuario.uid, {
      nombre: elementos.nombre.value,
      usuario: elementos.usuario.value
    });
  } catch (error) {
    await eliminarCuentaActual().catch((e) => manejarError(e, "Deshacer registro personal"));
    throw error;
  }
  window.location.replace(RUTAS.INICIO);
}

// ---------- Con correo y contraseña ----------

elementos.formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarMensaje(elementos.mensaje);
  if (!aplicarValidaciones(validacionesFormulario({ conCuentaDeCorreo: true }))) return;

  bloquearBotones(true);
  botonCargando(elementos.botonRegistro, true, "Revisando los datos...");
  try {
    await usuarioDisponible();
    elementos.botonRegistro.textContent = "Creando cuenta...";
    const usuario = await registrarConEmail(elementos.email.value, elementos.password.value);
    await guardarPerfil(usuario);
  } catch (error) {
    mostrarErrorRegistro(error);
    botonCargando(elementos.botonRegistro, false);
    bloquearBotones(false);
  }
});

// ---------- Con Google ----------
// La ventana de Google se abre primero, sin esperas antes, para que el navegador no la bloquee.
// Después se controla el nombre de usuario. Si ya estaba en uso, se borra la cuenta recién creada.

elementos.botonGoogle.addEventListener("click", async () => {
  ocultarMensaje(elementos.mensaje);
  marcarErrorCampo(elementos.email, "");
  marcarErrorCampo(elementos.password, "");
  if (!aplicarValidaciones(validacionesFormulario({ conCuentaDeCorreo: false }))) return;

  bloquearBotones(true);
  botonCargando(elementos.botonGoogle, true, "Conectando con Google...");
  try {
    const usuario = await iniciarSesionConGoogle();
    const existente = await obtenerUsuario(usuario.uid);
    if (existente?.rol === ROLES.CLIENTE) {
      // Ya tenía cuenta personal: se toma como inicio de sesión.
      window.location.replace(RUTAS.INICIO);
      return;
    }
    if (existente) {
      await cerrarSesion();
      throw new ErrorSenda("senda/ya-registrado");
    }
    try {
      await usuarioDisponible();
    } catch (error) {
      await eliminarCuentaActual().catch((e) => manejarError(e, "Deshacer registro personal"));
      throw error;
    }
    await guardarPerfil(usuario);
  } catch (error) {
    mostrarErrorRegistro(error);
    botonCargando(elementos.botonGoogle, false);
    bloquearBotones(false);
  }
});

// ---------- Validación al salir de cada campo ----------

elementos.usuario.addEventListener("input", () => {
  // Se escribe siempre en minúsculas y sin la arroba.
  const limpio = normalizarNombreUsuario(elementos.usuario.value);
  if (limpio !== elementos.usuario.value) elementos.usuario.value = limpio;
});

for (const campo of Object.keys(VALIDAR_CAMPO)) {
  const input = elementos[campo];
  input.addEventListener("blur", () => {
    if (input.value) marcarErrorCampo(input, VALIDAR_CAMPO[campo]());
  });
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") marcarErrorCampo(input, VALIDAR_CAMPO[campo]());
  });
}

elementos.terminos.addEventListener("change", () => {
  if (elementos.terminos.checked) marcarErrorCampo(elementos.terminos, "");
});

try {
  verificarConfiguracion();
} catch (error) {
  mostrarMensaje(elementos.mensaje, obtenerMensajeError(error), "error");
  bloquearBotones(true);
}
