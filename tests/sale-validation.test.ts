import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  canModifySale,
  MAX_SALE_NOTES_LENGTH,
  MAX_SALE_QUANTITY,
  MAX_UNIT_PRICE_CENTS,
  toSale,
  validateSaleInput,
} from '../src/services/saleValidation';
import { AppError } from '../src/services/errors';
import { computeTotalCents, getSuggestedUnitPrice } from '../src/utils/pricing';

/** Fecha determinista para las pruebas (17 oct 2026, 14:05). */
const FIXED_DATE = new Date(2026, 9, 17, 14, 5);

/** Simula el Timestamp de Firestore que usan los documentos. */
function ts(date: Date) {
  return { toDate: () => date };
}

/** Documento de venta válido, tal como lo escribe `createSale()`. */
function validSaleData(overrides: Record<string, unknown> = {}) {
  return {
    serviceType: 'COPY_BW',
    quantity: 8,
    unitPriceCents: 100,
    totalCents: 800,
    createdBy: 'uid-creador',
    createdByName: 'Ana',
    createdAt: ts(FIXED_DATE),
    updatedAt: ts(FIXED_DATE),
    ...overrides,
  };
}

describe('toSale: conversión de documentos de Firestore', () => {
  it('convierte un documento válido conservando los campos históricos', () => {
    const sale = toSale('venta-1', validSaleData());
    assert.ok(sale);
    assert.equal(sale.id, 'venta-1');
    assert.equal(sale.createdBy, 'uid-creador');
    assert.equal(sale.createdByName, 'Ana');
    assert.equal(sale.createdAt.getTime(), FIXED_DATE.getTime());
  });

  it('convierte documentos antiguos del Sprint 3 (sin campos de auditoría de edición)', () => {
    const sale = toSale('venta-vieja', validSaleData());
    assert.ok(sale);
    assert.equal(sale.updatedBy, undefined);
    assert.equal(sale.updatedByName, undefined);
  });

  it('lee los campos de auditoría de edición cuando existen', () => {
    const sale = toSale('venta-2', validSaleData({ updatedBy: 'uid-editor', updatedByName: 'Beto' }));
    assert.ok(sale);
    assert.equal(sale.updatedBy, 'uid-editor');
    assert.equal(sale.updatedByName, 'Beto');
  });

  it('devuelve null (y no lanza) para documentos inválidos', () => {
    assert.equal(toSale('malo-1', validSaleData({ serviceType: 'NO_EXISTE' })), null);
    assert.equal(toSale('malo-2', validSaleData({ quantity: 'ocho' })), null);
    assert.equal(toSale('malo-3', validSaleData({ unitPriceCents: null })), null);
    assert.equal(toSale('malo-4', validSaleData({ createdBy: 42 })), null);
  });

  it('no bloquea el historial: un documento inválido se omite y los válidos siguen', () => {
    // Simula el recorrido de una instantánea de `useSales`: los documentos
    // inválidos devuelven null y no rompen el bucle.
    const snapshot = [
      { id: 'buena', data: validSaleData() },
      { id: 'mala', data: validSaleData({ totalCents: 'gratis' }) },
      { id: 'otra-buena', data: validSaleData({ serviceType: 'RECHARGE', quantity: 1, unitPriceCents: 5000, totalCents: 5000 }) },
    ];
    const sales = snapshot
      .map((document) => toSale(document.id, document.data))
      .filter((sale) => sale !== null);
    assert.equal(sales.length, 2);
  });

  it('tolera fechas pendientes de serverTimestamp() sin lanzar errores', () => {
    // Un serverTimestamp() aún sin resolver llega como un objeto sin
    // `toDate`; la conversión usa una aproximación local visible en vez de
    // romper (documentado en `useSales`: no es la fecha confirmada).
    const sale = toSale('pendiente', validSaleData({ createdAt: {}, updatedAt: {} }));
    assert.ok(sale);
    assert.ok(sale.createdAt instanceof Date);
  });
});

