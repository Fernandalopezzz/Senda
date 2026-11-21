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
| Comercio | Sí, validada por la administración | Editar el perfil del local, publicar productos, cargar precios y descuentos, marcar el stock y reportar contenido. |
| Empleado | Sí, creada por la administración | Las tareas que la administración le habilita. Ver pendientes, validar, bloquear comercios y revisar reportes. No elimina cuentas. |
| Administración | Sí, asignada por el equipo de SENDA | Todo lo del empleado, más eliminar cuentas, crear y deshabilitar empleados, bloquear cuentas y ver el historial de moderación. |

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
7. **Comercios de tu zona**, con cada comercio de la localidad elegida, su logo, su nombre y sus productos. El selector **Localidad** cambia la ciudad. Sin cuenta, la elección queda guardada en el navegador. Con cuenta, se usa la localidad de la cuenta. Primero aparecen los comercios que actualizaron precios ese día.

Las páginas ocupan todo el ancho de la pantalla, con seis productos por fila. Debajo de cada precio figura el **precio por kilo o por litro**, calculado con la presentación del producto, para comparar envases de distinto tamaño. Los comercios que cambiaron algún precio o stock en el día llevan la insignia **Actualizado hoy**.

### Buscar un producto

El buscador está arriba de todo en el inicio. Se escribe el nombre de un producto, una marca, el nombre de un comercio o el **código de barras** del envase y se presiona **Buscar**. La búsqueda no distingue mayúsculas ni tildes, por eso "cafe" encuentra "Café" y "almacen" encuentra "Almacén". Las palabras pueden ir en cualquier orden, por ejemplo "canarias yerba". Hace falta escribir al menos dos letras, o al menos cuatro números para buscar por código.

Debajo del buscador aparecen dos secciones.

- **Precios destacados** muestra el producto que más comercios tienen en stock, con el precio de cada comercio ordenado de menor a mayor. El primero lleva el sello "Mejor precio".
- **Ofertas** muestra los productos con descuento vigente y stock disponible.

### Revisar los resultados

La página de resultados muestra cada producto encontrado con su precio más bajo y la cantidad de comercios que lo venden. Si la búsqueda coincide con el nombre de un comercio, la tarjeta de ese comercio aparece primero.

Los resultados se pueden ordenar por menor precio, mayor precio, mayor descuento o nombre. La casilla **Solo productos en stock** oculta los productos que ningún comercio tiene disponibles. Si hay muchos resultados, el botón **Ver más productos** carga los siguientes.

### Comparar precios de un producto

Al entrar a un producto se abre su detalle. Ahí figuran la imagen, la marca, la descripción, el código de barras si el comercio lo cargó y el **mejor precio** entre los comercios que tienen stock, con la fecha y la hora en que se actualizó. Si hay dos o más comercios con stock, una franja verde indica cuánto se ahorra, en pesos y en porcentaje, por ejemplo "Ahorrás $ 590 (14,1%)".

Más abajo está la lista de todos los comercios que venden ese producto. Primero aparecen los que tienen stock, de menor a mayor precio, y después los que no tienen.

- El más barato aparece destacado en verde, con la etiqueta **Más barato**.
- Cada comercio más caro muestra cuánto más cuesta, por ejemplo **+ $ 190**.
- Cada fila indica la dirección, el horario y la fecha y la hora de la última actualización del precio. Sirve para saber si una oferta puede estar vieja antes de ir al local.

Al final de la página se sugieren productos similares.

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
3. Completar el nombre, un nombre de usuario, la localidad (de una lista de localidades de Santa Cruz), el correo y una contraseña de al menos 8 caracteres con letras y números. También se puede usar **Google**, completando solo el nombre y el nombre de usuario.
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

Cuando un favorito cambió de precio, el inicio muestra el recuadro **Novedades de tus favoritos**. El control se hace cada vez que se abre SENDA con la sesión iniciada.

### La campanita de notificaciones

Con la sesión iniciada, la barra superior tiene una **campanita**. Reúne los avisos de la cuenta.

- Con cuenta personal, los cambios de precio de los favoritos (bajó, subió, se quedó sin stock o volvió a haber stock).
- Con cuenta de comercio, los productos que SENDA eliminó de su catálogo.
- En las dos, los avisos del equipo de SENDA sobre el contenido propio (en revisión, advertencia, oculto o aprobado).

