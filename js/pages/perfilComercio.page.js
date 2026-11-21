// Perfil público de un comercio: sus datos de contacto y el catálogo de productos que publicó.
// Se abre con perfil-comercio.html?id=<id del comercio>.
// Si quien lo abre es del equipo de SENDA (administrador o empleado habilitado), ve el perfil aunque
// el comercio esté pendiente o bloqueado y no puede editar ningún dato. Ve los botones de estado que
// su cuenta tiene permitidos. Solo el administrador puede eliminar un producto que no sea apto.
// El comercio recibe un aviso de la eliminación la próxima vez que abre SENDA.

import { LIMITES, ROLES, ROLES_COMERCIO_ACTIVO, ROLES_EQUIPO, RUTAS, TIPOS_REPORTE, PROVINCIA, LOCALIDAD_PREDETERMINADA, ORIGENES } from "../core/constants.js";
import { manejarError } from "../core/errores.js";
import { verificarConfiguracion, obtenerUsuarioActual } from "../services/authService.js";
import { ELIMINAR_CUENTA, accionesPermitidas, aplicarAccionComercio } from "../ui/components/accionesComercio.js";
import { obtenerActor, registrarAccion } from "../services/moderacionService.js";
import { mapaDeRevisiones, estadoDe } from "../services/reportesService.js";
import { obtenerOcultos, ocultarComercio, mostrarComercio } from "../services/bloqueosService.js";
import { crearBotonReportar } from "../ui/components/reportar.js";
import { obtenerCuentaActual } from "../guards/sessionGuard.js";
import { obtenerComercio, obtenerImagenesComercio } from "../services/comerciosService.js";
import { listarProductos } from "../services/productosService.js";
import { obtenerUsuario } from "../services/usuariosService.js";
import { listarPreciosPorComercio, eliminarPublicacionPorAdmin, esDeHoy } from "../services/preciosService.js";
import { htmlActualizadoHoy } from "../ui/components/tarjetaComercio.js";
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
  esAdmin: false,
  // Cuenta del equipo con la sesión abierta, o null (ver obtenerActor).
  actor: null,
  // Cuenta con sesión iniciada ({ uid, rol }) y si la persona ocultó este comercio.
  cuenta: null,
  ocultoPorMi: false,
  revisiones: new Map()
};

// Datos de la cuenta del equipo con la sesión abierta (administrador o empleado habilitado).
// Sin sesión, con otra cuenta o con error, devuelve null y se muestra la vista pública.
async function actorDelEquipo() {
  try {
    const usuario = await obtenerUsuarioActual();
    if (!usuario) return null;
    const perfil = await obtenerUsuario(usuario.uid);
    if (!ROLES_EQUIPO.includes(perfil?.rol)) return null;
    const actor = await obtenerActor(usuario, perfil.rol);
    return actor.rol === ROLES.ADMIN || actor.empleado?.activo ? actor : null;
  } catch (error) {
    manejarError(error, "Lectura de la sesión en el perfil");
    return null;
  }
}

function rutaMapa(direccion, localidad) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, ${localidad}, ${PROVINCIA}`)}`;
}

