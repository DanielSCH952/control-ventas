import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';

import type { Business } from '@/types/Business';

import { db } from './firebase';
import { AppError } from './errors';
import { parseDate } from './firestore-utils';

export const BUSINESS_NAME_MAX_LENGTH = 60;

// Alfabeto sin caracteres visualmente confusos (sin 0/O, 1/I/L).
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_REGEX = /^[A-HJKMNP-Z2-9]{6}$/;

const MAX_CODE_ATTEMPTS = 5;

/**
 * Valida el nombre del negocio: recorta espacios y rechaza nombres vacíos
 * o demasiado largos. Devuelve el nombre normalizado o lanza AppError.
 */
export function validateBusinessName(rawName: string): string {
  const name = rawName.trim();
  if (name.length < 1) {
    throw new AppError('Escribe el nombre del negocio para continuar.', 'invalid-business-name');
  }
  if (name.length > BUSINESS_NAME_MAX_LENGTH) {
    throw new AppError(
      `El nombre del negocio no puede superar ${BUSINESS_NAME_MAX_LENGTH} caracteres.`,
      'invalid-business-name',
    );
  }
  return name;
}

/**
 * Normaliza un código de invitación: elimina espacios y guiones y lo
 * convierte a mayúsculas, de modo que " ab-cdef " y "ABCDEF" sean iguales.
 */
export function normalizeJoinCode(rawCode: string): string {
  return rawCode.trim().replace(/[\s-]/g, '').toUpperCase();
}

function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

function toBusiness(id: string, data: DocumentData): Business {
  return {
    id,
    name: data.name,
    joinCode: data.joinCode,
    createdBy: data.createdBy,
    createdAt: parseDate(data.createdAt),
  };
}

/**
 * Recupera un negocio por su identificador.
 * Devuelve null si no existe o si las reglas de seguridad no permiten leerlo.
 */
export async function getBusinessById(businessId: string): Promise<Business | null> {
  try {
    const snapshot = await getDoc(doc(db, 'businesses', businessId));
    if (!snapshot.exists()) {
      return null;
    }
    return toBusiness(snapshot.id, snapshot.data());
  } catch (error) {
    console.warn('[businessService] Error al leer el negocio:', error);
    throw new AppError('No pudimos recuperar el negocio. Revisa tu conexión.', 'business-read-failed');
  }
}

/**
 * Busca el identificador del negocio asociado a un código de invitación.
 * La consulta se hace sobre `joinCodes/{code}`, que solo expone el
 * businessId correspondiente, sin permitir listar todos los negocios.
 *
 * Nota: el documento del negocio solo se puede leer una vez que el usuario
 * es miembro; por eso esta función no lo devuelve.
 */
export async function findBusinessIdByJoinCode(rawCode: string): Promise<string> {
  const code = normalizeJoinCode(rawCode);
  if (!JOIN_CODE_REGEX.test(code)) {
    throw new AppError(
      'El código no parece válido. Debe tener 6 caracteres (letras y números).',
      'invalid-join-code',
    );
  }

  try {
    const joinCodeSnapshot = await getDoc(doc(db, 'joinCodes', code));
    if (!joinCodeSnapshot.exists()) {
      throw new AppError(
        'No encontramos un negocio con ese código. Verifícalo e inténtalo de nuevo.',
        'join-code-not-found',
      );
    }
    return joinCodeSnapshot.data().businessId as string;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[businessService] Error al buscar por código:', error);
    throw new AppError(
      'No pudimos buscar el negocio. Revisa tu conexión e inténtalo de nuevo.',
      'join-code-lookup-failed',
    );
  }
}


