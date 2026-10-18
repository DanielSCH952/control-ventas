import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { AppError } from '@/services/errors';
import {
  subscribeSalesInPeriod,
  type PeriodSalesResult,
} from '@/services/reportService';
import type { ReportPeriod } from '@/types/Report';
import type { Sale } from '@/types/Sale';

/**
 * Suscripción en tiempo real a las ventas de un período de reporte (Sprint 5).
 *
 * Mismo contrato de seguridad que `useSales`: el `businessId` NUNCA llega
 * desde la interfaz, se toma del contexto de autenticación validado
 * (`useAuth`) y solo se consulta con `AuthStatus === 'ready'`.
 *
 * A diferencia de `useSales` (limitado a las 100 ventas recientes), esta
 * suscripción filtra por fechas en el servidor y recibe TODAS las ventas del
 * período consultado.
 *
 * Nota de rendimiento: el período debe ser un objeto memoizado por la
 * pantalla (p. ej. `useMemo` sobre modo + fecha ancla); en cada cambio de
 * período o negocio se cancela la suscripción anterior y se abre una nueva.
 * Solo existe UNA suscripción para todo el período: los indicadores,
 * agrupaciones y porcentajes se derivan del mismo conjunto de ventas.
 */

interface ReportSnapshotState {
  /** Clave negocio+período a la que pertenece la instantánea. */
  key: string;
  result: PeriodSalesResult;
  lastUpdatedAt: Date;
}

interface ReportErrorState {
  key: string;
  error: AppError;
}

function periodKey(businessId: string, period: ReportPeriod): string {
  return `${businessId}|${period.start.getTime()}|${period.end.getTime()}`;
}

export interface UseReportSalesResult {
  /** Ventas del período; null hasta la primera instantánea. */
  sales: Sale[] | null;
  /** Ventas recién creadas cuya fecha de servidor aún no está confirmada. */
  pendingTimestampCount: number;
  /** true solo durante la carga inicial del período actual. */
  loading: boolean;
  /** Último error de la suscripción; no vacía los datos ya cargados. */
  error: AppError | null;
  /** Momento local de la última instantánea (indicador de actualización). */
  lastUpdatedAt: Date | null;
  /** Vuelve a abrir la suscripción tras un error. */
  retry: () => void;
}

export function useReportSales(period: ReportPeriod | null): UseReportSalesResult {
  const { status, business } = useAuth();
  // Solo con sesión resuelta existe un businessId fiable.
  const businessId = status === 'ready' && business ? business.id : null;

  const [snapshot, setSnapshot] = useState<ReportSnapshotState | null>(null);
  const [errorState, setErrorState] = useState<ReportErrorState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Sin sesión resuelta o sin período no se consulta nada.
    if (!businessId || !period) {
      return;
    }

    let cancelled = false;
    const key = periodKey(businessId, period);

    const unsubscribe = subscribeSalesInPeriod({
      businessId,
      period,
      onData: (result) => {
        if (cancelled) {
          return;
        }
        setSnapshot({ key, result, lastUpdatedAt: new Date() });
      },
      onError: (error) => {
        if (cancelled) {
          return;
        }
        setErrorState({ key, error });
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [businessId, period, attempt]);

  const retry = useCallback(() => {
    setErrorState(null);
    setAttempt((count) => count + 1);
  }, []);

  const activeKey = businessId && period ? periodKey(businessId, period) : null;
  const hasCurrentSnapshot = snapshot !== null && snapshot.key === activeKey;
  const currentError =
    errorState !== null && errorState.key === activeKey ? errorState.error : null;

  const sales = activeKey !== null && hasCurrentSnapshot && snapshot ? snapshot.result.sales : null;
  const pendingTimestampCount =
    activeKey !== null && hasCurrentSnapshot && snapshot ? snapshot.result.pendingTimestampCount : 0;
  // Carga inicial: solo hasta la primera instantánea del período actual.
  // Las actualizaciones en tiempo real posteriores no la reactivan.
  const loading = activeKey !== null && !hasCurrentSnapshot && currentError === null;

  return {
    sales,
    pendingTimestampCount,
    loading,
    error: currentError,
    lastUpdatedAt: hasCurrentSnapshot && snapshot ? snapshot.lastUpdatedAt : null,
    retry,
  };
}
