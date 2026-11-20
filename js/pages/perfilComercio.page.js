// Perfil público de un comercio: sus datos de contacto y el catálogo de productos que publicó.
// Se abre con perfil-comercio.html?id=<id del comercio>.
// Si quien lo abre es el administrador, ve el perfil aunque el comercio esté pendiente o bloqueado,
// no puede editar ningún dato y puede eliminar un producto que no sea apto para la venta.
// El comercio recibe un aviso de la eliminación la próxima vez que abre SENDA.

import { LIMITES, ROLES, ROLES_COMERCIO_ACTIVO, RUTAS } from "../core/constants.js";
import { manejarError } from "../core/errores.js";
import { verificarConfiguracion, obtenerUsuarioActual } from "../services/authService.js";
import { ACCIONES_POR_ESTADO, ELIMINAR_CUENTA, aplicarAccionComercio } from "../ui/components/accionesComercio.js";
import { obtenerComercio, obtenerImagenesComercio } from "../services/comerciosService.js";
import { listarProductos } from "../services/productosService.js";
import { obtenerUsuario } from "../services/usuariosService.js";
import { listarPreciosPorComercio, eliminarPublicacionPorAdmin } from "../services/preciosService.js";
import {
  escaparHTML,
  iniciales,
  mostrarCargando,
  mostrarError,
  mostrarVacio,
  mostrarAviso,
  confirmar
} from "../ui/feedback.js";
import {
  crearTarjetaProducto,
  crearFiltros,
  filtrarItems,
  ordenarLista,
  opcionesOrden
} from "../ui/components/tarjetaProducto.js";
import { prepararBarraPublica } from "../guards/sessionGuard.js";

const $ = (id) => document.getElementById(id);

const elementos = {
  barra: $("barra-publica"),
  encabezado: $("encabezado-perfil"),
  perfil: $("perfil-publico"),
  catalogo: $("catalogo-comercio"),
  filtros: $("filtros"),
  resumen: $("resumen-catalogo"),
  orden: $("orden-catalogo"),
  lista: $("lista-catalogo"),
  botonMas: $("boton-mas-catalogo"),
  avisoAdmin: $("aviso-admin")
};

const TEXTO_ESTADO = {
  [ROLES.PENDIENTE]: "Pendiente de validación",
  [ROLES.COMERCIO]: "Validado",
  [ROLES.RECHAZADO]: "Bloqueado"
};

const estado = {
  items: [], // [{ precio, producto }]
  filtros: null,
  cantidadVisible: LIMITES.RESULTADOS_POR_PAGINA,
  comercio: null,
  imagenes: { foto: null, fondo: null },
  esAdmin: false
};

// true si la sesión abierta es la del administrador. Sin sesión o con error, se muestra la vista pública.
async function sesionEsAdmin() {
  try {
    const usuario = await obtenerUsuarioActual();
    if (!usuario) return false;
    const perfil = await obtenerUsuario(usuario.uid);
    return perfil?.rol === ROLES.ADMIN;
  } catch (error) {
    manejarError(error, "Lectura de la sesión en el perfil");
    return false;
  }
}

function rutaMapa(direccion) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, Río Gallegos, Santa Cruz`)}`;
}

function renderizarPerfil(comercio, { foto, fondo }) {
  document.title = `${comercio.nombre} · SENDA`;
  elementos.encabezado.classList.toggle("encabezado--con-fondo", Boolean(fondo));
  elementos.encabezado.style.setProperty("--fondo-comercio", fondo ? `url("${fondo}")` : "none");
  const cantidad = estado.items.length;
  const textoCantidad = cantidad === 1 ? "1 producto publicado" : `${cantidad} productos publicados`;
  const telefono = comercio.telefono?.trim();
  const direccion = comercio.direccion?.trim();

  elementos.perfil.innerHTML = `
    <div class="perfil-publico__cuerpo">
      <span class="perfil-comercio__foto">
        ${foto
          ? `<img class="perfil-comercio__imagen" src="${escaparHTML(foto)}" alt="Foto de ${escaparHTML(comercio.nombre)}">`
          : `<span class="perfil-comercio__iniciales" aria-hidden="true">${escaparHTML(iniciales(comercio.nombre))}</span>`}
      </span>
      <div class="perfil-publico__datos">
        <h1 class="perfil-publico__nombre">${escaparHTML(comercio.nombre)}</h1>
        ${comercio.validado ? "" : '<p class="no-validado no-validado--claro">Comercio no validado</p>'}
        <p class="perfil-publico__direccion">${escaparHTML(direccion || "Dirección sin cargar")}</p>
        <p class="perfil-publico__cantidad">${textoCantidad}</p>
      </div>
      <div class="perfil-publico__contacto">
        <p><strong>Contacto:</strong> ${telefono ? `<a href="tel:${escaparHTML(telefono.replace(/[^0-9+]/g, ""))}">${escaparHTML(telefono)}</a>` : "Sin cargar"}</p>
        <p><strong>Horario:</strong> ${escaparHTML(comercio.horario?.trim() || "Sin cargar")}</p>
        ${direccion ? `<a class="btn btn--amarillo btn--chico" href="${rutaMapa(direccion)}" target="_blank" rel="noopener">
          <svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          Cómo llegar</a>` : ""}
      </div>
    </div>`;
}

