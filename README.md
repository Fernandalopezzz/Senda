# SENDA

SENDA es una plataforma web para comparar precios de productos entre los comercios de Río Gallegos. Una persona escribe el nombre de un producto y ve en qué comercios está, cuánto cuesta en cada uno, si tiene descuento y si hay stock. Los comercios publican sus productos y mantienen sus precios al día desde un panel propio.

La idea central es simple. El mismo producto puede tener precios distintos según el comercio, y SENDA reúne esa información en un solo lugar para que el cliente elija dónde comprar.

El sitio está pensado para usarse desde el navegador de una computadora. No tiene versión para celular.

Proyecto final de la materia Programación Aplicada, 6.° I Informática. Docente García Lene Virginia. Integrantes Lagraña Ruth, Ruiz Facundo, López Fernanda y Goñi Valentina.

## Tecnologías

- HTML, CSS y JavaScript con módulos de ES6, sin frameworks.
- Firebase Authentication para las cuentas y Cloud Firestore como base de datos (SDK 13.1.0, cargado desde el servidor de Google).
- Reglas de seguridad de Firestore en `firestore.rules`.

## Cómo ejecutar el proyecto

1. Clonar el repositorio o descargarlo como ZIP.
2. Copiar `js/config/firebaseConfig.ejemplo.js` con el nombre `firebaseConfig.js` y completar los datos del proyecto de Firebase. Ese archivo no está en el repositorio.
3. Abrir la carpeta en Visual Studio Code con la extensión **Live Server**.
4. Presionar **Go Live**. El sitio se abre en `http://127.0.0.1:5500/index.html`.

Hace falta un servidor local porque los navegadores no cargan módulos de JavaScript desde un archivo abierto con doble clic. No hay que instalar paquetes.

## Estructura del repositorio

| Carpeta o archivo | Contenido |
|---|---|
| `*.html` | Una página por pantalla del sitio. |
| `css/` | Estilos generales (`base.css`), componentes (`components.css`) y estilos de cada página (`pages.css`). |
| `js/config/` | Conexión con Firebase. |
| `js/core/` | Constantes, validaciones y mensajes de error. |
| `js/services/` | Lectura y escritura en Firestore y Authentication. |
| `js/guards/` | Control de sesión y de rol. |
| `js/ui/` | Funciones y componentes visuales reutilizables. |
| `js/pages/` | Lógica de cada página. |
| `assets/img/` | Logo, ícono e imágenes. |
| `docs/` | Diccionario de datos, mapa del sitio, flujos de usuario y justificación de las cuentas personales. |
| `firestore.rules` | Reglas de seguridad de la base de datos. |

## Tipos de usuario

| Usuario | ¿Necesita cuenta? | Qué puede hacer |
|---|---|---|
| Cliente (visitante) | No | Buscar productos, comparar precios, ver ofertas, guardar favoritos en el navegador y consultar los datos de cada comercio. |
| Cliente con cuenta personal | Opcional, sin validación | Lo mismo que el visitante, más favoritos en cualquier computadora, avisos de cambio de precio, "me gusta", "no me gusta" y comentarios. |
| Comercio | Sí, validada por la administración | Editar el perfil del local, publicar productos, cargar precios y descuentos y marcar el stock. |
| Administración | Sí, asignada por el equipo de SENDA | Aceptar o rechazar las solicitudes de comercios nuevos, ver el perfil de cualquier comercio y eliminar productos no aptos para la venta. |

---

## Uso para clientes

Para buscar y comparar precios no hace falta registrarse. Todas esas funciones están abiertas para cualquier persona que entre al sitio. La cuenta personal es opcional y se explica más abajo, en "Cuenta personal".

### Inicio

El inicio está ordenado de arriba hacia abajo.

