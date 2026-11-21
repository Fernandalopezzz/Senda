// Campanita de notificaciones de la barra superior.
//
// Reúne en un solo lugar todo lo que SENDA le avisa a una cuenta:
//   - Cuenta personal: cambios de precio de sus favoritos (bajó, subió, sin stock, volvió el stock).
//   - Comercio: productos que SENDA eliminó de su catálogo.
//   - Las dos: avisos del equipo de moderación (en revisión, advertencia, oculto, aprobado).
//
// Al iniciar sesión, si hay novedades, aparece un aviso al costado durante unos segundos, sin tapar
// la página. Después el aviso "vuela" hacia la campanita y queda guardado ahí, con el número de
// notificaciones sin leer. Al tocar la campanita se abre la lista.

import { RUTAS } from "../../core/constants.js";
import { manejarError } from "../../core/errores.js";
import { escaparHTML, precioTexto } from "../feedback.js";
import { revisarCambiosDePrecio, marcarCambiosVistos } from "../../services/avisosPrecioService.js";
import { listarAvisosSinLeer, marcarAvisoLeido } from "../../services/reportesService.js";
import { listarNotificacionesPendientes, marcarNotificacionesLeidas } from "../../services/notificacionesService.js";

// Evento que avisa a la campanita que algo se marcó como leído en otra parte de la página.
export const EVENTO_NOTIFICACIONES = "senda:notificaciones-cambiaron";

const SEGUNDOS_AVISO = 6;

const ICONO_CAMPANA =
  '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/></svg>';

const TITULOS_MODERACION = {
  "en-revision": "Contenido en revisión",
  advertencia: "Advertencia del equipo de SENDA",
  oculto: "Contenido ocultado por SENDA",
  aprobado: "Revisión terminada"
};

function textoCambioPrecio({ tipo, antes, ahora, descuento }) {
  const conDescuento = descuento > 0 ? ` Tiene ${descuento}% de descuento.` : "";
  if (tipo === "bajo") return `Bajó de ${precioTexto(antes)} a ${precioTexto(ahora)}.${conDescuento}`;
  if (tipo === "subio") return `Subió de ${precioTexto(antes)} a ${precioTexto(ahora)}.`;
  if (tipo === "sin-stock") return "Ningún comercio tiene stock en este momento.";
  return `Volvió a haber stock, desde ${precioTexto(ahora)}.${conDescuento}`;
}

const TITULOS_PRECIO = {
  bajo: "Bajó el precio",
  subio: "Subió el precio",
  "sin-stock": "Sin stock",
  "volvio-stock": "Volvió el stock"
};

// Junta las notificaciones de todas las fuentes en una sola lista.
// Cada una: { clave, tipo, titulo, texto, enlace, leer() }
async function leerNotificaciones({ uid, esCliente, esComercio }) {
  const tareas = [listarAvisosSinLeer(uid).catch(() => [])];
  tareas.push(esCliente ? revisarCambiosDePrecio(uid).catch(() => ({ cambios: [], avisosActivos: false })) : { cambios: [], avisosActivos: false });
  tareas.push(esComercio ? listarNotificacionesPendientes(uid).catch(() => []) : []);
  const [moderacion, { cambios, avisosActivos }, eliminados] = await Promise.all(tareas);

  const lista = [];
  if (avisosActivos) {
    for (const cambio of cambios) {
      lista.push({
        clave: `precio-${cambio.productoId}`,
        tipo: cambio.tipo === "bajo" ? "bajo" : "precio",
        titulo: `${TITULOS_PRECIO[cambio.tipo]} · ${cambio.producto.nombre}`,
        texto: textoCambioPrecio(cambio),
        enlace: `${RUTAS.DETALLE_PRODUCTO}?id=${encodeURIComponent(cambio.productoId)}`,
        leer: () => marcarCambiosVistos(uid, [cambio])
      });
    }
  }
  for (const aviso of eliminados) {
    lista.push({
      clave: `eliminado-${aviso.id}`,
      tipo: "alerta",
      titulo: "SENDA eliminó un producto",
      texto: `«${aviso.productoNombre || "Producto sin nombre"}» ya no se muestra en tu comercio. Si creés que es un error, comunicate con soporte técnico.`,
      enlace: RUTAS.GESTION_COMERCIO,
      leer: () => marcarNotificacionesLeidas([aviso.id])
    });
  }
  for (const aviso of moderacion) {
    lista.push({
      clave: `moderacion-${aviso.id}`,
      tipo: aviso.tipo === "aprobado" ? "bajo" : "alerta",
      titulo: TITULOS_MODERACION[aviso.tipo] ?? "Aviso de SENDA",
      texto: aviso.texto,
      enlace: null,
      leer: () => marcarAvisoLeido(aviso.id)
    });
  }
  return lista;
}

