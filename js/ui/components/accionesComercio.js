// Acciones del administrador sobre una cuenta de comercio. Las usan el panel de administración
// (gestion-comercio.html) y el perfil del comercio visto por el administrador (perfil-comercio.html),
// así los textos y las confirmaciones son los mismos en los dos lugares.
//
//   Pendiente → Aceptar (validado) o Rechazar (bloqueado).
//   Validado  → Bloquear.
//   Bloqueado → Volver a habilitar o Eliminar la cuenta.

import { ROLES } from "../../core/constants.js";
import { confirmar } from "../feedback.js";
import { actualizarRol } from "../../services/usuariosService.js";
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

// Pide confirmación cuando la acción quita permisos o borra datos. Devuelve true si se puede seguir.
async function confirmarAccion(nombre, rolActual, destino) {
  if (destino === ELIMINAR_CUENTA) {
    return confirmar({
      titulo: "Eliminar cuenta",
      texto: `Se borran el perfil de ${nombre}, su correo guardado, todos sus precios y los productos que solo vendía ese comercio. No se puede deshacer.`,
      textoAceptar: "Eliminar cuenta",
      peligro: true
    });
  }
  if (destino !== ROLES.RECHAZADO) return true;
  const esValidado = rolActual === ROLES.COMERCIO;
  return confirmar({
    titulo: esValidado ? "Bloquear comercio" : "Rechazar solicitud",
    texto: esValidado
      ? `${nombre} no va a poder ingresar a su panel y sus productos dejan de verse. Se puede volver a habilitar o eliminar desde "Bloqueados".`
      : `${nombre} no va a poder ingresar a su panel ni publicar precios.`,
    textoAceptar: esValidado ? "Bloquear" : "Rechazar",
    peligro: true
  });
}

function textoResultado(nombre, rolActual, destino) {
  if (destino === ELIMINAR_CUENTA) return `Eliminaste la cuenta de ${nombre}.`;
  if (destino === ROLES.COMERCIO) {
    return rolActual === ROLES.PENDIENTE ? `Aceptaste a ${nombre}.` : `Volviste a habilitar a ${nombre}.`;
  }
  return rolActual === ROLES.PENDIENTE ? `Rechazaste a ${nombre}.` : `Bloqueaste a ${nombre}.`;
}

// Confirma y ejecuta la acción. Devuelve el texto del resultado, o null si se canceló.
export async function aplicarAccionComercio({ comercioId, nombre, rolActual, destino }) {
  if (!(await confirmarAccion(nombre, rolActual, destino))) return null;
  if (destino === ELIMINAR_CUENTA) await eliminarCuentaComercio(comercioId);
  else await actualizarRol(comercioId, destino);
  return textoResultado(nombre, rolActual, destino);
}
