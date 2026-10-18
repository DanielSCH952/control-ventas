import type { ServiceType } from '@/types/Service';

import { AppError } from '@/services/errors';

// ===== Tarifas confirmadas (centavos MXN) =====

/** Copia B/N: $1.50 por copia en cantidades de 1 a 4. */
export const COPY_BW_LOW_QUANTITY_UNIT_PRICE_CENTS = 150;
/** Copia B/N: $1.00 por copia a partir de esta cantidad. */
export const COPY_BW_HIGH_QUANTITY_UNIT_PRICE_CENTS = 100;
/** Cantidad a partir de la cual aplica el precio por volumen de copia B/N. */
export const COPY_BW_BULK_THRESHOLD = 5;
/** Copia a color: precio normal $2.00 por copia. */
export const COPY_COLOR_UNIT_PRICE_CENTS = 200;

/**
 * Valida que la cantidad sea un entero positivo.
 * Devuelve la cantidad normalizada o lanza `AppError` apto para la interfaz.
 */
export function validateQuantity(raw: number): number {
  if (!Number.isInteger(raw) || raw < 1) {
    throw new AppError(
      'La cantidad debe ser un número entero mayor que 0.',
      'invalid-quantity',
    );
  }
  return raw;
}

/**
 * Precio unitario sugerido para un servicio y una cantidad, en centavos.
 *
 * Devuelve `null` cuando no existe tarifa automática (el usuario debe
 * introducir el precio manualmente). No realiza operaciones de Firestore
 * ni conoce componentes visuales.
 *
 * Tarifas confirmadas:
 *  - COPY_BW:    1–4 copias → $1.50; 5 o más → $1.00.
 *  - COPY_COLOR: $2.00 por copia (editable para trabajos especiales).
 *  - Demás servicios: sin tarifa definida en este sprint → null.
 */
export function getSuggestedUnitPrice(serviceType: ServiceType, quantity: number): number | null {
  validateQuantity(quantity);

  switch (serviceType) {
    case 'COPY_BW':
      return quantity >= COPY_BW_BULK_THRESHOLD
        ? COPY_BW_HIGH_QUANTITY_UNIT_PRICE_CENTS
        : COPY_BW_LOW_QUANTITY_UNIT_PRICE_CENTS;
    case 'COPY_COLOR':
      return COPY_COLOR_UNIT_PRICE_CENTS;
    default:
      return null;
  }
}

/**
 * Total de una venta en centavos: `quantity * unitPriceCents`.
 * Se calcula por separado del precio sugerido y debe validarse antes
 * de guardar (ver `saleService`).
 */
export function computeTotalCents(quantity: number, unitPriceCents: number): number {
  validateQuantity(quantity);
  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new AppError('El precio unitario no es válido.', 'invalid-unit-price');
  }
  return quantity * unitPriceCents;
}
