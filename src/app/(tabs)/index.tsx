import { useCallback, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { getServiceLabel } from '@/constants/services';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { AppError } from '@/services/errors';
import { listRecentSales } from '@/services/saleService';
import { formatCents } from '@/utils/currency';
import { formatSaleDate } from '@/utils/datetime';
import type { Sale } from '@/types/Sale';

/**
 * Pantalla principal. Muestra el negocio, su código de invitación y la
 * lista inicial de ventas (Sprint 3). La lista se recarga al entrar o
 * volver a la pantalla; la sincronización en tiempo real (`onSnapshot`)
 * corresponde al Sprint 4.
 */
export default function HomeScreen() {
  const { profile, business } = useAuth();
  const [copied, setCopied] = useState(false);

  const [sales, setSales] = useState<Sale[] | null>(null);
  const [loadingSales, setLoadingSales] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Consulta inicial de ventas del negocio del usuario autenticado.
  const loadSales = useCallback(async () => {
    if (!business) {
      return;
    }
    setLoadingSales(true);
    setSalesError(null);
    try {
      setSales(await listRecentSales(business.id));
    } catch (error) {
      setSales([]);
      setSalesError(
        error instanceof AppError
          ? error.message
          : 'No pudimos cargar las ventas. Revisa tu conexión.',
      );
    } finally {
      setLoadingSales(false);
    }
  }, [business]);

  // Recarga al entrar a la pantalla y al volver de registrar una venta.
  useFocusEffect(
    useCallback(() => {
      loadSales();
    }, [loadSales]),
  );


  async function handleCopyCode() {
    if (!business) {
      return;
    }
    await Clipboard.setStringAsync(business.joinCode);
    setCopied(true);
  }

  async function handleShareCode() {
    if (!business) {
      return;
    }
    await Share.share({
      message: `Únete a mi negocio "${business.name}" con este código de invitación: ${business.joinCode}`,
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <ThemedText type="small" themeColor="textSecondary">
            Bienvenido/a
          </ThemedText>
          <ThemedText type="title">{business?.name ?? 'Tu negocio'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Hola, {profile?.name ?? ''}. Este es el inicio del panel del negocio.
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.codeCard}>
            <ThemedText type="smallBold">Código de invitación</ThemedText>
            <ThemedText type="title" style={styles.codeText}>
              {business?.joinCode ?? '------'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Compártelo para que otra persona se una a este negocio.
            </ThemedText>
            <PrimaryButton
              label={copied ? '¡Copiado!' : 'Copiar código'}
              onPress={handleCopyCode}
            />
            <PrimaryButton label="Compartir" onPress={handleShareCode} />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.salesCard}>
            <View style={styles.salesHeader}>
              <ThemedText type="smallBold">Ventas del negocio</ThemedText>
              <PrimaryButton label="Registrar venta" onPress={() => router.push('/sales/new')} />
            </View>

            {loadingSales ? (
              <ActivityIndicator style={styles.salesState} />
            ) : salesError ? (
              <View style={styles.salesState}>
                <ThemedText type="small" themeColor="textSecondary">
                  {salesError}
                </ThemedText>
                <PrimaryButton label="Reintentar" onPress={loadSales} />
              </View>
            ) : sales && sales.length > 0 ? (
              <View style={styles.salesList}>
                {sales.map((sale) => (
                  <ThemedView key={sale.id} type="backgroundSelected" style={styles.saleItem}>
                    <View style={styles.saleItemHeader}>
                      <ThemedText type="smallBold">{getServiceLabel(sale.serviceType)}</ThemedText>
                      <ThemedText type="smallBold">{formatCents(sale.totalCents)}</ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {sale.quantity} × {formatCents(sale.unitPriceCents)} · registrada por{' '}
                      {sale.createdByName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatSaleDate(sale.createdAt)}
                    </ThemedText>
                  </ThemedView>
                ))}
              </View>
            ) : (
              <View style={styles.salesState}>
                <ThemedText type="small" themeColor="textSecondary">
                  Todavía no hay ventas registradas. Pulsa «Registrar venta» para anotar la
                  primera copia, impresión o recarga del día.
                </ThemedText>
              </View>
            )}
          </ThemedView>
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
  codeCard: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'stretch',
  },
  salesCard: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  salesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  salesList: {
    gap: Spacing.two,
  },
  saleItem: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  saleItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  salesState: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  codeText: {
    letterSpacing: 8,
    textAlign: 'center',
  },
});
