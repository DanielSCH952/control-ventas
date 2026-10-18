import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type DocumentData } from 'firebase/firestore';

import type { UserProfile } from '@/types/User';

import { db } from './firebase';
import { AppError } from './errors';
import { parseDate } from './firestore-utils';

export const USER_NAME_MIN_LENGTH = 1;
export const USER_NAME_MAX_LENGTH = 50;

/**
 * Valida el nombre del usuario: recorta espacios y rechaza nombres vacíos
 * o demasiado largos. Devuelve el nombre normalizado o lanza AppError con
 * un mensaje apto para la interfaz.
 */
export function validateUserName(rawName: string): string {
  const name = rawName.trim();
  if (name.length < USER_NAME_MIN_LENGTH) {
    throw new AppError('Escribe tu nombre para continuar.', 'invalid-user-name');
  }
  if (name.length > USER_NAME_MAX_LENGTH) {
    throw new AppError(
      `El nombre no puede superar ${USER_NAME_MAX_LENGTH} caracteres.`,
      'invalid-user-name',
    );
  }
  return name;
}

function toProfile(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    name: typeof data.name === 'string' ? data.name : '',
    businessId: typeof data.businessId === 'string' ? data.businessId : null,
    createdAt: parseDate(data.createdAt),
    updatedAt: parseDate(data.updatedAt),
  };
}

/**
 * Recupera el perfil del usuario desde `users/{uid}`.
 * Devuelve null si todavía no existe el documento.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    if (!snapshot.exists()) {
      return null;
    }
    return toProfile(uid, snapshot.data());
  } catch (error) {
    console.warn('[userService] Error al leer el perfil:', error);
    throw new AppError('No pudimos recuperar tu perfil. Revisa tu conexión.', 'profile-read-failed');
  }
}

/**
 * Guarda o actualiza el nombre del usuario en `users/{uid}`.
 * No sobrescribe `businessId` si el usuario ya pertenece a un negocio.
 * Devuelve el perfil actualizado.
 */
export async function saveUserName(uid: string, rawName: string): Promise<UserProfile> {
  const name = validateUserName(rawName);

  try {
    const profileRef = doc(db, 'users', uid);
    const snapshot = await getDoc(profileRef);

    if (snapshot.exists()) {
      await updateDoc(profileRef, { name, updatedAt: serverTimestamp() });
    } else {
      await setDoc(profileRef, {
        uid,
        name,
        businessId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const profile = await getUserProfile(uid);
    if (!profile) {
      throw new Error('El perfil no existe después de guardarlo.');
    }
    return profile;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[userService] Error al guardar el perfil:', error);
    throw new AppError('No pudimos guardar tu nombre. Revisa tu conexión e inténtalo de nuevo.', 'profile-write-failed');
  }
}
