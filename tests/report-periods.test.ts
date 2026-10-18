import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  getDayPeriod,
  getMonthCalendar,
  getWeekPeriod,
  isDateInPeriod,
  isSameDay,
  startOfDay,
} from '../src/utils/reportPeriods';

/**
 * Pruebas de los períodos de reportes (Sprint 5).
 *
 * Todas las fechas se construyen con `new Date(año, mes, día, …)`, es decir,
 * en la zona horaria LOCAL del entorno de ejecución: exactamente la misma
 * convención que usa la implementación. No se mezclan fechas UTC.
 */

describe('getDayPeriod: día completo local como intervalo semiabierto', () => {
  it('va de 00:00 del día a 00:00 del día siguiente', () => {
    const day = new Date(2026, 9, 17, 14, 30); // 17 oct 2026, 14:30
    const { start, end } = getDayPeriod(day);
    assert.equal(start.getTime(), new Date(2026, 9, 17, 0, 0, 0, 0).getTime());
    assert.equal(end.getTime(), new Date(2026, 9, 18, 0, 0, 0, 0).getTime());
  });

  it('incluye la medianoche del inicio y excluye la del final', () => {
    const { start, end } = getDayPeriod(new Date(2026, 9, 17, 9));
    assert.ok(isDateInPeriod(new Date(2026, 9, 17, 0, 0, 0, 0), { start, end }));
    assert.ok(isDateInPeriod(new Date(2026, 9, 17, 23, 59, 59, 999), { start, end }));
    assert.ok(!isDateInPeriod(new Date(2026, 9, 18, 0, 0, 0, 0), { start, end }));
  });

  it('es independiente de la hora del día ancla', () => {
    const early = getDayPeriod(new Date(2026, 9, 17, 0, 5));
    const late = getDayPeriod(new Date(2026, 9, 17, 23, 55));
    assert.equal(early.start.getTime(), late.start.getTime());
    assert.equal(early.end.getTime(), late.end.getTime());
  });

  it('cruza correctamente fin de mes (31 oct → 1 nov)', () => {
    const { end } = getDayPeriod(new Date(2026, 9, 31, 20)); // 31 oct
    assert.equal(end.getTime(), new Date(2026, 10, 1).getTime());
  });

  it('cruza correctamente fin de año (31 dic → 1 ene)', () => {
    const { end } = getDayPeriod(new Date(2026, 11, 31, 20));
    assert.equal(end.getTime(), new Date(2027, 0, 1).getTime());
  });

  it('cruza el 29 de febrero de un año bisiesto', () => {
    const { start, end } = getDayPeriod(new Date(2028, 1, 29, 12));
    assert.equal(start.getTime(), new Date(2028, 1, 29).getTime());
    assert.equal(end.getTime(), new Date(2028, 2, 1).getTime());
  });
});

describe('getWeekPeriod: semana de lunes a domingo', () => {
  it('de un miércoles cubre lunes–domingo', () => {
    // 14 oct 2026 es miércoles.
    const { start, end } = getWeekPeriod(new Date(2026, 9, 14, 15));
    assert.equal(start.getTime(), new Date(2026, 9, 12).getTime()); // lunes 12
    assert.equal(end.getTime(), new Date(2026, 9, 19).getTime()); // lunes 19
  });

  it('de un domingo cubre la semana que EMPIEZA ese lunes anterior', () => {
    // 18 oct 2026 es domingo: pertenece a la semana del lunes 12.
    const { start, end } = getWeekPeriod(new Date(2026, 9, 18, 10));
    assert.equal(start.getTime(), new Date(2026, 9, 12).getTime());
    assert.equal(end.getTime(), new Date(2026, 9, 19).getTime());
  });

  it('de un lunes empieza exactamente en ese día', () => {
    // 19 oct 2026 es lunes.
    const { start, end } = getWeekPeriod(new Date(2026, 9, 19, 8));
    assert.equal(start.getTime(), new Date(2026, 9, 19).getTime());
    assert.equal(end.getTime(), new Date(2026, 9, 26).getTime());
  });

  it('incluye el lunes a medianoche y excluye el lunes siguiente', () => {
    const { start, end } = getWeekPeriod(new Date(2026, 9, 15));
    assert.ok(isDateInPeriod(new Date(2026, 9, 12, 0, 0, 0, 0), { start, end }));
    assert.ok(isDateInPeriod(new Date(2026, 9, 18, 23, 59, 59, 999), { start, end }));
    assert.ok(!isDateInPeriod(new Date(2026, 9, 19, 0, 0, 0, 0), { start, end }));
  });

  it('cruza el cambio de mes dentro de una misma semana', () => {
    // 2 nov 2026 es lunes; su semana termina el lunes 9 de noviembre.
    const { start, end } = getWeekPeriod(new Date(2026, 10, 4));
    assert.equal(start.getTime(), new Date(2026, 10, 2).getTime());
    assert.equal(end.getTime(), new Date(2026, 10, 9).getTime());
  });

  it('cruza el cambio de año (semana del 28 dic 2026 al 3 ene 2027)', () => {
    const { start, end } = getWeekPeriod(new Date(2026, 11, 30)); // miércoles 30 dic
    assert.equal(start.getTime(), new Date(2026, 11, 28).getTime());
    assert.equal(end.getTime(), new Date(2027, 0, 4).getTime());
  });
});

describe('addDays y utilidades de días', () => {
  it('suma días cruzando meses y años', () => {
    assert.ok(isSameDay(addDays(new Date(2026, 9, 31), 1), new Date(2026, 10, 1)));
    assert.ok(isSameDay(addDays(new Date(2026, 11, 31), 1), new Date(2027, 0, 1)));
  });

  it('resta días cruzando el inicio del mes', () => {
    assert.ok(isSameDay(addDays(new Date(2026, 10, 1), -1), new Date(2026, 9, 31)));
  });

  it('startOfDay trunca horas, minutos, segundos y milisegundos', () => {
    const start = startOfDay(new Date(2026, 9, 17, 18, 45, 30, 250));
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);
    assert.equal(start.getSeconds(), 0);
    assert.equal(start.getMilliseconds(), 0);
  });
});

describe('getMonthCalendar: matriz mensual de lunes a domingo', () => {
  it('cada semana tiene 7 días y el primer día de la cuadrícula es lunes', () => {
    const weeks = getMonthCalendar(2026, 9); // octubre 2026
    assert.equal(weeks.length, 6);
    for (const week of weeks) {
      assert.equal(week.length, 7);
    }
    assert.equal(weeks[0][0].getDay(), 1); // lunes 28 sep 2026
    assert.ok(isSameDay(weeks[0][0], new Date(2026, 8, 28)));
    assert.ok(isSameDay(weeks[0][6], new Date(2026, 9, 4))); // domingo 4 oct
  });

  it('contiene el último día del mes dentro de la cuadrícula', () => {
    const weeks = getMonthCalendar(2026, 9);
    const flat = weeks.flat();
    assert.ok(flat.some((day) => isSameDay(day, new Date(2026, 9, 31))));
  });
});
