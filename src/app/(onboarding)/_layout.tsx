import { Redirect, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/loading-view';
import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/context/AuthContext';

/**
 * Layout del flujo de configuración inicial (nombre y negocio).
 * - Mientras carga la sesión: estado de carga.
 * - Si hay un error de autenticación/perfil: pantalla de reintento.
 * - Si el usuario ya pertenece a un negocio: redirige al grupo principal.
 */
export default function OnboardingLayout() {
  const { status, authError, retryAuthentication } = useAuth();

  if (status === 'loading') {
    return <LoadingView message="Preparando tu sesión…" />;
  }

  if (authError) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-white px-6 dark:bg-neutral-950">
        <View className="items-center gap-4">
          <Text className="text-center text-xl font-semibold text-neutral-900 dark:text-white">
            Algo salió mal
          </Text>
          <Text className="text-center text-base text-neutral-600 dark:text-neutral-400">
            {authError}
          </Text>
          <PrimaryButton label="Reintentar" onPress={retryAuthentication} className="mt-2" />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'ready') {
    // El usuario ya pertenece a un negocio: fuera del flujo de configuración.
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
