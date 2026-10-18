import {
  addDoc,
  collection,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';

import type { CreateSaleInput, Sale } from '@/types/Sale';
import { SERVICE_TYPES, toServiceType } from '@/constants/services';

import { db } from './firebase';
import { AppError } from './errors';
import { parseDate } from './firestore-utils';

// ===== Límites (reflejados en firestore.rules) =====

/** Cantidad máxima permitida por venta. */
export const MAX_SALE_QUANTITY = 1000;
/** Precio unitario máximo: 10 000 000 centavos = $100,000.00 MXN. */
export const MAX_UNIT_PRICE_CENTS = 10_000_000;
/** Longitud máxima de las observaciones. */
export const MAX_SALE_NOTES_LENGTH = 200;
/** Ventas devueltas por la consulta inicial. */
export const SALE_RECENT_LIMIT = 50;
/** Longitud máxima del nombre del registrante (coincide con el perfil). */
const CREATED_BY_NAME_MAX_LENGTH = 50;

/**
 * Convierte un documento de Firestore a `Sale`.
 * Devuelve null (y registra una advertencia) si el documento no cumple el
 * contrato, en lugar de propagar datos corruptos a la interfaz.
 */
function toSale(id: string, data: DocumentData): Sale | null {
  const serviceType = toServiceType(data.serviceType);
  const { quantity, unitPriceCents, totalCents, createdBy, createdByName, createdAt, updatedAt, notes } = data;

  if (
    !serviceType
    || typeof quantity !== 'number'
    || typeof unitPriceCents !== 'number'
    || typeof totalCents !== 'number'
    || typeof createdBy !== 'string'
    || typeof createdByName !== 'string'
  ) {
    console.warn('[saleService] Documento de venta con datos inválidos, se omite:', id);
    return null;
  }

  return {
    id,
    serviceType,
    quantity,
    unitPriceCents,
    totalCents,
    createdBy,
    createdByName,
    createdAt: parseDate(createdAt),
    updatedAt: parseDate(updatedAt),
    notes: typeof notes === 'string' ? notes : undefined,
  };
}

/**
 * Valida los datos de la venta contra el contrato del sprint:
 *  - servicio conocido;
 *  - cantidad entera positiva dentro del límite;
 *  - precio unitario entero positivo dentro del límite (no se aceptan
 *    precios $0.00: un servicio sin tarifa debe capturarse manualmente);
 *  - total exactamente igual a `quantity * unitPriceCents`;
 *  - observaciones opcionales con longitud limitada.
 *
 * Devuelve la entrada normalizada o lanza `AppError` apto para la interfaz.
 */
function validateSaleInput(input: CreateSaleInput): CreateSaleInput {
  if (!SERVICE_TYPES.includes(input.serviceType)) {
    throw new AppError('Selecciona un servicio válido.', 'invalid-sale-service');
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new AppError('La cantidad debe ser un número entero mayor que 0.', 'invalid-sale-quantity');
  }
  if (input.quantity > MAX_SALE_QUANTITY) {
    throw new AppError(`La cantidad no puede superar ${MAX_SALE_QUANTITY}.`, 'invalid-sale-quantity');
  }
  if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents < 1) {
    throw new AppError('El precio unitario debe ser mayor que $0.00.', 'invalid-sale-price');
  }
  if (input.unitPriceCents > MAX_UNIT_PRICE_CENTS) {
    throw new AppError('El precio unitario es demasiado alto.', 'invalid-sale-price');
  }
  if (!Number.isInteger(input.totalCents) || input.totalCents !== input.quantity * input.unitPriceCents) {
    throw new AppError(
      'El total no coincide con la cantidad y el precio unitario. Revisa los datos.',
      'invalid-sale-total',
    );
  }

  const notes = input.notes?.trim() ?? '';
  if (notes.length > MAX_SALE_NOTES_LENGTH) {
    throw new AppError(
      `Las observaciones no pueden superar ${MAX_SALE_NOTES_LENGTH} caracteres.`,
      'invalid-sale-notes',
    );
  }

  return {
    serviceType: input.serviceType,
    quantity: input.quantity,
    unitPriceCents: input.unitPriceCents,
    totalCents: input.totalCents,
    notes: notes.length > 0 ? notes : undefined,
  };
}

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