Al abrir SENDA, si hay novedades, aparece un aviso al costado derecho durante unos segundos, sin tapar la página. Después el aviso se guarda en la campanita, que muestra el número de notificaciones sin leer. Al tocarla se abre la lista. Cada aviso de precio lleva al producto, y el tilde de cada aviso lo marca como leído.

### Reportar, ocultar comercios y bloquear cuentas

Cada comentario, cada producto, cada precio de la lista "Dónde comprar" y cada perfil tienen el botón **Reportar** (una bandera). Al tocarlo se elige el motivo. Los motivos son contenido ofensivo, spam o publicidad, precio falso, producto no apto para la venta, precio que no coincide con el del local u otro motivo, según lo que se reporta. Cada cuenta reporta una sola vez lo mismo y nadie reporta lo propio. Reportan las cuentas personales y los comercios.

Cuando algo junta **3 reportes de personas distintas**, sigue visible con la etiqueta **En revisión** y el dueño recibe un aviso con los motivos la próxima vez que abre SENDA. Si un comentario o un producto tiene palabras ofensivas o es un producto no apto, queda oculto en el momento y entra con prioridad a la revisión del equipo, aunque nadie lo haya reportado.

En el perfil de un comercio, **Ocultar de mis comparaciones** saca sus precios del inicio, de los resultados y del detalle de cada producto. En el detalle aparece un aviso que recuerda qué comercios se ocultaron. En el perfil público de otra cuenta personal, **Bloquear** hace que sus comentarios dejen de verse. Las dos cosas se deshacen desde **Configuración**, en "Comercios ocultos y cuentas bloqueadas".

### Cambiar datos o eliminar la cuenta

Cada cambio pide la contraseña actual. El cambio de correo envía un enlace al correo nuevo y se aplica al abrirlo. Eliminar la cuenta borra el perfil, los favoritos, las reacciones y los comentarios, y no se puede deshacer. Si la cuenta entra con Google, el correo y la contraseña se administran desde Google, y para eliminarla se confirma con la ventana de Google.

---

## Uso para comercios

### Registrar el comercio

1. Entrar a **Registrarse**, en la barra superior.
2. Completar el nombre del comercio, el nombre del dueño o responsable, la dirección, la localidad y un teléfono de contacto.
3. Elegir una de dos formas de crear la cuenta. Con correo y contraseña, la contraseña necesita al menos 8 caracteres, con letras y números. Con **Google**, se usa la cuenta de Google y no hace falta completar correo ni contraseña.
4. Aceptar los términos y presionar **Crear cuenta**.

Cada dato mal cargado se marca en rojo debajo de su campo, y la cuenta no se crea hasta corregirlo. El nombre del comercio no puede repetirse con el de otro comercio ya registrado.

Después del registro, la cuenta queda **pendiente de validación**. Mientras tanto no se puede ingresar al panel. La administración revisa los datos y valida la cuenta. Hoy SENDA no envía un aviso automático cuando eso ocurre, por eso conviene volver a intentar el ingreso más tarde.

### Iniciar sesión y recuperar la contraseña

El ingreso se hace desde **Iniciar sesión**, con correo y contraseña o con Google. Al ingresar, la página vuelve al inicio y en la barra superior aparecen la foto y el nombre del comercio. Un clic sobre ellos abre el panel de gestión.

Si se olvidó la contraseña, el enlace **¿Olvidaste tu contraseña?** permite pedir un correo para crear una nueva. Esta opción sirve solo para cuentas creadas con correo y contraseña.

### Editar el perfil del comercio

En la parte superior del panel se modifican el nombre, el teléfono, la dirección, la localidad y el horario de atención. Los cambios se guardan con el botón **Guardar cambios**.

También se pueden cambiar la **foto** del comercio y la **imagen de fondo** del perfil. Se aceptan imágenes JPG, PNG o WEBP de hasta 5 MB. SENDA achica la imagen automáticamente antes de guardarla.

El botón **Ver perfil público** muestra el perfil tal como lo ven los clientes.

### Publicar un producto

1. Presionar **Agregar producto** en la sección "Mis productos".
2. Escribir el nombre, la marca o el código de barras en **¿Qué producto vas a publicar?**. Mientras se escribe, abajo aparecen los productos de SENDA que se parecen, con su imagen y el comercio que los cargó.
3. Si el producto está en la lista, elegirlo. Sus datos se completan solos y solo falta el precio.
4. Si no está, elegir la última opción, **Cargar "…" como producto nuevo**. El nombre escrito ya queda cargado. Completar la marca, la presentación (por ejemplo "1 kg" o "500 ml"), el código de barras (opcional), las etiquetas separadas por coma, una descripción breve y una imagen.
5. Cargar el precio, el porcentaje de descuento (de 0 a 99) y si hay stock.
6. Presionar **Publicar producto**.

