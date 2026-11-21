// Perfil público de una cuenta personal: usuario.html?id=<uid>.
// Lo ve cualquiera, con o sin sesión, al tocar el nombre de usuario de un comentario.
// Solo muestra el nombre de usuario, la foto y los comentarios publicados, con el producto
// donde se publicó cada uno. No muestra el nombre real, el correo ni los favoritos.
// Otras cuentas pueden reportarla, y una cuenta personal puede bloquearla: deja de ver sus comentarios.
// Si el equipo de SENDA la ocultó o la bloqueó, el perfil no se muestra.

import { manejarError } from "../core/errores.js";
import { ROLES, TIPOS_REPORTE } from "../core/constants.js";
import { mapaDeRevisiones, estadoDe } from "../services/reportesService.js";
import { obtenerOcultos, bloquearCuenta, desbloquearCuenta } from "../services/bloqueosService.js";
import { obtenerUsuario } from "../services/usuariosService.js";
import { crearBotonReportar } from "../ui/components/reportar.js";
import { verificarConfiguracion, obtenerUsuarioActual } from "../services/authService.js";
import { obtenerCliente, listarComentariosDeCliente } from "../services/clientesService.js";
import { cargarCatalogo } from "../services/preciosService.js";
import { mostrarCargando, mostrarError, mostrarVacio, mostrarAviso, confirmar } from "../ui/feedback.js";
import { crearTarjetaComentario, htmlFotoCliente } from "../ui/components/tarjetaComentario.js";
import { prepararBarraPublica, obtenerCuentaActual } from "../guards/sessionGuard.js";

const $ = (id) => document.getElementById(id);

const elementos = {
  barra: $("barra-publica"),
  carga: $("carga-perfil-publico"),
  ficha: $("ficha-publica"),
  foto: $("foto-publica"),
  usuario: $("usuario-publico"),
  resumen: $("resumen-publico"),
  avisoPropio: $("aviso-propio"),
  acciones: $("acciones-publicas"),
  avisoBloqueada: $("aviso-bloqueada"),
  seccion: $("seccion-comentarios-publicos"),
  lista: $("lista-comentarios-publicos")
};

async function cargar() {
  const uid = new URLSearchParams(window.location.search).get("id");
  if (!uid) {
    mostrarVacio(elementos.carga, "No se indicó qué perfil mostrar");
    return;
  }
  mostrarCargando(elementos.carga, "Cargando perfil...");
  try {
    verificarConfiguracion();
    const [cliente, comentarios, catalogo, sesion, revisiones, usuarioPerfil, cuenta] = await Promise.all([
      obtenerCliente(uid),
      listarComentariosDeCliente(uid),
      cargarCatalogo(),
      obtenerUsuarioActual(),
      mapaDeRevisiones().catch(() => new Map()),
      obtenerUsuario(uid),
      obtenerCuentaActual()
    ]);
    const ocultaPorSenda = estadoDe(revisiones, TIPOS_REPORTE.CUENTA, uid).oculto || usuarioPerfil?.rol === ROLES.BLOQUEADO;
    if (!cliente || ocultaPorSenda) {
      mostrarVacio(elementos.carga, "Este perfil no existe", "Puede que la cuenta se haya eliminado.");
      return;
    }

    elementos.carga.hidden = true;
    document.title = `@${cliente.usuario} · SENDA`;
    elementos.foto.innerHTML = htmlFotoCliente(cliente, "perfil-tarjeta__foto");
    elementos.usuario.textContent = `@${cliente.usuario}`;
    elementos.resumen.textContent =
      comentarios.length === 1 ? "1 comentario publicado" : `${comentarios.length} comentarios publicados`;
    elementos.avisoPropio.hidden = sesion?.uid !== uid;
    elementos.ficha.hidden = false;
    elementos.seccion.hidden = false;

    // Bloqueo propio: la persona no ve los comentarios de esta cuenta.
    const bloqueada =
      cuenta?.rol === ROLES.CLIENTE && cuenta.uid !== uid
        ? (await obtenerOcultos(cuenta.uid).catch(() => ({ cuentas: [] }))).cuentas.includes(uid)
        : false;
    prepararAcciones({ uid, cliente, cuenta, bloqueada });
    if (bloqueada) {
      elementos.seccion.hidden = true;
      return;
    }
    const visibles = comentarios.filter((c) => !estadoDe(revisiones, TIPOS_REPORTE.COMENTARIO, c.id).oculto);
    elementos.resumen.textContent = visibles.length === 1 ? "1 comentario publicado" : `${visibles.length} comentarios publicados`;
    if (estadoDe(revisiones, TIPOS_REPORTE.CUENTA, uid).enRevision) {
      elementos.usuario.insertAdjacentHTML("beforeend", ' <span class="insignia-revision">En revisión</span>');
    }

    if (visibles.length === 0) {
      mostrarVacio(elementos.lista, "Todavía no publicó comentarios");
      return;
    }
    elementos.lista.replaceChildren(
      ...visibles.map((comentario) =>
        crearTarjetaComentario({
          comentario,
          autor: cliente,
          producto: catalogo.productoPorId.get(comentario.productoId),
          comercio: catalogo.comercioPorId.get(comentario.comercioId)
        })
      )
    );
  } catch (error) {
    elementos.carga.hidden = false;
    mostrarError(elementos.carga, manejarError(error, "Carga del perfil público"), cargar);
  }
}

