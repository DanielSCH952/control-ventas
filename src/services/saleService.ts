import {
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
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type { CreateSaleInput, Sale } from '@/types/Sale';

import { db } from './firebase';
import { AppError } from './errors';
import { isValidSaleId } from '@/utils/ids';
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
 * Crea una venta en `businesses/{businessId}/sales/{saleId}` (Sprint 6).
 *
 * **Identificador estable por intento (anti-duplicados):** la llamada recibe
 * un `saleId` generado UNA sola vez por la pantalla que inicia el intento
 * (`new.tsx` con `useRef`). La escritura usa `setDoc()`, no `addDoc()`. Si el
 * servidor llegó a crear el documento pero el cliente perdió la conexión
 * antes del ACK, un reintento con el MISMO identificador no crea una venta
 * duplicada: primero se comprueba con `getDoc` si ya existe (reintento tras
 * un error visible); si existe y fue creado por el mismo usuario, se informa
 * éxito (el intento anterior llegó al servidor).
 *
 * Límites del mecanismo (documentados en FIREBASE.md):
 *  - El ID no se deriva del contenido: dos ventas legítimas idénticas
 *    reciben IDs distintos porque cada intento nuevo genera el suyo.
 *  - Si el proceso muere antes de escribir y el usuario registra la venta
 *    de nuevo, es un intento NUEVO (ID nuevo): no puede generarse un
 *    duplicado conocido.
 *  - El estado «desconocido» (pérdida de red sin respuesta) no reintenta
 *    automáticamente; la interfaz debe permitir comprobar/reintentar.
 *
 * El negocio y el registrante NO se toman de la pantalla: la llamada debe
 * recibirlos desde el estado autenticado de la aplicación (`useAuth`), donde
 * ya se validaron el perfil y la membresía. `createdBy` siempre es el UID de
 * la sesión activa y `createdByName` el nombre del perfil ya cargado.
 *
 * Las fechas se escriben con `serverTimestamp()`. El objeto devuelto usa la
 * hora local como aproximación de esos campos; los valores reales del
 * servidor se ven al consultar la lista.
 */
export async function createSale(params: {
  businessId: string;
  saleId: string;
  actor: { uid: string; name: string };
  input: CreateSaleInput;
}): Promise<Sale> {
  const { businessId, saleId, actor, input } = params;

  if (!actor.uid) {
    throw new AppError('No hay una sesión activa. Vuelve a intentarlo.', 'missing-session');
  }
  if (!businessId) {
    throw new AppError(
      'Tu perfil no tiene un negocio asociado. Cierra y vuelve a abrir la aplicación.',
      'missing-business',
    );
  }
  if (!isValidSaleId(saleId)) {
    throw new AppError('El identificador de la venta no es válido.', 'invalid-sale-id');
  }
  const createdByName = actor.name.trim();
  if (createdByName.length < 1 || createdByName.length > CREATED_BY_NAME_MAX_LENGTH) {
    throw new AppError(
      'Tu nombre de perfil no es válido. Edítalo antes de registrar ventas.',
      'invalid-actor-name',
    );
  }

  const sale = validateSaleInput(input);

  const saleRef = doc(db, 'businesses', businessId, 'sales', saleId);

  // Reintento controlado: si el intento anterior SÍ llegó al servidor, el
  // documento ya existe. La pantalla garantiza que un reintento con el mismo
  // identificador lleva los mismos datos, así que un documento existente del
  // mismo usuario es la MISMA venta: se devuelve como confirmada en lugar de
  // duplicar con otro ID.
  try {
    const existing = await getDoc(saleRef);
    if (existing.exists()) {
      const existingData = existing.data();
      const sameUser = existingData.createdBy === actor.uid;
      const sameContent =
        existingData.serviceType === sale.serviceType &&
        existingData.quantity === sale.quantity &&
        existingData.unitPriceCents === sale.unitPriceCents &&
        existingData.totalCents === sale.totalCents &&
        (existingData.notes ?? undefined) === sale.notes;
      if (sameUser && sameContent) {
        const confirmed = toSale(existing.id, existingData);
        if (confirmed) {
          return confirmed;
        }
      }
      // Colisión de identificador (probabilísticamente imposible) o datos
      // incoherentes: se rechaza sin sobrescribir nada y se pide verificar
      // el historial antes de reintentar.
      throw new AppError(
        'No pudimos confirmar el estado de esta venta. Revisa el historial antes de volver a intentarlo.',
        'sale-create-id-collision',
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn('[saleService] No se pudo verificar la venta previa:', error);
    // Un fallo de lectura NO aborta el intento: el identificador es privado
    // de este intento, por lo que la escritura con `setDoc` no puede tocar
    // datos ajenos. Si el documento existiera, las reglas rechazarían la
    // escritura con `permission-denied` (create vs update) en lugar de
    // sobrescribir silenciosamente.
  }

  try {
    await setDoc(saleRef, {
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
      id: saleRef.id,
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
    const firestoreCode = (error as { code?: string }).code;
    // La escritura pudo llegar al servidor aunque el cliente perdiera la
    // conexión antes de recibir la confirmación. En ese caso NO se afirma
    // que la venta falló: se informa de un resultado desconocido. El
    // reintento con el MISMO identificador es seguro (verifica antes de
    // escribir, no puede duplicar).
    if (firestoreCode === 'unavailable' || firestoreCode === 'failed-precondition') {
      throw new AppError(
        'No pudimos confirmar si la venta se guardó. Revisa el historial; si no aparece, vuelve a guardarla: no se creará un duplicado.',
        'sale-create-unknown',
      );
    }
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
    case 'not-found':
      return new AppError(
        'La venta ya no existe en el negocio; puede haber sido eliminada por otra persona.',
        `${code}-not-found`,
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
    // Idempotencia (Sprint 6): si el servidor ya borró el documento pero el
    // cliente perdió la conexión antes del ACK, el reintento recibe
    // `permission-denied` (ya no existe → las reglas no dejan leerlo). Se
    // comprueba si el documento ya no existe: en ese caso la eliminación
    // SÍ se completó y se informa éxito en lugar de un error confuso.
    if (
      typeof (error as { code?: string }).code === 'string' &&
      (error as { code: string }).code === 'permission-denied'
    ) {
      const snapshot = await getDoc(
        doc(db, 'businesses', businessId, 'sales', saleId),
      );
      if (!snapshot.exists()) {
        return;
      }
    }
    console.warn('[saleService] Error al eliminar la venta:', error);
    throw toWriteAppError(error, 'eliminar la venta', 'sale-delete-failed');
  }
}

