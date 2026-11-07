/**
 * Generación de identificadores estables para escrituras que deben ser
 * idempotentes ante reintentos (Sprint 6).
 *
 * Contexto: `addDoc()` genera un ID NUEVO en cada llamada. Si una escritura
 * llega al servidor pero el cliente pierde la conexión antes de recibir la
 * confirmación, un reintento con `addDoc()` crearía un documento duplicado.
 * La estrategia de este sprint es generar el identificador UNA sola vez por
 * intento lógico (en la pantalla que inicia la operación) y reutilizarlo en
 * los reintentos controlados, usando `setDoc()`. El servicio verifica antes
 * de escribir si el documento ya existe con el mismo contenido: en ese caso
 * el intento anterior SÍ llegó al servidor y se informa éxito sin duplicar.
 *
 * Los identificadores NO se derivan del contenido: dos ventas legítimas
 * idénticas (mismo servicio, cantidad y precio) reciben IDs distintos porque
 * cada pulsación de «Guardar» que inicia un intento nuevo genera su propio ID.
 */

/** Prefijo con el que se marcan los IDs de venta. */
const SALE_ID_PREFIX = 'sale';

/** Longitud total del identificador: prefijo + guion + 32 caracteres. */
const SALE_ID_LENGTH = SALE_ID_PREFIX.length + 1 + 32;

/**
 * Genera un identificador aleatorio con formato `sale-<hex>`.
 * Usa `crypto.randomUUID()` (disponible en Hermes con Intl habilitado, Node
 * 19+ y navegadores) con un generador alternativo basado en `Math.random`
 * como respaldo. En ambos casos el espacio de valores es lo bastante grande
 * para que las colisiones entre intentos distintos sean despreciables.
 */
export function generateSaleId(): string {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `${SALE_ID_PREFIX}-${globalCrypto.randomUUID().replace(/-/g, '')}`;
  }
  let hex = '';
  for (let index = 0; index < 32; index += 1) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `${SALE_ID_PREFIX}-${hex}`;
}

/**
 * Comprueba que un identificador de venta tenga el formato esperado
 * (`sale-` + 32 caracteres hexadecimales). El servicio lo valida antes de
 * usarlo como ID de documento para que un valor corrupto nunca llegue a
 * Firestore.
 */
export function isValidSaleId(saleId: string): boolean {
  return (
    saleId.length === SALE_ID_LENGTH &&
    saleId.startsWith(`${SALE_ID_PREFIX}-`) &&
    /^[0-9a-f]{32}$/.test(saleId.slice(SALE_ID_PREFIX.length + 1))
  );
}

// ===== Identificadores de negocio (creación idempotente) =====

/** Prefijo con el que se marcan los IDs de negocio. */
const BUSINESS_ID_PREFIX = 'biz';

/** Longitud total: prefijo + guion + 32 caracteres hexadecimales. */
const BUSINESS_ID_LENGTH = BUSINESS_ID_PREFIX.length + 1 + 32;

/**
 * Genera un identificador estable para UN intento de creación de negocio
 * (`biz-<hex>`). La pantalla lo genera una sola vez y lo reutiliza en los
 * reintentos; `createBusiness` lo usa como ID del documento para detectar
 * un intento anterior a medias y completarlo en lugar de duplicar.
 */
export function generateBusinessId(): string {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `${BUSINESS_ID_PREFIX}-${globalCrypto.randomUUID().replace(/-/g, '')}`;
  }
  let hex = '';
  for (let index = 0; index < 32; index += 1) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `${BUSINESS_ID_PREFIX}-${hex}`;
}

/** Valida el formato de un identificador de negocio antes de usarlo como ID. */
export function isValidBusinessId(businessId: string): boolean {
  return (
    businessId.length === BUSINESS_ID_LENGTH &&
    businessId.startsWith(`${BUSINESS_ID_PREFIX}-`) &&
    /^[0-9a-f]{32}$/.test(businessId.slice(BUSINESS_ID_PREFIX.length + 1))
  );
}
