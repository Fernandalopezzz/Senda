// Opiniones de clientes en el detalle de un producto: "Me gusta", "No me gusta" y comentarios.
// Las reacciones se muestran junto al producto. Los comentarios, al presionar "Ver comentarios".
// El nombre de usuario de cada autor lleva a su perfil público (usuario.html).
//
// Por qué existen en un comparador de precios:
//   Los precios los carga cada comercio y pueden quedar viejos. El cliente que fue al local es quien
//   primero se entera de que una oferta terminó o de que no había stock. Un comentario como
//   "En Austral ya no está a ese precio" le ahorra el viaje al siguiente cliente y lo lleva a la
//   opción que sí conviene. Por eso cada comentario puede indicar de qué comercio habla.
//
// Quién puede opinar:
//   Solo las cuentas personales (rol "cliente"). Los comercios no opinan, para que nadie se ponga
//   buenas opiniones a sí mismo ni malas a la competencia. Los visitantes ven todo, pero para opinar
//   necesitan una cuenta, así cada opinión tiene un autor y se puede moderar.
//   El autor puede borrar sus comentarios y el administrador puede borrar los que no cumplan las normas.
//
// Moderación:
//   Cada comentario ajeno tiene el botón "Reportar". Con 3 reportes muestra la etiqueta "En revisión".
//   Lo que el equipo ocultó no se muestra, y tampoco los comentarios de cuentas bloqueadas por SENDA
//   o por la propia persona (ver bloqueosService.js).

import { ROLES, RUTAS, LIMITES, REACCIONES, TIPOS_REPORTE } from "../../core/constants.js";
import { validarComentario } from "../../core/validators.js";
import { manejarError } from "../../core/errores.js";
import { escaparHTML, iniciales, textoFecha, mostrarAviso, confirmar, mostrarCargando } from "../feedback.js";
import { obtenerCuentaActual } from "../../guards/sessionGuard.js";
import { obtenerClientes } from "../../services/clientesService.js";
import {
  obtenerReacciones,
  reaccionar,
  listarComentarios,
  publicarComentario,
  eliminarComentario
} from "../../services/opinionesService.js";
import { mapaDeRevisiones, estadoDe } from "../../services/reportesService.js";
import { obtenerOcultos } from "../../services/bloqueosService.js";
import { crearBotonReportar } from "./reportar.js";

const ICONOS = {
  [REACCIONES.ME_GUSTA]:
    '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 11v9H4v-9h3Zm0 0 4-7a2 2 0 0 1 3 2l-1 4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/></svg>',
  [REACCIONES.NO_ME_GUSTA]:
    '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M17 13V4h3v9h-3Zm0 0-4 7a2 2 0 0 1-3-2l1-4H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17"/></svg>',
  borrar:
    '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'
};

const ETIQUETAS = {
  [REACCIONES.ME_GUSTA]: "Me gusta",
  [REACCIONES.NO_ME_GUSTA]: "No me gusta"
};

