// Secciones del panel que usa el equipo de SENDA, además de la validación de comercios:
//   Empleados (solo administrador): alta, permisos y deshabilitar cuentas.
//   Historial (solo administrador): qué hizo cada persona del equipo, cuándo, por qué y desde dónde.
//   Cambiar contraseña (solo empleados).
// Las usa gestionComercio.page.js.

import { PERMISOS_EMPLEADO } from "../../core/constants.js";
import { manejarError } from "../../core/errores.js";
import {
  validarEmail,
  validarPassword,
  validarPasswordNueva,
  validarTextoObligatorio
} from "../../core/validators.js";
import {
  escaparHTML,
  mostrarCargando,
  mostrarError,
  mostrarVacio,
  mostrarAviso,
  aplicarValidaciones,
  marcarErrorCampo,
  limpiarErrores,
  botonCargando,
  abrirModal,
  cerrarModal,
  prepararModal,
  confirmar
} from "../feedback.js";
import { listarEmpleados, crearEmpleado, actualizarPermisos, cambiarEstadoEmpleado } from "../../services/empleadosService.js";
import { listarHistorial } from "../../services/moderacionService.js";
import { reautenticar, cambiarContrasena } from "../../services/authService.js";

const $ = (id) => document.getElementById(id);

const ICONO_DESHABILITAR =
  '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function fechaYHora(fecha) {
  const valor = fecha?.toDate?.();
  if (!valor) return "Recién";
  return valor.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ======================================================
// Empleados
// ======================================================

const empleados = {
  lista: $("lista-empleados"),
  resumen: $("resumen-empleados"),
  modal: $("modal-empleado"),
  form: $("form-empleado"),
  nombre: $("empleado-nombre"),
  correo: $("empleado-correo"),
  password: $("empleado-password"),
  permisosAlta: $("permisos-alta"),
  botonCrear: $("boton-crear-empleado"),
  items: [],
  actor: null
};

function casillasPermisos(prefijo, permisos = {}, deshabilitado = false) {
  return PERMISOS_EMPLEADO.map(
    ({ clave, nombre, detalle }) => `
      <label class="opcion equipo__permiso" title="${escaparHTML(detalle)}">
        <input type="checkbox" name="${prefijo}" value="${clave}" ${permisos[clave] ? "checked" : ""} ${deshabilitado ? "disabled" : ""}>
        <span>${escaparHTML(nombre)}</span>
      </label>`
  ).join("");
}

function leerCasillas(contenedor) {
  return Object.fromEntries([...contenedor.querySelectorAll("input[type=checkbox]")].map((c) => [c.value, c.checked]));
}

export async function cargarEmpleados() {
  mostrarCargando(empleados.lista, "Cargando empleados...");
  try {
    empleados.items = await listarEmpleados();
    renderizarEmpleados();
  } catch (error) {
    mostrarError(empleados.lista, manejarError(error, "Carga de empleados"), cargarEmpleados);
  }
}