describe('validateSaleInput: validación de alta y edición', () => {
  const validInput = {
    serviceType: 'COPY_BW' as const,
    quantity: 8,
    unitPriceCents: 100,
    totalCents: 800,
  };

  it('acepta una entrada válida y normaliza las notas', () => {
    const result = validateSaleInput({ ...validInput, notes: '  nota  ' });
    assert.equal(result.notes, 'nota');
    assert.equal(result.totalCents, 800);
  });

  it('convierte notas vacías en ausentes', () => {
    const result = validateSaleInput({ ...validInput, notes: '   ' });
    assert.equal(result.notes, undefined);
  });

  it('rechaza un servicio desconocido', () => {
    assert.throws(
      () => validateSaleInput({ ...validInput, serviceType: 'SCAN' as never }),
      AppError,
    );
  });

  it('rechaza cantidades fuera del rango permitido', () => {
    for (const quantity of [0, -1, 1.5, MAX_SALE_QUANTITY + 1]) {
      assert.throws(
        () => validateSaleInput({ ...validInput, quantity }),
        AppError,
        `cantidad ${quantity} debió rechazarse`,
      );
    }
  });

  it('acepta la cantidad máxima permitida', () => {
    const quantity = MAX_SALE_QUANTITY;
    const total = computeTotalCents(quantity, validInput.unitPriceCents);
    const result = validateSaleInput({ ...validInput, quantity, totalCents: total });
    assert.equal(result.quantity, MAX_SALE_QUANTITY);
  });

  it('rechaza precios de $0.00 (un servicio sin tarifa exige precio manual)', () => {
    assert.throws(
      () => validateSaleInput({ ...validInput, unitPriceCents: 0, totalCents: 0 }),
      AppError,
    );
  });

  it('rechaza precios por encima del máximo', () => {
    assert.throws(
      () =>
        validateSaleInput({
          ...validInput,
          unitPriceCents: MAX_UNIT_PRICE_CENTS + 1,
          totalCents: (MAX_UNIT_PRICE_CENTS + 1) * validInput.quantity,
        }),
      AppError,
    );
  });

  it('rechaza totales que no coinciden con cantidad × precio unitario', () => {
    // El caso clave que las reglas de Firestore también rechazan.
    assert.throws(
      () => validateSaleInput({ ...validInput, totalCents: 801 }),
      AppError,
    );
  });

  it('recalcula el total correctamente durante una edición simulada', () => {
    // Edición: cantidad 8→3 y precio 100→250 centavos; el total debe
    // recalcularse desde cero, nunca reutilizar el anterior.
    const quantity = 3;
    const unitPriceCents = 250;
    const totalCents = computeTotalCents(quantity, unitPriceCents);
    const edited = validateSaleInput({
      serviceType: 'COPY_COLOR',
      quantity,
      unitPriceCents,
      totalCents,
    });
    assert.equal(edited.totalCents, 750);
  });
});

describe('canModifySale: permisos de edición y eliminación (vista previa de la interfaz)', () => {
  const sale = { createdBy: 'uid-creador' };

  it('permite al creador modificar su propia venta', () => {
    assert.equal(canModifySale(sale, 'uid-creador', null), true);
  });

  it('permite al propietario del negocio modificar cualquier venta, incluso ajena', () => {
    assert.equal(canModifySale(sale, 'uid-dueno', 'uid-dueno'), true);
  });

  it('rechaza a un miembro que no es creador ni propietario', () => {
    assert.equal(canModifySale(sale, 'uid-otro', 'uid-dueno'), false);
  });

  it('rechaza a un usuario sin sesión', () => {
    assert.equal(canModifySale(sale, null, 'uid-dueno'), false);
  });
});

describe('Precios sugeridos: manual vs tarifa (Sprint 3, reutilizado en edición)', () => {
  it('ofrece tarifa por volumen cuando existe', () => {
    const suggestion = getSuggestedUnitPrice('COPY_BW', 8);
    assert.ok(suggestion !== null);
  });

  it('no ofrece tarifa para servicios sin precio sugerido (captura manual)', () => {
    assert.equal(getSuggestedUnitPrice('OTHER', 1), null);
  });

  it('el total siempre es cantidad × precio, con sugerido o manual', () => {
    const suggested = getSuggestedUnitPrice('COPY_BW', 8) ?? 0;
    assert.equal(computeTotalCents(8, suggested), 8 * suggested);
    assert.equal(computeTotalCents(2, 123), 246);
  });
});

