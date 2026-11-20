// Perfil público de una cuenta personal: usuario.html?id=<uid>.
// Lo ve cualquiera, con o sin sesión, al tocar el nombre de usuario de un comentario.
// Solo muestra el nombre de usuario, la foto y los comentarios publicados, con el producto
// donde se publicó cada uno. No muestra el nombre real, el correo ni los favoritos.

import { manejarError } from "../core/errores.js";
import { verificarConfiguracion, obtenerUsuarioActual } from "../services/authService.js";
import { obtenerCliente, listarComentariosDeCliente } from "../services/clientesService.js";
import { cargarCatalogo } from "../services/preciosService.js";
import { mostrarCargando, mostrarError, mostrarVacio } from "../ui/feedback.js";
import { crearTarjetaComentario, htmlFotoCliente } from "../ui/components/tarjetaComentario.js";
import { prepararBarraPublica } from "../guards/sessionGuard.js";

const $ = (id) => document.getElementById(id);

const elementos = {
  barra: $("barra-publica"),
  carga: $("carga-perfil-publico"),
  ficha: $("ficha-publica"),
  foto: $("foto-publica"),
  usuario: $("usuario-publico"),
  resumen: $("resumen-publico"),
  avisoPropio: $("aviso-propio"),
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
    const [cliente, comentarios, catalogo, sesion] = await Promise.all([
      obtenerCliente(uid),
      listarComentariosDeCliente(uid),
      cargarCatalogo(),
      obtenerUsuarioActual()
    ]);
    if (!cliente) {
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

    if (comentarios.length === 0) {
      mostrarVacio(elementos.lista, "Todavía no publicó comentarios");
      return;
    }
    elementos.lista.replaceChildren(
      ...comentarios.map((comentario) =>
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

prepararBarraPublica(elementos.barra);
cargar();
