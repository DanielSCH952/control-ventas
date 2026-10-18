import { useEffect } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/context/AuthContext';

/**
 * Pantalla de selección: crear un negocio nuevo o unirse a uno existente
 * mediante un código de invitación.
 */
export default function BusinessSetupScreen() {
  const { status, profile } = useAuth();

  useEffect(() => {
    if (status === 'needs-name') {
      router.replace('/(onboarding)/setup');
    }
  }, [status]);

  return (
    <SafeAreaView className="flex-1 justify-center bg-white px-6 dark:bg-neutral-950">
      <View className="w-full gap-6" style={{ maxWidth: 480, alignSelf: 'center' }}>
        <View className="gap-2">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            Hola, {profile?.name ?? ''}
          </Text>
          <Text className="text-base text-neutral-600 dark:text-neutral-400">
            Para empezar, crea tu negocio o únete a uno existente con un código de invitación.
          </Text>
        </View>

        <View className="gap-3">
          <PrimaryButton
            label="Crear un negocio"
            onPress={() => router.push('/(onboarding)/create-business')}
          />
          <PrimaryButton
            label="Unirme con un código"
            onPress={() => router.push('/(onboarding)/join-business')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
