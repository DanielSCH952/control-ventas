import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/loading-view';
import { SaleForm } from '@/components/sale-form';
import { useAuth } from '@/context/AuthContext';
import { createSale } from '@/services/saleService';
import type { CreateSaleInput } from '@/types/Sale';

/**
 * Pantalla para registrar una venta.
 *
 * El negocio y el registrante provienen de `useAuth` (estado autenticado);
 * la pantalla nunca permite elegir un `businessId` ni el UID del vendedor.
 *
 * La lógica del formulario (servicio, cantidad, precio sugerido, total y
 * observaciones) vive en `SaleForm`, compartida con la edición (Sprint 4).
 */
export default function NewSaleScreen() {
  const { status, user, profile, business } = useAuth();

  if (status === 'loading') {
    return <LoadingView message="Preparando tu sesión…" />;
  }

  if (status !== 'ready' || !user || !profile || !business) {
    return <Redirect href="/" />;
  }

  function handleSubmit(input: CreateSaleInput): Promise<void> {
    return createSale({
      businessId: business!.id,
      actor: { uid: user!.uid, name: profile!.name },
      input,
    }).then(() => {
      // Solo tras confirmar la escritura se informa al usuario.
      Alert.alert('Venta guardada', 'La venta se registró correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    });
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
                Registrar venta
              </Text>
              <Text className="text-base text-neutral-600 dark:text-neutral-400">
                Se guardará en «{business.name}».
              </Text>
            </View>

            <SaleForm
              submitLabel="Guardar venta"
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
