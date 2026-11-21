// Comprobación de sesión y permisos.
// Los guards solo controlan qué pantalla se muestra. La seguridad real de los datos
// depende de las reglas de firestore.rules.

import { obtenerUsuarioActual, cerrarSesion, verificarConfiguracion, observarSesion, CLAVE_CUENTA_BARRA } from "../services/authService.js";
import { obtenerUsuario } from "../services/usuariosService.js";
import { obtenerComercio } from "../services/comerciosService.js";
import { obtenerMiCuenta } from "../services/clientesService.js";
import { vincularFavoritosConCuenta } from "../services/productosService.js";
import { revisarCambiosDePrecio } from "../services/avisosPrecioService.js";
import { ROLES, ROLES_COMERCIO_ACTIVO, ROLES_EQUIPO, RUTAS } from "../core/constants.js";
import { obtenerEmpleado } from "../services/empleadosService.js";
import { ErrorSenda, manejarError } from "../core/errores.js";
import { iniciales, mostrarAviso } from "../ui/feedback.js";
import { montarCampanita } from "../ui/components/campanita.js";

// El equipo (administrador y empleados) y el comercio usan la misma pantalla de gestión;
// el contenido cambia según el rol.
// La cuenta personal tiene su propio perfil.
export function rutaSegunRol(rol) {
  if (ROLES_EQUIPO.includes(rol) || ROLES_COMERCIO_ACTIVO.includes(rol)) return RUTAS.GESTION_COMERCIO;
  if (rol === ROLES.CLIENTE) return RUTAS.PERFIL_USUARIO;
  return null;
}

// Cuenta con sesión iniciada: { uid, rol } o null si no hay sesión.
// La usan las páginas públicas para saber si mostrar opciones de cuenta personal o de administración.
export async function obtenerCuentaActual() {
  try {
    verificarConfiguracion();
    const usuario = await obtenerUsuarioActual();
    if (!usuario) return null;
    const perfil = await obtenerUsuario(usuario.uid);
    return perfil ? { uid: usuario.uid, rol: perfil.rol } : null;
  } catch (error) {
    manejarError(error, "Lectura de la cuenta actual");
    return null;
  }
}

// Verifica que la cuenta pueda entrar a un panel. Si no puede, cierra la sesión y lanza el motivo.
export async function resolverAcceso(usuario) {
  const perfil = await obtenerUsuario(usuario.uid);
  const destino = rutaSegunRol(perfil?.rol);
  if (perfil?.rol === ROLES.EMPLEADO) {
    const empleado = await obtenerEmpleado(usuario.uid);
    return { perfil, destino, deshabilitado: !empleado?.activo };
  }
  if (destino) return { perfil, destino };

  await cerrarSesion();
  if (perfil?.rol === ROLES.PENDIENTE) throw new ErrorSenda("senda/pendiente");
  if (perfil?.rol === ROLES.RECHAZADO) throw new ErrorSenda("senda/rechazado");
  if (perfil?.rol === ROLES.BLOQUEADO) throw new ErrorSenda("senda/bloqueado");
  throw new ErrorSenda("senda/sin-cuenta");
}

// Protege una página privada. Devuelve { usuario, perfil } si el rol está permitido.
// Si no, redirige y deja la promesa sin resolver para que la página no siga cargando.
export async function protegerPagina(rolesPermitidos) {
  verificarConfiguracion();
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return redirigir(RUTAS.LOGIN);

  const perfil = await obtenerUsuario(usuario.uid);
  if (rolesPermitidos.includes(perfil?.rol)) return { usuario, perfil };

  const destino = rutaSegunRol(perfil?.rol);
  if (destino) return redirigir(destino);

  await cerrarSesion();
  return redirigir(RUTAS.LOGIN);
}

function redirigir(ruta) {
  window.location.replace(ruta);
  return new Promise(() => {});
}

