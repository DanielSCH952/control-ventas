import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ReportCalendar } from '@/components/report-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getServiceLabel } from '@/constants/services';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useReportSales } from '@/hooks/useReportSales';
import { useTheme } from '@/hooks/use-theme';
import type { ReportMode } from '@/types/Report';
import { formatCents } from '@/utils/currency';
import { formatDayLabel, formatTimeLabel } from '@/utils/datetime';
import { buildPeriodReport, formatPercentage } from '@/utils/reportAggregations';
import { addDays, getDayPeriod, getWeekPeriod } from '@/utils/reportPeriods';

/**
 * Pantalla de Reportes (Sprint 5).
 *
 * Permite consultar las ventas registradas de un día o de una semana
 * (lunes → domingo) del negocio activo, con desglose por servicio y por
 * usuario que registró cada venta.
 *
 * - El período se define en la zona horaria local del dispositivo y es un
 *   intervalo semiabierto [inicio, fin).
 * - La fuente de datos es `useReportSales`: UNA suscripción por período que
 *   consulta TODAS las ventas del intervalo (no el límite de 100 de
 *   `useSales`) y se actualiza en tiempo real.
 * - Los importes se formatean con `formatCents()`; los porcentajes son solo
 *   presentación.
 * - Los reportes reflejan ventas REGISTRADAS en la aplicación; no son
 *   utilidad, ganancia neta ni dinero efectivamente cobrado.
 */
