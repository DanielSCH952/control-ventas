import { Pressable, Text, type ViewProps } from 'react-native';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Los textos de error/alerta se renderizan en rojo. */
  variant?: 'primary' | 'danger';
  className?: ViewProps['className'];
}

/**
 * Botón principal de formularios. Se deshabilita mientras una operación
 * está en curso para evitar envíos duplicados.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  className = '',
}: PrimaryButtonProps) {
  const variantClass =
    variant === 'danger'
      ? 'bg-red-600 active:bg-red-700'
      : 'bg-neutral-900 active:bg-neutral-800 dark:bg-white';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`items-center rounded-xl px-5 py-4 ${variantClass} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      <Text className="text-base font-semibold text-white dark:text-neutral-900">{label}</Text>
    </Pressable>
  );
}