function renderizarPerfil(comercio, { foto, fondo }) {
  document.title = `${comercio.nombre} · SENDA`;
  elementos.encabezado.classList.toggle("encabezado--con-fondo", Boolean(fondo));
  elementos.encabezado.style.setProperty("--fondo-comercio", fondo ? `url("${fondo}")` : "none");
  const cantidad = estado.items.length;
  const textoCantidad = cantidad === 1 ? "1 producto publicado" : `${cantidad} productos publicados`;
  const telefono = comercio.telefono?.trim();
  const direccion = comercio.direccion?.trim();
  const localidad = comercio.localidad || LOCALIDAD_PREDETERMINADA;

  elementos.perfil.innerHTML = `
    <div class="perfil-publico__cuerpo">
      <span class="perfil-comercio__foto">
        ${foto
          ? `<img class="perfil-comercio__imagen" src="${escaparHTML(foto)}" alt="Foto de ${escaparHTML(comercio.nombre)}">`
          : `<span class="perfil-comercio__iniciales" aria-hidden="true">${escaparHTML(iniciales(comercio.nombre))}</span>`}
      </span>
      <div class="perfil-publico__datos">
        <h1 class="perfil-publico__nombre">${escaparHTML(comercio.nombre)} ${htmlActualizadoHoy(comercio)}${
          estadoDe(estado.revisiones, TIPOS_REPORTE.CUENTA, comercio.id).enRevision ? ' <span class="insignia-revision">En revisión</span>' : ""
        }</h1>
        ${comercio.validado ? "" : '<p class="no-validado no-validado--claro">Comercio no validado</p>'}
        <p class="perfil-publico__direccion">${escaparHTML(direccion || "Dirección sin cargar")} · ${escaparHTML(localidad)}</p>
        <p class="perfil-publico__cantidad">${textoCantidad}</p>
      </div>
      <div class="perfil-publico__contacto">
        <p><strong>Contacto:</strong> ${telefono ? `<a href="tel:${escaparHTML(telefono.replace(/[^0-9+]/g, ""))}">${escaparHTML(telefono)}</a>` : "Sin cargar"}</p>
        <p><strong>Horario:</strong> ${escaparHTML(comercio.horario?.trim() || "Sin cargar")}</p>
        ${direccion ? `<a class="btn btn--amarillo btn--chico" href="${rutaMapa(direccion, localidad)}" target="_blank" rel="noopener">
          <svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          Cómo llegar</a>` : ""}
        <div class="perfil-publico__moderacion"></div>
      </div>
    </div>
    ${estado.ocultoPorMi ? `<p class="mensaje mensaje--info perfil-publico__oculto">Ocultaste este comercio: sus precios no aparecen en tus comparaciones. <button class="enlace-boton" type="button" id="boton-mostrar-comercio">Volver a mostrarlo</button></p>` : ""}`;
  agregarAccionesDeCuenta(comercio);
}

// Reportar el comercio (cuentas personales y otros comercios) y ocultarlo de las comparaciones
// (solo cuentas personales). El equipo de SENDA y el propio comercio no ven estos botones.
function agregarAccionesDeCuenta(comercio) {
  const zona = elementos.perfil.querySelector(".perfil-publico__moderacion");
  const cuenta = estado.cuenta;
  if (estado.actor || cuenta?.uid === comercio.id) return;
  zona.append(
    crearBotonReportar(
      { tipo: TIPOS_REPORTE.CUENTA, objetivoId: comercio.id, objetivoNombre: comercio.nombre, duenoId: comercio.id },
      { texto: "Reportar comercio", clase: "btn--sobre-oscuro" }
    )
  );
  if (cuenta?.rol === ROLES.CLIENTE && !estado.ocultoPorMi) {
    const ocultar = document.createElement("button");
    ocultar.type = "button";
    ocultar.className = "btn btn--linea btn--chico btn--sobre-oscuro";
    ocultar.textContent = "Ocultar de mis comparaciones";
    ocultar.addEventListener("click", () => cambiarOculto(true));
    zona.append(ocultar);
  }
  elementos.perfil.querySelector("#boton-mostrar-comercio")?.addEventListener("click", () => cambiarOculto(false));
}

