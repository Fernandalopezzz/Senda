# Flujos de usuario · SENDA

## Cliente: buscar y comparar un producto

1. Entra a `index.html` y escribe el nombre del producto en el buscador.
2. `resultados.html` muestra los productos encontrados con el precio más bajo y la cantidad de comercios.
3. Si no encuentra el producto, hace una búsqueda nueva desde el mismo buscador.
4. Entra al detalle del producto y compara precio y stock en cada comercio.
5. Entra al perfil del comercio elegido para ver dirección, horario y contacto.

## Cliente: ver la cuenta de un comercio

1. Escribe el nombre del comercio en el buscador.
2. En `resultados.html` la cuenta del comercio aparece primero.
3. Con "Ver comercio" entra a `perfil-comercio.html` y ve todos los productos que publicó.

## Cliente: crear una cuenta personal y opinar

1. Presiona "Registrarse" y elige "Cuenta personal".
2. Completa nombre, nombre de usuario, correo y contraseña, o usa Google. La cuenta queda activa al instante.
3. Guarda productos con el corazón. La lista queda en su cuenta.
4. En el detalle de un producto da "Me gusta" o "No me gusta" y puede comentar, indicando de qué comercio habla.
5. Al volver a entrar, si cambió el mejor precio de un favorito, ve un número rojo sobre su foto y el aviso en su perfil.

## Comercio: registrarse

1. Entra a `registro-comercio.html` y completa nombre del comercio, dueño, dirección, teléfono, correo y contraseña. Cada dato mal cargado se marca en rojo y la cuenta no se crea hasta corregirlo.
2. La cuenta queda con rol `pendiente`. Si intenta iniciar sesión, ve el aviso de validación pendiente.
3. Un administrador revisa los datos en la pestaña "Pendientes" de `gestion-comercio.html` y acepta la solicitud con el tilde o la rechaza con el tachito. Más tarde puede bloquear un comercio validado, volver a habilitar uno bloqueado o eliminar una cuenta bloqueada. También puede hacerlo desde el perfil del comercio, con los botones del recuadro de administración.

## Comercio: administrar productos

1. Inicia sesión en `login.html` y entra a `gestion-comercio.html`.
2. Decide si agrega un producto nuevo o modifica uno existente.
3. Producto nuevo: elige uno que ya existe en SENDA o carga uno nuevo con su imagen, y define precio, descuento y stock.
4. Producto existente: cambia el precio o el stock desde la lista "Mis productos". Si el producto lo cargó su comercio, también puede cambiar nombre, marca, descripción e imagen.
5. Los cambios se guardan en Firestore y se ven en las páginas públicas al abrirlas o recargarlas.

## Administrador: revisar un comercio y eliminar un producto

1. Inicia sesión como administrador.
2. Entra al perfil del comercio desde el sitio (listado "Comercios") o, si la solicitud está pendiente, con el ícono del ojo en su panel.
3. Ve el perfil y el catálogo del comercio, con un recuadro que indica el estado de la cuenta. No puede editar datos.
4. Si un producto no es apto para la venta, presiona "Eliminar producto" y confirma.
5. La próxima vez que el comercio abre SENDA con su sesión, ve el aviso "Este producto ha sido eliminado por SENDA" con la indicación de comunicarse con soporte técnico si cree que fue un error.
