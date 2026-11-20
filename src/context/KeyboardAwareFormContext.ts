import { createContext } from 'react';
import type { TextInput } from 'react-native';

export interface KeyboardAwareFormContextValue {
  showInput: (input: TextInput) => void;
  clearInput: (input: TextInput) => void;
}

/**
 * Conecta los inputs con su formulario desplazable más cercano.
 * Fuera de un KeyboardAwareForm el valor es null y FormInput conserva su
 * comportamiento habitual.
 */
export const KeyboardAwareFormContext = createContext<KeyboardAwareFormContextValue | null>(null);
