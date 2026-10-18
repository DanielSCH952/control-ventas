import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { AppError } from '@/services/errors';
import { db } from '@/services/firebase';
import { toSale } from '@/services/saleValidation';
import type { Sale } from '@/types/Sale';

/** Máximo de ventas recientes que la suscripción mantiene en memoria. */
const REALTIME_SALES_LIMIT = 100;

/** Instantánea válida, etiquetada con el negocio al que pertenece. */
interface SalesSnapshotState {
  businessId: string;
  sales: Sale[];
  lastUpdatedAt: Date;
}

/** Error de suscripción, etiquetado con el negocio al que pertenece. */
interface SalesErrorState {
  businessId: string;
  error: AppError;
}

export interface UseSalesResult {
  /** Ventas ordenadas por `createdAt` descendente; null hasta la primera instantánea. */
  sales: Sale[] | null;
  /** true solo durante la carga inicial (antes de la primera instantánea). */
  loading: boolean;
  /** Último error de la suscripción; no vacía la lista si ya hay datos. */
  error: AppError | null;
  /** Momento local en que llegó la última instantánea (indicador de sincronía). */
  lastUpdatedAt: Date | null;
  /** Vuelve a abrir la suscripción tras un error. */
  retry: () => void;
}

/** Traduce un error de Firestore a un `AppError` con mensaje apto para la interfaz. */
function toSubscriptionError(error: { code: string }): AppError {
  switch (error.code) {
    case 'permission-denied':
      return new AppError(
        'No tienes permiso para ver las ventas de este negocio.',
        'sales-read-denied',
      );
    case 'unauthenticated':
      return new AppError(
        'Tu sesión expiró. Cierra y vuelve a abrir la aplicación.',
        'sales-read-unauthenticated',
      );
    case 'unavailable':
    case 'failed-precondition':
      return new AppError(
        'Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
        'sales-read-offline',
      );
    default:
      return new AppError(
        'No pudimos sincronizar las ventas. Revisa tu conexión.',
        'sales-read-failed',
      );
  }
}

/**
 * Suscripción en tiempo real a las ventas del negocio del usuario (Sprint 4).
 *
 * El `businessId` nunca llega desde la interfaz: se toma del contexto de
 * autenticación validado (`useAuth`) y solo se consulta cuando `AuthStatus`
 * es `ready`. La suscripción:
 *  - se cancela al desmontar el componente o al cambiar de negocio;
 *  - no se duplica (una sola por `businessId` + reintento);
 *  - ignora instantáneas que llegan tras la limpieza;
 *  - conserva la lista anterior cuando la suscripción falla (el error nunca
 *    se sustituye por una lista vacía);
 *  - se limita a las 100 ventas más recientes por `createdAt` descendente.
 *
 * Fechas pendientes: los `serverTimestamp()` recién escritos aún no tienen
 * valor del servidor en la instantánea local. Se leen con
 * `serverTimestamps: 'estimate'`, de modo que Firestore los resuelve con la
 * hora local del dispositivo. Es una aproximación VISIBLE hasta que el
 * servidor confirma la escritura; no debe confundirse con la fecha real.
 */
export function useSales(): UseSalesResult {
  const { status, business } = useAuth();
  // Solo con sesión resuelta existe un businessId fiable.
  const businessId = status === 'ready' && business ? business.id : null;

  const [snapshot, setSnapshot] = useState<SalesSnapshotState | null>(null);
  const [errorState, setErrorState] = useState<SalesErrorState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Sin sesión resuelta no se consulta nada: no existe un negocio válido.
    if (!businessId) {
      return;
    }

    let cancelled = false;

    const salesQuery = query(
      collection(db, 'businesses', businessId, 'sales'),
      orderBy('createdAt', 'desc'),
      limitQuery(REALTIME_SALES_LIMIT),
    );

    const unsubscribe = onSnapshot(
      salesQuery,
      (querySnapshot) => {
        if (cancelled) {
          return;
        }
        const nextSales: Sale[] = [];
        // 'estimate' resuelve los serverTimestamp() pendientes con la hora
        // local (aproximación documentada en el comentario del hook).
        querySnapshot.forEach((document) => {
          const sale = toSale(document.id, document.data({ serverTimestamps: 'estimate' }));
          if (sale) {
            nextSales.push(sale);
          }
        });
        setSnapshot({ businessId, sales: nextSales, lastUpdatedAt: new Date() });
      },
      (snapshotError) => {
        if (cancelled) {
          return;
        }
        console.warn('[useSales] Error en la suscripción de ventas:', snapshotError.code);
        setErrorState({ businessId, error: toSubscriptionError(snapshotError) });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [businessId, attempt]);

  const retry = useCallback(() => {
    // Limpiar el error aquí (manejador de evento) y forzar una nueva
    // suscripción mediante `attempt`.
    setErrorState(null);
    setAttempt((count) => count + 1);
  }, []);

  // Estado derivado, enmascarado por negocio: los datos o errores de un
  // negocio anterior nunca se muestran para el actual.
  const hasCurrentSnapshot = snapshot !== null && snapshot.businessId === businessId;
  const currentError =
    errorState !== null && errorState.businessId === businessId ? errorState.error : null;

  const sales = businessId !== null && hasCurrentSnapshot && snapshot ? snapshot.sales : null;
  // Carga inicial: solo hasta la primera instantánea del negocio actual.
  // Las actualizaciones en tiempo real posteriores NO la reactivan: la
  // lista cambia en su sitio.
  const loading = businessId !== null && !hasCurrentSnapshot && currentError === null;

  return {
    sales,
    loading,
    error: currentError,
    lastUpdatedAt: hasCurrentSnapshot && snapshot ? snapshot.lastUpdatedAt : null,
    retry,
  };
}
