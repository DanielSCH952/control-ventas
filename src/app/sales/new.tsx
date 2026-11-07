import { useRef } from 'react';
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
import { AppError } from '@/services/errors';
import { generateSaleId } from '@/utils/ids';
import type { CreateSaleInput } from '@/types/Sale';

/**
 * Pantalla para registrar una venta.
 *
 * El negocio y el registrante provienen de `useAuth` (estado autenticado);
 * la pantalla nunca permite elegir un `businessId` ni el UID del vendedor.
 *
 * La lógica del formulario (servicio, cantidad, precio sugerido, total y
 * observaciones) vive en `SaleForm`, compartida con la edición (Sprint 4).
 *
 * Sprint 6 — anti-duplicados: el identificador de la venta se genera UNA
 * vez por intento (en un `useRef`) y se reutiliza en los reintentos de ese
 * mismo intento. Si el servidor llegó a guardar la venta pero la conexión
 * se cortó antes de la confirmación, reintentar con el mismo ID NO crea
 * una segunda venta: el servicio detecta que ya existe y lo informa como
 * éxito. Un intento de envío nuevo siempre genera un ID nuevo, así que
 * dos ventas legítimas idénticas no comparten identificador.
 *
 * Estado «desconocido»: si la escritura no recibe respuesta del servidor,
 * NO se afirma que la venta falló ni que se guardó. El formulario muestra
 * un aviso de resultado sin confirmar y conserva los datos; volver a pulsar
 * «Guardar venta» reintenta con el MISMO identificador, por lo que el
 * resultado solo puede ser: guardada (sin duplicar) o error definitivo.
 */
export default function NewSaleScreen() {
  const { status, user, profile, business } = useAuth();
  // Identificador del intento de creación actual. Sobrevive a los
  // reintentos controlados del mismo intento.
  const attemptIdRef = useRef<string>(generateSaleId());

  if (status === 'loading') {
    return <LoadingView message="Preparando tu sesión…" />;
  }

  if (status !== 'ready' || !user || !profile || !business) {
    return <Redirect href="/" />;
  }

  function handleSubmit(input: CreateSaleInput): Promise<void> {
    return createSale({
      businessId: business!.id,
      saleId: attemptIdRef.current,
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
