import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/context/AuthContext';
import { AppError } from '@/services/errors';
import { joinBusinessByCode, JOIN_CODE_LENGTH } from '@/services/businessService';

/**
 * Pantalla para unirse a un negocio existente mediante un código de
 * invitación. El código se normaliza (mayúsculas, sin espacios ni guiones)
 * y toda la operación es una transacción que evita membresías duplicadas.
 */
export default function JoinBusinessScreen() {
  const { user, profile, onBusinessAttached } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (joining || !user || !profile) {
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const business = await joinBusinessByCode({
        uid: user.uid,
        userName: profile.name,
        code,
      });
      // Notifica al contexto: el estado pasa a "ready" y el layout redirige.
      onBusinessAttached(business);
    } catch (caught) {
      const message =
        caught instanceof AppError
          ? caught.message
          : 'No pudimos unirte al negocio. Inténtalo de nuevo.';
      setError(message);
    } finally {
      setJoining(false);
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
                Unirme a un negocio
              </Text>
              <Text className="text-base text-neutral-600 dark:text-neutral-400">
                Pide el código de invitación a la persona que creó el negocio.
              </Text>
            </View>

            <FormInput
              label="Código de invitación"
              value={code}
              onChangeText={setCode}
              maxLength={JOIN_CODE_LENGTH}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
              error={error}
            />

            <PrimaryButton
              label={joining ? 'Uniéndote…' : 'Unirme al negocio'}
              onPress={handleJoin}
              disabled={joining}
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
