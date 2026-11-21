// Operaciones sobre la colección "usuarios".
// Cada documento usa como ID el uid de Firebase Authentication y guarda el rol de la cuenta.
// La lectura es pública porque el rol indica si un comercio está validado.

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  getFirestore,
  initializeFirestore,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { prepararImagen } from "./imagenesService.js";
import { db, firebaseConfig } from "../config/firebase.js";
import {
  COLECCIONES,
  ROLES,
  LOCALIDAD_PREDETERMINADA
} from "../core/constants.js";
import { ErrorSenda } from "../core/errores.js";

// Los datos de prueba están en js/core/datosPrueba.js, que no se sube al repositorio porque
// tiene contraseñas. Se cargan solo cuando el administrador presiona el botón.
let COMERCIOS_DE_PRUEBA = [];
let PRODUCTOS_DE_PRUEBA = [];
let CLIENTES_DE_PRUEBA = [];
let CLIENTES_DE_PRUEBA_ANTERIORES = [];

async function leerDatosDePrueba() {
  let datos;
  try {
    datos = await import("../core/datosPrueba.js");
  } catch {
    throw new ErrorSenda("senda/sin-datos-prueba");
  }
  ({ COMERCIOS_DE_PRUEBA, PRODUCTOS_DE_PRUEBA, CLIENTES_DE_PRUEBA, CLIENTES_DE_PRUEBA_ANTERIORES = [] } = datos);
}

