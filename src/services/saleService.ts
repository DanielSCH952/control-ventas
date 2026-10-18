import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import type { CreateSaleInput, Sale } from '@/types/Sale';

import { db } from './firebase';
import { AppError } from './errors';
import {
  CREATED_BY_NAME_MAX_LENGTH,
  toSale,
  validateSaleInput,
} from './saleValidation';

// Los límites y la validación de entradas viven en `saleValidation` para poder
// probarlos sin Firebase; se re-exportan porque la interfaz ya los importaba
// desde este módulo.
export {
  MAX_SALE_NOTES_LENGTH,
  MAX_SALE_QUANTITY,
  MAX_UNIT_PRICE_CENTS,
} from './saleValidation';

/** Ventas devueltas por la consulta inicial. */
export const SALE_RECENT_LIMIT = 50;

/**
 * Crea una venta en `businesses/{businessId}/sales/{saleId}`.
 *
 * El identificador del documento lo genera Firestore (`addDoc`). El negocio
 * y el registrante NO se toman de la pantalla: la llamada debe recibirlos
 * desde el estado autenticado de la aplicación (`useAuth`), donde ya se
 * validaron el perfil y la membresía. `createdBy` siempre es el UID de la
 * sesión activa y `createdByName` el nombre del perfil ya cargado.
 *
 * Las fechas se escriben con `serverTimestamp()`. El objeto devuelto usa la
 * hora local como aproximación de esos campos; los valores reales del
 * servidor se ven al consultar la lista.
 */
