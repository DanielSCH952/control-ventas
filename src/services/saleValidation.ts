import type { DocumentData } from 'firebase/firestore';

import type { CreateSaleInput, Sale } from '@/types/Sale';
import { SERVICE_TYPES, toServiceType } from '@/constants/services';

import { AppError } from './errors';
import { parseDate } from './firestore-utils';

// ===== Límites (reflejados en firestore.rules) =====

/** Cantidad máxima permitida por venta. */
export const MAX_SALE_QUANTITY = 1000;
/** Precio unitario máximo: 10 000 000 centavos = $100,000.00 MXN. */
export const MAX_UNIT_PRICE_CENTS = 10_000_000;
/** Longitud máxima de las observaciones. */
export const MAX_SALE_NOTES_LENGTH = 200;
/** Longitud máxima del nombre del registrante/editor (coincide con el perfil). */
export const CREATED_BY_NAME_MAX_LENGTH = 50;

/**
 * Convierte un documento de Firestore a `Sale`.
 * Devuelve null (y registra una advertencia) si el documento no cumple el
 * contrato, en lugar de propagar datos corruptos a la interfaz.
 *
 * Los documentos creados antes del Sprint 4 (sin `updatedBy`/`updatedByName`)
 * siguen convirtiéndose correctamente: esos campos se marcan como ausentes.
 */
export function toSale(id: string, data: DocumentData): Sale | null {
  const serviceType = toServiceType(data.serviceType);
  const {
    quantity,
    unitPriceCents,
    totalCents,
    createdBy,
    createdByName,
    createdAt,
    updatedAt,
    notes,
    updatedBy,
    updatedByName,
  } = data;

  if (
    !serviceType
      || typeof quantity !== 'number'
      || typeof unitPriceCents !== 'number'
      || typeof totalCents !== 'number'
      || typeof createdBy !== 'string'
      || typeof createdByName !== 'string'
  ) {
    console.warn('[saleValidation] Documento de venta con datos inválidos, se omite:', id);
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
    updatedBy: typeof updatedBy === 'string' ? updatedBy : undefined,
    updatedByName: typeof updatedByName === 'string' ? updatedByName : undefined,
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
 * No toca los campos históricos (`createdBy`, `createdByName`, `createdAt`):
 * esos se conservan y solo las reglas de Firestore los inmutan.
 *
 * Devuelve la entrada normalizada o lanza `AppError` apto para la interfaz.
 */
export function validateSaleInput(input: CreateSaleInput): CreateSaleInput {
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
 * Comprueba en la interfaz si un usuario puede editar o eliminar una venta:
 * su creador o el propietario del negocio.
 *
 * Mejora la experiencia (oculta acciones imposibles), pero NO es el control
 * de seguridad: `firestore.rules` aplica la misma política en el servidor.
 */
export function canModifySale(
  sale: Pick<Sale, 'createdBy'>,
  viewerUid: string | null | undefined,
  ownerUid: string | null | undefined,
): boolean {
  if (!viewerUid) {
    return false;
  }
  return sale.createdBy === viewerUid || (!!ownerUid && ownerUid === viewerUid);
}