// elementos: { reacciones, zonaComentar, lista, cantidad }
// producto: { id, nombre }. comercios: comercios que venden el producto (para elegir de cuál habla).
export async function montarOpiniones(elementos, { producto, comercios }) {
  const estado = {
    cuenta: await obtenerCuentaActual(),
    reacciones: null,
    comentarios: [],
    autores: new Map(),
    revisiones: new Map(),
    // Cuentas personales que la persona bloqueó: sus comentarios no se le muestran.
    bloqueadas: [],
    comercioPorId: new Map(comercios.map((c) => [c.id, c]))
  };
  const esCliente = estado.cuenta?.rol === ROLES.CLIENTE;

  // ---------- Me gusta / No me gusta ----------

  function renderizarReacciones() {
    const { propia } = estado.reacciones;
    elementos.reacciones.replaceChildren(
      ...[REACCIONES.ME_GUSTA, REACCIONES.NO_ME_GUSTA].map((valor) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = `reaccion reaccion--${valor}`;
        boton.setAttribute("aria-pressed", String(propia === valor));
        boton.title = ETIQUETAS[valor];
        boton.innerHTML = `${ICONOS[valor]}<span class="reaccion__texto">${ETIQUETAS[valor]}</span><span class="reaccion__cantidad">${estado.reacciones[valor]}</span>`;
        boton.addEventListener("click", () => alReaccionar(valor, boton));
        return boton;
      })
    );
  }

  async function alReaccionar(valor, boton) {
    if (!esCliente) {
      mostrarAviso(avisoSinCuenta(), "error");
      return;
    }
    boton.disabled = true;
    try {
      const anterior = estado.reacciones.propia;
      const nueva = await reaccionar(producto.id, estado.cuenta.uid, valor, anterior);
      if (anterior) estado.reacciones[anterior] -= 1;
      if (nueva) estado.reacciones[nueva] += 1;
      estado.reacciones.propia = nueva;
      renderizarReacciones();
    } catch (error) {
      boton.disabled = false;
      mostrarAviso(manejarError(error, "Reacción a un producto"), "error");
    }
  }

  function avisoSinCuenta() {
    if (!estado.cuenta) return "Para opinar, iniciá sesión con una cuenta personal.";
    return "Las opiniones son de las cuentas personales de los clientes.";
  }

  // ---------- Formulario para comentar ----------

  function renderizarZonaComentar() {
    if (!esCliente) {
      const nota = document.createElement("p");
      nota.className = "opiniones__nota";
      nota.innerHTML = estado.cuenta
        ? "Los comentarios los escriben los clientes con su cuenta personal. Los comercios y la administración solo los leen."
        : `¿Fuiste al comercio y el precio no era el mismo? <a href="${RUTAS.LOGIN}">Iniciá sesión</a> o <a href="${RUTAS.CREAR_CUENTA}">creá una cuenta personal</a> para avisarle a los demás clientes.`;
      elementos.zonaComentar.replaceChildren(nota);
      return;
    }

    const formulario = document.createElement("form");
    formulario.className = "comentar";
    formulario.noValidate = true;
    formulario.innerHTML = `
      <div class="campo">
        <label class="campo__etiqueta" for="comentario-comercio">¿Sobre qué comercio?</label>
        <select class="campo__control" id="comentario-comercio">
          <option value="">Comentario general del producto</option>
          ${comercios.map((c) => `<option value="${escaparHTML(c.id)}">${escaparHTML(c.nombre)}</option>`).join("")}
        </select>
      </div>
      <div class="campo">
        <label class="campo__etiqueta" for="comentario-texto">Tu comentario</label>
        <textarea class="campo__control" id="comentario-texto" rows="3" maxlength="${LIMITES.LARGO_COMENTARIO}"
          placeholder="Por ejemplo: fui hoy y la oferta ya no estaba, ahora sale más caro."></textarea>
        <p class="campo__ayuda"><span id="comentario-contador">0</span>/${LIMITES.LARGO_COMENTARIO}. Se publica con tu nombre de usuario.</p>
        <p class="campo__error" aria-live="polite"></p>
      </div>
      <button class="btn btn--primario btn--chico" type="submit">Publicar comentario</button>`;

    const texto = formulario.querySelector("#comentario-texto");
    const contador = formulario.querySelector("#comentario-contador");
    const error = formulario.querySelector(".campo__error");
    const boton = formulario.querySelector("button[type=submit]");
    texto.addEventListener("input", () => {
      contador.textContent = texto.value.length;
      if (error.textContent) error.textContent = validarComentario(texto.value);
    });

    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const mensaje = validarComentario(texto.value);
      error.textContent = mensaje;
      texto.setAttribute("aria-invalid", String(Boolean(mensaje)));
      if (mensaje) return;

      boton.disabled = true;
      try {
        const comercioId = formulario.querySelector("#comentario-comercio").value;
        const { id, enRevision } = await publicarComentario({
          productoId: producto.id,
          comercioId,
          uid: estado.cuenta.uid,
          texto: texto.value,
          productoNombre: producto.nombre
        });
        if (enRevision) {
          // Tiene palabras no permitidas: no se muestra hasta que el equipo lo revise.
          texto.value = "";
          contador.textContent = "0";
          mostrarAviso("Tu comentario quedó oculto y en revisión porque tiene palabras no permitidas. El equipo de SENDA lo va a revisar.", "error");
          return;
        }
        estado.comentarios.unshift({ id, productoId: producto.id, comercioId, clienteId: estado.cuenta.uid, texto: texto.value.trim(), fecha: null });
        if (!estado.autores.has(estado.cuenta.uid)) {
          estado.autores = new Map([...estado.autores, ...(await obtenerClientes([estado.cuenta.uid]))]);
        }
        texto.value = "";
        formulario.querySelector("#comentario-comercio").value = "";
        contador.textContent = "0";
        renderizarComentarios();
        mostrarAviso("Publicaste tu comentario.");
      } catch (e) {
        mostrarAviso(manejarError(e, "Publicación de comentario"), "error");
      } finally {
        boton.disabled = false;
      }
    });

    elementos.zonaComentar.replaceChildren(formulario);
  }

  // ---------- Lista de comentarios ----------

  function puedeBorrar(comentario) {
    if (!estado.cuenta) return false;
    return estado.cuenta.rol === ROLES.ADMIN || comentario.clienteId === estado.cuenta.uid;
  }

  // Comentarios que se muestran: sin los ocultados por SENDA, sin los de cuentas ocultadas o
  // bloqueadas por SENDA y sin los de cuentas que la persona bloqueó.
  function comentariosVisibles() {
    return estado.comentarios.filter(
      (c) =>
        !estadoDe(estado.revisiones, TIPOS_REPORTE.COMENTARIO, c.id).oculto &&
        !estadoDe(estado.revisiones, TIPOS_REPORTE.CUENTA, c.clienteId).oculto &&
        !estado.bloqueadas.includes(c.clienteId)
    );
  }

  function renderizarComentarios() {
    const visibles = comentariosVisibles();
    const deBloqueadas = estado.comentarios.filter((c) => estado.bloqueadas.includes(c.clienteId)).length;
    const cantidad = visibles.length;
    elementos.cantidad.textContent = `(${cantidad})`;
    const notaBloqueadas = deBloqueadas
      ? `<li class="comentario comentario--vacio">No se muestran ${deBloqueadas === 1 ? "1 comentario" : `${deBloqueadas} comentarios`} de cuentas que bloqueaste. Podés desbloquearlas desde Configuración.</li>`
      : "";
    if (cantidad === 0) {
      elementos.lista.innerHTML = `<li class="comentario comentario--vacio">Todavía no hay comentarios sobre este producto.</li>${notaBloqueadas}`;
      return;
    }
    elementos.lista.replaceChildren(...visibles.map(crearComentario));
    if (notaBloqueadas) elementos.lista.insertAdjacentHTML("beforeend", notaBloqueadas);
  }

  function crearComentario(comentario) {
    const autor = estado.autores.get(comentario.clienteId);
    const comercio = estado.comercioPorId.get(comentario.comercioId);
    const usuario = autor?.usuario ? `@${autor.usuario}` : "Cuenta eliminada";
    const rutaAutor = `${RUTAS.PERFIL_PUBLICO}?id=${encodeURIComponent(comentario.clienteId)}`;
    const foto = autor?.foto
      ? `<img class="comentario__foto" src="${escaparHTML(autor.foto)}" alt="">`
      : `<span class="avatar comentario__foto" aria-hidden="true">${escaparHTML(iniciales(autor?.usuario || "?"))}</span>`;

    const item = document.createElement("li");
    item.className = "comentario";
    item.innerHTML = `
      ${autor ? `<a class="comentario__enlace-foto" href="${rutaAutor}" tabindex="-1" aria-hidden="true">${foto}</a>` : foto}
      <div class="comentario__cuerpo">
        <p class="comentario__cabecera">
          ${autor ? `<a class="comentario__autor" href="${rutaAutor}" title="Ver el perfil de ${escaparHTML(usuario)}">${escaparHTML(usuario)}</a>` : `<strong>${escaparHTML(usuario)}</strong>`}
          <span class="comentario__fecha">${escaparHTML(textoFecha(comentario.fecha))}</span>
          ${estadoDe(estado.revisiones, TIPOS_REPORTE.COMENTARIO, comentario.id).enRevision ? '<span class="insignia-revision" title="Recibió varios reportes y el equipo de SENDA lo está revisando">En revisión</span>' : ""}
        </p>
        ${comercio ? `<p class="comentario__comercio">Sobre ${escaparHTML(comercio.nombre)}</p>` : ""}
        <p class="comentario__texto">${escaparHTML(comentario.texto)}</p>
      </div>`;

    if (puedeBorrar(comentario)) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "boton-icono boton-icono--rechazar comentario__borrar";
      const propio = comentario.clienteId === estado.cuenta.uid;
      boton.title = propio ? "Borrar mi comentario" : "Borrar comentario (administración)";
      boton.setAttribute("aria-label", boton.title);
      boton.innerHTML = ICONOS.borrar;
      boton.addEventListener("click", () => borrar(comentario, propio));
      item.append(boton);
    }
    // Reportar: en los comentarios de otras personas.
    if (comentario.clienteId !== estado.cuenta?.uid && estado.cuenta?.rol !== ROLES.ADMIN) {
      item.append(
        crearBotonReportar(
          {
            tipo: TIPOS_REPORTE.COMENTARIO,
            objetivoId: comentario.id,
            objetivoNombre: `${usuario}: ${comentario.texto.length > 70 ? `${comentario.texto.slice(0, 67)}...` : comentario.texto}`,
            duenoId: comentario.clienteId,
            comercioId: comentario.comercioId || ""
          },
          { clase: "comentario__reportar" }
        )
      );
    }
    return item;
  }

  async function borrar(comentario, propio) {
    const aceptado = await confirmar({
      titulo: propio ? "Borrar tu comentario" : "Borrar comentario",
      texto: propio
        ? "El comentario deja de verse para todos los clientes."
        : "El comentario se borra porque no cumple las normas de SENDA.",
      textoAceptar: "Borrar",
      peligro: true
    });
    if (!aceptado) return;
    try {
      await eliminarComentario(comentario.id);
      estado.comentarios = estado.comentarios.filter((c) => c !== comentario);
      renderizarComentarios();
      mostrarAviso("Se borró el comentario.");
    } catch (error) {
      mostrarAviso(manejarError(error, "Borrado de comentario"), "error");
    }
  }

  // ---------- Carga inicial ----------

  mostrarCargando(elementos.lista, "Cargando opiniones...");
  try {
    const uid = esCliente ? estado.cuenta.uid : null;
    const [reacciones, comentarios, revisiones, ocultos] = await Promise.all([
      obtenerReacciones(producto.id, uid),
      listarComentarios(producto.id),
      mapaDeRevisiones(),
      esCliente ? obtenerOcultos(uid).catch(() => ({ cuentas: [] })) : { cuentas: [] }
    ]);
    estado.reacciones = reacciones;
    estado.comentarios = comentarios;
    estado.revisiones = revisiones;
    estado.bloqueadas = ocultos.cuentas;
    estado.autores = await obtenerClientes(comentarios.map((c) => c.clienteId));
    renderizarReacciones();
    renderizarZonaComentar();
    renderizarComentarios();
    window.dispatchEvent(new CustomEvent("senda:opiniones-listas"));
  } catch (error) {
    elementos.lista.innerHTML = `<li class="comentario comentario--vacio">${escaparHTML(manejarError(error, "Carga de opiniones"))}</li>`;
  }
}
