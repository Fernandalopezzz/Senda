// Validaciones de formularios.
// Cada función devuelve un mensaje de error o un texto vacío si el valor es válido.

import { LIMITES, TIPOS_ARCHIVO } from "./constants.js";

// Pasa a minúsculas y quita tildes para comparar textos en búsquedas ("Almacén" = "almacen").
export function normalizarTexto(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const REGEX_TELEFONO = /^[0-9+()\-\s]{6,25}$/;

// Explica qué le falta al correo: la arroba, el proveedor (gmail, hotmail...) o la terminación (.com).
export function validarEmail(valor) {
  const texto = valor.trim();
  if (!texto) return "Ingresá tu correo electrónico.";
  if (/\s/.test(texto)) return "El correo no puede tener espacios.";
  if (!texto.includes("@")) return "Al correo le falta la arroba (@). Ejemplo: nombre@gmail.com";
  if ((texto.match(/@/g) ?? []).length > 1) return "El correo tiene más de una arroba (@).";
  const [usuario, dominio] = texto.split("@");
  if (!usuario) return "Falta el nombre antes de la arroba. Ejemplo: nombre@gmail.com";
  if (!dominio) return "Falta el proveedor después de la arroba. Ejemplo: @gmail.com";
  if (!dominio.includes(".")) return `Falta la terminación del correo. Ejemplo: @${dominio}.com`;
  if (dominio.startsWith(".")) return "Falta el proveedor antes del punto. Ejemplo: @gmail.com";
  if (!REGEX_EMAIL.test(texto)) return "La terminación del correo no es válida. Ejemplo: .com o .com.ar";
  return "";
}

export function validarPassword(valor) {
  if (!valor) return "Ingresá tu contraseña.";
  return "";
}

export function validarPasswordNueva(valor) {
  if (!valor) return "Creá una contraseña.";
  if (valor.length < LIMITES.PASSWORD_MINIMO) {
    return `La contraseña tiene que tener al menos ${LIMITES.PASSWORD_MINIMO} caracteres (tiene ${valor.length}).`;
  }
  if (!/[a-zA-Z]/.test(valor)) return "La contraseña tiene que tener al menos una letra.";
  if (!/[0-9]/.test(valor)) return "La contraseña tiene que tener al menos un número.";
  return "";
}

export function validarTerminos(aceptado) {
  return aceptado ? "" : "Tenés que aceptar los términos y la política de privacidad.";
}

export function validarTextoObligatorio(valor, nombreCampo, maximo = LIMITES.LARGO_NOMBRE) {
  const texto = valor.trim();
  if (!texto) return `Completá ${nombreCampo}.`;
  if (texto.length < 2) return `${capitalizar(nombreCampo)} es demasiado corto.`;
  if (texto.length > maximo) return `${capitalizar(nombreCampo)} admite hasta ${maximo} caracteres.`;
  return "";
}

export function validarTextoOpcional(valor, nombreCampo, maximo = LIMITES.LARGO_NOMBRE) {
  if (valor.trim().length > maximo) return `${capitalizar(nombreCampo)} admite hasta ${maximo} caracteres.`;
  return "";
}

export function validarTelefono(valor) {
  const texto = valor.trim();
  if (!texto) return "";
  if (!REGEX_TELEFONO.test(texto)) return "Usá solo números, espacios, +, - o paréntesis.";
  return "";
}

// Teléfono obligatorio (registro de comercios).
export function validarTelefonoObligatorio(valor) {
  if (!valor.trim()) return "Ingresá un teléfono de contacto.";
  const error = validarTelefono(valor);
  if (error) return error;
  if (valor.replace(/\D/g, "").length < 6) return "El teléfono tiene que tener al menos 6 números.";
  return "";
}

export function validarBusqueda(valor) {
  const texto = valor.trim();
  if (!texto) return "Escribí qué producto estás buscando.";
  if (texto.length < 2) return "Escribí al menos 2 letras.";
  return "";
}

export function validarPrecio(valor) {
  if (String(valor).trim() === "") return "Ingresá el precio.";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "Ingresá un precio válido.";
  if (numero <= 0) return "El precio tiene que ser mayor a 0.";
  if (numero > LIMITES.PRECIO_MAXIMO) return "El precio es demasiado alto.";
  if (Math.abs(Math.round(numero * 100) - numero * 100) > 1e-6) return "Usá como máximo dos decimales.";
  return "";
}

export function validarPorcentaje(valor) {
  if (String(valor).trim() === "") return "";
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return "Ingresá un número entero.";
  if (numero < 0 || numero > 99) return "El descuento va de 0 a 99 %.";
  return "";
}

export function validarImagen(archivo, obligatoria = false) {
  if (!archivo) return obligatoria ? "Elegí una imagen." : "";
  if (!TIPOS_ARCHIVO.IMAGEN.includes(archivo.type)) return "Usá una imagen JPG, PNG o WEBP.";
  if (archivo.size > LIMITES.MB_IMAGEN * 1024 * 1024) return `La imagen puede pesar hasta ${LIMITES.MB_IMAGEN} MB.`;
  return "";
}

export function validarRangoPrecio(desde, hasta) {
  if (desde !== null && desde < 0) return "El precio mínimo no puede ser negativo.";
  if (hasta !== null && hasta < 0) return "El precio máximo no puede ser negativo.";
  if (desde !== null && hasta !== null && desde > hasta) return "El precio mínimo no puede superar al máximo.";
  return "";
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Nombre de usuario de una cuenta personal: de 3 a 20 caracteres, letras sin tilde (mayúsculas o
// minúsculas), números, punto o guion bajo. Se guarda sin la arroba y respetando las mayúsculas,
// por ejemplo "lider_Ruiz". Coincide con la regla de firestore.rules.
export function normalizarNombreUsuario(valor) {
  return String(valor ?? "").trim().replace(/^@/, "");
}

// Versión en minúsculas para comparar. Así "Lider_Ruiz" y "lider_ruiz" cuentan como el mismo nombre
// y no pueden existir dos personas que solo se diferencien por una mayúscula.
export function claveNombreUsuario(valor) {
  return normalizarNombreUsuario(valor).toLowerCase();
}

export function validarNombreUsuario(valor) {
  const usuario = normalizarNombreUsuario(valor);
  if (!usuario) return "Elegí un nombre de usuario.";
  if (usuario.length < 3) return "El nombre de usuario tiene que tener al menos 3 caracteres.";
  if (usuario.length > 20) return "El nombre de usuario admite hasta 20 caracteres.";
  if (!/^[A-Za-z0-9._]+$/.test(usuario)) return "Usá solo letras sin tilde, números, punto o guion bajo.";
  return "";
}

export function validarComentario(valor) {
  const texto = valor.trim();
  if (texto.length < 3) return "Escribí un comentario de al menos 3 caracteres.";
  if (texto.length > LIMITES.LARGO_COMENTARIO) return `El comentario admite hasta ${LIMITES.LARGO_COMENTARIO} caracteres.`;
  return "";
}

// Presentación del producto: peso o volumen, por ejemplo "1 kg" o "500 ml". Opcional.
export function validarPresentacion(valor) {
  return String(valor ?? "").trim().length > LIMITES.LARGO_PRESENTACION
    ? `La presentación admite hasta ${LIMITES.LARGO_PRESENTACION} caracteres.`
    : "";
}

// Etiquetas del producto escritas separadas por coma, por ejemplo "Natural, Sabor intenso".
// Se guardan como lista, sin repetidas y sin vacías.
export function normalizarEtiquetas(valor) {
  const lista = Array.isArray(valor) ? valor : String(valor ?? "").split(",");
  const vistas = new Set();
  const resultado = [];
  for (const etiqueta of lista.map((e) => String(e).trim().replace(/\s+/g, " ")).filter(Boolean)) {
    const clave = normalizarTexto(etiqueta);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    resultado.push(etiqueta);
  }
  return resultado;
}

export function validarEtiquetas(valor) {
  const etiquetas = normalizarEtiquetas(valor);
  if (etiquetas.length > LIMITES.ETIQUETAS_MAXIMO) return `Usá hasta ${LIMITES.ETIQUETAS_MAXIMO} etiquetas.`;
  if (etiquetas.some((e) => e.length > LIMITES.LARGO_ETIQUETA)) return `Cada etiqueta admite hasta ${LIMITES.LARGO_ETIQUETA} caracteres.`;
  return "";
}