export default function ReportsScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<ReportMode>('day');
  // Inicializador perezoso: «hoy» se fija una sola vez al montar; el botón
  // «Hoy» recalcula la fecha en el momento del toque.
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Período consultado: objeto estable mientras no cambien modo/ancla, para
  // que `useReportSales` no reabra la suscripción en cada render.
  const period = useMemo(
    () => (mode === 'day' ? getDayPeriod(anchor) : getWeekPeriod(anchor)),
    [mode, anchor],
  );

  const { sales, pendingTimestampCount, loading, error, lastUpdatedAt, retry } =
    useReportSales(period);

  // Todos los indicadores y desgloses derivan del MISMO conjunto de ventas.
  const report = useMemo(() => buildPeriodReport(sales ?? [], period), [sales, period]);

  const rangeLabel =
    mode === 'day'
      ? formatDayLabel(period.start)
      : `${formatDayLabel(period.start)} – ${formatDayLabel(addDays(period.end, -1))}`;

  const stepDays = mode === 'day' ? 1 : 7;
  const goPrev = () => setAnchor((current) => addDays(current, -stepDays));
  const goNext = () => setAnchor((current) => addDays(current, stepDays));
  const goToday = () => setAnchor(new Date());

  const hasSales = report.totals.saleCount > 0;
  // Error sin datos: estado de error con reintentar. Error con datos ya en
  // pantalla: aviso compacto sin perder el reporte.
  const showErrorState = error !== null && sales === null;
  const showErrorBanner = error !== null && sales !== null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <ThemedText type="small" themeColor="textSecondary">
            Reportes
          </ThemedText>
          <ThemedText type="subtitle">Ventas del período</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Resumen de las ventas registradas en la aplicación. No representa utilidad, ganancia
            neta ni dinero cobrado por otros medios.
          </ThemedText>

          {/* Selector Diario / Semanal */}
          <View style={styles.modeRow}>
            {(['day', 'week'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setMode(option)}
                style={[
                  styles.modePill,
                  {
                    backgroundColor:
                      mode === option ? theme.backgroundSelected : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText type="smallBold">
                  {option === 'day' ? 'Diario' : 'Semanal'}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Período consultado y navegación */}
          <ThemedView type="backgroundElement" style={styles.periodCard}>
            <ThemedText type="smallBold" style={styles.rangeLabel}>
              {rangeLabel}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {mode === 'week'
                ? 'Semana de lunes a domingo (zona horaria del dispositivo)'
                : 'Día completo (zona horaria del dispositivo)'}
            </ThemedText>
            <View style={styles.navRow}>
              <PrimaryButton label="‹ Anterior" onPress={goPrev} className="flex-1" />
              <PrimaryButton label="Hoy" onPress={goToday} className="flex-1" />
              <PrimaryButton label="Siguiente ›" onPress={goNext} className="flex-1" />
            </View>
            <PrimaryButton
              label={calendarOpen ? 'Ocultar calendario' : 'Elegir fecha'}
              onPress={() => setCalendarOpen((open) => !open)}
            />
          </ThemedView>

          {calendarOpen ? (
            <ReportCalendar
              key={anchor.toISOString()}
              selectedDate={anchor}
              onSelectDate={(date) => setAnchor(date)}
            />
          ) : null}
          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                Cargando reporte…
              </ThemedText>
            </View>
          ) : showErrorState && error ? (
            <View style={styles.state}>
              <ThemedText type="small" themeColor="textSecondary">
                {error.message}
              </ThemedText>
              <PrimaryButton label="Reintentar" onPress={retry} />
            </View>
          ) : (
            <View style={styles.reportBody}>
              {showErrorBanner && error ? (
                <View style={styles.state}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {error.message} Se muestra el último reporte recibido.
                  </ThemedText>
                  <PrimaryButton label="Reintentar" onPress={retry} />
                </View>
              ) : lastUpdatedAt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Actualizado en tiempo real · {formatTimeLabel(lastUpdatedAt)}
                </ThemedText>
              ) : null}

              {pendingTimestampCount > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {pendingTimestampCount} venta(s) recién registradas esperan la confirmación de su
                  fecha en el servidor; aparecerán en el período correcto en cuanto se confirme.
                </ThemedText>
              ) : null}

              {/* Resumen de indicadores */}
              <View style={styles.grid}>
                <ThemedView type="backgroundElement" style={styles.summaryCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Total vendido
                  </ThemedText>
                  <ThemedText type="smallBold">{formatCents(report.totals.totalCents)}</ThemedText>
                </ThemedView>
                <ThemedView type="backgroundElement" style={styles.summaryCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Ventas
                  </ThemedText>
                  <ThemedText type="smallBold">{report.totals.saleCount}</ThemedText>
                </ThemedView>
                <ThemedView type="backgroundElement" style={styles.summaryCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Unidades registradas
                  </ThemedText>
                  <ThemedText type="smallBold">{report.totals.quantityUnits}</ThemedText>
                </ThemedView>
                <ThemedView type="backgroundElement" style={styles.summaryCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Ticket promedio
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {formatCents(report.totals.averageTicketCents)}
                  </ThemedText>
                </ThemedView>
                {report.totals.topSaleCents !== null ? (
                  <ThemedView type="backgroundElement" style={styles.summaryCard}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Mayor venta registrada
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {formatCents(report.totals.topSaleCents)}
                    </ThemedText>
                  </ThemedView>
                ) : null}
              </View>

              {!hasSales ? (
                <View style={styles.state}>
                  <ThemedText type="small" themeColor="textSecondary">
                    No hay ventas registradas en este período. Los importes muestran cero; usa
                    «Anterior» o el calendario para consultar otra fecha.
                  </ThemedText>
                </View>
              ) : null}

              {/* Desglose por servicio */}
              <ThemedView type="backgroundElement" style={styles.sectionCard}>
                <ThemedText type="smallBold">Desglose por servicio</ThemedText>
                {report.services.map((row) => (
                  <View key={row.serviceType} style={styles.breakdownRow}>
                    <View style={styles.breakdownInfo}>
                      <ThemedText type="smallBold">{getServiceLabel(row.serviceType)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {row.saleCount} venta(s) · {row.quantityUnits} unidad(es) ·{' '}
                        {formatPercentage(row.percentageOfTotal)}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{formatCents(row.totalCents)}</ThemedText>
                  </View>
                ))}
              </ThemedView>

              {/* Desglose por usuario */}
              <ThemedView type="backgroundElement" style={styles.sectionCard}>
                <ThemedText type="smallBold">Desglose por usuario</ThemedText>
                {report.users.length > 0 ? (
                  report.users.map((row) => (
                    <View key={row.createdBy} style={styles.breakdownRow}>
                      <View style={styles.breakdownInfo}>
                        <ThemedText type="smallBold">{row.createdByName}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {row.saleCount} venta(s) · {row.quantityUnits} unidad(es) ·{' '}
                          {formatPercentage(row.percentageOfTotal)}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold">{formatCents(row.totalCents)}</ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Ningún usuario registró ventas en este período.
                  </ThemedText>
                )}
              </ThemedView>

            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.six,
  },
  contentContainer: {
    alignItems: 'stretch',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  periodCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rangeLabel: {
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  state: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  reportBody: {
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  summaryCard: {
    width: '48.5%',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  sectionCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  breakdownInfo: {
    flex: 1,
    gap: Spacing.half,
  },
});

