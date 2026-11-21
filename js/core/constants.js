// Constantes compartidas por toda la aplicación.

export const COLECCIONES = Object.freeze({
  USUARIOS: "usuarios",
  PRODUCTOS: "productos",
  COMERCIOS: "comercios",
  PRECIOS: "precios",
  NOTIFICACIONES: "notificaciones",
  COMERCIOS_PRIVADOS: "comerciosPrivados",
  CLIENTES: "clientes",
  CLIENTES_PRIVADOS: "clientesPrivados",
  FAVORITOS: "favoritos",
  REACCIONES: "reacciones",
  COMENTARIOS: "comentarios",
  EMPLEADOS: "empleados",
  HISTORIAL_MODERACION: "historialModeracion",
  REPORTES: "reportes",
  REVISIONES: "revisiones",
  AVISOS_MODERACION: "avisosModeracion",
  LISTA_BLOQUEO: "listaBloqueo",
  OCULTOS: "ocultos"
});

// Valores posibles del campo "rol" de la colección usuarios.
//   pendiente:  se registró y espera que un administrador revise sus datos. No puede ingresar.
//   comercio:   validado por un administrador. Puede ingresar y publicar.
//   rechazado:  bloqueado por un administrador. No puede ingresar y sus precios no se muestran.
//   admin:      cuenta de administración.
//   cliente:    cuenta personal. Guarda favoritos, opina y comenta. No necesita validación.
//   bloqueado:  cuenta personal bloqueada por el administrador. No puede ingresar.
//   empleado:   cuenta del equipo de SENDA creada por el administrador. Hace las tareas que el
//               administrador le habilita (ver PERMISOS_EMPLEADO), pero no elimina cuentas.
export const ROLES = Object.freeze({
  ADMIN: "admin",
  EMPLEADO: "empleado",
  BLOQUEADO: "bloqueado",
  CLIENTE: "cliente",
  COMERCIO: "comercio",
  PENDIENTE: "pendiente",
  RECHAZADO: "rechazado"
});

// Roles de comercio que pueden ingresar a su panel y publicar productos.
export const ROLES_COMERCIO_ACTIVO = Object.freeze([ROLES.COMERCIO]);

// Cuentas del equipo de SENDA, que entran al panel de administración.
export const ROLES_EQUIPO = Object.freeze([ROLES.ADMIN, ROLES.EMPLEADO]);

// Tareas que el administrador puede habilitar a cada empleado. La clave es el nombre del campo
// en el documento empleados/{uid}.permisos. Ningún empleado puede eliminar cuentas.
export const PERMISOS_EMPLEADO = Object.freeze([
  { clave: "verPendientes", nombre: "Ver pendientes", detalle: "Ve las solicitudes de comercios nuevos." },
  { clave: "validar", nombre: "Validar", detalle: "Acepta comercios pendientes y vuelve a habilitar bloqueados." },
  { clave: "bloquear", nombre: "Bloquear", detalle: "Rechaza solicitudes y bloquea comercios validados." },
  { clave: "moderar", nombre: "Revisar reportes", detalle: "Atiende la lista de revisión: aprueba, advierte u oculta lo reportado." }
]);

// Desde dónde se hizo cada acción del historial de moderación.
export const ORIGENES = Object.freeze({
  PANEL: "Panel de validación",
  PERFIL: "Perfil del comercio",
  EMPLEADOS: "Sección Empleados",
  REVISION: "Reporte (lista de revisión)"
});

// ---------- Reportes y revisión ----------

// Qué se puede reportar. La revisión de cada elemento usa el ID <tipo>_<id>.
//   comentario: un comentario de una cuenta personal.
//   producto:   los datos de un producto (nombre, imagen, descripción).
//   precio:     la publicación de un producto en un comercio (precio y stock).
//   cuenta:     una cuenta personal o un comercio.
export const TIPOS_REPORTE = Object.freeze({
  COMENTARIO: "comentario",
  PRODUCTO: "producto",
  PRECIO: "precio",
  CUENTA: "cuenta"
});