function renderizarCatalogo() {
  const total = estado.items.length;
  if (total === 0) {
    elementos.resumen.textContent = "Precios publicados por el comercio";
    mostrarVacio(elementos.lista, "Este comercio todavía no publicó productos");
    elementos.botonMas.hidden = true;
    return;
  }

  const filtrados = ordenarLista(filtrarItems(estado.items, estado.filtros.obtener()), elementos.orden.value, {
    obtenerPrecio: (item) => item.precio.precioFinal,
    obtenerDescuento: (item) => Number(item.precio.porcentajeDescuento) || 0,
    obtenerNombre: (item) => item.producto.nombre
  });

  elementos.resumen.textContent = `${filtrados.length} de ${total} productos · Precios publicados por el comercio`;
  if (filtrados.length === 0) {
    mostrarVacio(elementos.lista, "Ningún producto coincide con los filtros", "Probá con otros filtros o borralos.");
    elementos.botonMas.hidden = true;
    return;
  }

  elementos.lista.replaceChildren(
    ...filtrados.slice(0, estado.cantidadVisible).map((item) => {
      const { precio, producto } = item;
      const tarjeta = crearTarjetaProducto({
        producto,
        precio: precio.precioFinal,
        descuento: Number(precio.porcentajeDescuento) || 0,
        detalle: precio.disponible ? "En stock" : "Sin stock",
        sinStock: !precio.disponible
      });
      if (estado.esAdmin) tarjeta.querySelector(".tarjeta-producto__cuerpo").append(crearBotonEliminar(item));
      return tarjeta;
    })
  );
  elementos.botonMas.hidden = filtrados.length <= estado.cantidadVisible;
}

// ---------- Acciones del administrador ----------

function crearBotonEliminar(item) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "btn btn--peligro btn--bloque btn--chico";
  boton.textContent = "Eliminar producto";
  boton.addEventListener("click", () => eliminarProducto(item, boton));
  return boton;
}

async function eliminarProducto(item, boton) {
  const { precio, producto } = item;
  const aceptado = await confirmar({
    titulo: "Eliminar producto",
    texto: `«${producto.nombre}» deja de publicarse en ${estado.comercio.nombre}. La próxima vez que el comercio abra SENDA, va a ver un aviso de que SENDA eliminó el producto.`,
    textoAceptar: "Eliminar",
    peligro: true
  });
  if (!aceptado) return;

  boton.disabled = true;
  try {
    await eliminarPublicacionPorAdmin(precio, producto);
    estado.items = estado.items.filter((otro) => otro !== item);
    renderizarPerfil(estado.comercio, estado.imagenes);
    renderizarCatalogo();
    mostrarAviso(`Eliminaste «${producto.nombre}» de ${estado.comercio.nombre}.`);
  } catch (error) {
    boton.disabled = false;
    mostrarAviso(manejarError(error, "Eliminación de producto por el administrador"), "error");
  }
}

// Recuadro del administrador: estado de la cuenta y botones para cambiarlo
// (aceptar, rechazar, bloquear, volver a habilitar o eliminar, según el estado).
function mostrarAvisoAdmin(rol) {
  estado.rol = rol;
  elementos.avisoAdmin.hidden = false;
  elementos.avisoAdmin.innerHTML = `
    <div class="aviso-admin__texto">
      <p><strong>Vista de administración.</strong> Estado de la cuenta: <strong>${escaparHTML(TEXTO_ESTADO[rol] ?? "Sin estado")}</strong>.</p>
      <p>Los datos del comercio no se pueden editar desde acá. Si un producto no es apto para la venta, se puede eliminar
      y el comercio recibe un aviso.</p>
    </div>
    <div class="aviso-admin__acciones"></div>`;
  const acciones = elementos.avisoAdmin.querySelector(".aviso-admin__acciones");
  for (const accion of ACCIONES_POR_ESTADO[rol] ?? []) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = `btn btn--chico ${accion.icono === "aceptar" ? "btn--primario" : "btn--peligro"}`;
    boton.textContent = accion.destino === ELIMINAR_CUENTA ? "Eliminar cuenta" : `${accion.texto} cuenta`;
    boton.addEventListener("click", () => cambiarEstadoCuenta(accion.destino));
    acciones.append(boton);
  }
}