1. **Buscador**, para escribir un producto, una marca o un comercio.
2. **Novedades de tus favoritos**, solo con cuenta personal y si algún favorito cambió de precio.
3. **Recomendados**, con los productos más baratos que tienen stock en algún comercio.
4. **Para vos**, con la mejor oferta de lo que se buscó o se miró hace poco. Por ejemplo, después de mirar una yerba cara, sugiere la yerba con más descuento. El menú de tres puntos permite borrar ese historial, que se guarda solo en el navegador.
5. **Compará precios**, con un producto de ejemplo y su precio en varios comercios.
6. **Ofertas y descuentos**.

### Buscar un producto

El buscador está arriba de todo en el inicio. Se escribe el nombre de un producto, una marca o el nombre de un comercio y se presiona **Buscar**. La búsqueda no distingue mayúsculas ni tildes, por eso "almacen" encuentra "Almacén". Hace falta escribir al menos dos letras.

Debajo del buscador aparecen dos secciones.

- **Precios destacados** muestra el producto que más comercios tienen en stock, con el precio de cada comercio ordenado de menor a mayor. El primero lleva el sello "Mejor precio".
- **Ofertas** muestra los productos con descuento vigente y stock disponible.

### Revisar los resultados

La página de resultados muestra cada producto encontrado con su precio más bajo y la cantidad de comercios que lo venden. Si la búsqueda coincide con el nombre de un comercio, la tarjeta de ese comercio aparece primero.

Los resultados se pueden ordenar por menor precio, mayor precio, mayor descuento o nombre. La casilla **Solo productos en stock** oculta los productos que ningún comercio tiene disponibles. Si hay muchos resultados, el botón **Ver más productos** carga los siguientes.

### Comparar precios de un producto

Al entrar a un producto se abre su detalle. Ahí figuran la imagen, la marca, la descripción y el **mejor precio** entre los comercios que tienen stock. Si hay dos o más comercios con stock, también se informa cuánto se ahorra al elegir el más barato.

Más abajo está la lista de todos los comercios que venden ese producto. Primero aparecen los que tienen stock, de menor a mayor precio, y después los que no tienen. Cada fila indica la dirección, el horario y la fecha de la última actualización del precio. Al final de la página se sugieren productos similares.

### Consultar el perfil de un comercio

Desde cualquier tarjeta de comercio se entra a su perfil público. El perfil muestra la foto, la imagen de fondo, la dirección, el teléfono, el horario de atención y todos los productos que publicó.

- El botón **Cómo llegar** abre la dirección en Google Maps.
- El teléfono es un enlace que abre la aplicación de llamadas de la computadora.
- El catálogo tiene filtros por nombre, por ofertas, por stock y por rango de precio.

### Ofertas, favoritos y lista de comercios

El pie de página y la barra superior llevan a tres listados.

- **Ofertas** reúne todos los productos con descuento.
- **Favoritos** muestra los productos marcados con el corazón. Sin cuenta, se guardan en el navegador del dispositivo, y si se borran los datos del navegador o se entra desde otro equipo, la lista aparece vacía. Con cuenta personal, la lista queda guardada en la cuenta.
- **Comercios** muestra todos los comercios que tienen productos publicados.

---

## Cuenta personal

La cuenta personal es para clientes que quieren seguir sus productos de cerca. No es necesaria para comparar precios.

### Crear la cuenta

1. Presionar **Registrarse** en la barra superior.
2. Elegir **Cuenta personal**. La otra opción, **Cuenta de comercio**, es para locales que publican precios.
3. Completar el nombre, un nombre de usuario, el correo y una contraseña de al menos 8 caracteres con letras y números. También se puede usar **Google**, completando solo el nombre y el nombre de usuario.
4. Aceptar los términos y presionar **Crear cuenta**.

La cuenta queda lista al instante, sin validación. El nombre de usuario es el que ven los demás junto a los comentarios y no se puede cambiar después. El correo es privado y solo lo ve su dueño.

