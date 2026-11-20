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
  COMENTARIOS: "comentarios"
});

// Valores posibles del campo "rol" de la colección usuarios.
//   pendiente:  se registró y espera que un administrador revise sus datos. No puede ingresar.
//   comercio:   validado por un administrador. Puede ingresar y publicar.
//   rechazado:  bloqueado por un administrador. No puede ingresar y sus precios no se muestran.
//   admin:      cuenta de administración.
//   cliente:    cuenta personal. Guarda favoritos, opina y comenta. No necesita validación.
export const ROLES = Object.freeze({
  ADMIN: "admin",
  CLIENTE: "cliente",
  COMERCIO: "comercio",
  PENDIENTE: "pendiente",
  RECHAZADO: "rechazado"
});

// Roles de comercio que pueden ingresar a su panel y publicar productos.
export const ROLES_COMERCIO_ACTIVO = Object.freeze([ROLES.COMERCIO]);

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
  OFERTAS_INICIO: 5,
  RESULTADOS_POR_PAGINA: 8,
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
  FAVORITOS: "senda.favoritos"
});

// Tipos de imagen aceptados al subir una foto, un fondo o la imagen de un producto.
export const TIPOS_ARCHIVO = Object.freeze({
  IMAGEN: ["image/jpeg", "image/png", "image/webp"]
});