async function cambiarEstadoCuenta(destino) {
  const botones = elementos.avisoAdmin.querySelectorAll("button");
  botones.forEach((boton) => (boton.disabled = true));
  try {
    const resultado = await aplicarAccionComercio({
      comercioId: estado.comercio.id,
      nombre: estado.comercio.nombre,
      rolActual: estado.rol,
      destino
    });
    if (!resultado) {
      botones.forEach((boton) => (boton.disabled = false));
      return;
    }
    if (destino === ELIMINAR_CUENTA) {
      // La cuenta ya no existe: se vuelve al panel de administración.
      sessionStorage.setItem("senda:aviso-admin", resultado);
      window.location.replace(RUTAS.GESTION_COMERCIO);
      return;
    }
    estado.comercio.validado = destino === ROLES.COMERCIO;
    mostrarAvisoAdmin(destino);
    renderizarPerfil(estado.comercio, estado.imagenes);
    mostrarAviso(resultado);
  } catch (error) {
    botones.forEach((boton) => (boton.disabled = false));
    mostrarAviso(manejarError(error, "Cambio de estado desde el perfil del comercio"), "error");
  }
}

function reiniciarPaginaYRenderizar() {
  estado.cantidadVisible = LIMITES.RESULTADOS_POR_PAGINA;
  renderizarCatalogo();
}

async function cargar() {
  const comercioId = new URLSearchParams(window.location.search).get("id");
  if (!comercioId) {
    mostrarVacio(elementos.perfil, "No se indicó qué comercio mostrar", "Buscá el comercio por su nombre desde el inicio.");
    elementos.catalogo.hidden = true;
    return;
  }

  mostrarCargando(elementos.lista, "Cargando catálogo...");
  try {
    verificarConfiguracion();
    const [comercio, usuario, precios, productos, imagenes, esAdmin] = await Promise.all([
      obtenerComercio(comercioId),
      obtenerUsuario(comercioId),
      listarPreciosPorComercio(comercioId),
      listarProductos(),
      // Si la foto o el fondo fallan, el perfil se muestra igual, sin ellos.
      obtenerImagenesComercio(comercioId).catch((error) => {
        manejarError(error, "Foto y fondo del comercio");
        return { foto: null, fondo: null };
      }),
      sesionEsAdmin()
    ]);
    estado.esAdmin = esAdmin;

    // Los comercios pendientes o rechazados no tienen perfil público. El administrador sí los ve.
    if (!comercio || (!esAdmin && !ROLES_COMERCIO_ACTIVO.includes(usuario?.rol))) {
      mostrarVacio(elementos.perfil, "No encontramos este comercio", "Puede que ya no esté publicado en SENDA.");
      elementos.catalogo.hidden = true;
      return;
    }

    const productoPorId = new Map(productos.map((producto) => [producto.id, producto]));
    estado.items = precios
      .filter((precio) => productoPorId.has(precio.productoId))
      .map((precio) => ({ precio, producto: productoPorId.get(precio.productoId) }));

    comercio.validado = usuario?.rol === ROLES.COMERCIO;
    estado.comercio = comercio;
    estado.imagenes = imagenes;
    if (esAdmin) mostrarAvisoAdmin(usuario?.rol);
    renderizarPerfil(comercio, imagenes);
    renderizarCatalogo();
  } catch (error) {
    const mensaje = manejarError(error, "Carga del perfil del comercio");
    mostrarError(elementos.perfil, mensaje, cargar);
    elementos.lista.replaceChildren();
  }
}

prepararBarraPublica(elementos.barra);
elementos.orden.innerHTML = opcionesOrden();
elementos.orden.addEventListener("change", reiniciarPaginaYRenderizar);
estado.filtros = crearFiltros(elementos.filtros, {
  modoStock: "enStock",
  placeholder: "Buscar en este comercio",
  alCambiar: reiniciarPaginaYRenderizar
});
elementos.botonMas.addEventListener("click", () => {
  estado.cantidadVisible += LIMITES.RESULTADOS_POR_PAGINA;
  renderizarCatalogo();
});
cargar();
