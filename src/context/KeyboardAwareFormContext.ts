import { createContext } from 'react';

export interface KeyboardAwareField {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

export interface KeyboardAwareFormContextValue {
  showInput: (field: KeyboardAwareField) => void;
  clearInput: (field: KeyboardAwareField) => void;
}

/**
 * Conecta los inputs con su formulario desplazable más cercano.
 * Fuera de un KeyboardAwareForm el valor es null y FormInput conserva su
 * comportamiento habitual.
 */
export const KeyboardAwareFormContext = createContext<KeyboardAwareFormContextValue | null>(null);
