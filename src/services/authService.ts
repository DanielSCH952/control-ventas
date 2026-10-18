import { signInAnonymously, onAuthStateChanged, type Unsubscribe, type User } from 'firebase/auth';

import { auth } from './firebase';

/**
 * Devuelve el usuario actual o crea una sesión anónima si no existe ninguna.
 * No genera una nueva identidad cuando ya hay una sesión activa.
 *
 * Los errores se propagan para que la interfaz pueda mostrarlos.
 */
export async function authenticateUser(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const result = await signInAnonymously(auth);

  return result.user;
}

/**
 * Observa el estado de autenticación. El primer evento incluye la sesión
 * anónima restaurada desde AsyncStorage, si existe. Devuelve una función
 * para cancelar la suscripción.
 */
export function observeAuthState(onUser: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, onUser);
}