// Reportar (cuentas personales y comercios) y bloquear (solo cuentas personales).
function prepararAcciones({ uid, cliente, cuenta, bloqueada }) {
  elementos.acciones.replaceChildren();
  elementos.avisoBloqueada.hidden = !bloqueada;
  if (!cuenta || cuenta.uid === uid || ![ROLES.CLIENTE, ROLES.COMERCIO].includes(cuenta.rol)) {
    // Sin sesión también se muestra "Reportar": al tocarlo pide iniciar sesión.
    if (!cuenta) {
      elementos.acciones.append(
        crearBotonReportar({ tipo: TIPOS_REPORTE.CUENTA, objetivoId: uid, objetivoNombre: `@${cliente.usuario}`, duenoId: uid }, { texto: "Reportar" })
      );
    }
    return;
  }
  elementos.acciones.append(
    crearBotonReportar({ tipo: TIPOS_REPORTE.CUENTA, objetivoId: uid, objetivoNombre: `@${cliente.usuario}`, duenoId: uid }, { texto: "Reportar" })
  );
  if (cuenta.rol === ROLES.CLIENTE && !bloqueada) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn--linea btn--chico";
    boton.textContent = "Bloquear";
    boton.addEventListener("click", async () => {
      const aceptado = await confirmar({
        titulo: `Bloquear a @${cliente.usuario}`,
        texto: "No vas a ver sus comentarios en los productos. La otra cuenta no recibe ningún aviso. Podés desbloquearla desde Configuración.",
        textoAceptar: "Bloquear",
        peligro: true
      });
      if (!aceptado) return;
      try {
        await bloquearCuenta(cuenta.uid, uid);
        mostrarAviso(`Bloqueaste a @${cliente.usuario}.`);
        cargar();
      } catch (error) {
        mostrarAviso(manejarError(error, "Bloqueo de cuenta"), "error");
      }
    });
    elementos.acciones.append(boton);
  }
  $("boton-desbloquear").onclick = async () => {
    try {
      await desbloquearCuenta(cuenta.uid, uid);
      mostrarAviso(`Desbloqueaste a @${cliente.usuario}.`);
      cargar();
    } catch (error) {
      mostrarAviso(manejarError(error, "Desbloqueo de cuenta"), "error");
    }
  };
}

prepararBarraPublica(elementos.barra);
cargar();