export async function obtenerUsuario(uid) {
  const snapshot = await getDoc(doc(db, COLECCIONES.USUARIOS, uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listarUsuarios() {
  const snapshot = await getDocs(collection(db, COLECCIONES.USUARIOS));
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

export async function listarUsuariosPorRol(rol) {
  const consulta = query(collection(db, COLECCIONES.USUARIOS), where("rol", "==", rol));
  const snapshot = await getDocs(consulta);
  return snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

export function actualizarRol(uid, rol) {
  return updateDoc(doc(db, COLECCIONES.USUARIOS, uid), { rol });
}

// ======================================================
// Datos de prueba
// Crea los 3 comercios de COMERCIOS_DE_PRUEBA con sus cuentas, foto, fondo y 6 productos
// con imagen, y las 6 cuentas personales de CLIENTES_DE_PRUEBA con foto, favoritos y comentarios. Sigue el mismo camino que un comercio real: se registra como "pendiente",
// el administrador lo valida y recién entonces sube sus imágenes y publica sus productos.
// Usa una segunda conexión de Firebase para iniciar sesión como cada comercio sin cerrar
// la sesión del administrador. Así cada dato se guarda con los permisos de su dueño,
// igual que si el comercio lo cargara desde su panel. Si se ejecuta otra vez, actualiza
// los datos en lugar de duplicarlos.
// ======================================================

const NOMBRE_CONEXION_PRUEBA = "senda-datos-prueba";

function conexionDePrueba() {
  const app = getApps().find((a) => a.name === NOMBRE_CONEXION_PRUEBA) ?? initializeApp(firebaseConfig, NOMBRE_CONEXION_PRUEBA);
  let db;
  try {
    // Misma conexión por long polling que js/config/firebase.js.
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    db = getFirestore(app); // ya estaba inicializada (segunda carga en la misma página)
  }
  return { auth: getAuth(app), db };
}

// Lee una imagen de assets/ y la prepara igual que una imagen que sube un comercio.
async function imagenDePrueba(rutaLocal, tipo) {
  const respuesta = await fetch(rutaLocal);
  if (!respuesta.ok) throw new Error(`No se encontró la imagen ${rutaLocal}`);
  return prepararImagen(await respuesta.blob(), tipo);
}

// Sirve para comercios y para cuentas personales: crea la cuenta o, si ya existe, inicia sesión.
async function entrarComoComercio(auth, { email, password }) {
  try {
    return (await createUserWithEmailAndPassword(auth, email, password)).user;
  } catch (error) {
    if (error?.code !== "auth/email-already-in-use") throw error;
    return (await signInWithEmailAndPassword(auth, email, password)).user;
  }
}

// Paso 1 del registro: la cuenta queda "pendiente" con los datos del comercio.
async function registrarComercioDePrueba(conexion, comercio) {
  const usuario = await entrarComoComercio(conexion.auth, comercio);
  const perfil = await getDoc(doc(conexion.db, COLECCIONES.USUARIOS, usuario.uid));
  if (!perfil.exists()) {
    await setDoc(doc(conexion.db, COLECCIONES.USUARIOS, usuario.uid), { rol: ROLES.PENDIENTE });
  }
  const datos = {
    nombre: comercio.nombre,
    dueno: comercio.dueno,
    direccion: comercio.direccion,
    telefono: comercio.telefono,
    horario: comercio.horario,
    localidad: comercio.localidad || LOCALIDAD_PREDETERMINADA
  };
  const existente = await getDoc(doc(conexion.db, COLECCIONES.COMERCIOS, usuario.uid));
  // Un comercio pendiente puede crear su perfil. Si ya existe, lo actualiza después de la validación.
  if (!existente.exists()) await setDoc(doc(conexion.db, COLECCIONES.COMERCIOS, usuario.uid), datos);
  // Correo privado, para que el administrador lo vea en su panel.
  await setDoc(doc(conexion.db, COLECCIONES.COMERCIOS_PRIVADOS, usuario.uid), { correo: usuario.email });
  await signOut(conexion.auth);
  return usuario.uid;
}

// Paso 3: con la cuenta ya validada, el comercio sube foto, fondo y publica sus 6 productos.
async function publicarComercioDePrueba(conexion, comercio, productoIdPorNombre, alAvanzar) {
  const usuario = await entrarComoComercio(conexion.auth, comercio);
  await setDoc(
    doc(conexion.db, COLECCIONES.COMERCIOS, usuario.uid),
    { nombre: comercio.nombre, dueno: comercio.dueno, direccion: comercio.direccion, telefono: comercio.telefono, horario: comercio.horario, localidad: comercio.localidad || LOCALIDAD_PREDETERMINADA },
    { merge: true }
  );

  alAvanzar(`Subiendo la foto y el fondo de ${comercio.nombre}...`);
  await setDoc(
    doc(conexion.db, COLECCIONES.COMERCIOS, usuario.uid),
    {
      foto: await imagenDePrueba(`assets/img/comercios/${comercio.clave}-foto.jpg`, "foto"),
      fondo: await imagenDePrueba(`assets/img/comercios/${comercio.clave}-fondo.jpg`, "fondo")
    },
    { merge: true }
  );

  const preciosActuales = await getDocs(
    query(collection(conexion.db, COLECCIONES.PRECIOS), where("comercioId", "==", usuario.uid))
  );
  const precioIdPorProducto = new Map(preciosActuales.docs.map((d) => [d.data().productoId, d.id]));

  for (const producto of PRODUCTOS_DE_PRUEBA) {
    alAvanzar(`${comercio.nombre}: publicando ${producto.nombre}...`);
    let productoId = idDeProductoDePrueba(productoIdPorNombre, producto);
    const datosProducto = {
      nombre: producto.nombre,
      marca: producto.marca,
      descripcion: producto.descripcion,
      presentacion: producto.presentacion,
      etiquetas: producto.etiquetas
    };
    if (!productoId) {
      // El producto se crea una sola vez y los otros comercios le agregan su precio.
      productoId = doc(collection(conexion.db, COLECCIONES.PRODUCTOS)).id;
      const imagen = await imagenDePrueba(`assets/img/productos/${producto.clave}.jpg`, "producto");
      await setDoc(doc(conexion.db, COLECCIONES.PRODUCTOS, productoId), {
        ...datosProducto,
        imagen,
        // El primer comercio de prueba que publica el producto queda como su creador.
        creadorId: usuario.uid
      });
      productoIdPorNombre.set(producto.nombre, productoId);
    } else {
      // Producto ya cargado: su creador le actualiza los datos y la imagen.
      // Así los productos guardados con los nombres anteriores pasan a los nuevos sin duplicarse.
      const existente = await getDoc(doc(conexion.db, COLECCIONES.PRODUCTOS, productoId));
      if (existente.data()?.creadorId === usuario.uid) {
        await updateDoc(doc(conexion.db, COLECCIONES.PRODUCTOS, productoId), {
          ...datosProducto,
          imagen: await imagenDePrueba(`assets/img/productos/${producto.clave}.jpg`, "producto")
        });
      }
    }

    const [precioOriginal, porcentajeDescuento, disponible] = comercio.precios[producto.clave];
    const datosPrecio = {
      precioOriginal,
      porcentajeDescuento,
      precioFinal: Math.round(precioOriginal * (1 - porcentajeDescuento / 100) * 100) / 100,
      disponible,
      fechaActualizacion: serverTimestamp()
    };
    const precioId = precioIdPorProducto.get(productoId);
    if (precioId) {
      await updateDoc(doc(conexion.db, COLECCIONES.PRECIOS, precioId), datosPrecio);
    } else {
      await addDoc(collection(conexion.db, COLECCIONES.PRECIOS), { productoId, comercioId: usuario.uid, ...datosPrecio });
    }
  }
  await signOut(conexion.auth);
  return usuario.uid;
}

// Busca un producto de prueba por su nombre actual o por los anteriores.
function idDeProductoDePrueba(productoIdPorNombre, producto) {
  for (const nombre of [producto.nombre, ...(producto.nombresAnteriores ?? [])]) {
    if (productoIdPorNombre.has(nombre)) return productoIdPorNombre.get(nombre);
  }
  return null;
}

// Paso 4: cuentas personales. Cada una se registra sola, igual que desde registro-personal.html
// (no necesita validación), sube su foto, guarda favoritos, reacciona y comenta.
// Si la cuenta ya existe, actualiza la foto y no repite comentarios ni reacciones.
async function publicarClienteDePrueba(conexion, cliente, productoIdPorClave, comercioIdPorClave, alAvanzar) {
  alAvanzar(`Creando la cuenta personal de ${cliente.nombre}...`);
  const usuario = await entrarComoComercio(conexion.auth, cliente);
  const uid = usuario.uid;

  const perfil = await getDoc(doc(conexion.db, COLECCIONES.USUARIOS, uid));
  if (!perfil.exists()) await setDoc(doc(conexion.db, COLECCIONES.USUARIOS, uid), { rol: ROLES.CLIENTE });

  // El nombre de usuario no se puede cambiar (lo impiden las reglas). Si la cuenta ya existía con otro
  // nombre de usuario, se borra el perfil público y se vuelve a crear.
  const foto = await imagenDePrueba(`assets/img/clientes/cliente-${cliente.foto}.jpg`, "foto");
  const referenciaPublica = doc(conexion.db, COLECCIONES.CLIENTES, uid);
  const publico = await getDoc(referenciaPublica);
  if (publico.exists() && publico.data().usuario === cliente.usuario) {
    await updateDoc(referenciaPublica, { foto });
  } else {
    if (publico.exists()) await deleteDoc(referenciaPublica);
    await setDoc(referenciaPublica, { usuario: cliente.usuario, foto });
  }
  await setDoc(doc(conexion.db, COLECCIONES.CLIENTES_PRIVADOS, uid), { nombre: cliente.nombre });

  // Favoritos con un precio de referencia distinto del actual: al entrar aparece el aviso.
  const productos = cliente.favoritos.map((clave) => productoIdPorClave.get(clave)).filter(Boolean);
  const precios = Object.fromEntries(
    Object.entries(cliente.referencias)
      .filter(([clave]) => productoIdPorClave.has(clave))
      .map(([clave, precio]) => [productoIdPorClave.get(clave), precio])
  );
  await setDoc(doc(conexion.db, COLECCIONES.FAVORITOS, uid), { productos, precios, avisos: true });

  // Reacciones: se guardan las de la lista y se borran las que ya no están.
  const reaccionesNuevas = new Map(
    Object.entries(cliente.reacciones)
      .filter(([clave]) => productoIdPorClave.has(clave))
      .map(([clave, valor]) => [productoIdPorClave.get(clave), valor])
  );
  const reaccionesGuardadas = await getDocs(
    query(collection(conexion.db, COLECCIONES.REACCIONES), where("clienteId", "==", uid))
  );
  for (const guardada of reaccionesGuardadas.docs) {
    if (!reaccionesNuevas.has(guardada.data().productoId)) await deleteDoc(guardada.ref);
  }
  for (const [productoId, valor] of reaccionesNuevas) {
    await setDoc(doc(conexion.db, COLECCIONES.REACCIONES, `${productoId}_${uid}`), { productoId, clienteId: uid, valor });
  }

  // Comentarios de la ronda 1. Se borran los que ya no están en la lista (por ejemplo, de una versión anterior).
  await publicarComentariosDeCliente(conexion, cliente, uid, 1, productoIdPorClave, comercioIdPorClave, true);
  await signOut(conexion.auth);
}

// Publica los comentarios de una ronda. Si limpiar es true, borra antes los comentarios propios
// cuyo texto ya no figura en la lista del cliente.
async function publicarComentariosDeCliente(conexion, cliente, uid, ronda, productoIdPorClave, comercioIdPorClave, limpiar = false) {
  const textos = new Set(cliente.comentarios.map((c) => c.texto));
  const anteriores = await getDocs(
    query(collection(conexion.db, COLECCIONES.COMENTARIOS), where("clienteId", "==", uid))
  );
  const yaPublicados = new Set();
  for (const anterior of anteriores.docs) {
    if (limpiar && !textos.has(anterior.data().texto)) await deleteDoc(anterior.ref);
    else yaPublicados.add(anterior.data().texto);
  }
  for (const comentario of cliente.comentarios) {
    if ((comentario.ronda ?? 1) !== ronda) continue;
    const productoId = productoIdPorClave.get(comentario.producto);
    if (!productoId || yaPublicados.has(comentario.texto)) continue;
    await addDoc(collection(conexion.db, COLECCIONES.COMENTARIOS), {
      productoId,
      comercioId: comercioIdPorClave.get(comentario.comercio) ?? "",
      clienteId: uid,
      texto: comentario.texto,
      fecha: serverTimestamp()
    });
  }
}

// Ronda 2: respuestas a comentarios de otras cuentas. Se publican al final para que queden después.
async function publicarRespuestasDeCliente(conexion, cliente, productoIdPorClave, comercioIdPorClave) {
  if (!cliente.comentarios.some((c) => c.ronda === 2)) return;
  const { user } = await signInWithEmailAndPassword(conexion.auth, cliente.email, cliente.password);
  await publicarComentariosDeCliente(conexion, cliente, user.uid, 2, productoIdPorClave, comercioIdPorClave);
  await signOut(conexion.auth);
}

// Borra una cuenta personal de prueba que ya no se usa: comentarios, reacciones, favoritos, perfil y la cuenta.
// Las reglas permiten que cada cuenta personal borre sus propios datos. Si la cuenta no existe, no hace nada.
async function eliminarClienteAnterior(conexion, { email, password }) {
  let credencial;
  try {
    credencial = await signInWithEmailAndPassword(conexion.auth, email, password);
  } catch {
    return;
  }
  const uid = credencial.user.uid;
  const perfil = await getDoc(doc(conexion.db, COLECCIONES.USUARIOS, uid));
  if (perfil.exists() && perfil.data().rol !== ROLES.CLIENTE) {
    await signOut(conexion.auth);
    return;
  }
  for (const coleccion of [COLECCIONES.COMENTARIOS, COLECCIONES.REACCIONES]) {
    const propios = await getDocs(query(collection(conexion.db, coleccion), where("clienteId", "==", uid)));
    for (const documento of propios.docs) await deleteDoc(documento.ref);
  }
  for (const coleccion of [COLECCIONES.FAVORITOS, COLECCIONES.CLIENTES_PRIVADOS, COLECCIONES.CLIENTES, COLECCIONES.USUARIOS]) {
    await deleteDoc(doc(conexion.db, coleccion, uid));
  }
  await deleteUser(credencial.user);
}

// alAvanzar(texto) informa el paso actual a la pantalla.
export async function cargarComerciosDePrueba(alAvanzar = () => {}) {
  await leerDatosDePrueba();
  const conexion = conexionDePrueba();

  const uids = [];
  for (const comercio of COMERCIOS_DE_PRUEBA) {
    alAvanzar(`Registrando la cuenta de ${comercio.nombre}...`);
    uids.push(await registrarComercioDePrueba(conexion, comercio));
  }

  // Paso 2: la validación la hace el administrador que tiene la sesión abierta en la conexión principal.
  alAvanzar("Validando los comercios...");
  for (const uid of uids) await actualizarRol(uid, ROLES.COMERCIO);

  const productosExistentes = await getDocs(collection(conexion.db, COLECCIONES.PRODUCTOS));
  const productoIdPorNombre = new Map(productosExistentes.docs.map((d) => [d.data().nombre, d.id]));
  const nombresDePrueba = new Set(
    PRODUCTOS_DE_PRUEBA.flatMap((producto) => [producto.nombre, ...(producto.nombresAnteriores ?? [])])
  );

  // Los productos de prueba cargados antes de que existiera creadorId no tienen dueño.
  // El administrador (sesión principal) se los asigna al primer comercio de prueba,
  // antes de publicar, para que ese comercio pueda completarles la presentación y las etiquetas.
  const sinDueno = productosExistentes.docs.filter(
    (d) => nombresDePrueba.has(d.data().nombre) && !d.data().creadorId
  );
  if (sinDueno.length > 0) alAvanzar("Asignando dueño a los productos de prueba...");
  for (const documento of sinDueno) {
    await updateDoc(doc(db, COLECCIONES.PRODUCTOS, documento.id), { creadorId: uids[0] });
  }

  const comercioIdPorClave = new Map();
  for (const comercio of COMERCIOS_DE_PRUEBA) {
    comercioIdPorClave.set(comercio.clave, await publicarComercioDePrueba(conexion, comercio, productoIdPorNombre, alAvanzar));
  }

  const productoIdPorClave = new Map(
    PRODUCTOS_DE_PRUEBA.map((producto) => [producto.clave, idDeProductoDePrueba(productoIdPorNombre, producto)])
  );
  alAvanzar("Quitando las cuentas personales de prueba anteriores...");
  for (const anterior of CLIENTES_DE_PRUEBA_ANTERIORES) {
    await eliminarClienteAnterior(conexion, anterior);
  }
  for (const cliente of CLIENTES_DE_PRUEBA) {
    await publicarClienteDePrueba(conexion, cliente, productoIdPorClave, comercioIdPorClave, alAvanzar);
  }
  alAvanzar("Publicando las respuestas entre comentarios...");
  for (const cliente of CLIENTES_DE_PRUEBA) {
    await publicarRespuestasDeCliente(conexion, cliente, productoIdPorClave, comercioIdPorClave);
  }

  return [
    ...COMERCIOS_DE_PRUEBA.map(({ nombre, email, password }) => ({ tipo: "Comercio", nombre, email, password })),
    ...CLIENTES_DE_PRUEBA.map(({ nombre, usuario, email, password }) => ({ tipo: "Personal", nombre: `${nombre} (@${usuario})`, email, password }))
  ];
}
