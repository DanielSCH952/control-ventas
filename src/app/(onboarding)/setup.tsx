import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/context/AuthContext';
import { AppError } from '@/services/errors';
import { saveUserName, USER_NAME_MAX_LENGTH } from '@/services/userService';

/**
 * Pantalla para ingresar el nombre del usuario.
 * Crea o actualiza `users/{uid}`; si el usuario ya tenía nombre pero no
 * negocio, redirige a la selección de negocio.
 */
export default function SetupScreen() {
  const { status, user, onNameSaved } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'needs-business') {
      router.replace('/(onboarding)/business-setup');
    }
  }, [status]);

  async function handleSave() {
    if (saving || !user) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const profile = await saveUserName(user.uid, name);
      onNameSaved(profile);
      router.replace('/(onboarding)/business-setup');
    } catch (caught) {
      const message =
        caught instanceof AppError
          ? caught.message
          : 'No pudimos guardar tu nombre. Inténtalo de nuevo.';
      setError(message);
    } finally {
      setSaving(false);
    }
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
                ¿Cómo te llamas?
              </Text>
              <Text className="text-base text-neutral-600 dark:text-neutral-400">
                Tu nombre se compartirá con la otra persona del negocio.
              </Text>
            </View>

            <FormInput
              label="Tu nombre"
              value={name}
              onChangeText={setName}
              maxLength={USER_NAME_MAX_LENGTH}
              placeholder="Ej. María"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              error={error}
            />

            <PrimaryButton
              label={saving ? 'Guardando…' : 'Continuar'}
              onPress={handleSave}
              disabled={saving}
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
  },
});