El formulario muestra el precio final con el descuento aplicado antes de publicar. Con las flechas del teclado y **Enter** también se elige un producto de la lista.

Un producto nuevo queda en la lista para los demás comercios. Si otro comercio lo busca después, le aparece con la imagen y los datos ya cargados, y solo pone su precio. Así el producto aparece una sola vez en la búsqueda y los clientes comparan los precios de todos los comercios que lo venden. El comercio que lo cargó primero sigue siendo el único que puede cambiar sus datos. Los productos que el comercio ya publica aparecen en gris con la leyenda "Ya lo publicás".

### Modificar un producto, su precio o su stock

Cada producto de la lista "Mis productos" tiene tres acciones.

- **Editar producto** cambia el nombre, la marca, la presentación, las etiquetas, la descripción o la imagen. Este botón aparece solo en los productos que cargó el mismo comercio. Si el producto lo cargó otro comercio, la fila lo indica y solo se pueden cambiar el precio y el stock propios. Cuando el creador edita un producto que otros comercios también venden, el cambio se ve en todas las publicaciones.
- **Actualizar precio** cambia el precio y el descuento. La fecha de actualización se registra sola.
- **¿En stock? Sí / No** marca si el producto está disponible. Un producto sin stock sigue publicado, pero aparece al final de las comparaciones.

Los comercios no eliminan productos publicados. Para retirar uno de la venta, se marca sin stock.

### Aviso de producto eliminado por SENDA

Si la administración elimina un producto por no ser apto para la venta, la próxima vez que el comercio abre SENDA con su sesión iniciada aparece un aviso al costado, que después queda en la campanita. El aviso indica el nombre del producto y que, si se considera un error, hay que comunicarse con soporte técnico. Al marcarlo como leído, no vuelve a aparecer.

La lista tiene filtros por nombre, por ofertas, por productos sin stock y por rango de precio.

### Cerrar sesión

El botón **Cerrar sesión** está arriba a la derecha del panel.

---

## Uso para la administración y los empleados

La cuenta de administración y las cuentas de empleado entran al mismo panel de gestión. La barra superior tiene las secciones **Comercios**, **Revisión**, **Empleados** e **Historial**. Un empleado ve solo **Comercios** y, si tiene el permiso, **Revisión**. En cada sección ve solo los botones de las tareas que tiene habilitadas.

### Aceptar, rechazar, bloquear y habilitar comercios

Las cuentas de comercio se dividen en tres pestañas, cada una con su cantidad. Cada comercio ocupa un renglón con el nombre, el dueño, la dirección, el correo, el teléfono y el horario. El correo abre el programa de correo para escribirle al comercio. Al lado aparecen íconos según la pestaña.

| Pestaña | Significado | Íconos |
|---|---|---|
| Pendientes | Comercios recién registrados que esperan revisión. No pueden ingresar. | Ojo, tilde (aceptar) y tachito (rechazar). |
| Validados | Comercios habilitados. Pueden ingresar y sus precios se muestran en el sitio. | Ojo y tachito (bloquear). |
| Bloqueados | Comercios rechazados o bloqueados. No pueden ingresar y sus precios no se muestran. | Ojo, tilde (volver a habilitar) y tachito (eliminar la cuenta). |

El ojo abre el perfil del comercio en otra pestaña. El tachito pide confirmación y un motivo antes de rechazar, bloquear o eliminar. Al usar un ícono, el comercio pasa a la pestaña que corresponde y la acción queda en el historial.

### Eliminar una cuenta de comercio

Solo la administración elimina cuentas, y solo las que ya están bloqueadas. Primero se bloquea y después, en la pestaña **Bloqueados**, el tachito la elimina. Se borran el perfil del comercio, su correo guardado, todos sus precios y los productos que solo vendía ese comercio. Los productos que también venden otros comercios siguen publicados en ellos. La eliminación no se puede deshacer.

El correo y el teléfono de la cuenta eliminada quedan en una **lista de bloqueo permanente**. Si alguien se registra de nuevo con ese correo o ese teléfono, la cuenta nace bloqueada y no puede ingresar. El nombre del comercio sí se puede volver a usar.

