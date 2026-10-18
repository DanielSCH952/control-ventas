import type { ServiceType } from './Service';

/**
 * Tipados de los reportes de ventas (Sprint 5).
 *
 * Los reportes agregan ventas YA convertidas (`Sale`); estos tipos describen
 * únicamente los resultados del cálculo puro que vive en
 * `src/utils/reportAggregations.ts`.
 */

/** Modos de consulta del reporte. */
export type ReportMode = 'day' | 'week';

/**
 * Intervalo semiabierto de fechas: `start` incluido, `end` excluido.
 * Ambos límites están construidos en la zona horaria LOCAL del dispositivo.
 */
export interface ReportPeriod {
  start: Date;
  end: Date;
}

/** Indicadores generales del período. */
export interface ReportTotals {
  /** Suma exacta de `totalCents` (enteros; nunca punto flotante). */
  totalCents: number;
  /** Número de ventas válidas incluidas en el período. */
  saleCount: number;
  /** Suma de `quantity` (unidades registradas, NO número de ventas). */
  quantityUnits: number;
  /** totalCents / saleCount redondeado al centavo; 0 si no hay ventas. */
  averageTicketCents: number;
  /** Mayor `totalCents` registrado en el período; null sin ventas. */
  topSaleCents: number | null;
}

/** Fila del desglose por tipo de servicio (siempre las seis del catálogo). */
export interface ServiceBreakdownRow {
  serviceType: ServiceType;
  saleCount: number;
  quantityUnits: number;
  totalCents: number;
  /** Porcentaje del total vendido del período (2 decimales como máximo). */
  percentageOfTotal: number;
}

/**
 * Fila del desglose por usuario. La agrupación es por `createdBy` (UID); el
 * nombre mostrado es el histórico del registro más reciente de ese UID.
 */
export interface UserBreakdownRow {
  createdBy: string;
  createdByName: string;
  saleCount: number;
  quantityUnits: number;
  totalCents: number;
  percentageOfTotal: number;
}

/** Resumen completo de un período. */
export interface PeriodReport {
  totals: ReportTotals;
  /** Una fila por cada servicio del catálogo, en el orden de `SERVICE_TYPES`. */
  services: ServiceBreakdownRow[];
  /** Usuarios con al menos una venta, ordenados por total vendido. */
  users: UserBreakdownRow[];
  /** Ventas excluidas por datos inválidos (señal diagnóstica en desarrollo). */
  invalidSaleCount: number;
}