// contenedor: el bloque de la barra con la cuenta (data-acciones-sesion o encabezado__acciones).
// cuenta: { uid, esCliente, esComercio }
export function montarCampanita(contenedor, cuenta) {
  if (!cuenta?.uid || contenedor.querySelector(".campanita")) return;

  const raiz = document.createElement("div");
  raiz.className = "campanita";
  raiz.innerHTML = `
    <button class="campanita__boton" type="button" aria-haspopup="true" aria-expanded="false" title="Notificaciones">
      ${ICONO_CAMPANA}
      <span class="campanita__numero" hidden>0</span>
    </button>
    <div class="campanita__panel" role="dialog" aria-label="Notificaciones" hidden>
      <div class="campanita__cabecera">
        <strong>Notificaciones</strong>
        <button class="enlace-boton campanita__leer-todo" type="button" hidden>Marcar todo como leído</button>
      </div>
      <ul class="campanita__lista"></ul>
    </div>`;
  contenedor.prepend(raiz);

  const boton = raiz.querySelector(".campanita__boton");
  const numero = raiz.querySelector(".campanita__numero");
  const panel = raiz.querySelector(".campanita__panel");
  const lista = raiz.querySelector(".campanita__lista");
  const leerTodo = raiz.querySelector(".campanita__leer-todo");
  let notificaciones = [];

  function renderizar() {
    numero.hidden = notificaciones.length === 0;
    numero.textContent = notificaciones.length > 9 ? "9+" : notificaciones.length;
    boton.setAttribute("aria-label", notificaciones.length ? `Notificaciones, ${notificaciones.length} sin leer` : "Notificaciones");
    leerTodo.hidden = notificaciones.length === 0;
    if (notificaciones.length === 0) {
      lista.innerHTML = '<li class="campanita__vacio">No tenés notificaciones nuevas.</li>';
      return;
    }
    lista.replaceChildren(
      ...notificaciones.map((n) => {
        const item = document.createElement("li");
        item.className = `campanita__item campanita__item--${n.tipo}`;
        item.innerHTML = `
          <span class="campanita__marca" aria-hidden="true"></span>
          <span class="campanita__textos">
            <strong>${escaparHTML(n.titulo)}</strong>
            <span>${escaparHTML(n.texto)}</span>
          </span>
          <button class="campanita__cerrar" type="button" title="Marcar como leída" aria-label="Marcar como leída">
            <svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          </button>`;
        item.querySelector(".campanita__cerrar").addEventListener("click", (evento) => {
          evento.stopPropagation();
          leer([n]);
        });
        if (n.enlace) {
          item.classList.add("campanita__item--enlace");
          item.addEventListener("click", async () => {
            await leer([n]);
            window.location.href = n.enlace;
          });
        }
        return item;
      })
    );
  }

  async function leer(cuales) {
    try {
      await Promise.all(cuales.map((n) => n.leer()));
    } catch (error) {
      manejarError(error, "Marcar notificaciones");
    }
    const claves = new Set(cuales.map((n) => n.clave));
    notificaciones = notificaciones.filter((n) => !claves.has(n.clave));
    renderizar();
  }

  function abrir(abierto) {
    panel.hidden = !abierto;
    boton.setAttribute("aria-expanded", String(abierto));
  }

  boton.addEventListener("click", (evento) => {
    evento.stopPropagation();
    abrir(panel.hidden);
  });
  leerTodo.addEventListener("click", () => leer([...notificaciones]));
  document.addEventListener("click", (evento) => {
    if (!raiz.contains(evento.target)) abrir(false);
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") abrir(false);
  });

  async function actualizar({ conAviso = false } = {}) {
    try {
      notificaciones = await leerNotificaciones(cuenta);
    } catch (error) {
      manejarError(error, "Notificaciones");
      notificaciones = [];
    }
    renderizar();
    if (conAviso && notificaciones.length > 0) mostrarAvisoLateral(notificaciones, boton);
  }

  window.addEventListener(EVENTO_NOTIFICACIONES, () => actualizar());

  // El aviso lateral aparece una vez por visita (al iniciar sesión o al abrir SENDA).
  let primeraVez = true;
  try {
    const clave = `senda:campanita:${cuenta.uid}`;
    primeraVez = sessionStorage.getItem(clave) !== "si";
    sessionStorage.setItem(clave, "si");
  } catch {
    // Sin sessionStorage el aviso aparece en cada página.
  }
  actualizar({ conAviso: primeraVez });
}

// Aviso que entra por el costado derecho, se queda unos segundos y vuela hacia la campanita.
function mostrarAvisoLateral(notificaciones, boton) {
  const aviso = document.createElement("div");
  aviso.className = "campanita-aviso";
  aviso.setAttribute("role", "status");
  const primeras = notificaciones.slice(0, 2);
  aviso.innerHTML = `
    <span class="campanita-aviso__icono">${ICONO_CAMPANA}</span>
    <div class="campanita-aviso__textos">
      ${primeras.map((n) => `<p><strong>${escaparHTML(n.titulo)}</strong><br>${escaparHTML(n.texto)}</p>`).join("")}
      ${notificaciones.length > 2 ? `<p class="campanita-aviso__mas">Y ${notificaciones.length - 2} más en la campanita.</p>` : ""}
    </div>`;
  document.body.append(aviso);
  requestAnimationFrame(() => aviso.classList.add("campanita-aviso--visible"));

  setTimeout(() => {
    // Vuela hacia la campanita: se achica y se mueve hasta el botón.
    const desde = aviso.getBoundingClientRect();
    const hasta = boton.getBoundingClientRect();
    const dx = hasta.left + hasta.width / 2 - (desde.left + desde.width / 2);
    const dy = hasta.top + hasta.height / 2 - (desde.top + desde.height / 2);
    aviso.style.transform = `translate(${dx}px, ${dy}px) scale(0.08)`;
    aviso.classList.add("campanita-aviso--guardando");
    setTimeout(() => {
      aviso.remove();
      boton.classList.add("campanita__boton--sacudir");
      setTimeout(() => boton.classList.remove("campanita__boton--sacudir"), 700);
    }, 650);
  }, SEGUNDOS_AVISO * 1000);
}