El inicio de sesión es el mismo que el de los comercios. Al ingresar, la barra superior muestra la foto y el nombre de la cuenta. Un clic sobre ellos abre el perfil.

### Opinar sobre un producto

En el detalle de cada producto aparecen su presentación (por ejemplo "1 kg"), su descripción y sus etiquetas (por ejemplo "Natural" o "Sabor intenso"). Debajo están los botones **Me gusta** y **No me gusta**, que registran una reacción por cuenta. Tocar el mismo botón otra vez la quita.

Al final de la lista "Dónde comprar" está el botón **Ver comentarios**. Ahí se leen los comentarios de otros clientes y, con cuenta personal, se publica uno nuevo. El selector **¿Sobre qué comercio?** indica de qué comercio se habla, por ejemplo para avisar que una oferta ya terminó. El límite es de 300 caracteres. El autor puede borrar sus comentarios con el tachito.

El nombre de usuario de cada comentario lleva al **perfil público** de esa persona. Ese perfil muestra solo su nombre de usuario, su foto y sus comentarios, cada uno con el producto donde se publicó. Nunca muestra el nombre real ni el correo.

### La cuenta personal por dentro

La cuenta se abre tocando la foto o el @usuario de la barra superior. **Cerrar sesión** está al lado, en la misma barra. A la izquierda hay una barra lateral con tres secciones.

| Sección | Para qué sirve |
|---|---|
| Mi perfil | Muestra lo que ven los demás: foto, nombre de usuario y comentarios publicados. También muestra el nombre y el correo, marcados como "Solo vos lo ves". **Editar perfil** cambia la foto y el nombre. **Ver cómo me ven los demás** abre el perfil público. |
| Mis favoritos | Lista privada de los productos guardados con el corazón, con un buscador. Arriba aparecen los cambios de precio: si un favorito bajó, subió, tiene descuento o se quedó sin stock. **Entendido** marca cada aviso como visto. |
| Configuración | **Avisos de precio** se encienden o se apagan. **Modo oscuro** cambia los fondos blancos por grises oscuros en todo el sitio. **Idioma** muestra los idiomas disponibles, por ahora solo español. En **Cuenta** se cambian el correo y la contraseña, y se elimina la cuenta. |

Cuando un favorito cambió de precio, el inicio muestra el recuadro **Novedades de tus favoritos** y la foto de la barra un número rojo. El control se hace cada vez que se abre SENDA con la sesión iniciada.

### Cambiar datos o eliminar la cuenta

Cada cambio pide la contraseña actual. El cambio de correo envía un enlace al correo nuevo y se aplica al abrirlo. Eliminar la cuenta borra el perfil, los favoritos, las reacciones y los comentarios, y no se puede deshacer. Si la cuenta entra con Google, el correo y la contraseña se administran desde Google, y para eliminarla se confirma con la ventana de Google.

---

## Uso para comercios

### Registrar el comercio

1. Entrar a **Registrarse**, en la barra superior.
2. Completar el nombre del comercio, el nombre del dueño o responsable, la dirección y un teléfono de contacto.
3. Elegir una de dos formas de crear la cuenta. Con correo y contraseña, la contraseña necesita al menos 8 caracteres, con letras y números. Con **Google**, se usa la cuenta de Google y no hace falta completar correo ni contraseña.
4. Aceptar los términos y presionar **Crear cuenta**.

Cada dato mal cargado se marca en rojo debajo de su campo, y la cuenta no se crea hasta corregirlo. El nombre del comercio no puede repetirse con el de otro comercio ya registrado.

Después del registro, la cuenta queda **pendiente de validación**. Mientras tanto no se puede ingresar al panel. La administración revisa los datos y valida la cuenta. Hoy SENDA no envía un aviso automático cuando eso ocurre, por eso conviene volver a intentar el ingreso más tarde.

### Iniciar sesión y recuperar la contraseña

