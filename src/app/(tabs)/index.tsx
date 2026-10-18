import { useCallback, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { getServiceLabel } from '@/constants/services';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSales } from '@/hooks/useSales';
import { AppError } from '@/services/errors';
import { deleteSale } from '@/services/saleService';
import { canModifySale } from '@/services/saleValidation';
import { formatCents } from '@/utils/currency';
import { formatSaleDate } from '@/utils/datetime';
import type { Sale } from '@/types/Sale';

/**
 * Pantalla principal. Muestra el negocio, su código de invitación y el
 * historial de ventas.
 *
 * Desde el Sprint 4 la lista vive en una suscripción en tiempo real
 * (`useSales` → `onSnapshot`): cualquier venta creada, editada o eliminada
 * —desde este teléfono o desde otro miembro del negocio— aparece aquí sin
 * recargar la pantalla.
 */
export default function HomeScreen() {
  const { user, profile, business } = useAuth();
  // El negocio nunca llega desde la interfaz: `useSales` lo toma del
  // contexto de autenticación validado.
  const { sales, loading, error, lastUpdatedAt, retry } = useSales();
  const [copied, setCopied] = useState(false);
  // Identificador de la venta cuya eliminación está en curso; evita
  // solicitudes duplicadas mientras Firestore confirma.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const viewerUid = user?.uid ?? null;
  // El propietario del negocio es quien lo creó (mismo criterio que las
  // reglas de Firestore).
  const ownerUid = business?.createdBy ?? null;

  /**
   * Eliminación con confirmación explícita. La venta no se retira de la
   * interfaz hasta que Firestore confirma: la lista se actualiza sola por
   * la suscripción en tiempo real. La eliminación es permanente (no hay
   * papelera ni cancelación en el modelo actual).
   */
  const handleDeleteSale = useCallback(
    (sale: Sale) => {
      if (!business || deletingId !== null) {
        return;
      }
      Alert.alert(
        'Eliminar venta',
        `Se eliminará la venta de ${getServiceLabel(sale.serviceType)} por ${formatCents(sale.totalCents)}, registrada por ${sale.createdByName}.\n\nEsta acción es permanente y no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => {
              setDeletingId(sale.id);
              deleteSale({ businessId: business.id, saleId: sale.id })
                .catch((deleteError: unknown) => {
                  // La venta sigue en la lista: solo se informa del error.
                  Alert.alert(
                    'No se pudo eliminar',
                    deleteError instanceof AppError
                      ? deleteError.message
                      : 'Revisa tu conexión e inténtalo de nuevo.',
                  );
                })
                .finally(() => {
                  setDeletingId(null);
                });
            },
          },
        ],
        { cancelable: true },
      );
    },
    [business, deletingId],
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

            {/* Carga inicial: la suscripción aún no ha devuelto la primera
                instantánea. Las actualizaciones posteriores NO muestran este
                indicador: la lista cambia en su sitio. */}
            {loading ? (
              <ActivityIndicator style={styles.salesState} />
            ) : sales && sales.length > 0 ? (
              <View style={styles.salesList}>
                {/* Con datos en pantalla y error de suscripción se mantiene
                    la lista y se ofrece reintentar; el error nunca se
                    sustituye por una lista vacía. */}
                {error ? (
                  <View style={styles.salesState}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {error.message}
                    </ThemedText>
                    <PrimaryButton label="Reintentar" onPress={retry} />
                  </View>
                ) : lastUpdatedAt ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Sincronizado en tiempo real · {formatSaleDate(lastUpdatedAt)}
                  </ThemedText>
                ) : null}
                {sales.map((sale) => {
                  // Vista previa de permisos: solo el creador o el
                  // propietario ven las acciones; las reglas de Firestore
                  // siguen siendo la autoridad real.
                  const canModify = canModifySale(sale, viewerUid, ownerUid);
                  const deleting = deletingId === sale.id;
                  return (
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
                      {sale.notes ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          Nota: {sale.notes}
                        </ThemedText>
                      ) : null}
                      {canModify ? (
                        <View style={styles.saleItemActions}>
                          <PrimaryButton
                            label="Editar"
                            className="flex-1"
                            disabled={deleting}
                            onPress={() =>
                              router.push({
                                pathname: '/sales/edit',
                                params: { saleId: sale.id },
                              })
                            }
                          />
                          <PrimaryButton
                            label={deleting ? 'Eliminando…' : 'Eliminar'}
                            variant="danger"
                            className="flex-1"
                            disabled={deletingId !== null}
                            onPress={() => handleDeleteSale(sale)}
                          />
                        </View>
                      ) : null}
                    </ThemedView>
                  );
                })}
              </View>
            ) : error ? (
              <View style={styles.salesState}>
                <ThemedText type="small" themeColor="textSecondary">
                  {error.message}
                </ThemedText>
                <PrimaryButton label="Reintentar" onPress={retry} />
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
  saleItemActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
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
