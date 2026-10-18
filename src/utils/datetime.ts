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