async function cambiarOculto(ocultar) {
  if (ocultar) {
    const aceptado = await confirmar({
      titulo: `Ocultar ${estado.comercio.nombre}`,
      texto: "Sus precios dejan de aparecer en tus comparaciones, en el inicio y en los resultados. Vas a ver un aviso cuando falte en una comparación. Podés volver a mostrarlo desde Configuración.",
      textoAceptar: "Ocultar"
    });
    if (!aceptado) return;
  }
  try {
    if (ocultar) await ocultarComercio(estado.cuenta.uid, estado.comercio.id);
    else await mostrarComercio(estado.cuenta.uid, estado.comercio.id);
    estado.ocultoPorMi = ocultar;
    renderizarPerfil(estado.comercio, estado.imagenes);
    mostrarAviso(ocultar ? `Ocultaste ${estado.comercio.nombre} de tus comparaciones.` : `${estado.comercio.nombre} vuelve a aparecer en tus comparaciones.`);
  } catch (error) {
    mostrarAviso(manejarError(error, "Ocultar comercio"), "error");
  }
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
  const motivo = await confirmar({
    titulo: "Eliminar producto",
    texto: `«${producto.nombre}» deja de publicarse en ${estado.comercio.nombre}. La próxima vez que el comercio abra SENDA, va a ver un aviso de que SENDA eliminó el producto.`,
    textoAceptar: "Eliminar",
    peligro: true,
    motivo: { etiqueta: "Motivo de la eliminación", obligatorio: true }
  });
  if (motivo === null) return;

  boton.disabled = true;
  try {
    await eliminarPublicacionPorAdmin(precio, producto);
    await registrarAccion(estado.actor, {
      accion: "Producto eliminado",
      objetivoTipo: "producto",
      objetivoId: producto.id,
      objetivoNombre: `${producto.nombre} (${estado.comercio.nombre})`,
      motivo,
      origen: ORIGENES.PERFIL
    }).catch((error) => manejarError(error, "Registro de la eliminación en el historial"));
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
      <p><strong>${estado.esAdmin ? "Vista de administración" : `Vista de empleado (${escaparHTML(estado.actor.nombre)})`}.</strong> Estado de la cuenta: <strong>${escaparHTML(TEXTO_ESTADO[rol] ?? "Sin estado")}</strong>.</p>
      <p>${
        estado.esAdmin
          ? "Los datos del comercio no se pueden editar desde acá. Si un producto no es apto para la venta, se puede eliminar y el comercio recibe un aviso."
          : "Los datos del comercio no se pueden editar desde acá. Solo ves los botones de las tareas que el administrador te habilitó."
      }</p>
    </div>
    <div class="aviso-admin__acciones"></div>`;
  const acciones = elementos.avisoAdmin.querySelector(".aviso-admin__acciones");
  for (const accion of accionesPermitidas(rol, estado.actor)) {
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
      destino,
      actor: estado.actor,
      origen: ORIGENES.PERFIL
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
    const [comercio, usuario, precios, productos, imagenes, actor, revisiones, cuenta] = await Promise.all([
      obtenerComercio(comercioId),
      obtenerUsuario(comercioId),
      listarPreciosPorComercio(comercioId),
      listarProductos(),
      // Si la foto o el fondo fallan, el perfil se muestra igual, sin ellos.
      obtenerImagenesComercio(comercioId).catch((error) => {
        manejarError(error, "Foto y fondo del comercio");
        return { foto: null, fondo: null };
      }),
      actorDelEquipo(),
      mapaDeRevisiones().catch(() => new Map()),
      obtenerCuentaActual()
    ]);
    estado.revisiones = revisiones;
    estado.cuenta = cuenta;
    if (cuenta?.rol === ROLES.CLIENTE) {
      estado.ocultoPorMi = (await obtenerOcultos(cuenta.uid).catch(() => ({ comercios: [] }))).comercios.includes(comercioId);
    }
    estado.actor = actor;
    estado.esAdmin = actor?.rol === ROLES.ADMIN;
    const esEquipo = Boolean(actor);

    // Los comercios pendientes o rechazados no tienen perfil público. El equipo de SENDA sí los ve.
    // Un comercio ocultado por SENDA tampoco se muestra al público.
    const ocultoPorSenda = estadoDe(revisiones, TIPOS_REPORTE.CUENTA, comercioId).oculto;
    if (!comercio || (!esEquipo && (!ROLES_COMERCIO_ACTIVO.includes(usuario?.rol) || ocultoPorSenda))) {
      mostrarVacio(elementos.perfil, "No encontramos este comercio", "Puede que ya no esté publicado en SENDA.");
      elementos.catalogo.hidden = true;
      return;
    }

    const productoPorId = new Map(productos.map((producto) => [producto.id, producto]));
    estado.items = precios
      .filter((precio) => productoPorId.has(precio.productoId))
      // Lo que ocultó el equipo solo lo sigue viendo el equipo.
      .filter(
        (precio) =>
          esEquipo ||
          (!estadoDe(revisiones, TIPOS_REPORTE.PRECIO, precio.id).oculto &&
            !estadoDe(revisiones, TIPOS_REPORTE.PRODUCTO, precio.productoId).oculto)
      )
      .map((precio) => ({ precio, producto: productoPorId.get(precio.productoId) }));

    comercio.validado = usuario?.rol === ROLES.COMERCIO;
    comercio.actualizadoHoy = precios.some((precio) => esDeHoy(precio.fechaActualizacion));
    estado.comercio = comercio;
    estado.imagenes = imagenes;
    if (esEquipo) mostrarAvisoAdmin(usuario?.rol);
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
