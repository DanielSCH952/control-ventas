import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/context/AuthContext';
import type { Business } from '@/types/Business';
import { AppError } from '@/services/errors';
import { createBusiness, BUSINESS_NAME_MAX_LENGTH } from '@/services/businessService';

/**
 * Pantalla para crear un negocio. Al terminar, muestra el código de
 * invitación generado, con opciones para copiar y compartir. El usuario
 * pasa al grupo principal solo cuando pulsa "Continuar".
 */
export default function CreateBusinessScreen() {
  const { user, profile, onBusinessAttached } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Business | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (saving || !user || !profile) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const business = await createBusiness({
        uid: user.uid,
        userName: profile.name,
        businessName,
      });
      setCreated(business);
    } catch (caught) {
      const message =
        caught instanceof AppError
          ? caught.message
          : 'No pudimos crear el negocio. Inténtalo de nuevo.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyCode() {
    if (!created) {
      return;
    }
    await Clipboard.setStringAsync(created.joinCode);
    setCopied(true);
  }

  async function handleShareCode() {
    if (!created) {
      return;
    }
    await Share.share({
      message: `Únete a mi negocio "${created.name}" con este código de invitación: ${created.joinCode}`,
    });
  }

  function handleContinue() {
    if (created) {
      // Notifica al contexto: el estado pasa a "ready" y el layout redirige.
      onBusinessAttached(created);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View className="w-full gap-6" style={{ maxWidth: 480 }}>
            {created ? (
              <View className="items-center gap-6">
                <View className="gap-2">
                  <Text className="text-center text-2xl font-bold text-neutral-900 dark:text-white">
                    ¡{created.name} está listo!
                  </Text>
                  <Text className="text-center text-base text-neutral-600 dark:text-neutral-400">
                    Comparte este código de invitación con la otra persona del negocio.
                  </Text>
                </View>

                <View className="w-full items-center gap-3 rounded-2xl border border-neutral-300 bg-neutral-100 px-6 py-8 dark:border-neutral-700 dark:bg-neutral-900">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    Código de invitación
                  </Text>
                  <Text className="text-4xl font-bold tracking-widest text-neutral-900 dark:text-white">
                    {created.joinCode}
                  </Text>
                </View>

                <View className="w-full flex-row gap-3">
                  <PrimaryButton
                    label={copied ? '¡Copiado!' : 'Copiar código'}
                    onPress={handleCopyCode}
                    className="flex-1"
                  />
                  <PrimaryButton
                    label="Compartir"
                    onPress={handleShareCode}
                    className="flex-1"
                  />
                </View>

                <PrimaryButton label="Continuar" onPress={handleContinue} className="w-full" />
              </View>
            ) : (
              <View className="gap-6">
                <View className="gap-2">
                  <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
                    Crea tu negocio
                  </Text>
                  <Text className="text-base text-neutral-600 dark:text-neutral-400">
                    Este nombre identificará las ventas compartidas.
                  </Text>
                </View>

                <FormInput
                  label="Nombre del negocio"
                  value={businessName}
                  onChangeText={setBusinessName}
                  maxLength={BUSINESS_NAME_MAX_LENGTH}
                  placeholder="Ej. Copias La Esquina"
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                  error={error}
                />

                <PrimaryButton
                  label={saving ? 'Creando…' : 'Crear negocio'}
                  onPress={handleCreate}
                  disabled={saving}
                />
              </View>
            )}
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
