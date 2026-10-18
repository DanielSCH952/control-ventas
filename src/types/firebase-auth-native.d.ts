import type { Persistence } from '@firebase/auth';

/**
 * `getReactNativePersistence` existe en el build de React Native de
 * `@firebase/auth` (al que Metro llega a través del campo "react-native"
 * del package.json), pero los typings por defecto del paquete no lo
 * exponen: la condición "types" de primer nivel opaca la condición
 * "react-native". Esta declaración solo añade el typing que falta;
 * no cambia el comportamiento en tiempo de ejecución.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  }): Persistence;
}
