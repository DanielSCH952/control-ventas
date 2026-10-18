import { SERVICE_TYPES } from '@/constants/services';
import type {
  PeriodReport,
  ReportPeriod,
  ServiceBreakdownRow,
  UserBreakdownRow,
} from '@/types/Report';
import type { Sale } from '@/types/Sale';
import type { ServiceType } from '@/types/Service';

import { isDateInPeriod } from './reportPeriods';

/**
 * Agregaciones PURAS de reportes (Sprint 5). Sin React ni Firebase: reciben
 * ventas ya convertidas (`Sale[]`) y devuelven un `PeriodReport` tipado.
 *
 * Reglas de cálculo (ver FIREBASE.md, Sprint 5):
 *  - Todo el dinero se acumula en ENTEROS de centavos; nunca punto flotante.
 *  - `saleCount` cuenta ventas; `quantityUnits` suma `quantity`. No se
 *    confunden y ninguna venta se cuenta dos veces: las funciones reciben
 *    una lista y cada documento entra exactamente una vez.
 *  - Las ventas editadas se atribuyen al creador original (`createdBy`) y a
 *    su fecha original (`createdAt`); `updatedBy`/`updatedAt` solo son
 *    auditoría y NUNCA definen período ni autoría.
 *  - Los porcentajes son solo presentación: se derivan de los totales
 *    exactos y jamás se usan para calcular otros indicadores.
 */

/**
 * Contrato mínimo que una venta debe cumplir para entrar al reporte.
 * Un documento que no lo cumpla se EXCLUYE (no contamina totales) y queda
 * registrado en `invalidSaleCount` con una advertencia en consola.
 */
export function isReportableSale(sale: Sale): boolean {
  return (
    sale.createdAt instanceof Date &&
    !Number.isNaN(sale.createdAt.getTime()) &&
    typeof sale.createdBy === 'string' &&
    sale.createdBy.length > 0 &&
    typeof sale.createdByName === 'string' &&
    sale.createdByName.length > 0 &&
    Number.isInteger(sale.quantity) &&
    sale.quantity >= 1 &&
    Number.isInteger(sale.totalCents) &&
    sale.totalCents >= 0
  );
}

/**
 * Porcentaje de `partCents` respecto a `totalCents`, con 2 decimales como
 * máximo. Si el total es 0 (o negativo por datos corruptos) devuelve 0:
 * nunca divide entre cero.
 */
export function percentageOfTotal(partCents: number, totalCents: number): number {
  if (totalCents <= 0 || partCents <= 0) {
    return 0;
  }
  return Math.round((partCents * 10_000) / totalCents) / 100;
}

/** Presentación de porcentajes: "50 %", "33.33 %", "0 %". */
export function formatPercentage(percentage: number): string {
  const rounded = Math.round(percentage * 100) / 100;
  return `${rounded} %`;
}

interface ServiceBucket {
  saleCount: number;
  quantityUnits: number;
  totalCents: number;
}

interface UserBucket extends ServiceBucket {
  createdBy: string;
  /** Nombre histórico mostrado: el del registro MÁS RECIENTE del UID. */
  createdByName: string;
  latestCreatedAt: Date;
  latestSaleId: string;
}

/**
 * Construye el resumen del período a partir de las ventas ya convertidas.
 *
 * `period` es opcional: si se proporciona, solo se agregan las ventas cuyo
 * `createdAt` local caiga en [start, end). Es un doble filtro de seguridad:
 * la consulta de Firestore ya filtra por `createdAt`; esto garantiza que un
 * documento con fecha corrupta no entre por error.
 *
 * Determinismo: la misma entrada produce siempre la misma salida (las filas
 * se ordenan por criterios estables y los empates se rompen por UID/fecha).
 */
