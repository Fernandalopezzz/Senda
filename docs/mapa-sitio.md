# Mapa del sitio · SENDA

## Páginas públicas (sin cuenta)

| Página | Archivo | Contenido |
|---|---|---|
| Inicio | `index.html` | Buscador, precios destacados, ofertas, cómo funciona y acceso para comercios. |
| Resultados | `resultados.html` | Resultados de la búsqueda. Si el texto coincide con un comercio, su cuenta aparece primero. También muestra ofertas, favoritos y la lista de comercios. |
| Perfil del comercio | `perfil-comercio.html?id=...` | Datos de contacto, foto, fondo y catálogo del comercio, con filtros. |
| Detalle de producto | `detalle-producto.html?id=...` | Mejor precio, comercios que lo venden y productos similares. |

## Acceso de comercios

| Página | Archivo | Contenido |
|---|---|---|
| Iniciar sesión | `login.html` | Ingreso con correo o Google. Incluye la recuperación de contraseña. |
| Registro | `registro-comercio.html` | Alta del comercio con nombre, dueño, dirección, teléfono, correo y contraseña. Queda pendiente de validación. |

## Cuentas personales

| Página | Archivo | Contenido |
|---|---|---|
| Crear cuenta | `crear-cuenta.html` | Elección entre cuenta personal y cuenta de comercio. |
| Registro personal | `registro-personal.html` | Nombre, nombre de usuario, correo y contraseña, o Google. |
| Cuenta personal | `perfil-usuario.html` (rol `cliente`) | Barra lateral con tres secciones. "Mi perfil" (`#perfil`) muestra lo que ven los demás y los comentarios publicados. "Mis favoritos" (`#favoritos`) es privada, con buscador y avisos de precio. "Configuración" (`#configuracion`) tiene avisos, modo oscuro, idioma y datos de acceso. "Cerrar sesión" está en el encabezado. |
| Perfil público | `usuario.html?id=...` | Nombre de usuario, foto y comentarios de una cuenta personal. Se abre al tocar el autor de un comentario. |
| Ayuda | `ayuda.html` | Preguntas frecuentes, términos y condiciones, política de privacidad, defensa del consumidor y contacto. Se abre desde el pie de todas las páginas y desde "Ayuda" en el panel del comercio. |

El detalle de producto (`detalle-producto.html`) muestra la presentación, las etiquetas y los botones "Me gusta" y "No me gusta". Al final de "Dónde comprar" está el botón "Ver comentarios". Con `#comentarios` en la dirección, los comentarios se abren solos.

El inicio (`index.html`) ordena las secciones así: buscador, novedades de los favoritos (solo con cuenta personal), Recomendados, Para vos, Compará precios y Ofertas y descuentos.

## Gestión (con cuenta)

| Página | Archivo | Contenido |
|---|---|---|
| Panel del comercio | `gestion-comercio.html` (rol `comercio`) | Edición del perfil, foto y fondo. Alta y edición de productos, precios, descuentos y stock. |
| Validación de comercios | `gestion-comercio.html` (rol `admin`) | Pestañas Pendientes, Validados y Bloqueados, con su cantidad. Cada comercio es un renglón con comercio, dueño, dirección, correo, teléfono y horario, e íconos para ver el perfil, aceptar o habilitar (tilde) y rechazar o bloquear (tachito). |
| Perfil visto por el administrador | `perfil-comercio.html?id=...` (rol `admin`) | El perfil y los productos de cualquier comercio, también pendiente o bloqueado. No permite editar datos. Permite eliminar un producto no apto para la venta y cambiar el estado de la cuenta (aceptar, rechazar, bloquear, habilitar o eliminar). |

## Navegación

- La barra pública tiene Inicio, Precios Destacados y Ofertas, más Iniciar sesión y Registrarse.
- Desde los resultados se entra al perfil del comercio o al detalle de un producto.
- Desde el detalle se vuelve a los resultados o se entra al perfil de cada comercio.
- Al iniciar sesión, la cuenta vuelve al inicio. En la barra, en lugar de "Iniciar sesión / Registrarse", aparecen la foto y el nombre del comercio (o "Administración"). Con un clic ahí se abre `gestion-comercio.html`, que muestra el panel según el rol y tiene el botón "Cerrar sesión".
