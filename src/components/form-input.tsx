import { useCallback, useContext, useRef, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import {
  KeyboardAwareFormContext,
  type KeyboardAwareField,
} from '@/context/KeyboardAwareFormContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PLACEHOLDER_COLORS = {
  light: '#737373',
  dark: '#A3A3A3',
} as const;

interface FormInputProps extends Omit<TextInputProps, 'className'> {
  label: string;
  error?: string | null;
  maxLength: number;
  /** Clases adicionales de NativeWind para el campo. */
  className?: string;
}

/**
 * Campo de formulario con etiqueta y mensaje de error.
 * Mientras hay un error no recuperado, el borde se resalta.
 */
export function FormInput({ label, error, maxLength, className = '', ...inputProps }: FormInputProps) {
  const [focused, setFocused] = useState(false);
  const colorScheme = useColorScheme();
  const defaultPlaceholderColor = PLACEHOLDER_COLORS[colorScheme === 'dark' ? 'dark' : 'light'];
  const inputRef = useRef<TextInput>(null);
  const fieldRef = useRef<View>(null);
  const keyboardAwareForm = useContext(KeyboardAwareFormContext);

  const setInputRef = useCallback(
    (input: TextInput | null) => {
      const previousInput = inputRef.current;
      if (previousInput && previousInput !== input) {
        keyboardAwareForm?.clearInput(previousInput);
      }
      inputRef.current = input;
    },
    [keyboardAwareForm],
  );

  const showFocusedField = useCallback(() => {
    const field = fieldRef.current;
    if (field) {
      keyboardAwareForm?.showInput(field);
    }
  }, [keyboardAwareForm]);

  const clearFocusedField = useCallback(() => {
    const field = fieldRef.current;
    if (field) {
      keyboardAwareForm?.clearInput(field);
    }
  }, [keyboardAwareForm]);

  return (
    <View ref={fieldRef} className="w-full gap-2">
      <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</Text>
      <TextInput
        {...inputProps}
        ref={setInputRef}
        maxLength={maxLength}
        placeholderTextColor={inputProps.placeholderTextColor ?? defaultPlaceholderColor}
        onFocus={(event) => {
          setFocused(true);
          showFocusedField();
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          clearFocusedField();
          inputProps.onBlur?.(event);
        }}
        accessibilityLabel={label}
        className={`rounded-xl border bg-white px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white ${
          error && !focused
            ? 'border-red-500'
            : focused
              ? 'border-neutral-900 dark:border-white'
              : 'border-neutral-300 dark:border-neutral-700'
        } ${className}`}
      />
      {error ? (
        <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
      ) : null}
    </View>
  );
}
