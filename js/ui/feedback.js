// Elementos de interfaz reutilizables: estados de carga, error y vacío, avisos,
// errores de formulario, modales y utilidades de presentación de datos.

// ---------- Utilidades de presentación ----------

export function escaparHTML(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const formatoEntero =new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

// Devuelve el precio con los centavos en un span aparte, como en los wireframes: $ 2.450,00
export function precioHTML(valor) {
  const totalCentavos = Math.round((Number(valor) || 0) * 100);
  const entero = Math.floor(totalCentavos / 100);
  const centavos = String(totalCentavos % 100).padStart(2, "0");
  return `$ ${formatoEntero.format(entero)}<span class="precio__centavos">,${centavos}</span>`;
}

export function precioTexto(valor) {
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(valor) || 0)}`;
}

export function iniciales(nombre) {
  const palabras = String(nombre ?? "").trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  const letras = palabras.length === 1 ? palabras[0].slice(0, 2) : palabras[0][0] + palabras[1][0];
  return letras.toUpperCase();
}

// Convierte un Timestamp de Firestore en "Actualizado hoy", "ayer" o "hace N días".
export function textoActualizacion(fecha) {
  if (!fecha?.toDate) return "Actualizado recién";
  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diferencia = Math.round((dia(new Date()) - dia(fecha.toDate())) / 86400000);
  if (diferencia <= 0) return "Actualizado hoy";
  if (diferencia === 1) return "Actualizado ayer";
  return `Actualizado hace ${diferencia} días`;
}

// Fecha y hora completas de la última actualización de un precio, por ejemplo
// "Actualizado hoy, 20/11/2026 14:30". Sirve para saber si una oferta puede estar vieja.
export function textoActualizacionCompleta(fecha) {
  if (!fecha?.toDate) return "Actualizado recién";
  const valor = fecha.toDate();
  const dia = valor.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = valor.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${textoActualizacion(fecha)}, ${dia} ${hora}`;
}

// Fecha corta de un Timestamp de Firestore, por ejemplo "19 nov. 2026". Sin fecha: "Recién".
export function textoFecha(fecha) {
  if (!fecha?.toDate) return "Recién";
  return fecha.toDate().toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

// ---------- Estados de un contenedor ----------

export function mostrarCargando(contenedor, mensaje = "Cargando...") {
  contenedor.innerHTML = `
    <div class="estado" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <p class="estado__texto">${escaparHTML(mensaje)}</p>
    </div>`;
}

export function mostrarVacio(contenedor, titulo, texto = "") {
  contenedor.innerHTML = `
    <div class="estado estado--vacio">
      <p class="estado__titulo">${escaparHTML(titulo)}</p>
      ${texto ? `<p class="estado__texto">${escaparHTML(texto)}</p>` : ""}
    </div>`;
}

export function mostrarError(contenedor, mensaje, alReintentar = null) {
  contenedor.innerHTML = `
    <div class="estado estado--error" role="alert">
      <p class="estado__titulo">No pudimos cargar la información</p>
      <p class="estado__texto">${escaparHTML(mensaje)}</p>
    </div>`;
  if (alReintentar) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn--linea btn--chico";
    boton.textContent = "Reintentar";
    boton.addEventListener("click", alReintentar);
    contenedor.querySelector(".estado").append(boton);
  }
}

// ---------- Avisos flotantes ----------

export function mostrarAviso(mensaje, tipo = "exito") {
  let zona = document.querySelector(".avisos");
  if (!zona) {
    zona = document.createElement("div");
    zona.className = "avisos";
    zona.setAttribute("aria-live", "polite");
    document.body.append(zona);
  }
  const aviso = document.createElement("div");
  aviso.className = `aviso aviso--${tipo}`;
  aviso.textContent = mensaje;
  zona.append(aviso);
  setTimeout(() => aviso.remove(), 4000);
}

// ---------- Mensajes dentro de un formulario ----------

export function mostrarMensaje(elemento, mensaje, tipo = "error") {
  elemento.textContent = mensaje;
  elemento.className = `mensaje mensaje--${tipo}`;
  elemento.hidden = false;
}

export function ocultarMensaje(elemento) {
  elemento.hidden = true;
  elemento.textContent = "";
}

export function marcarErrorCampo(input, mensaje) {
  const campo = input.closest(".campo");
  const salida = campo?.querySelector(".campo__error");
  input.setAttribute("aria-invalid", mensaje ? "true" : "false");
  campo?.classList.toggle("campo--error", Boolean(mensaje));
  if (salida) salida.textContent = mensaje;
}

export function limpiarErrores(formulario) {
  formulario.querySelectorAll("input, select, textarea").forEach((input) => marcarErrorCampo(input, ""));
}