/**
 * Crea un negocio y la membresía de propietario.
 *
 * Sprint 6 — idempotencia y recuperación: el identificador del negocio es un
 * `attemptId` ESTABLE que genera la pantalla UNA vez por intento (ver
 * `create-business.tsx` e `ids.ts`). Si la conexión se pierde después de
 * crear el documento del negocio pero antes de confirmar el batch, un
 * reintento con el MISMO `attemptId` detecta el documento existente y solo
 * completa las piezas que falten (membresía, código, perfil). Un mismo
 * intento jamás crea un segundo negocio.
 *
 * Nota sobre atomicidad: las reglas de seguridad de Firestore se evalúan
 * contra el estado previo de la base de datos, por lo que la membresía y
 * el código de invitación no pueden validarse en la misma transacción en
 * la que nace el documento del negocio. El flujo es:
 *   1) Se crea el documento del negocio (único paso no atómico).
 *   2) Un batch atómico crea: membresía del propietario, `joinCodes/{code}`
 *      y actualiza `users/{uid}.businessId`.
 * Si el paso 2 falla, no se muestra éxito y el usuario puede reintentarlo
 * sin riesgo de duplicar el negocio. Si en un reintento el nombre difiere
 * del ya guardado, prevalece el nombre almacenado en el paso 1.
 *
 * @returns el negocio creado, con su código de invitación.
 */
export async function createBusiness(params: {
  uid: string;
  userName: string;
  businessName: string;
  attemptId: string;
}): Promise<Business> {
  const name = validateBusinessName(params.businessName);
  const attemptId = params.attemptId.trim();
  if (!attemptId) {
    throw new AppError(
      'No pudimos crear el negocio. Inténtalo de nuevo.',
      'business-create-attempt-missing',
    );
  }

  try {
    const businessRef = doc(collection(db, 'businesses'), attemptId);
    const existingSnapshot = await getDoc(businessRef);

    let businessNameToUse = name;
    let joinCode = '';

    if (existingSnapshot.exists()) {
      // Recuperación de un intento anterior: el documento ya nació. Solo el
      // creador original puede completarlo; cualquier otro caso se aborta.
      const existing = existingSnapshot.data() as {
        name?: unknown;
        joinCode?: unknown;
        createdBy?: unknown;
      };
      if (
        existing.createdBy !== params.uid ||
        typeof existing.name !== 'string' ||
        typeof existing.joinCode !== 'string'
      ) {
        throw new AppError(
          'No pudimos crear el negocio. Inténtalo de nuevo con otro nombre.',
          'business-create-conflict',
        );
      }
      businessNameToUse = existing.name;
      joinCode = existing.joinCode;
    } else {
      // Primer intento: generar un código de invitación libre.
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
        const candidate = generateJoinCode();
        const candidateSnapshot = await getDoc(doc(db, 'joinCodes', candidate));
        if (!candidateSnapshot.exists()) {
          joinCode = candidate;
          break;
        }
      }
      if (!joinCode) {
        throw new AppError(
          'No pudimos generar un código de invitación. Inténtalo de nuevo.',
          'join-code-generation-failed',
        );
      }

      // Paso 1: documento del negocio con el identificador estable del intento.
      await setDoc(businessRef, {
        name,
        joinCode,
        createdBy: params.uid,
        createdAt: serverTimestamp(),
      });
    }

    // Paso 2: batch con SOLO las piezas que falten (idempotente). Un reintento
    // tras un batch ya confirmado no reescribe nada.
    const membershipRef = doc(db, 'businesses', businessRef.id, 'users', params.uid);
    const joinCodeRef = doc(db, 'joinCodes', joinCode);
    const profileRef = doc(db, 'users', params.uid);

    const [membershipSnapshot, joinCodeSnapshot, profileSnapshot] = await Promise.all([
      getDoc(membershipRef),
      getDoc(joinCodeRef),
      getDoc(profileRef),
    ]);

    const membershipMissing =
      !membershipSnapshot.exists() ||
      (membershipSnapshot.data() as { uid?: unknown }).uid !== params.uid;
    const joinCodeMissing =
      !joinCodeSnapshot.exists() ||
      (joinCodeSnapshot.data() as { businessId?: unknown }).businessId !== businessRef.id;
    const profileMissing =
      !profileSnapshot.exists() ||
      (profileSnapshot.data() as { businessId?: unknown }).businessId !== businessRef.id;

    if (membershipMissing || joinCodeMissing || profileMissing) {
      const batch = writeBatch(db);
      if (membershipMissing) {
        batch.set(membershipRef, {
          uid: params.uid,
          name: params.userName,
          role: 'owner',
          createdAt: serverTimestamp(),
        });
      }
      if (joinCodeMissing) {
        batch.set(joinCodeRef, { businessId: businessRef.id });
      }
      if (profileMissing) {
        batch.set(
          profileRef,
          { businessId: businessRef.id, updatedAt: serverTimestamp() },
          { merge: true },
        );
      }
      await batch.commit();
    }

    // Devolvemos el negocio con los valores almacenados.
    return {
      id: businessRef.id,
      name: businessNameToUse,
      joinCode,
      createdBy: params.uid,
      createdAt: new Date(),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[businessService] Error al crear el negocio:', error);
    throw new AppError(
      'No pudimos crear el negocio. Revisa tu conexión e inténtalo de nuevo.',
      'business-create-failed',
    );
  }
}