El ingreso se hace desde **Iniciar sesión**, con correo y contraseña o con Google. Al ingresar, la página vuelve al inicio y en la barra superior aparecen la foto y el nombre del comercio. Un clic sobre ellos abre el panel de gestión.

Si se olvidó la contraseña, el enlace **¿Olvidaste tu contraseña?** permite pedir un correo para crear una nueva. Esta opción sirve solo para cuentas creadas con correo y contraseña.

### Editar el perfil del comercio

En la parte superior del panel se modifican el nombre, el teléfono, la dirección y el horario de atención. Los cambios se guardan con el botón **Guardar cambios**.

También se pueden cambiar la **foto** del comercio y la **imagen de fondo** del perfil. Se aceptan imágenes JPG, PNG o WEBP de hasta 5 MB. SENDA achica la imagen automáticamente antes de guardarla.

El botón **Ver perfil público** muestra el perfil tal como lo ven los clientes.

### Publicar un producto

1. Presionar **Agregar producto** en la sección "Mis productos".
2. Elegir un producto que ya existe en SENDA o la opción **Producto nuevo**.
3. Si el producto es nuevo, cargar el nombre, la marca, la presentación (por ejemplo "1 kg" o "500 ml"), las etiquetas separadas por coma (por ejemplo "Natural, Sabor intenso"), una descripción breve y una imagen.
4. Cargar el precio, el porcentaje de descuento (de 0 a 99) y si hay stock.
5. Presionar **Publicar producto**.

El formulario muestra el precio final con el descuento aplicado antes de publicar.

Elegir un producto existente es la forma recomendada cuando otro comercio ya lo cargó. Así el producto aparece una sola vez en la búsqueda y los clientes pueden comparar los precios de todos los comercios que lo venden. El comercio que lo cargó primero sigue siendo el único que puede cambiar sus datos.

### Modificar un producto, su precio o su stock

Cada producto de la lista "Mis productos" tiene tres acciones.

- **Editar producto** cambia el nombre, la marca, la presentación, las etiquetas, la descripción o la imagen. Este botón aparece solo en los productos que cargó el mismo comercio. Si el producto lo cargó otro comercio, la fila lo indica y solo se pueden cambiar el precio y el stock propios. Cuando el creador edita un producto que otros comercios también venden, el cambio se ve en todas las publicaciones.
- **Actualizar precio** cambia el precio y el descuento. La fecha de actualización se registra sola.
- **¿En stock? Sí / No** marca si el producto está disponible. Un producto sin stock sigue publicado, pero aparece al final de las comparaciones.

Los comercios no eliminan productos publicados. Para retirar uno de la venta, se marca sin stock.

### Aviso de producto eliminado por SENDA

Si la administración elimina un producto por no ser apto para la venta, la próxima vez que el comercio abre SENDA con su sesión iniciada aparece un aviso con el nombre del producto. El aviso indica que el producto ha sido eliminado por SENDA y que, si se considera un error, hay que comunicarse con soporte técnico. Al presionar **Entendido**, el aviso no vuelve a aparecer.

La lista tiene filtros por nombre, por ofertas, por productos sin stock y por rango de precio.

### Cerrar sesión

El botón **Cerrar sesión** está arriba a la derecha del panel.

---

## Uso para la administración

La cuenta de administración entra al mismo panel de gestión, pero ve la pantalla **Validación de comercios**.

### Aceptar, rechazar, bloquear y habilitar comercios

Las cuentas de comercio se dividen en tres pestañas, cada una con su cantidad. Cada comercio ocupa un renglón con el nombre, el dueño, la dirección, el correo, el teléfono y el horario. El correo abre el programa de correo para escribirle al comercio. Al lado aparecen íconos según la pestaña.