export function buildPeriodReport(
  allSales: readonly Sale[],
  period?: ReportPeriod,
): PeriodReport {
  const validSales: Sale[] = [];
  let invalidSaleCount = 0;

  for (const sale of allSales) {
    if (!isReportableSale(sale)) {
      invalidSaleCount += 1;
      // Señal diagnóstica en desarrollo: el documento no bloquea el
      // reporte, pero no pasa en silencio.
      console.warn(
        '[reportAggregations] Venta con datos inválidos, se excluye del reporte:',
        sale?.id,
      );
      continue;
    }
    if (period && !isDateInPeriod(sale.createdAt, period)) {
      continue;
    }
    validSales.push(sale);
  }

  // Indicadores generales: sumas enteras exactas de centavos.
  let totalCents = 0;
  let quantityUnits = 0;
  let topSaleCents: number | null = null;

  const services = new Map<ServiceType, ServiceBucket>();
  for (const serviceType of SERVICE_TYPES) {
    services.set(serviceType, { saleCount: 0, quantityUnits: 0, totalCents: 0 });
  }

  const users = new Map<string, UserBucket>();

  for (const sale of validSales) {
    totalCents += sale.totalCents;
    quantityUnits += sale.quantity;
    if (topSaleCents === null || sale.totalCents > topSaleCents) {
      topSaleCents = sale.totalCents;
    }

    const byService = services.get(sale.serviceType);
    if (byService) {
      byService.saleCount += 1;
      byService.quantityUnits += sale.quantity;
      byService.totalCents += sale.totalCents;
    }

    let byUser = users.get(sale.createdBy);
    if (!byUser) {
      byUser = {
        createdBy: sale.createdBy,
        createdByName: sale.createdByName,
        latestCreatedAt: sale.createdAt,
        latestSaleId: sale.id,
        saleCount: 0,
        quantityUnits: 0,
        totalCents: 0,
      };
      users.set(sale.createdBy, byUser);
    }
    byUser.saleCount += 1;
    byUser.quantityUnits += sale.quantity;
    byUser.totalCents += sale.totalCents;
    // Criterio documentado: ante nombres históricos distintos del mismo UID,
    // se muestra el nombre del registro más reciente (desempate por id de
    // venta). Nunca se atribuyen ventas antiguas al nombre actual de OTRO
    // usuario: la agrupación es por UID, no por nombre.
    if (
      sale.createdAt.getTime() > byUser.latestCreatedAt.getTime() ||
      (sale.createdAt.getTime() === byUser.latestCreatedAt.getTime() &&
        sale.id > byUser.latestSaleId)
    ) {
      byUser.createdByName = sale.createdByName;
      byUser.latestCreatedAt = sale.createdAt;
      byUser.latestSaleId = sale.id;
    }
  }

  const saleCount = validSales.length;
  const averageTicketCents = saleCount > 0 ? Math.round(totalCents / saleCount) : 0;

  const emptyBucket: ServiceBucket = { saleCount: 0, quantityUnits: 0, totalCents: 0 };

  const serviceRows: ServiceBreakdownRow[] = SERVICE_TYPES.map((serviceType) => {
    const bucket = services.get(serviceType) ?? emptyBucket;
    return {
      serviceType,
      saleCount: bucket.saleCount,
      quantityUnits: bucket.quantityUnits,
      totalCents: bucket.totalCents,
      percentageOfTotal: percentageOfTotal(bucket.totalCents, totalCents),
    };
  });

  const userRows: UserBreakdownRow[] = Array.from(users.values())
    .map((bucket) => ({
      createdBy: bucket.createdBy,
      createdByName: bucket.createdByName,
      saleCount: bucket.saleCount,
      quantityUnits: bucket.quantityUnits,
      totalCents: bucket.totalCents,
      percentageOfTotal: percentageOfTotal(bucket.totalCents, totalCents),
    }))
    // Orden determinista: total vendido ↓, luego ventas ↓, luego UID ↑.
    .sort((a, b) => {
      if (a.totalCents !== b.totalCents) {
        return b.totalCents - a.totalCents;
      }
      if (a.saleCount !== b.saleCount) {
        return b.saleCount - a.saleCount;
      }
      return a.createdBy < b.createdBy ? -1 : a.createdBy > b.createdBy ? 1 : 0;
    });

  return {
    totals: {
      totalCents,
      saleCount,
      quantityUnits,
      averageTicketCents,
      topSaleCents,
    },
    services: serviceRows,
    users: userRows,
    invalidSaleCount,
  };
}