function renderizarEmpleados() {
  const activos = empleados.items.filter((e) => e.activo).length;
  const inactivos = empleados.items.length - activos;
  empleados.resumen.textContent =
    `${activos} ${activos === 1 ? "empleado habilitado" : "empleados habilitados"}` +
    (inactivos ? ` · ${inactivos} ${inactivos === 1 ? "deshabilitado" : "deshabilitados"}` : "");
  if (empleados.items.length === 0) {
    mostrarVacio(empleados.lista, "Todavía no hay empleados. Agregá el primero con el botón \"Agregar empleado\".");
    return;
  }
  const tabla = document.createElement("table");
  tabla.className = "tabla-solicitudes tabla-empleados";
  tabla.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Nombre</th>
        <th scope="col">Correo</th>
        <th scope="col">Permisos</th>
        <th scope="col">Alta</th>
        <th scope="col"><span class="solo-lectores">Acciones</span></th>
      </tr>
    </thead>
    <tbody></tbody>`;
  tabla.tBodies[0].append(...empleados.items.map(crearFilaEmpleado));
  empleados.lista.replaceChildren(tabla);
}

function crearFilaEmpleado(empleado) {
  const fila = document.createElement("tr");
  if (!empleado.activo) fila.className = "tabla-empleados__fila--deshabilitada";
  fila.innerHTML = `
    <th scope="row">${escaparHTML(empleado.nombre)}${empleado.activo ? "" : ' <span class="insignia-deshabilitado">Deshabilitado</span>'}</th>
    <td><a href="mailto:${escaparHTML(empleado.correo)}">${escaparHTML(empleado.correo)}</a></td>
    <td><div class="equipo__permisos">${casillasPermisos(`permisos-${empleado.id}`, empleado.permisos, !empleado.activo)}</div></td>
    <td>${escaparHTML(fechaYHora(empleado.fechaAlta).split(",")[0])}</td>
    <td class="tabla-solicitudes__acciones"></td>`;

  // Cada casilla guarda el cambio en el momento.
  fila.querySelectorAll("input[type=checkbox]").forEach((casilla) =>
    casilla.addEventListener("change", async () => {
      const permisos = leerCasillas(fila);
      fila.querySelectorAll("input").forEach((c) => (c.disabled = true));
      try {
        empleado.permisos = await actualizarPermisos(empleado, permisos, empleados.actor);
        mostrarAviso(`Guardaste los permisos de ${empleado.nombre}.`);
      } catch (error) {
        casilla.checked = !casilla.checked;
        mostrarAviso(manejarError(error, "Permisos del empleado"), "error");
      } finally {
        fila.querySelectorAll("input").forEach((c) => (c.disabled = !empleado.activo));
      }
    })
  );

  const acciones = fila.querySelector(".tabla-solicitudes__acciones");
  const boton = document.createElement("button");
  boton.type = "button";
  if (empleado.activo) {
    boton.className = "boton-icono boton-icono--rechazar";
    boton.innerHTML = ICONO_DESHABILITAR;
    boton.title = `Deshabilitar a ${empleado.nombre}`;
    boton.setAttribute("aria-label", boton.title);
  } else {
    boton.className = "btn btn--linea btn--chico";
    boton.textContent = "Volver a habilitar";
  }
  boton.addEventListener("click", () => cambiarEstado(empleado, !empleado.activo));
  acciones.append(boton);
  return fila;
}

async function cambiarEstado(empleado, activo) {
  const aceptado = await confirmar(
    activo
      ? {
          titulo: `¿Deseas volver a habilitar a ${empleado.nombre}?`,
          texto: "La cuenta vuelve a entrar al panel sin permisos. Después marcá las tareas que puede hacer.",
          textoAceptar: "Habilitar"
        }
      : {
          titulo: "¿Deseas deshabilitar este usuario?",
          texto: `${empleado.nombre} (${empleado.correo}) pierde todos sus permisos y no puede usar el panel. Al ingresar va a ver un aviso para comunicarse con soporte técnico. Sus acciones siguen en el historial.`,
          textoAceptar: "Deshabilitar",
          peligro: true,
          grande: true
        }
  );
  if (!aceptado) return;
  try {
    await cambiarEstadoEmpleado(empleado, activo, empleados.actor);
    mostrarAviso(activo ? `Volviste a habilitar a ${empleado.nombre}.` : `Deshabilitaste a ${empleado.nombre}.`);
    await cargarEmpleados();
  } catch (error) {
    mostrarAviso(manejarError(error, "Estado del empleado"), "error");
  }
}

function abrirAlta() {
  empleados.form.reset();
  limpiarErrores(empleados.form);
  // Por defecto, las tareas que pidió el equipo para un empleado nuevo: ver pendientes, validar y bloquear.
  empleados.permisosAlta.innerHTML = casillasPermisos("permisos-alta", { verPendientes: true, validar: true, bloquear: true });
  abrirModal(empleados.modal);
  empleados.nombre.focus();
}

async function guardarAlta(evento) {
  evento.preventDefault();
  const valido = aplicarValidaciones([
    [empleados.nombre, validarTextoObligatorio(empleados.nombre.value, "el nombre", 60)],
    [empleados.correo, validarEmail(empleados.correo.value)],
    [empleados.password, validarPasswordNueva(empleados.password.value)]
  ]);
  if (!valido) return;
  botonCargando(empleados.botonCrear, true);
  try {
    const nuevo = await crearEmpleado(
      {
        nombre: empleados.nombre.value,
        correo: empleados.correo.value,
        password: empleados.password.value,
        permisos: leerCasillas(empleados.permisosAlta)
      },
      empleados.actor
    );
    cerrarModal(empleados.modal);
    mostrarAviso(`Creaste la cuenta de ${nuevo.nombre}. Ya puede ingresar con su correo.`);
    await cargarEmpleados();
  } catch (error) {
    marcarErrorCampo(empleados.correo, manejarError(error, "Alta de empleado"));
  } finally {
    botonCargando(empleados.botonCrear, false);
  }
}

export function prepararEmpleados(actor) {
  empleados.actor = actor;
  prepararModal(empleados.modal);
  $("boton-nuevo-empleado").addEventListener("click", abrirAlta);
  empleados.form.addEventListener("submit", guardarAlta);
}

// ======================================================
// Historial de moderación
// ======================================================

const historial = {
  lista: $("lista-historial"),
  resumen: $("resumen-historial"),
  filtro: $("filtro-historial"),
  items: []
};

export async function cargarHistorial() {
  mostrarCargando(historial.lista, "Cargando el historial...");
  try {
    historial.items = await listarHistorial();
    prepararFiltroHistorial();
    renderizarHistorial();
  } catch (error) {
    mostrarError(historial.lista, manejarError(error, "Carga del historial"), cargarHistorial);
  }
}

// Una opción por cada persona que aparece en el historial.
function prepararFiltroHistorial() {
  const elegido = historial.filtro.value;
  const personas = new Map(historial.items.map((a) => [a.actorId, `${a.actorNombre} (${a.actorCorreo})`]));
  historial.filtro.innerHTML =
    '<option value="">Todo el equipo</option>' +
    [...personas]
      .sort((a, b) => a[1].localeCompare(b[1], "es"))
      .map(([id, texto]) => `<option value="${escaparHTML(id)}">${escaparHTML(texto)}</option>`)
      .join("");
  historial.filtro.value = personas.has(elegido) ? elegido : "";
}

function renderizarHistorial() {
  const visibles = historial.filtro.value
    ? historial.items.filter((a) => a.actorId === historial.filtro.value)
    : historial.items;
  historial.resumen.textContent = `${visibles.length} ${visibles.length === 1 ? "acción registrada" : "acciones registradas"}, de la más nueva a la más vieja.`;
  if (visibles.length === 0) {
    mostrarVacio(historial.lista, "Todavía no hay acciones registradas.");
    return;
  }
  const tabla = document.createElement("table");
  tabla.className = "tabla-solicitudes tabla-historial";
  tabla.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Fecha y hora</th>
        <th scope="col">Quién</th>
        <th scope="col">Acción</th>
        <th scope="col">Sobre qué</th>
        <th scope="col">Motivo</th>
        <th scope="col">Desde dónde</th>
      </tr>
    </thead>
    <tbody>${visibles
      .map(
        (a) => `
      <tr>
        <td class="tabla-historial__fecha">${escaparHTML(fechaYHora(a.fecha))}</td>
        <th scope="row">${escaparHTML(a.actorNombre)}<span class="tabla-historial__correo">${escaparHTML(a.actorCorreo)}</span></th>
        <td><span class="insignia-accion">${escaparHTML(a.accion)}</span></td>
        <td>${escaparHTML(a.objetivoNombre)}<span class="tabla-historial__tipo">${escaparHTML(a.objetivoTipo)}</span></td>
        <td>${escaparHTML(a.motivo || "Sin motivo escrito")}</td>
        <td>${escaparHTML(a.origen)}</td>
      </tr>`
      )
      .join("")}</tbody>`;
  historial.lista.replaceChildren(tabla);
}

export function prepararHistorial() {
  historial.filtro.addEventListener("change", renderizarHistorial);
}

// ======================================================
// Cambiar contraseña (empleados)
// ======================================================

export function prepararCambioDeContrasena() {
  const modal = $("modal-contrasena");
  const form = $("form-contrasena");
  const actual = $("contrasena-actual");
  const nueva = $("contrasena-nueva");
  const boton = $("boton-guardar-contrasena");
  prepararModal(modal);
  $("boton-cambiar-contrasena").addEventListener("click", () => {
    form.reset();
    limpiarErrores(form);
    abrirModal(modal);
    actual.focus();
  });
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const valido = aplicarValidaciones([
      [actual, validarPassword(actual.value)],
      [nueva, validarPasswordNueva(nueva.value)]
    ]);
    if (!valido) return;
    botonCargando(boton, true);
    try {
      await reautenticar(actual.value);
      await cambiarContrasena(nueva.value);
      cerrarModal(modal);
      mostrarAviso("Cambiaste tu contraseña.");
    } catch (error) {
      marcarErrorCampo(actual, manejarError(error, "Cambio de contraseña del empleado"));
    } finally {
      botonCargando(boton, false);
    }
  });
}
