// Palabras que mandan un texto a revisión automáticamente, sin esperar reportes.
//
// Se revisan los comentarios y los datos de los productos (nombre, marca, descripción y etiquetas).
// Si aparece una de estas palabras, el contenido se guarda igual, pero queda oculto y entra primero
// en la lista de revisión del equipo. No se borra ni se bloquea a nadie: lo decide una persona.
//
// La comparación no distingue mayúsculas ni tildes, y reconoce letras cambiadas por números
// ("1d10ta") o repetidas ("bolüuudo"). Solo cuenta palabras enteras, así "computadora"
// no coincide con "puta". Las listas se pueden ampliar sin cambiar nada más.

// Insultos y expresiones ofensivas.
const OFENSIVAS = [
  "boludo", "boluda", "pelotudo", "pelotuda", "forro", "forra", "idiota", "imbecil", "estupido", "estupida",
  "tarado", "tarada", "mogolico", "mogolica", "pajero", "pajera", "culiado", "culiada", "puto", "puta",
  "mierda", "conchudo", "conchuda", "hdp", "hijo de puta", "la concha", "garca", "chorro", "chorros",
  "ladron", "ladrones", "estafador", "estafadores", "basura", "inutil", "inutiles", "negro de mierda",
  "trolo", "trola", "sorete", "cagon", "lacra", "rata", "ratas"
];

// Productos que no se pueden publicar en un comparador de comercios de barrio.
const NO_APTOS = [
  "arma de fuego", "pistola", "revolver", "municion", "municiones", "cocaina", "marihuana", "porro",
  "faso", "merca", "falopa", "droga", "drogas", "medicamento con receta", "psicofarmaco", "clonazepam",
  "rivotril", "alplax", "explosivo", "explosivos", "pirotecnia"
];

// Pasa a minúsculas, saca tildes, cambia números por letras y junta letras repetidas.
export function normalizarParaRevision(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/[^a-zñ\s]/g, " ")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Las listas también se normalizan, así una palabra con letras dobles ("garrca") coincide igual.
const PREPARADAS = {
  ofensivo: OFENSIVAS.map(normalizarParaRevision),
  noApto: NO_APTOS.map(normalizarParaRevision)
};

function encontradas(textoNormalizado, lista) {
  const conEspacios = ` ${textoNormalizado} `;
  return lista.filter((palabra) => conEspacios.includes(` ${palabra} `));
}

// Revisa uno o varios textos. Devuelve { ofensivo, noApto, motivo }.
// motivo: texto para el equipo, por ejemplo "Palabras no permitidas: idiota".
export function revisarTexto(...textos) {
  const normalizado = normalizarParaRevision(textos.flat().join(" "));
  const ofensivas = encontradas(normalizado, PREPARADAS.ofensivo);
  const noAptas = encontradas(normalizado, PREPARADAS.noApto);
  const partes = [];
  if (ofensivas.length) partes.push(`Palabras no permitidas: ${ofensivas.join(", ")}`);
  if (noAptas.length) partes.push(`Producto no apto: ${noAptas.join(", ")}`);
  return { ofensivo: ofensivas.length > 0, noApto: noAptas.length > 0, motivo: partes.join(". ") };
}
