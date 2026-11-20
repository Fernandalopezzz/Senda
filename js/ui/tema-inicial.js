// Aplica el modo oscuro guardado antes de que se dibuje la página.
// Es un script común (no módulo) y se carga en el <head> de todas las páginas.
(function () {
  try {
    if (localStorage.getItem("senda:tema") === "oscuro") {
      document.documentElement.setAttribute("data-tema", "oscuro");
    }
  } catch (e) {
    // Sin localStorage se usa el modo claro.
  }
})();