// Barra pública (inicio, resultados, perfil del comercio y detalle de producto).
// La barra está escrita en el HTML; acá solo se marca la opción activa y, si un comercio
// o administrador ya inició sesión, se cambia "Iniciar sesión / Registrarse" por su foto y su nombre.
// Al hacer clic en ellos se entra a su cuenta (gestion-comercio.html o perfil-usuario.html),
// donde está "Cerrar sesión".
// activo: "inicio" | "destacados" | "ofertas" | null
// revisarPrecios: con cuenta personal, revisa si cambió el precio de algún favorito (el perfil lo hace por su cuenta).
// alCambiarPrecios(cambios): si la página la recibe, muestra los cambios a su manera (el inicio los
// muestra en un recuadro) y no aparece el aviso flotante.
export function prepararBarraPublica(contenedor, { activo = null, revisarPrecios = true, alCambiarPrecios = null } = {}) {
  contenedor.querySelectorAll("[data-nav]").forEach((enlace) => {
    const esActivo = enlace.dataset.nav === activo;
    enlace.classList.toggle("navegacion__enlace--activo", esActivo);
    if (esActivo) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  });

  try {
    verificarConfiguracion();
  } catch {
    return;
  }
  const visitante = contenedor.querySelector("[data-acciones-visitante]");
  const sesion = contenedor.querySelector("[data-acciones-sesion]");

  // Firebase tarda un momento en confirmar la sesión. Mientras tanto se muestra la última cuenta
  // guardada, así la barra no muestra "Iniciar sesión" por un instante a alguien que ya ingresó.
  const guardada = leerCuentaDeLaBarra();
  if (guardada) {
    visitante.hidden = true;
    sesion.hidden = false;
    mostrarCuenta(sesion, guardada);
  }

  observarSesion(async (usuario) => {
    let cuenta = null;
    if (usuario) {
      try {
        cuenta = await datosDeLaCuenta(usuario.uid);
      } catch (error) {
        manejarError(error, "Lectura de la cuenta en la barra");
      }
    }
    // Un empleado deshabilitado no puede navegar SENDA con su cuenta: va al aviso de su panel,
    // donde lo único que puede hacer es cerrar sesión.
    if (cuenta?.deshabilitado) {
      window.location.replace(RUTAS.GESTION_COMERCIO);
      return;
    }
    visitante.hidden = Boolean(cuenta);
    sesion.hidden = !cuenta;
    if (cuenta) mostrarCuenta(sesion, cuenta);
    guardarCuentaDeLaBarra(cuenta);
    // Campanita con los avisos de precio, los productos eliminados por SENDA y los avisos de
    // moderación. Al abrir SENDA, las novedades aparecen unos segundos al costado y quedan guardadas ahí.
    if (cuenta?.esComercio || cuenta?.esCliente) {
      montarCampanita(sesion, { uid: usuario.uid, esCliente: Boolean(cuenta.esCliente), esComercio: Boolean(cuenta.esComercio) });
    }
    // Con cuenta personal, los favoritos se toman de la cuenta.
    if (cuenta?.esCliente) {
      vincularFavoritosConCuenta(usuario.uid)
        .then(() => (revisarPrecios ? avisarCambiosDePrecio(sesion, usuario.uid, alCambiarPrecios) : null))
        .catch((error) => manejarError(error, "Favoritos de la cuenta"));
    }
  });
}

// Con cuenta personal, el inicio muestra los cambios de precio en su propio recuadro.
// Los avisos de la barra los muestra la campanita (campanita.js).
async function avisarCambiosDePrecio(sesion, uid, alCambiarPrecios) {
  if (!alCambiarPrecios) return;
  const { cambios, avisosActivos } = await revisarCambiosDePrecio(uid);
  if (avisosActivos && cambios.length > 0) alCambiarPrecios(cambios);
}

function leerCuentaDeLaBarra() {
  try {
    const cuenta = JSON.parse(localStorage.getItem(CLAVE_CUENTA_BARRA) ?? "null");
    return cuenta?.nombre && cuenta?.destino ? cuenta : null;
  } catch {
    return null;
  }
}

function guardarCuentaDeLaBarra(cuenta) {
  try {
    if (!cuenta) return localStorage.removeItem(CLAVE_CUENTA_BARRA);
    const { nombre, foto, destino } = cuenta;
    localStorage.setItem(CLAVE_CUENTA_BARRA, JSON.stringify({ nombre, foto, destino }));
  } catch {
    // Sin espacio o sin localStorage: la barra espera a Firebase, como antes.
  }
}

// Nombre, foto y destino de la cuenta con sesión iniciada, o null si no puede usar un panel.
async function datosDeLaCuenta(uid) {
  const perfil = await obtenerUsuario(uid);
  const destino = rutaSegunRol(perfil?.rol);
  if (!destino) return null;
  if (perfil.rol === ROLES.ADMIN) return { nombre: "Administración", foto: null, destino };
  if (perfil.rol === ROLES.EMPLEADO) {
    const empleado = await obtenerEmpleado(uid);
    return { nombre: empleado?.nombre || "Equipo SENDA", foto: null, destino, deshabilitado: !empleado?.activo };
  }
  if (perfil.rol === ROLES.CLIENTE) {
    const cliente = await obtenerMiCuenta(uid);
    return { nombre: cliente?.usuario ? `@${cliente.usuario}` : "Mi cuenta", foto: cliente?.foto || null, destino, esCliente: true };
  }
  const comercio = await obtenerComercio(uid);
  return { nombre: comercio?.nombre || "Mi comercio", foto: comercio?.foto || null, destino, esComercio: true };
}

function mostrarCuenta(sesion, { nombre, foto, destino }) {
  const enlace = sesion.querySelector("[data-enlace-panel]");
  const imagen = sesion.querySelector("[data-foto-sesion]");
  const letras = sesion.querySelector("[data-iniciales-sesion]");
  enlace.href = destino;
  enlace.setAttribute("aria-label", `Ver la cuenta de ${nombre}`);
  sesion.querySelector("[data-nombre-sesion]").textContent = nombre;
  letras.textContent = iniciales(nombre.replace(/^@/, ""));
  // Si tiene foto se muestra la foto; si no, sus iniciales.
  imagen.hidden = !foto;
  letras.hidden = Boolean(foto);
  if (foto) imagen.src = foto;
}
