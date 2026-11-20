// Preparación de imágenes para guardarlas en Cloud Firestore.
// El proyecto usa el plan gratuito de Firebase (Spark), que no incluye Cloud Storage.
// Por eso cada imagen se achica en el navegador, se convierte a JPG y se guarda como texto
// (data URL) en el mismo documento: productos.imagen, comercios.foto y comercios.fondo.
// Así queda guardada en Firebase y la ven todos los visitantes, sin pedir una tarjeta.

import { ErrorSenda } from "../core/errores.js";

// Medida máxima de cada tipo de imagen y largo máximo del texto que se guarda.
// Los largos coinciden con los límites de firestore.rules.
// Las medidas son chicas a propósito: cada página descarga todas las imágenes del catálogo junto con
// los datos. Con 480 px una imagen de producto ocupa unos 25 KB en lugar de 50 KB, y la página
// carga casi el doble de rápido en conexiones lentas. En pantalla se ven igual de nítidas.
const MEDIDAS = Object.freeze({
  producto: { ancho: 480, alto: 480, maximo: 250000 },
  foto: { ancho: 320, alto: 320, maximo: 90000 },
  fondo: { ancho: 1100, alto: 420, maximo: 300000 }
});

const CALIDADES = [0.75, 0.65, 0.55, 0.45, 0.38];

// archivo: File o Blob de una imagen. tipo: "producto", "foto" o "fondo".
// Devuelve un data URL JPG listo para guardar en Firestore.
export async function prepararImagen(archivo, tipo) {
  const medida = MEDIDAS[tipo];
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, medida.ancho / imagen.width, medida.alto / imagen.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const contexto = lienzo.getContext("2d");
  // Fondo blanco para las imágenes PNG con transparencia.
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  // Se baja la calidad hasta que el texto entra en el límite.
  for (const calidad of CALIDADES) {
    const url = lienzo.toDataURL("image/jpeg", calidad);
    if (url.length <= medida.maximo) return url;
  }
  throw new ErrorSenda("senda/imagen-grande");
}
