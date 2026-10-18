import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../src/services/errors';
import {
  centsToInputString,
  formatCents,
  parseMoneyToCents,
} from '../src/utils/currency';
import { formatSaleDate } from '../src/utils/datetime';

describe('parseMoneyToCents', () => {
  it('acepta punto y coma como separador decimal', () => {
    assert.equal(parseMoneyToCents('1.50'), 150);
    assert.equal(parseMoneyToCents('1,50'), 150);
    assert.equal(parseMoneyToCents('1,5'), 150);
  });

  it('interpreta enteros como pesos exactos', () => {
    assert.equal(parseMoneyToCents('2'), 200);
    assert.equal(parseMoneyToCents('10'), 1000);
  });

  it('rechaza entradas inválidas con AppError', () => {
    for (const invalid of ['', 'abc', '-1', '1.234', '1.999', '12345678']) {
      assert.throws(() => parseMoneyToCents(invalid), AppError, `'${invalid}' debió rechazarse`);
    }
  });
});

describe('round-trip de precios entre la interfaz y centavos', () => {
  it('centsToInputString produce el texto que espera el formulario', () => {
    assert.equal(centsToInputString(150), '1.50');
    assert.equal(centsToInputString(100), '1.00');
    assert.equal(centsToInputString(5000), '50.00');
  });

  it('formatCents presenta montos en MXN', () => {
    assert.equal(formatCents(800), '$8.00');
    assert.equal(formatCents(150), '$1.50');
    assert.equal(formatCents(5), '$0.05');
  });

  it('el ciclo editar → guardar no altera el valor', () => {
    const cents = 175;
    const back = parseMoneyToCents(centsToInputString(cents));
    assert.equal(back, cents);
  });
});

describe('formatSaleDate', () => {
  it('formatea la fecha en español con hora local', () => {
    const date = new Date(2026, 9, 17, 14, 5);
    assert.equal(formatSaleDate(date), '17 oct 2026, 14:05');
  });
});
