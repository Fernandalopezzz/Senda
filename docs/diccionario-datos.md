# Diccionario de datos · SENDA

Base de datos: Cloud Firestore. Las relaciones se hacen con identificadores (`productoId`, `comercioId`). Los nombres de campos usan camelCase.

## usuarios

Una cuenta por comercio, administrador o cuenta personal. El ID del documento es el `uid` de Firebase Authentication. Para buscar y comparar precios no hace falta cuenta. La cuenta personal es opcional. La lectura es pública porque las páginas sin cuenta necesitan saber si un comercio está validado. El correo queda solo en Firebase Authentication.

| Campo | Tipo | Descripción |
|---|---|---|
| rol | string | `pendiente`, `comercio`, `rechazado`, `admin` o `cliente`. |

El campo `rol` también registra la validación del comercio:

- `pendiente`: el comercio se registró y espera que un administrador revise sus datos. No puede entrar al panel.
- `comercio`: un administrador lo validó. Puede entrar a su panel y publicar productos.
- `rechazado`: el administrador lo bloqueó. No puede entrar al panel y sus precios no se muestran.
- `cliente`: cuenta personal. Se crea sin validación y sirve para favoritos, reacciones, comentarios y avisos de precio.
- `admin`: cuenta de administración. Se asigna a mano desde la consola de Firebase, porque las reglas no permiten asignarla desde la aplicación.

## comercios

El ID del documento es el `uid` de la cuenta del comercio. Así se relaciona el comercio con su cuenta sin agregar un campo.

| Campo | Tipo | Descripción |
|---|---|---|
| nombre | string | Nombre del comercio. Obligatorio y sin repetir entre comercios. |
| dueno | string | Nombre del dueño o responsable. Lo carga el comercio al registrarse y lo ve el administrador. |
| foto | string | Foto de perfil del comercio, como imagen JPG en formato data URL. Opcional. |
| fondo | string | Imagen de fondo del perfil, como imagen JPG en formato data URL. Opcional. |
| direccion | string | Dirección del local. |
| telefono | string | Teléfono o WhatsApp de contacto. |
| horario | string | Días y horario de atención. |

## comerciosPrivados

Correo de cada cuenta de comercio. El ID es el `uid`. No es público, lo leen el propio comercio y el administrador. Se guarda al registrarse, y los comercios registrados antes lo completan solos al entrar a su panel.

| Campo | Tipo | Descripción |
|---|---|---|
| correo | string | Correo de la cuenta en Authentication. Las reglas solo aceptan el correo real de la sesión. |

## productos

Catálogo compartido. Un mismo producto lo venden varios comercios, cada uno con su precio. Los datos del producto solo los edita el comercio que lo creó (`creadorId`). Los demás comercios solo publican y modifican su propio precio y stock.

| Campo | Tipo | Descripción |
|---|---|---|
| nombre | string | Nombre y presentación, por ejemplo "Yerba mate tradicional 500 g". |
| marca | string | Marca del producto. Puede quedar vacía. |
| descripcion | string | Descripción breve. Puede quedar vacía. |
| imagen | string | Imagen del producto como JPG en formato data URL. Puede quedar vacía. |
| presentacion | string | Peso o volumen, por ejemplo "1 kg" o "500 ml". Opcional, hasta 30 caracteres. |
| etiquetas | array | Características cortas, por ejemplo "Natural" o "Sabor intenso". Opcional, hasta 6 de 24 caracteres. |
| creadorId | string | `uid` del comercio que cargó el producto. Es el único que puede editar nombre, marca, descripción e imagen. No se puede cambiar. |

## precios

Une un producto con un comercio. Los descuentos forman parte de este documento.

| Campo | Tipo | Descripción |
|---|---|---|
| productoId | string | ID del documento de `productos`. |
| comercioId | string | ID del documento de `comercios`. |
| precioOriginal | number | Precio sin descuento. |
| porcentajeDescuento | number | Entero de 0 a 99. 0 significa sin descuento. |
| precioFinal | number | `precioOriginal` con el descuento aplicado, redondeado a dos decimales. |
| disponible | boolean | `true` si hay stock. |
| fechaActualizacion | timestamp | Fecha del servidor de la última modificación. |

## notificaciones

Avisos de SENDA para un comercio. Hoy se crean cuando el administrador elimina un producto de un comercio. El comercio los ve la próxima vez que abre SENDA con su sesión iniciada y, al cerrarlos, quedan como leídos.

| Campo | Tipo | Descripción |
|---|---|---|
| comercioId | string | ID del comercio que recibe el aviso. |
| tipo | string | Tipo de aviso. Por ahora solo `producto-eliminado`. |
| productoNombre | string | Nombre del producto eliminado, guardado porque el producto puede dejar de existir. |
| fecha | timestamp | Fecha del servidor en que se creó el aviso. |
| leida | boolean | `false` hasta que el comercio cierra el aviso. |

Solo el administrador crea avisos. El comercio solo puede leer los suyos y marcarlos como leídos.

