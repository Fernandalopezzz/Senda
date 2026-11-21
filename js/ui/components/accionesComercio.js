// Acciones del equipo de SENDA (administrador y empleados) sobre una cuenta de comercio.
// Las usan el panel de administración (gestion-comercio.html) y el perfil del comercio
// (perfil-comercio.html), así los textos y las confirmaciones son los mismos en los dos lugares.
//
//   Pendiente → Aceptar (validado) o Rechazar (bloqueado).
//   Validado  → Bloquear.
//   Bloqueado → Volver a habilitar o Eliminar la cuenta (solo el administrador).
//
// Cada acción queda en el historial de moderación con quién la hizo, el motivo y desde dónde.

import { ROLES } from "../../core/constants.js";
import { confirmar } from "../feedback.js";
import { cambiarRolCuenta, registrarAccion } from "../../services/moderacionService.js";
import { eliminarCuentaComercio } from "../../services/comerciosService.js";

// Acción especial que no es un rol: borra la cuenta.
export const ELIMINAR_CUENTA = "eliminar";

// Para cada estado: [{ icono, texto, destino }]. icono: "aceptar" (tilde) o "rechazar" (tachito).
export const ACCIONES_POR_ESTADO = {
  [ROLES.PENDIENTE]: [
    { icono: "aceptar", texto: "Aceptar", destino: ROLES.COMERCIO },
    { icono: "rechazar", texto: "Rechazar", destino: ROLES.RECHAZADO }
  ],
  [ROLES.COMERCIO]: [{ icono: "rechazar", texto: "Bloquear", destino: ROLES.RECHAZADO }],
  [ROLES.RECHAZADO]: [
    { icono: "aceptar", texto: "Volver a habilitar", destino: ROLES.COMERCIO },
    { icono: "rechazar", texto: "Eliminar cuenta", destino: ELIMINAR_CUENTA }
  ]
};

// true si la cuenta (actor) puede hacer la acción. El administrador puede todo.
// Un empleado necesita el permiso "validar" para aceptar o habilitar y "bloquear" para rechazar
// o bloquear. Eliminar cuentas es solo del administrador.
export function puedeHacer(actor, destino) {
  if (actor?.rol === ROLES.ADMIN) return true;
  const permisos = actor?.empleado?.activo ? actor.empleado.permisos ?? {} : {};
  if (destino === ROLES.COMERCIO) return permisos.validar === true;
  if (destino === ROLES.RECHAZADO) return permisos.bloquear === true;
  return false;
}

export function accionesPermitidas(rolActual, actor) {
  return (ACCIONES_POR_ESTADO[rolActual] ?? []).filter(({ destino }) => puedeHacer(actor, destino));
}

function nombreAccion(rolActual, destino) {
  if (destino === ELIMINAR_CUENTA) return "Cuenta eliminada";
  if (destino === ROLES.COMERCIO) return rolActual === ROLES.PENDIENTE ? "Comercio aceptado" : "Comercio habilitado";
  return rolActual === ROLES.PENDIENTE ? "Solicitud rechazada" : "Comercio bloqueado";
}

// Pide confirmación y el motivo. Devuelve el motivo escrito o null si se canceló.
// Aceptar no pide confirmación: es la acción que se espera de una solicitud correcta.
async function pedirMotivo(nombre, rolActual, destino) {
  if (destino === ELIMINAR_CUENTA) {
    return confirmar({
      titulo: "Eliminar cuenta",
      texto: `Se borran el perfil de ${nombre}, su correo guardado, todos sus precios y los productos que solo vendía ese comercio. Su correo y su teléfono quedan en la lista de bloqueo: si alguien se registra de nuevo con alguno de los dos, la cuenta queda bloqueada. El nombre del comercio sí se puede volver a usar. No se puede deshacer.`,
      textoAceptar: "Eliminar cuenta",
      peligro: true,
      motivo: { etiqueta: "Motivo de la eliminación", obligatorio: true }
    });
  }
  if (destino === ROLES.COMERCIO) {
    if (rolActual === ROLES.PENDIENTE) return "Datos del comercio revisados";
    return confirmar({
      titulo: "Volver a habilitar",
      texto: `${nombre} va a poder ingresar a su panel y sus productos vuelven a verse.`,
      textoAceptar: "Habilitar",
      motivo: { etiqueta: "Motivo", obligatorio: false }
    });
  }
  const esValidado = rolActual === ROLES.COMERCIO;
  return confirmar({
    titulo: esValidado ? "Bloquear comercio" : "Rechazar solicitud",
    texto: esValidado
      ? `${nombre} no va a poder ingresar a su panel y sus productos dejan de verse. Se puede volver a habilitar desde "Bloqueados".`
      : `${nombre} no va a poder ingresar a su panel ni publicar precios.`,
    textoAceptar: esValidado ? "Bloquear" : "Rechazar",
    peligro: true,
    motivo: { etiqueta: esValidado ? "Motivo del bloqueo" : "Motivo del rechazo", obligatorio: true }
  });
}

function textoResultado(nombre, rolActual, destino) {
  if (destino === ELIMINAR_CUENTA) return `Eliminaste la cuenta de ${nombre}.`;
  if (destino === ROLES.COMERCIO) {
    return rolActual === ROLES.PENDIENTE ? `Aceptaste a ${nombre}.` : `Volviste a habilitar a ${nombre}.`;
  }
  return rolActual === ROLES.PENDIENTE ? `Rechazaste a ${nombre}.` : `Bloqueaste a ${nombre}.`;
}

// Confirma, ejecuta la acción y la registra. Devuelve el texto del resultado, o null si se canceló.
// actor: { uid, nombre, correo, rol, empleado } (ver obtenerActor). origen: un valor de ORIGENES.
export async function aplicarAccionComercio({ comercioId, nombre, rolActual, destino, actor, origen }) {
  if (!puedeHacer(actor, destino)) return null;
  const motivo = await pedirMotivo(nombre, rolActual, destino);
  if (motivo === null || motivo === false) return null;
  const registro = {
    accion: nombreAccion(rolActual, destino),
    objetivoTipo: "comercio",
    objetivoId: comercioId,
    objetivoNombre: nombre,
    motivo: motivo || "Sin motivo escrito",
    origen
  };
  if (destino === ELIMINAR_CUENTA) {
    await eliminarCuentaComercio(comercioId, motivo);
    await registrarAccion(actor, registro);
  } else {
    await cambiarRolCuenta(comercioId, destino, actor, registro);
  }
  return textoResultado(nombre, rolActual, destino);
}