| Pestaña | Significado | Íconos |
|---|---|---|
| Pendientes | Comercios recién registrados que esperan revisión. No pueden ingresar. | Ojo, tilde (aceptar) y tachito (rechazar). |
| Validados | Comercios habilitados. Pueden ingresar y sus precios se muestran en el sitio. | Ojo y tachito (bloquear). |
| Bloqueados | Comercios rechazados o bloqueados. No pueden ingresar y sus precios no se muestran. | Ojo, tilde (volver a habilitar) y tachito (eliminar la cuenta). |

El ojo abre el perfil del comercio en otra pestaña. El tachito pide confirmación antes de rechazar, bloquear o eliminar. Al usar un ícono, el comercio pasa a la pestaña que corresponde.

### Eliminar una cuenta de comercio

Solo se puede eliminar una cuenta que ya está bloqueada. Primero se bloquea y después, en la pestaña **Bloqueados**, el tachito la elimina. Se borran el perfil del comercio, su correo guardado, todos sus precios y los productos que solo vendía ese comercio. Los productos que también venden otros comercios siguen publicados en ellos. La eliminación no se puede deshacer.

La cuenta eliminada ya no puede entrar a SENDA. Su usuario de acceso queda registrado en Firebase Authentication, porque la página no tiene permiso para borrarlo. Si hace falta liberar ese correo, se borra a mano desde la consola de Firebase, en **Authentication → Users**.

### Revisar el perfil de un comercio, eliminar productos y cambiar el estado

El ojo de cada renglón abre el perfil del comercio, en cualquiera de los tres estados. Con la sesión de administración, el perfil muestra un recuadro con el estado de la cuenta y un botón **Eliminar producto** en cada producto.

El mismo recuadro tiene botones para cambiar el estado sin volver al panel. Si la cuenta está pendiente, aparecen **Aceptar cuenta** y **Rechazar cuenta**. Si está validada, aparece **Bloquear cuenta**. Si está bloqueada, aparecen **Volver a habilitar cuenta** y **Eliminar cuenta**. Después de eliminar una cuenta, la página vuelve al panel de administración.

Desde esta vista no se puede editar ningún dato del comercio. El botón **Eliminar producto** sirve para retirar publicaciones que no son aptas para la venta. Al confirmar, el producto deja de mostrarse en ese comercio y el comercio recibe el aviso de eliminación. Si ningún otro comercio vendía ese producto, el producto se borra de SENDA. Si otros comercios lo venden, sigue publicado en ellos.

### Cargar datos de prueba

El enlace **Cargar datos de prueba**, al pie de la lista, crea tres comercios ficticios ya validados, cada uno con foto, fondo y seis productos con precios distintos. También crea seis cuentas personales ficticias con foto, favoritos y comentarios. Al terminar, la pantalla muestra el correo y la contraseña de cada cuenta. Si se presiona otra vez, actualiza los datos en lugar de duplicarlos. Esta función está pensada para demostraciones y pruebas. Los datos están en `js/core/datosPrueba.js`, que el equipo comparte por separado porque incluye contraseñas de las cuentas de prueba. Sin ese archivo, el enlace avisa que no está disponible.

---

## Preguntas frecuentes

**El ingreso muestra "pendiente de validación".**
La cuenta todavía no fue revisada por la administración. Hay que esperar la validación y volver a intentar.

**Un producto publicado no aparece en la búsqueda.**
Los cambios se ven al recargar la página. Si el comercio está bloqueado, sus productos no se muestran.

**Los favoritos desaparecieron.**
Sin cuenta, se guardan solo en el navegador. Borrar los datos de navegación o cambiar de dispositivo deja la lista vacía. Con una cuenta personal, aparecen otra vez al iniciar sesión.

**No aparece la opción de comentar.**
Los comentarios y las reacciones son solo para cuentas personales. Con una cuenta de comercio o sin sesión, las opiniones se pueden leer pero no escribir.

**La imagen no se pudo guardar.**
La imagen tiene que ser JPG, PNG o WEBP y pesar menos de 5 MB. Si tiene demasiado detalle, conviene recortarla o usar otra.
