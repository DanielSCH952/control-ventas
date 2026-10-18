// Pruebas de humo de las funciones puras del Sprint 3 (pricing, currency,
// fechas). Se ejecutan con Node (strip-types) + alias-loader, sin dependencias:
//
//   node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/smoke-tests.mjs
//
// No sustituyen las pruebas funcionales con Firebase real (ver FIREBASE.md).
import assert from 'node:assert/strict';

import { computeTotalCents, getSuggestedUnitPrice, validateQuantity } from '@/utils/pricing.ts';
import { centsToInputString, formatCents, parseMoneyToCents } from '@/utils/currency.ts';
import { formatSaleDate } from '@/utils/datetime.ts';
import { getServiceLabel, SERVICE_OPTIONS, toServiceType } from '@/constants/services.ts';
import { AppError } from '@/services/errors.ts';

// ===== pricing: tarifas confirmadas =====
assert.equal(getSuggestedUnitPrice('COPY_BW', 1), 150);
assert.equal(getSuggestedUnitPrice('COPY_BW', 4), 150);
assert.equal(getSuggestedUnitPrice('COPY_BW', 5), 100);
assert.equal(getSuggestedUnitPrice('COPY_BW', 500), 100);
assert.equal(getSuggestedUnitPrice('COPY_COLOR', 1), 200);
assert.equal(getSuggestedUnitPrice('COPY_COLOR', 99), 200);
// Servicios sin tarifa definida → null (precio manual).
assert.equal(getSuggestedUnitPrice('PRINT_BW', 10), null);
assert.equal(getSuggestedUnitPrice('PRINT_COLOR', 10), null);
assert.equal(getSuggestedUnitPrice('RECHARGE', 10), null);
assert.equal(getSuggestedUnitPrice('OTHER', 10), null);

// ===== pricing: validación de cantidad =====
assert.throws(() => getSuggestedUnitPrice('COPY_BW', 0), AppError);
assert.throws(() => getSuggestedUnitPrice('COPY_BW', -3), AppError);
assert.throws(() => getSuggestedUnitPrice('COPY_BW', 2.5), AppError);
assert.equal(validateQuantity(8), 8);

// ===== pricing: total = quantity * unitPriceCents =====
assert.equal(computeTotalCents(8, 100), 800);
assert.equal(computeTotalCents(3, 150), 450);
assert.throws(() => computeTotalCents(8, 0.5), AppError);
assert.throws(() => computeTotalCents(0, 100), AppError);

// ===== currency: conversión sin punto flotante =====
assert.equal(parseMoneyToCents('1.50'), 150);
assert.equal(parseMoneyToCents('1,50'), 150);
assert.equal(parseMoneyToCents('2'), 200);
assert.equal(parseMoneyToCents('1,5'), 150);
assert.equal(parseMoneyToCents(' 0.01 '), 1);
assert.equal(parseMoneyToCents('1234567.89'), 123456789);
// Entradas inválidas → AppError (vacío, negativo, 3 decimales, letras, doble punto).
assert.throws(() => parseMoneyToCents(''), AppError);
assert.throws(() => parseMoneyToCents('-1.50'), AppError);
assert.throws(() => parseMoneyToCents('1.505'), AppError);
assert.throws(() => parseMoneyToCents('abc'), AppError);
assert.throws(() => parseMoneyToCents('1.2.3'), AppError);

// ===== currency: formateo MXN =====
assert.equal(formatCents(150), '$1.50');
assert.equal(formatCents(0), '$0.00');
assert.equal(formatCents(123456789), '$1234567.89');
assert.equal(formatCents(5), '$0.05');

// ===== currency: ida y vuelta sugerido → input =====
assert.equal(centsToInputString(150), '1.50');
assert.equal(centsToInputString(getSuggestedUnitPrice('COPY_BW', 8)), '1.00');

// ===== datetime =====
const date = new Date(2026, 9, 17, 14, 5); // 17 oct 2026, 14:05 (hora local)
assert.equal(formatSaleDate(date), '17 oct 2026, 14:05');

// ===== servicios: catálogo y tipado =====
assert.equal(SERVICE_OPTIONS.length, 6);
assert.equal(getServiceLabel('COPY_BW'), 'Copia blanco y negro');
assert.equal(getServiceLabel('RECHARGE'), 'Recarga');
assert.equal(toServiceType('COPY_BW'), 'COPY_BW');
assert.equal(toServiceType('NOPE'), null);
assert.equal(toServiceType(42), null);

console.log('OK: 40+ aserciones de humo del Sprint 3 pasaron (pricing, currency, datetime, servicios).');