// Motivos de reporte y en qué tipos tienen sentido.
export const MOTIVOS_REPORTE = Object.freeze([
  { clave: "ofensivo", texto: "Contenido ofensivo", tipos: ["comentario", "producto", "precio", "cuenta"] },
  { clave: "spam", texto: "Spam o publicidad", tipos: ["comentario", "producto", "precio", "cuenta"] },
  { clave: "precio-falso", texto: "Precio falso", tipos: ["precio"] },
  { clave: "no-apto", texto: "Producto no apto para la venta", tipos: ["producto", "precio"] },
  { clave: "no-coincide", texto: "El precio no coincide con el del local", tipos: ["precio"] },
  { clave: "otro", texto: "Otro motivo", tipos: ["comentario", "producto", "precio", "cuenta"] }
]);

// Cantidad de reportes de personas distintas que manda un elemento a revisión.
export const REPORTES_PARA_REVISION = 3;

export const RUTAS = Object.freeze({
  INICIO: "index.html",
  LOGIN: "login.html",
  REGISTRO: "registro-comercio.html",
  CREAR_CUENTA: "crear-cuenta.html",
  REGISTRO_PERSONAL: "registro-personal.html",
  PERFIL_USUARIO: "perfil-usuario.html",
  PERFIL_PUBLICO: "usuario.html",
  RESULTADOS: "resultados.html",
  DETALLE_PRODUCTO: "detalle-producto.html",
  PERFIL_COMERCIO: "perfil-comercio.html",
  GESTION_COMERCIO: "gestion-comercio.html"
});

export const LIMITES = Object.freeze({
  OFERTAS_INICIO: 6,
  RESULTADOS_POR_PAGINA: 12,
  COMERCIOS_DESTACADOS: 3,
  PRODUCTOS_POR_PAGINA: 4,
  FAVORITOS_MAXIMO: 100,
  PASSWORD_MINIMO: 8,
  LARGO_NOMBRE: 120,
  LARGO_TEXTO: 500,
  MB_IMAGEN: 5,
  PRECIO_MAXIMO: 100000000,
  LARGO_NOMBRE_PERSONA: 60,
  LARGO_COMENTARIO: 300,
  LARGO_PRESENTACION: 30,
  LARGO_ETIQUETA: 24,
  ETIQUETAS_MAXIMO: 6
});

// Reacciones posibles sobre un producto.
export const REACCIONES = Object.freeze({
  ME_GUSTA: "me-gusta",
  NO_ME_GUSTA: "no-me-gusta"
});

// Tipos de aviso de la colección notificaciones.
export const TIPOS_NOTIFICACION = Object.freeze({
  PRODUCTO_ELIMINADO: "producto-eliminado"
});

// Claves usadas en localStorage del navegador.
export const ALMACENAMIENTO = Object.freeze({
  FAVORITOS: "senda.favoritos",
  LOCALIDAD: "senda.localidad"
});

// Tipos de imagen aceptados al subir una foto, un fondo o la imagen de un producto.
export const TIPOS_ARCHIVO = Object.freeze({
  IMAGEN: ["image/jpeg", "image/png", "image/webp"]
});

// Localidades de la provincia de Santa Cruz. Se elige una al registrarse y sirve para mostrar
// los "Comercios de tu zona". Es una lista cerrada para que la misma ciudad no quede escrita
// de dos maneras distintas ("Rio Gallegos" y "Río Gallegos").
export const PAIS = "Argentina";
export const PROVINCIA = "Santa Cruz";
export const LOCALIDADES = Object.freeze([
  "Río Gallegos",
  "El Calafate",
  "El Chaltén",
  "Caleta Olivia",
  "Pico Truncado",
  "Las Heras",
  "Puerto Deseado",
  "Puerto San Julián",
  "Puerto Santa Cruz",
  "Comandante Luis Piedra Buena",
  "Gobernador Gregores",
  "Perito Moreno",
  "Los Antiguos",
  "Río Turbio",
  "28 de Noviembre"
]);
// Los comercios registrados antes de que existiera la localidad se toman como de Río Gallegos.
export const LOCALIDAD_PREDETERMINADA = "Río Gallegos";

