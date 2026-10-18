import { AppError } from '@/services/errors';

/**
 * Utilidades de dinero. Estrategia única de la aplicación:
 *  - Todo se almacena y calcula en centavos enteros (sin punto flotante).
 *  - La interfaz edita/importa pesos con decimales (máximo 2) usando
 *    punto o coma como separador decimal.
 *  - La presentación es peso mexicano (MXN): "$1.50".
 */

/** Máximo de dígitos de pesos aceptados al escribir un precio. */
const MONEY_MAX_PESOS_DIGITS = 7;

// Enteros con hasta 2 decimales, aceptando "." o "," como separador.
const MONEY_INPUT_REGEX = new RegExp(`^\\d{1,${MONEY_MAX_PESOS_DIGITS}}([.,]\\d{1,2})?$`);

/**
 * Convierte un texto introducido por el usuario (pesos) a centavos enteros.
 * Rechaza entradas vacías, negativas o mal formadas lanzando `AppError`
 * con un mensaje apto para la interfaz.
 *
 * Ejemplos: "1.50" → 150 · "1,5" → 150 · "2" → 200 · "" → error.
 */
export function parseMoneyToCents(raw: string): number {
  const text = raw.trim().replace(',', '.');
  if (!MONEY_INPUT_REGEX.test(text)) {
    throw new AppError('Escribe un precio válido, por ejemplo 1.50.', 'invalid-money');
  }

  const separatorIndex = text.indexOf('.');
  if (separatorIndex === -1) {
    return Number(text) * 100;
  }

  const pesos = Number(text.slice(0, separatorIndex));
  // "1.5" se interpreta como $1.50 (se rellena a 2 decimales).
  const decimals = text.slice(separatorIndex + 1).padEnd(2, '0');
  return pesos * 100 + Number(decimals);
}

/** Formatea centavos como moneda MXN, p. ej. 150 → "$1.50". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const pesos = Math.floor(abs / 100);
  const remainingCents = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${pesos}.${remainingCents}`;
}

/**
 * Convierte centavos al texto que edita la interfaz (siempre 2 decimales),
 * p. ej. 150 → "1.50". Es la inversa de `parseMoneyToCents`.
 */
export function centsToInputString(cents: number): string {
  const pesos = Math.floor(cents / 100);
  const remainingCents = (Math.abs(cents) % 100).toString().padStart(2, '0');
  return `${pesos}.${remainingCents}`;
}
