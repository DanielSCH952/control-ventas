import { collection, onSnapshot, query, where } from 'firebase/firestore';

import type { ReportPeriod } from '@/types/Report';
import type { Sale } from '@/types/Sale';

import { db } from './firebase';
import { AppError } from './errors';
import { toSale } from './saleValidation';

/**
 * Consulta de reportes (Sprint 5).
 *
 * NO usa `useSales`: esa suscripción está limitada a las 100 ventas más
 * recientes del negocio y truncaría períodos con más actividad. Esta
 * consulta filtra por `createdAt` dentro del intervalo solicitado y devuelve
 * TODAS las ventas válidas del período (sin `limit`).
 *
 * - `businessId` llega SIEMPRE del contexto de autenticación validado; la
 *   interfaz nunca puede elegir otro negocio.
 * - Filtros equivalentes a `createdAt >= start` y `createdAt < end`
 *   (intervalo semiabierto; los límites se construyen en la zona horaria
 *   local del dispositivo).
 * - Un solo filtro de campo (`createdAt`) no requiere índice compuesto: el
 *   índice automático de un solo campo es suficiente (ver FIREBASE.md).
 * - `onSnapshot` mantiene el período activo actualizado (crear/editar/
 *   eliminar ventas dentro del período llega solo); la suscripción se
 *   cancela desde `useReportSales` al cambiar de período o negocio.
 *
 * Fechas pendientes: los documentos recién escritos con `serverTimestamp()`
 * aún no tienen fecha del servidor. Se leen con `serverTimestamps: 'none'`
 * (la fecha llega como null) y se EXCLUYEN del reporte en lugar de
 * asignarles una fecha aproximada que podría meterlas en el período
 * incorrecto. Se cuentan en `pendingTimestampCount` para que la interfaz
 * pueda avisar; cuando el servidor confirma la fecha, `onSnapshot` emite
 * una nueva instantánea y la venta entra a su período real.
 */

/** Instantánea de un período convertida y validada. */
export interface PeriodSalesResult {
  /** Ventas válidas del período con `createdAt` confirmado. */
  sales: Sale[];
  /** Ventas cuyo `serverTimestamp()` aún no ha resuelto el servidor. */
  pendingTimestampCount: number;
}

/** Traduce un error de Firestore a un `AppError` apto para la interfaz. */
function toReportError(error: { code: string }): AppError {
  switch (error.code) {
    case 'permission-denied':
      return new AppError(
        'No tienes permiso para ver los reportes de este negocio.',
        'report-read-denied',
      );
    case 'unauthenticated':
      return new AppError(
        'Tu sesión expiró. Cierra y vuelve a abrir la aplicación.',
        'report-read-unauthenticated',
      );
    case 'unavailable':
    case 'failed-precondition':
      return new AppError(
        'Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
        'report-read-offline',
      );
    default:
      return new AppError(
        'No pudimos cargar el reporte. Revisa tu conexión.',
        'report-read-failed',
      );
  }
}

/**
 * Suscripción en tiempo real a las ventas del período, del negocio activo.
 * Devuelve la función de cancelación.
 */
export function subscribeSalesInPeriod(params: {
  businessId: string;
  period: ReportPeriod;
  onData: (result: PeriodSalesResult) => void;
  onError: (error: AppError) => void;
}): () => void {
  const { businessId, period, onData, onError } = params;

  const salesQuery = query(
    collection(db, 'businesses', businessId, 'sales'),
    where('createdAt', '>=', period.start),
    where('createdAt', '<', period.end),
  );

  return onSnapshot(
    salesQuery,
    (snapshot) => {
      const sales: Sale[] = [];
      let pendingTimestampCount = 0;

      snapshot.forEach((document) => {
        // 'none' (valor por defecto): un serverTimestamp() pendiente llega
        // como null. No se estima la fecha: la venta espera la confirmación
        // del servidor para entrar al período que le corresponda.
        const data = document.data({ serverTimestamps: 'none' });
        const createdAt: unknown = data.createdAt;
        if (
          createdAt === null ||
          typeof (createdAt as { toDate?: unknown }).toDate !== 'function'
        ) {
          pendingTimestampCount += 1;
          return;
        }
        // Reutiliza el conversor de ventas existente; los documentos que no
        // cumplen el contrato se omiten (toSale registra la advertencia).
        const sale = toSale(document.id, data);
        if (sale) {
          sales.push(sale);
        }
      });

      onData({ sales, pendingTimestampCount });
    },
    (error) => {
      console.warn('[reportService] Error en la suscripción del reporte:', error.code);
      onError(toReportError(error));
    },
  );
}
