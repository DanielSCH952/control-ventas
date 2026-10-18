const MONTH_ABBREVIATIONS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** Nombres completos de mes para encabezados (p. ej. el calendario). */
export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Abreviaturas de día indexadas por `Date.getDay()` (0 = domingo). */
const WEEKDAY_ABBREVIATIONS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

/** Encabezado del calendario de reportes: lunes → domingo. */
export const WEEKDAY_HEADER = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Formatea la fecha de una venta en español, en la zona horaria local del
 * dispositivo, sin depender de `Intl` (no siempre disponible en Hermes).
 * Ejemplo: "17 oct 2026, 14:05".
 */
export function formatSaleDate(date: Date): string {
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  return `${date.getDate()} ${month} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Etiqueta de un día completa en español y zona local, p. ej. "sáb 17 oct 2026".
 * Se usa para el rango consultado en los reportes (Sprint 5).
 */
export function formatDayLabel(date: Date): string {
  const weekday = WEEKDAY_ABBREVIATIONS[date.getDay()];
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  return `${weekday} ${date.getDate()} ${month} ${date.getFullYear()}`;
}

/** Hora local compacta, p. ej. "14:05" (indicador de actualización). */
export function formatTimeLabel(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