## clientes

Perfil público de cada cuenta personal (rol `cliente`). El ID es el `uid`. La lectura es pública porque el nombre de usuario y la foto se muestran junto a los comentarios y en el perfil público. El nombre real y el correo no se guardan acá.

| Campo | Tipo | Descripción |
|---|---|---|
| usuario | string | Nombre de usuario, de 3 a 20 caracteres, con letras sin tilde (se respetan las mayúsculas), números, punto o guion bajo. Es único sin distinguir mayúsculas. No se puede cambiar. |
| foto | string | Foto de perfil como JPG en formato data URL. Puede quedar vacía. |

## clientesPrivados

Datos privados de la cuenta personal. El ID es el `uid` y solo los lee y modifica su dueño.

| Campo | Tipo | Descripción |
|---|---|---|
| nombre | string | Nombre de la persona, de 2 a 60 caracteres. Se puede cambiar desde "Editar perfil". |

## favoritos

Lista privada de una cuenta personal. El ID es el `uid` y solo la lee su dueño.

| Campo | Tipo | Descripción |
|---|---|---|
| productos | array | IDs de los productos guardados, hasta 100. |
| precios | map | Para cada producto, el mejor precio que la persona ya vio. `null` si no había stock. Se usa para los avisos de cambio de precio. |
| avisos | boolean | `false` si la persona apagó los avisos de precio en Configuración. Si no existe, los avisos están encendidos. |

## reacciones

"Me gusta" o "No me gusta" de una cuenta personal sobre un producto. El ID es `<productoId>_<uid>`, así cada cuenta tiene una sola reacción por producto.

| Campo | Tipo | Descripción |
|---|---|---|
| productoId | string | Producto al que se reacciona. |
| clienteId | string | `uid` de la cuenta personal. |
| valor | string | `me-gusta` o `no-me-gusta`. |

## comentarios

Comentarios de cuentas personales sobre un producto. Lectura pública. No se editan. Los borra su autor o el administrador.

| Campo | Tipo | Descripción |
|---|---|---|
| productoId | string | Producto comentado. |
| comercioId | string | Comercio del que habla el comentario, o vacío si es general. |
| clienteId | string | `uid` del autor. |
| texto | string | Comentario, de 3 a 300 caracteres. |
| fecha | timestamp | Fecha del servidor en que se publicó. |

## Eliminación de una cuenta de comercio

Solo el administrador elimina cuentas de comercio, y solo si están bloqueadas (rol `rechazado`). Se borran los precios del comercio, los productos que ningún otro comercio publica, sus `notificaciones`, su documento de `comercios`, su correo de `comerciosPrivados` y su documento de `usuarios`. El rol se borra al final, porque las reglas lo usan para autorizar los borrados anteriores. El usuario de Authentication queda y se borra a mano desde la consola.

## Eliminación de una cuenta personal

La persona elimina su cuenta desde su perfil. En una sola escritura en lote se borran sus comentarios, sus reacciones, su documento de `favoritos`, su perfil de `clientes`, sus datos de `clientesPrivados` y su documento de `usuarios`. Después se borra la cuenta de Authentication.

## Eliminación de productos

Los comercios no eliminan productos, los marcan sin stock. El administrador sí puede eliminar la publicación de un producto en un comercio desde el perfil de ese comercio. Se borra el documento de `precios` de ese comercio. Si ningún otro comercio publica el producto, también se borra el documento de `productos`. En la misma operación se crea el aviso en `notificaciones`.

## Imágenes

El proyecto usa el plan gratuito de Firebase (Spark), que no incluye Cloud Storage. Por eso las imágenes se guardan en Firestore. Antes de guardarlas, `js/services/imagenesService.js` las achica y las convierte a JPG en el navegador. El resultado es un texto (data URL) que entra en `productos.imagen`, `comercios.foto` y `comercios.fondo`. Los límites de tamaño están en `firestore.rules`.

## Datos de prueba

El administrador puede cargar 3 comercios ficticios ya validados y 6 cuentas personales con el botón «Cargar datos de prueba» de `gestion-comercio.html`. Los datos están en `js/core/constants.js` (`COMERCIOS_DE_PRUEBA`, `PRODUCTOS_DE_PRUEBA` y `CLIENTES_DE_PRUEBA`). Las imágenes están en `assets/img/productos`, `assets/img/comercios` y `assets/img/clientes`.

## Datos que quedan en el navegador

Algunos datos no se guardan en Firestore, porque son del dispositivo y no hace falta conservarlos en el servidor.

| Clave de localStorage | Contenido |
|---|---|
| `senda:favoritos` | Copia local de los favoritos, para que el corazón responda al instante. |
| `senda:tema` | `oscuro` o `claro`, según el modo elegido en Configuración. |
| `senda:historial:<uid>` | Últimas 10 búsquedas y últimos 10 productos vistos, para "Para vos". Los visitantes usan `senda:historial:visitante`. |