export async function createSale(params: {
  businessId: string;
  actor: { uid: string; name: string };
  input: CreateSaleInput;
}): Promise<Sale> {
  const { businessId, actor, input } = params;

  if (!actor.uid) {
    throw new AppError('No hay una sesión activa. Vuelve a intentarlo.', 'missing-session');
  }
  if (!businessId) {
    throw new AppError(
      'Tu perfil no tiene un negocio asociado. Cierra y vuelve a abrir la aplicación.',
      'missing-business',
    );
  }
  const createdByName = actor.name.trim();
  if (createdByName.length < 1 || createdByName.length > CREATED_BY_NAME_MAX_LENGTH) {
    throw new AppError(
      'Tu nombre de perfil no es válido. Edítalo antes de registrar ventas.',
      'invalid-actor-name',
    );
  }

  const sale = validateSaleInput(input);

  try {
    const salesRef = collection(db, 'businesses', businessId, 'sales');
    const docRef = await addDoc(salesRef, {
      serviceType: sale.serviceType,
      quantity: sale.quantity,
      unitPriceCents: sale.unitPriceCents,
      totalCents: sale.totalCents,
      createdBy: actor.uid,
      createdByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(sale.notes !== undefined ? { notes: sale.notes } : {}),
    });

    const now = new Date();
    return {
      id: docRef.id,
      serviceType: sale.serviceType,
      quantity: sale.quantity,
      unitPriceCents: sale.unitPriceCents,
      totalCents: sale.totalCents,
      createdBy: actor.uid,
      createdByName,
      createdAt: now,
      updatedAt: now,
      notes: sale.notes,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[saleService] Error al crear la venta:', error);
    throw new AppError(
      'No pudimos guardar la venta. Revisa tu conexión e inténtalo de nuevo.',
      'sale-create-failed',
    );
  }
}

/**
 * Consulta inicial de ventas del negocio, ordenadas por fecha descendente.
 *
 * Nota sobre índices: la consulta usa un único `orderBy` (`createdAt`) con
 * `limit`, por lo que NO requiere ningún índice compuesto; el índice
 * automático de un solo campo es suficiente. Si en un sprint posterior se
 * filtra por servicio o usuario además de ordenar, ahí sí se necesitará un
 * índice compuesto.
 *
 * Los documentos que no cumplan el contrato se omiten (ver `toSale`).
 */
export async function listRecentSales(
  businessId: string,
  maxResults: number = SALE_RECENT_LIMIT,
): Promise<Sale[]> {
  if (!businessId) {
    throw new AppError(
      'Tu perfil no tiene un negocio asociado. Cierra y vuelve a abrir la aplicación.',
      'missing-business',
    );
  }

  try {
    const salesQuery = query(
      collection(db, 'businesses', businessId, 'sales'),
      orderBy('createdAt', 'desc'),
      limitQuery(maxResults),
    );
    const snapshot = await getDocs(salesQuery);

    const sales: Sale[] = [];
    for (const document of snapshot.docs) {
      const sale = toSale(document.id, document.data());
      if (sale) {
        sales.push(sale);
      }
    }
    return sales;
  } catch (error) {
    console.warn('[saleService] Error al listar las ventas:', error);
    throw new AppError(
      'No pudimos cargar las ventas. Revisa tu conexión e inténtalo de nuevo.',
      'sale-list-failed',
    );
  }
}

/**
 * Obtiene una venta individual del negocio. La pantalla de edición la usa
 * para cargar el documento antes de permitir modificarlo: el identificador
 * llega del enlace de navegación, pero el documento solo existe dentro del
 * negocio autenticado del usuario, así que no se puede leer de otro negocio.
 */
export async function getSaleById(businessId: string, saleId: string): Promise<Sale> {
  if (!businessId || !saleId) {
    throw new AppError(
      'Tu perfil no tiene un negocio asociado. Cierra y vuelve a abrir la aplicación.',
      'missing-business',
    );
  }

  try {
    const docRef = doc(db, 'businesses', businessId, 'sales', saleId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      throw new AppError('La venta que buscas ya no existe en este negocio.', 'sale-not-found');
    }

    const sale = toSale(snapshot.id, snapshot.data());
    if (!sale) {
      throw new AppError(
        'La venta tiene datos dañados y no se puede abrir. Puedes eliminarla y registrarla de nuevo.',
        'sale-invalid-document',
      );
    }
    return sale;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[saleService] Error al obtener la venta:', error);
    throw new AppError(
      'No pudimos cargar la venta. Revisa tu conexión e inténtalo de nuevo.',
      'sale-get-failed',
    );
  }
}

/**
 * Traduce un error de escritura de Firestore a un `AppError` comprensible.
 * `permission-denied` es el caso esperado cuando las reglas rechazan a un
 * usuario que no es creador ni propietario de la venta.
 */
function toWriteAppError(
  error: unknown,
  action: 'guardar los cambios' | 'eliminar la venta',
  code: string,
): AppError {
  const firestoreCode = (error as { code?: string } | null)?.code;
  switch (firestoreCode) {
    case 'permission-denied':
      return new AppError(
        'No tienes permiso para modificar esta venta. Solo puede hacerlo quien la registró o el propietario del negocio.',
        `${code}-denied`,
      );
    case 'unauthenticated':
      return new AppError(
        'Tu sesión expiró. Cierra y vuelve a abrir la aplicación e inténtalo de nuevo.',
        'missing-session',
      );
    case 'unavailable':
      return new AppError(
        'Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
        'sales-write-offline',
      );
    default:
      return new AppError(
        `No pudimos ${action}. Revisa tu conexión e inténtalo de nuevo.`,
        code,
      );
  }
}

/**
 * Actualiza una venta existente (Sprint 4).
 *
 * Solo se modifican los campos editables (`serviceType`, `quantity`,
 * `unitPriceCents`, `totalCents`, `notes`) y la auditoría de edición:
 *  - `updatedAt` con `serverTimestamp()` (coincide con `request.time`);
 *  - `updatedBy` con el UID de quien edita;
 *  - `updatedByName` como instantánea del nombre del editor.
 *
 * `createdBy`, `createdByName` y `createdAt` nunca se tocan: la venta
 * conserva su autor histórico. Si `notes` queda vacía, el campo se elimina
 * del documento para mantener el mismo formato que `createSale()`.
 *
 * Las reglas de Firestore son la autoridad de seguridad: un usuario que no
 * sea creador ni propietario recibe `permission-denied`.
 */
export async function updateSale(params: {
  businessId: string;
  saleId: string;
  actor: { uid: string; name: string };
  input: CreateSaleInput;
}): Promise<void> {
  const { businessId, saleId, actor, input } = params;

  if (!actor.uid) {
    throw new AppError('No hay una sesión activa. Vuelve a intentarlo.', 'missing-session');
  }
  if (!businessId || !saleId) {
    throw new AppError(
      'Tu perfil no tiene un negocio asociado. Cierra y vuelve a abrir la aplicación.',
      'missing-business',
    );
  }

  const updatedByName = actor.name.trim();
  if (updatedByName.length < 1 || updatedByName.length > CREATED_BY_NAME_MAX_LENGTH) {
    throw new AppError(
      'Tu nombre de perfil no es válido. Edítalo antes de modificar ventas.',
      'invalid-actor-name',
    );
  }

  const sale = validateSaleInput(input);

  try {
    const docRef = doc(db, 'businesses', businessId, 'sales', saleId);
    await updateDoc(docRef, {
      serviceType: sale.serviceType,
      quantity: sale.quantity,
      unitPriceCents: sale.unitPriceCents,
      totalCents: sale.totalCents,
      // Mismo formato que createSale(): sin notas no hay campo `notes`.
      ...(sale.notes !== undefined ? { notes: sale.notes } : { notes: deleteField() }),
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
      updatedByName,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[saleService] Error al actualizar la venta:', error);
    throw toWriteAppError(error, 'guardar los cambios', 'sale-update-failed');
  }
}

/**
 * Elimina una venta de forma permanente (Sprint 4).
 *
 * La eliminación es IRREVERSIBLE en el modelo actual: no existe papelera,
 * cancelación ni borrado lógico. No se toca el negocio, la membresía ni el
 * perfil del usuario. Las reglas de Firestore solo la permiten al creador
 * de la venta o al propietario del negocio; cualquier otro usuario recibe
 * `permission-denied`.
 *
 * La lista de la interfaz se actualiza sola: `useSales` recibe el evento de
 * borrado a través de `onSnapshot`.
 */
export async function deleteSale(params: {
  businessId: string;
  saleId: string;
}): Promise<void> {
  const { businessId, saleId } = params;

  if (!businessId || !saleId) {
    throw new AppError(
      'Tu perfil no tiene un negocio asociado. Cierra y vuelve a abrir la aplicación.',
      'missing-business',
    );
  }

  try {
    const docRef = doc(db, 'businesses', businessId, 'sales', saleId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('[saleService] Error al eliminar la venta:', error);
    throw toWriteAppError(error, 'eliminar la venta', 'sale-delete-failed');
  }
}

