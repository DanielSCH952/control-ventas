import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MONTH_NAMES, WEEKDAY_HEADER } from '@/utils/datetime';
import { getMonthCalendar, isSameDay } from '@/utils/reportPeriods';

interface ReportCalendarProps {
  /** Día seleccionado (en modo semanal se resalta toda su semana vía el ancla). */
  selectedDate: Date;
  /** Se llama al tocar cualquier día visible. */
  onSelectDate: (date: Date) => void;
}

/**
 * Calendario mensual compacto para elegir el día del reporte (Sprint 5).
 *
 * Semanas de lunes a domingo. Sin dependencias externas: solo React Native,
 * para funcionar igual en iOS, Android y web.
 */
export function ReportCalendar({ selectedDate, onSelectDate }: ReportCalendarProps) {
  const theme = useTheme();
  // El cursor del mes es estado interno; el componente padre lo REMONTA
  // (key) cada vez que cambia la fecha seleccionada, así el cursor siempre
  // arranca en el mes de la selección sin necesitar efectos.
  const [cursor, setCursor] = useState(() => ({
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth(),
  }));

  const weeks = useMemo(
    () => getMonthCalendar(cursor.year, cursor.month),
    [cursor],
  );

  const monthLabel = `${MONTH_NAMES[cursor.month]} ${cursor.year}`;
  const today = new Date();

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          onPress={() => shiftMonth(-1)}
          style={styles.arrow}
        >
          <ThemedText type="smallBold">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.monthLabel}>
          {monthLabel}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          onPress={() => shiftMonth(1)}
          style={styles.arrow}
        >
          <ThemedText type="smallBold">›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_HEADER.map((weekday) => (
          <ThemedText key={weekday} type="small" themeColor="textSecondary" style={styles.cell}>
            {weekday}
          </ThemedText>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.weekRow}>
          {week.map((day) => {
            const selected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            const outsideMonth = day.getMonth() !== cursor.month;
            return (
              <Pressable
                key={day.toISOString()}
                accessibilityRole="button"
                accessibilityLabel={day.toDateString()}
                onPress={() => onSelectDate(day)}
                style={[
                  styles.cell,
                  styles.dayCell,
                  { backgroundColor: selected ? theme.text : 'transparent' },
                ]}
              >
                <ThemedText
                  type="small"
                  themeColor={selected ? 'background' : outsideMonth ? 'textSecondary' : 'text'}
                  style={outsideMonth && !selected ? styles.outside : undefined}
                >
                  {day.getDate()}
                </ThemedText>
                {isToday && !selected ? <View style={styles.todayDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ThemedView>
  );
}

const DAY_CELL_SIZE = 38;

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  monthLabel: {
    textAlign: 'center',
  },
  arrow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    textAlign: 'center',
  },
  dayCell: {
    height: DAY_CELL_SIZE,
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  outside: {
    opacity: 0.45,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3c87f7',
    marginTop: 2,
  },
});
