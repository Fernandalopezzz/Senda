// Página de ayuda: preguntas frecuentes, términos, privacidad, defensa del consumidor y contacto.
// Es texto fijo. Solo prepara la barra superior para mostrar la sesión iniciada.

import { prepararBarraPublica } from "../guards/sessionGuard.js";

prepararBarraPublica(document.getElementById("barra-publica"));
