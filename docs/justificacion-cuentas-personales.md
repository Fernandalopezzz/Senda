# Justificación de las cuentas personales · SENDA

SENDA es un comparador de precios. No vende productos, no cobra y no gestiona envíos. Cada decisión de este documento se evaluó con esa idea como criterio. Una función entra al sitio solo si ayuda al cliente a decidir dónde comprar o a enterarse de que un precio cambió.

## Cuenta opcional para el cliente

Buscar, comparar, ver ofertas y consultar comercios sigue abierto para cualquier visitante, sin registro. Pedir una cuenta para comparar precios agregaría un paso que no aporta nada a esa tarea y alejaría a quien solo quiere saber dónde está más barato un producto.

La cuenta personal existe para lo que necesita una identidad o una memoria entre visitas. Sirve para guardar favoritos en cualquier dispositivo, recibir avisos de precio y opinar con un nombre visible. Por eso, al crear una cuenta, el sitio ofrece dos caminos separados. Uno es la cuenta personal, para comprar. El otro es la cuenta de comercio, para publicar precios. El inicio de sesión es el mismo formulario para las dos, porque el sistema reconoce el tipo de cuenta por su rol.

La cuenta personal no necesita validación de la administración. Un cliente no publica precios ni datos de un local, por eso no hay nada que verificar antes de habilitarla. La cuenta de comercio sí se valida, porque sus datos los ven todos los clientes.

## Organización de la cuenta personal

La cuenta tiene una barra lateral con solo tres secciones, "Mi perfil", "Mis favoritos" y "Configuración". Cada una responde a una pregunta distinta del cliente. "Mi perfil" muestra cómo lo ven los demás. "Mis favoritos" muestra lo que sigue de cerca. "Configuración" agrupa cómo funciona el sitio para esa persona. Menos secciones hacen que cada cosa se encuentre en un solo lugar.

"Cerrar sesión" está en el encabezado, arriba a la derecha, igual que en el panel de los comercios. Así la acción queda en el mismo lugar para cualquier tipo de cuenta y no se confunde con una sección del perfil.

No se incluyó un historial de búsqueda visible. Las búsquedas se usan para armar "Para vos", pero mostrarlas como lista no ayuda a comparar precios y expone un dato personal a quien mire la pantalla.

## Perfil público y perfil propio

"Mi perfil" muestra lo mismo que ve cualquier persona al tocar un nombre de usuario en un comentario, que es la foto, el nombre de usuario y los comentarios publicados. A eso suma el nombre real y el correo, marcados como "Solo vos lo ves". Así el cliente sabe exactamente qué datos suyos son públicos.

Cada comentario del perfil indica en qué producto se publicó y, si corresponde, sobre qué comercio. El enlace lleva al producto con los comentarios abiertos. Un comentario sin su producto no tiene sentido en un comparador, porque lo útil es saber a qué precio se refiere.

Ver el perfil de otro cliente sirve para valorar sus comentarios. Si alguien publicó varios avisos acertados sobre precios, sus próximos comentarios merecen más confianza. Por eso el perfil público muestra solo los comentarios y no los favoritos, que son una lista privada.

## Datos que se piden y datos que no

El registro personal pide nombre, nombre de usuario, correo y contraseña. No pide dirección, teléfono, horario, documento ni datos de pago. Esos datos tienen sentido en un comercio, que necesita que lo encuentren. En un cliente no se usan para nada, y guardarlos solo agregaría riesgo.

El nombre real se guarda aparte, en un documento que solo lee su dueño. Los demás ven únicamente el nombre de usuario y la foto. No hace falta conocer el nombre real de alguien para aprovechar su aviso de que una oferta terminó.

El nombre de usuario es lo que los demás clientes ven junto a cada comentario. No se puede cambiar, para que nadie publique con un nombre y después lo cambie para despegarse de lo que escribió. El nombre y la foto sí se pueden modificar desde el perfil.

El correo no se guarda en Firestore. Queda en Firebase Authentication y solo aparece en el perfil de su dueño, marcado como "Solo vos lo ves". Así, aunque la colección de perfiles es pública para mostrar autores de comentarios, ningún correo queda expuesto.

## Favoritos en la cuenta

Sin cuenta, los favoritos se guardan en el navegador, igual que antes. Con cuenta, la misma lista se guarda también en Firestore y aparece en cualquier computadora donde se inicie sesión. Al iniciar sesión, los favoritos guardados sin cuenta se suman a los de la cuenta, para que no se pierda nada.

El perfil incluye un buscador de favoritos. Con muchos productos guardados, encontrar uno recorriendo tarjetas es lento.

## Avisos de cambio de precio

Es la función que más justifica tener una cuenta en un comparador. Un cliente guarda un producto porque le interesa su precio. Si ese precio baja, conviene que se entere. Si sube, también, para no ir al comercio con un dato viejo.

Para cada favorito, SENDA guarda el mejor precio que el cliente ya vio. Cuando el cliente vuelve a abrir el sitio con su sesión iniciada, se compara ese valor con el mejor precio actual entre los comercios validados con stock. Si cambió, aparece un número rojo sobre su foto en la barra, un aviso flotante una vez por visita y una lista en su perfil. Esa lista dice si el precio bajó, si subió, si ningún comercio tiene stock o si volvió a haber stock. Al presionar "Entendido", el precio actual pasa a ser la nueva referencia.

El aviso se calcula en el navegador al abrir el sitio. SENDA usa el plan gratuito de Firebase, que no incluye funciones en el servidor ni envío de correos programados. Esta solución no tiene costo y cumple el objetivo. Su límite es que el cliente se entera al entrar, no en el momento exacto del cambio.

