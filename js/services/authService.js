// Operaciones de Firebase Authentication.

import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  verifyBeforeUpdateEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { auth, firebaseConfigurado } from "../config/firebase.js";
import { ErrorSenda } from "../core/errores.js";

export function verificarConfiguracion() {
  if (!firebaseConfigurado) throw new ErrorSenda("senda/sin-configuracion");
}

export async function iniciarSesion(email, password) {
  verificarConfiguracion();
  const credencial = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credencial.user;
}

export async function iniciarSesionConGoogle() {
  verificarConfiguracion();
  const proveedor = new GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: "select_account" });
  const credencial = await signInWithPopup(auth, proveedor);
  return credencial.user;
}

export async function registrarConEmail(email, password) {
  verificarConfiguracion();
  const credencial = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return credencial.user;
}

// Se usa para deshacer un registro que no pudo terminar de guardar sus datos en Firestore.
export function eliminarCuentaActual() {
  return auth.currentUser ? deleteUser(auth.currentUser) : Promise.resolve();
}

// Clave donde la barra guarda el nombre y la foto de la última cuenta (ver sessionGuard.js).
export const CLAVE_CUENTA_BARRA = "senda:cuenta-barra";

export function olvidarCuentaDeLaBarra() {
  try {
    localStorage.removeItem(CLAVE_CUENTA_BARRA);
  } catch {
    // Sin localStorage no hay nada guardado.
  }
}

export function cerrarSesion() {
  olvidarCuentaDeLaBarra();
  return signOut(auth);
}

export async function enviarEnlaceRecuperacion(email) {
  verificarConfiguracion();
  await sendPasswordResetEmail(auth, email.trim());
}

// Devuelve el usuario autenticado una vez que Firebase terminó de restaurar la sesión.
export function obtenerUsuarioActual() {
  return new Promise((resolve) => {
    const desuscribir = onAuthStateChanged(auth, (usuario) => {
      desuscribir();
      resolve(usuario);
    });
  });
}

export function observarSesion(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------- Datos de acceso de la cuenta con sesión iniciada ----------
// Cambiar el correo, la contraseña o eliminar la cuenta son operaciones sensibles.
// Firebase exige haber ingresado hace poco, por eso antes se vuelve a pedir la contraseña
// (o se abre de nuevo la ventana de Google si la cuenta usa Google).

export function correoActual() {
  return auth.currentUser?.email ?? "";
}

// true si la cuenta entra con correo y contraseña. false si entra solo con Google.
export function usaContrasena() {
  return Boolean(auth.currentUser?.providerData.some((p) => p.providerId === "password"));
}

export async function reautenticar(passwordActual = "") {
  const usuario = auth.currentUser;
  if (usaContrasena()) {
    const credencial = EmailAuthProvider.credential(usuario.email, passwordActual);
    await reauthenticateWithCredential(usuario, credencial);
  } else {
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: "select_account" });
    await reauthenticateWithPopup(usuario, proveedor);
  }
}

// Firebase envía un enlace al correo nuevo. El cambio se aplica cuando la persona lo abre,
// así nadie puede poner un correo ajeno en su cuenta.
export function cambiarCorreo(correoNuevo) {
  return verifyBeforeUpdateEmail(auth.currentUser, correoNuevo.trim());
}

export function cambiarContrasena(passwordNueva) {
  return updatePassword(auth.currentUser, passwordNueva);
}

export function eliminarUsuarioActual() {
  olvidarCuentaDeLaBarra();
  return deleteUser(auth.currentUser);
}
