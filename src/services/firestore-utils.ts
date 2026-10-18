/**
 * Convierte un valor de fecha de Firestore (Timestamp) a Date.
 * Si el valor no es válido (por ejemplo, un serverTimestamp aún sin resolver),
 * devuelve la fecha actual como aproximación.
 */
export function parseDate(value: unknown): Date {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}