Los avisos se pueden apagar desde Configuración. Una persona que guarda productos solo para encontrarlos rápido puede no querer avisos, y forzarlos haría que deje de prestarles atención.

## Configuración

El **modo oscuro** cambia los fondos blancos por grises oscuros y los textos oscuros por grises claros. Mantiene el azul de la marca, el verde de los precios y el rojo de las alertas, para que los precios se sigan leyendo igual. Reduce el brillo de la pantalla de noche, que es cuando muchas personas planean las compras del día siguiente. Se guarda en el dispositivo y no en la cuenta, porque depende de la pantalla y del momento. Una persona puede quererlo en la computadora de su casa y no en la del trabajo.

El **idioma** se muestra en una tarjeta centrada, con español habilitado y otros idiomas en gris y cursiva, marcados como "No disponible por el momento". El sitio todavía no tiene traducciones, y mostrar las opciones deshabilitadas deja claro que la función está prevista sin prometer algo que no funciona.

No se incluyó la **ubicación**. SENDA compara comercios de una misma ciudad, y el botón "Cómo llegar" de cada comercio ya abre el mapa desde donde esté la persona. Guardar su ubicación sería un dato sensible sin uso.

## Inicio con recomendaciones

El inicio ordena las secciones de lo general a lo personal. Primero va el buscador, porque es lo que la mayoría viene a usar. Después, "Recomendados" muestra los productos con el precio más bajo, que le sirven a cualquier visitante sin que tenga que elegir nada.

"Para vos" toma las últimas búsquedas y los últimos productos vistos, y para cada uno sugiere la opción con más descuento y stock. Si alguien miró una yerba cara, se le ofrece la yerba con la mejor oferta. Es la misma lógica del comparador aplicada a lo que la persona ya mostró que necesita. El historial se guarda solo en el navegador y se puede borrar desde el menú de tres puntos.

No se muestra "lo más buscado" entre todos los usuarios. Para calcularlo habría que registrar en el servidor qué busca cada persona, y ese dato no hace falta para comparar precios.

Después siguen "Compará precios", con un ejemplo del funcionamiento del sitio, y "Ofertas y descuentos", como antes.

## Me gusta y no me gusta

La reacción es la forma más rápida de opinar sobre un producto, con un solo clic. El contador le da al siguiente cliente una idea general de cómo lo valoran otros compradores antes de leer los comentarios. Cada cuenta tiene una sola reacción por producto, y tocar el mismo botón otra vez la quita. Así nadie infla el contador.

## Comentarios

Los precios de SENDA los carga cada comercio y pueden quedar desactualizados. El primero en notarlo es el cliente que fue al local. Si encontró que la oferta terminó, que el precio era otro o que no había stock, un comentario le ahorra el viaje al próximo cliente y lo orienta hacia el comercio que sí conviene.

Los comentarios aparecen al final de la comparación de precios, con el botón "Ver comentarios". Primero se lee el dato objetivo, que es el precio en cada comercio, y después la experiencia de otros clientes. Así los comentarios complementan la comparación y no la tapan.

Por eso cada comentario puede indicar de qué comercio habla, con un selector que lista los comercios que venden el producto. Un comentario como "En Austral la oferta ya no está" es más útil que uno general, porque el lector sabe exactamente qué precio poner en duda. Esa etiqueta se muestra junto al comentario.

Los comentarios tienen un límite de 300 caracteres. Alcanza para avisar algo concreto y evita reseñas largas que no ayudan a comparar.

Solo las cuentas personales pueden comentar y reaccionar. Los comercios no opinan, para que ninguno se ponga buenas opiniones a sí mismo ni malas a la competencia. Los visitantes leen todo, pero para publicar necesitan una cuenta, así cada comentario tiene un autor identificable.

## Moderación

Un espacio de comentarios abierto necesita control. El autor puede borrar sus propios comentarios desde el detalle del producto o desde su perfil. La administración puede borrar cualquier comentario que no cumpla las normas, con el tachito que ve en cada comentario cuando tiene la sesión iniciada. Los comentarios no se editan, para que una respuesta de otro cliente no quede fuera de contexto.

## Gestión de la cuenta

Desde el perfil, el cliente puede cambiar su correo, cambiar su contraseña y eliminar su cuenta. Cada una de estas acciones pide la contraseña actual, porque si alguien deja la sesión abierta en un equipo compartido, otra persona no debería poder tomar la cuenta.

El cambio de correo envía un enlace al correo nuevo, y el cambio se aplica cuando se abre ese enlace. Así se confirma que el correo existe y pertenece a quien lo pide.

La eliminación borra el perfil, los favoritos, las reacciones, los comentarios y la cuenta de acceso. La Ley 25.326 de Protección de Datos Personales reconoce el derecho de una persona a pedir la supresión de sus datos. Ofrecerlo desde el propio perfil cumple ese derecho sin depender de un pedido por correo.

Si la cuenta entra con Google, el correo y la contraseña los administra Google. En ese caso el perfil lo indica y solo ofrece eliminar la cuenta, confirmando la identidad con la ventana de Google.

## Funciones que se dejaron afuera

- **Carrito, compra o pago.** SENDA no vende. La compra ocurre en el comercio.
- **Mensajes privados entre clientes o con comercios.** No ayudan a comparar precios y exigen una moderación mucho más costosa.
- **Calificación de comercios con estrellas.** El objetivo es comparar precios, no puntuar locales. Los comentarios con comercio indicado ya cubren el caso útil, que es avisar de un precio que no coincide.
- **Dirección o ubicación del cliente.** No se usa para nada. El botón "Cómo llegar" de cada comercio abre el mapa sin necesidad de guardar dónde vive el cliente.
- **Historial de búsqueda visible.** Se usa internamente para "Para vos", pero no se muestra como sección.
