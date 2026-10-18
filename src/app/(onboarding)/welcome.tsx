import { useEffect } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/context/AuthContext';

/**
 * Pantalla de bienvenida del flujo de configuración.
 * Si el usuario ya guardó su nombre pero no tiene negocio, va directo a la
 * selección de negocio.
 */
export default function WelcomeScreen() {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'needs-business') {
      router.replace('/(onboarding)/business-setup');
    }
  }, [status]);

  return (
    <SafeAreaView className="flex-1 justify-center bg-white px-6 dark:bg-neutral-950">
      <View className="w-full items-center gap-6" style={{ maxWidth: 480, alignSelf: 'center' }}>
        <View className="items-center gap-2">
          <Text className="text-4xl font-bold text-neutral-900 dark:text-white">Control de Ventas</Text>
          <Text className="text-center text-base text-neutral-600 dark:text-neutral-400">
            Registra las ventas de tu negocio de copias, impresiones y recargas desde tu teléfono.
          </Text>
        </View>

        <View className="w-full items-center gap-2">
          <PrimaryButton label="Comenzar" onPress={() => router.replace('/(onboarding)/setup')} />
          <Text className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            Solo necesitamos tu nombre para empezar.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
