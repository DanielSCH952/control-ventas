import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/loading-view';
import { PrimaryButton } from '@/components/primary-button';
import { SaleForm } from '@/components/sale-form';
import { useAuth } from '@/context/AuthContext';
import { AppError } from '@/services/errors';
import { getSaleById, updateSale } from '@/services/saleService';
import { canModifySale } from '@/services/saleValidation';
import { getServiceLabel } from '@/constants/services';
import { formatSaleDate } from '@/utils/datetime';
import type { CreateSaleInput, Sale } from '@/types/Sale';

/**
 * Pantalla para editar una venta existente (Sprint 4).
 *
 * La venta se carga desde Firestore antes de permitir su edición. Se
 * conservan su identificador, su fecha de creación y su autor histórico
 * (`createdBy`/`createdByName`); la escritura añade `updatedAt`,
 * `updatedBy` y `updatedByName`.
 *
 * La interfaz comprueba permisos (creador o propietario) para mostrar un
 * aviso claro, pero la autoridad de seguridad son las reglas de Firestore:
 * un usuario no autorizado recibe `permission-denied` del servidor.
 */
export default function EditSaleScreen() {
  const { status, user, profile, business } = useAuth();
  const { saleId } = useLocalSearchParams<{ saleId: string }>();

  // Venta cargada, etiquetada con la clave (negocio + venta) a la que
  // pertenece: si cambia, los datos anteriores no se muestran.
  const [loaded, setLoaded] = useState<{ key: string; sale: Sale } | null>(null);
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);

  const loadKey = business && saleId ? `${business.id}/${saleId}` : null;

  useEffect(() => {
    // Sin sesión resuelta o sin identificador no hay nada que leer.
    if (status !== 'ready' || !business || !saleId) {
      return;
    }
    let cancelled = false;

    getSaleById(business.id, saleId)
      .then((sale) => {
        if (!cancelled) {
          setLoaded({ key: `${business.id}/${saleId}`, sale });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError({
          key: `${business.id}/${saleId}`,
          message:
            error instanceof AppError
              ? error.message
              : 'No pudimos cargar la venta. Revisa tu conexión e inténtalo de nuevo.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [status, business, saleId]);

  // Estado derivado, enmascarado por clave de carga.
  const sale = loadKey !== null && loaded !== null && loaded.key === loadKey ? loaded.sale : null;
  const currentLoadError =
    loadKey !== null && loadError !== null && loadError.key === loadKey ? loadError.message : null;
  // Cargando: contexto válido, aún sin venta y sin error para esta clave.
  const loadingSale = loadKey !== null && sale === null && currentLoadError === null;

  const handleSubmit = useCallback(
    (input: CreateSaleInput): Promise<void> => {
      if (!business || !user || !profile || !sale) {
        return Promise.reject(new AppError('Tu sesión no está lista. Vuelve a intentarlo.', 'missing-session'));
      }
      return updateSale({
        businessId: business.id,
        saleId: sale.id,
        actor: { uid: user.uid, name: profile.name },
        input,
      }).then(() => {
        // Solo tras confirmar la escritura en Firestore se informa al usuario.
        // Los demás dispositivos ven el cambio a través de `onSnapshot`.
        Alert.alert('Cambios guardados', 'La venta se actualizó correctamente.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      });
    },
    [business, user, profile, sale],
  );

  if (status === 'loading') {
    return <LoadingView message="Preparando tu sesión…" />;
  }

  if (status !== 'ready' || !user || !profile || !business || !saleId) {
    return <Redirect href="/" />;
  }

  if (loadingSale) {
    return <LoadingView message="Cargando la venta…" />;
  }

  if (currentLoadError || !sale) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-neutral-950">
        <Text className="text-center text-base text-neutral-700 dark:text-neutral-300">
          {currentLoadError ?? 'La venta que buscas ya no existe en este negocio.'}
        </Text>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  // Vista previa de permisos en la interfaz: el propietario del negocio es
  // quien lo creó (`business.createdBy`, mismo criterio que `firestore.rules`).
  // Las reglas siguen siendo la autoridad: si este control se equivocara,
  // el servidor rechazaría la escritura.
  const canEdit = canModifySale(sale, user.uid, business.createdBy);

  if (!canEdit) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-neutral-950">
        <Text className="text-center text-base text-neutral-700 dark:text-neutral-300">
          Solo puede editar esta venta quien la registró o el propietario del negocio.
        </Text>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View className="w-full gap-6" style={{ maxWidth: 480 }}>
            <View className="gap-2">
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
                Editar venta
              </Text>
              <Text className="text-base text-neutral-600 dark:text-neutral-400">
                {getServiceLabel(sale.serviceType)} · {formatSaleDate(sale.createdAt)}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                Registrada por {sale.createdByName}. La fecha de creación y el autor
                original se conservan; los cambios quedan registrados en tu nombre.
              </Text>
            </View>

            <SaleForm
              initialValues={{
                serviceType: sale.serviceType,
                quantity: sale.quantity,
                unitPriceCents: sale.unitPriceCents,
                notes: sale.notes,
              }}
              submitLabel="Guardar cambios"
              savingLabel="Guardando…"
              onSubmit={handleSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});