/**
 * Une al usuario al negocio asociado a un código de invitación.
 *
 * Todo ocurre dentro de una transacción: se verifica que el código exista
 * y que el usuario no pertenezca ya a otro negocio (leyendo su perfil).
 * Solo entonces se crean la membresía (rol `member`) y la referencia
 * `users/{uid}.businessId`.
 *
 * El documento del negocio no se lee dentro de la transacción: las reglas
 * de seguridad solo permiten leerlo a los miembros, así que se recupera
 * después del commit, cuando el usuario ya pertenece al negocio.
 */
export async function joinBusinessByCode(params: {
  uid: string;
  userName: string;
  code: string;
}): Promise<Business> {
  const code = normalizeJoinCode(params.code);
  if (!JOIN_CODE_REGEX.test(code)) {
    throw new AppError(
      'El código no parece válido. Debe tener 6 caracteres (letras y números).',
      'invalid-join-code',
    );
  }

  let businessId: string | null = null;

  try {
    await runTransaction(db, async (transaction) => {
      const joinCodeSnapshot = await transaction.get(doc(db, 'joinCodes', code));
      if (!joinCodeSnapshot.exists()) {
        throw new AppError(
          'No encontramos un negocio con ese código. Verifícalo e inténtalo de nuevo.',
          'join-code-not-found',
        );
      }
      const targetBusinessId = joinCodeSnapshot.data().businessId as string;

      // Evitar membresías duplicadas: si el perfil ya apunta a un negocio, no se une.
      const profileSnapshot = await transaction.get(doc(db, 'users', params.uid));
      const existingBusinessId = profileSnapshot.exists()
        ? ((profileSnapshot.data().businessId as string | null) ?? null)
        : null;
      if (existingBusinessId) {
        throw new AppError('Ya perteneces a un negocio.', 'already-in-business');
      }

      transaction.set(doc(db, 'businesses', targetBusinessId, 'users', params.uid), {
        uid: params.uid,
        name: params.userName,
        role: 'member',
        joinCode: code,
        createdAt: serverTimestamp(),
      });
      transaction.set(
        doc(db, 'users', params.uid),
        { uid: params.uid, name: params.userName, businessId: targetBusinessId, updatedAt: serverTimestamp() },
        { merge: true },
      );

      businessId = targetBusinessId;
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[businessService] Error al unirse al negocio:', error);
    throw new AppError(
      'No pudimos unirte al negocio. Revisa tu conexión e inténtalo de nuevo.',
      'business-join-failed',
    );
  }

  if (!businessId) {
    throw new AppError(
      'No pudimos unirte al negocio. Revisa tu conexión e inténtalo de nuevo.',
      'business-join-failed',
    );
  }

  // La membresía ya existe: ahora sí está permitido leer el negocio.
  try {
    const joinedBusiness = await getBusinessById(businessId);
    if (!joinedBusiness) {
      throw new Error(`El negocio ${businessId} no existe después de unirse.`);
    }
    return joinedBusiness;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[businessService] Error al leer el negocio tras unirse:', error);
    // La unión SÍ se completó; solo falló la lectura posterior.
    throw new AppError(
      'Te uniste al negocio, pero no pudimos cargar sus datos. Cierra y vuelve a abrir la aplicación.',
      'business-post-join-read-failed',
    );
  }
}




