import { ActivityIndicator, Text, View } from 'react-native';

/**
 * Pantalla de carga reutilizable mientras se resuelve la sesión.
 */
export function LoadingView({ message = 'Cargando…' }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-6 dark:bg-neutral-950">
      <ActivityIndicator size="large" />
      <Text className="text-base text-neutral-600 dark:text-neutral-400">{message}</Text>
    </View>
  );
}
