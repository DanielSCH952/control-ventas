import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

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

  return (
    <View className="w-full gap-2">
      <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</Text>
      <TextInput
        {...inputProps}
        maxLength={maxLength}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
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