// Aplica una lista de validaciones [input, mensaje] y enfoca el primer campo con error.
export function aplicarValidaciones(validaciones) {
  let primero = null;
  for (const [input, mensaje] of validaciones) {
    marcarErrorCampo(input, mensaje);
    if (mensaje && !primero) primero = input;
  }
  primero?.focus();
  return primero === null;
}

export function botonCargando(boton, cargando, textoCargando = "Guardando...") {
  if (cargando) {
    boton.dataset.textoOriginal = boton.textContent;
    boton.textContent = textoCargando;
    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");
  } else {
    boton.textContent = boton.dataset.textoOriginal ?? boton.textContent;
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
  }
}

// ---------- Modales (<dialog>) ----------

export function abrirModal(dialogo) {
  dialogo.showModal();
}

export function cerrarModal(dialogo) {
  dialogo.close();
}

// Conecta los botones [data-cerrar-modal] y el clic fuera del contenido.
export function prepararModal(dialogo) {
  dialogo.querySelectorAll("[data-cerrar-modal]").forEach((boton) =>
    boton.addEventListener("click", () => cerrarModal(dialogo))
  );
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) cerrarModal(dialogo);
  });
}

// Tarjeta de confirmación. Devuelve true si se acepta y false si se cancela.
// motivo: { etiqueta, obligatorio } agrega un campo de texto para explicar la decisión. En ese caso
// devuelve el texto escrito (o "" si no es obligatorio y quedó vacío) y null si se cancela.
// grande: tarjeta más grande, para acciones que la persona tiene que leer con atención.
export function confirmar({ titulo, texto, textoAceptar = "Confirmar", peligro = false, motivo = null, grande = false }) {
  return new Promise((resolve) => {
    const dialogo = document.createElement("dialog");
    dialogo.className = `modal ${grande ? "modal--confirmacion-grande" : "modal--chico"}`;
    dialogo.innerHTML = `
      <form class="modal__contenido" method="dialog" novalidate>
        <h2 class="modal__titulo">${escaparHTML(titulo)}</h2>
        <p class="modal__texto">${escaparHTML(texto)}</p>
        ${
          motivo
            ? `<div class="campo">
                <label class="campo__etiqueta" for="motivo-confirmacion">${escaparHTML(motivo.etiqueta ?? "Motivo")}${motivo.obligatorio ? "" : " (opcional)"}</label>
                <textarea class="campo__control" id="motivo-confirmacion" rows="3" maxlength="300"></textarea>
                <p class="campo__error" aria-live="polite"></p>
              </div>`
            : ""
        }
        <div class="modal__acciones">
          <button type="button" class="btn btn--linea" value="no">Cancelar</button>
          <button type="submit" class="btn ${peligro ? "btn--peligro" : "btn--primario"}" value="si">${escaparHTML(textoAceptar)}</button>
        </div>
      </form>`;
    document.body.append(dialogo);
    const campo = dialogo.querySelector("#motivo-confirmacion");
    let respuesta = motivo ? null : false;
    dialogo.querySelector("button[value=no]").addEventListener("click", () => dialogo.close());
    dialogo.querySelector("form").addEventListener("submit", (evento) => {
      evento.preventDefault();
      if (motivo) {
        const valor = campo.value.trim();
        if (motivo.obligatorio && valor.length < 3) {
          marcarErrorCampo(campo, "Escribí el motivo (al menos 3 letras).");
          campo.focus();
          return;
        }
        respuesta = valor;
      } else {
        respuesta = true;
      }
      dialogo.close();
    });
    dialogo.addEventListener("close", () => {
      dialogo.remove();
      resolve(respuesta);
    });
    dialogo.showModal();
    campo?.focus();
  });
}

// ---------- Buscador del encabezado (inicio y resultados) ----------

// Valida el texto y llama a alBuscar(texto). validar devuelve un mensaje de error o "".
export function prepararBuscador({ formulario, input, limpiar, error }, { validar, alBuscar }) {
  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const mensaje = validar(input.value);
    error.textContent = mensaje;
    error.hidden = !mensaje;
    if (mensaje) {
      input.focus();
      return;
    }
    alBuscar(input.value.trim());
  });
  input.addEventListener("input", () => {
    limpiar.hidden = input.value === "";
    error.hidden = true;
  });
  limpiar.addEventListener("click", () => {
    input.value = "";
    limpiar.hidden = true;
    input.focus();
  });
}

// Completa un <select> con las localidades. Con placeholder agrega una primera opción vacía.
export function llenarSelectorLocalidad(select, localidades, { valor = "", placeholder = "" } = {}) {
  select.innerHTML =
    (placeholder ? `<option value="">${escaparHTML(placeholder)}</option>` : "") +
    localidades.map((localidad) => `<option value="${escaparHTML(localidad)}">${escaparHTML(localidad)}</option>`).join("");
  select.value = valor;
}
