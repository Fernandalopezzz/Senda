// Preferencias de pantalla que se guardan en el navegador: modo oscuro.
// tema-inicial.js las aplica antes de dibujar cada página. Este módulo las cambia desde Configuración.
// Se guardan por dispositivo porque dependen de la pantalla y del momento de uso:
// alguien puede querer el modo oscuro en el celular de noche y el claro en la computadora.

const CLAVE_TEMA = "senda:tema";

export function modoOscuroActivo() {
  return document.documentElement.getAttribute("data-tema") === "oscuro";
}

export function aplicarModoOscuro(activo) {
  if (activo) document.documentElement.setAttribute("data-tema", "oscuro");
  else document.documentElement.removeAttribute("data-tema");
  try {
    localStorage.setItem(CLAVE_TEMA, activo ? "oscuro" : "claro");
  } catch {
    // Sin localStorage, el cambio dura mientras la página está abierta.
  }
}