La cuenta eliminada ya no puede entrar a SENDA. Su usuario de acceso queda registrado en Firebase Authentication, porque la página no tiene permiso para borrarlo. Si hace falta liberar ese correo, se borra a mano desde la consola de Firebase, en **Authentication → Users**.

### Revisar el perfil de un comercio, eliminar productos y cambiar el estado

El ojo de cada renglón abre el perfil del comercio, en cualquiera de los tres estados. Con la sesión de administración, el perfil muestra un recuadro con el estado de la cuenta y un botón **Eliminar producto** en cada producto.

El mismo recuadro tiene botones para cambiar el estado sin volver al panel. Si la cuenta está pendiente, aparecen **Aceptar cuenta** y **Rechazar cuenta**. Si está validada, aparece **Bloquear cuenta**. Si está bloqueada, aparecen **Volver a habilitar cuenta** y **Eliminar cuenta**. Después de eliminar una cuenta, la página vuelve al panel de administración. Un empleado ve el mismo recuadro, pero solo con los botones de sus permisos y sin **Eliminar producto** ni **Eliminar cuenta**.

Desde esta vista no se puede editar ningún dato del comercio. El botón **Eliminar producto** sirve para retirar publicaciones que no son aptas para la venta. Al confirmar, el producto deja de mostrarse en ese comercio y el comercio recibe el aviso de eliminación. Si ningún otro comercio vendía ese producto, el producto se borra de SENDA. Si otros comercios lo venden, sigue publicado en ellos.

### Empleados

En **Empleados**, el botón **Agregar empleado** pide el nombre, el correo, una contraseña inicial y los permisos. El empleado puede cambiar la contraseña desde su panel, con **Cambiar contraseña**. La tabla muestra el nombre, el correo, los permisos y la fecha de alta de cada empleado.

| Permiso | Qué habilita |
|---|---|
| Ver pendientes | Ver las solicitudes de comercios nuevos. |
| Validar | Aceptar comercios pendientes y volver a habilitar bloqueados. |
| Bloquear | Rechazar solicitudes y bloquear comercios validados. |
| Revisar reportes | Atender la lista de revisión. |

Las casillas se guardan al marcarlas. La **X** deshabilita la cuenta después de una confirmación. Un empleado deshabilitado pierde todos sus permisos, su fila pasa al final de la tabla en gris y, si ingresa, solo ve el aviso "Esta cuenta está deshabilitada" con el botón para cerrar sesión. **Volver a habilitar** devuelve el acceso sin permisos. Los empleados no se borran, para que el historial siga mostrando quién hizo cada acción.

### Revisión de reportes

La sección **Revisión** muestra lo que tiene 3 reportes o fue marcado por palabras no permitidas. Primero aparece lo marcado con prioridad y después lo que tiene más reportes. Cada tarjeta indica qué es, los motivos, cuántos reportes tiene y si está oculto o visible. **Ver lo que escribió cada persona** muestra el detalle de cada reporte y **Ver** abre el contenido.

| Decisión | Qué pasa |
|---|---|
| Aprobar | Se quita la etiqueta "En revisión" y el contenido vuelve a verse si estaba oculto. |
| Advertir | El contenido sigue visible y el dueño recibe una advertencia con el motivo. |
| Ocultar o Borrar | Un comentario se borra. Un producto, un precio o una cuenta dejan de mostrarse. |
| Bloquear la cuenta | El empleado lo pide y el pedido le llega a la administración, que lo ve primero en la lista y decide si bloquea la cuenta. |

Cada decisión pide un motivo, se le avisa al dueño y queda en el historial.

### Historial de moderación

Solo la administración ve el **Historial**. Cada fila indica la fecha y la hora, quién hizo la acción (nombre y correo), la acción, sobre qué cuenta o contenido, el motivo y desde dónde se hizo (panel de validación, perfil del comercio, lista de revisión o sección Empleados). El selector **Mostrar acciones de** filtra por persona. Las acciones no se pueden editar ni borrar.

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

**Un comentario o un producto quedó "oculto y en revisión" al publicarlo.**
Tiene palabras no permitidas o es un producto no apto para la venta. El equipo de SENDA lo revisa y, si está bien, lo aprueba.

**La cuenta nueva aparece bloqueada al registrarse.**
El correo o el teléfono pertenecen a una cuenta que la administración eliminó por no cumplir las normas. Hay que comunicarse con soporte técnico.

**La imagen no se pudo guardar.**
La imagen tiene que ser JPG, PNG o WEBP y pesar menos de 5 MB. Si tiene demasiado detalle, conviene recortarla o usar otra.
