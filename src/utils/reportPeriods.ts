import type { ReportPeriod } from '@/types/Report';

/**
 * Utilidades PURAS de períodos de reportes (Sprint 5).
 *
 * Zona horaria: todos los límites se construyen con la zona horaria LOCAL del
 * dispositivo (los constructores `new Date(y, m, d)` usan la zona del entorno).
 * El modelo de datos NO almacena una zona horaria del negocio, así que en esta
 * versión el reporte usa la zona del dispositivo; si esta cambia, los límites
 * del período consultado pueden variar (comportamiento documentado en
 * FIREBASE.md). Nunca se mezclan fechas locales con cadenas UTC.
 *
 * Convención de semana: lunes → domingo (no existe otra convención previa en
 * el proyecto que haya que conservar).
 */

/** Suma días a una fecha conservando la hora local (`setDate` absorbe DST). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/** 00:00:00.000 locales del día civil que contiene a `date`. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** ¿Son el mismo día civil local? */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Período del día de `date`: [00:00 local del día, 00:00 local del día
 * siguiente). Intervalo semiabierto: el inicio está INCLUIDO y el fin
 * EXCLUIDO (una venta registrada exactamente a las 00:00 del día siguiente
 * pertenece a ese día, no al anterior).
 */
export function getDayPeriod(date: Date): ReportPeriod {
  const start = startOfDay(date);
  const end = startOfDay(addDays(date, 1));
  return { start, end };
}

/**
 * Período de la semana (lunes → domingo) que contiene a `date`:
 * [00:00 del lunes, 00:00 del lunes siguiente).
 */
export function getWeekPeriod(date: Date): ReportPeriod {
  const dayOfWeek = date.getDay(); // 0 = domingo
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = addDays(date, -daysFromMonday);
  const start = startOfDay(monday);
  const end = startOfDay(addDays(monday, 7));
  return { start, end };
}

/** ¿Está `date` dentro del intervalo semiabierto [start, end)? */
export function isDateInPeriod(date: Date, period: ReportPeriod): boolean {
  const time = date.getTime();
  return time >= period.start.getTime() && time < period.end.getTime();
}

// ===== Calendario mensual (selector de fecha de los reportes) =====

/**
 * Matriz del mes en semanas de lunes a domingo. Cada semana contiene 7
 * `Date` reales (los días de meses adyacentes incluidos: la interfaz decide
 * cómo presentarlos). Siempre devuelve 6 semanas para que la altura del
 * calendario sea estable.
 */
export function getMonthCalendar(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const gridStart = startOfDay(
    addDays(firstDay, dayOfWeek === 0 ? -6 : -(dayOfWeek - 1)),
  );

  const weeks: Date[][] = [];
  let cursor = gridStart;
  while (weeks.length < 6) {
    const week: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
