/**
 * Bootstrap de pruebas con `node --test` (Sprint 4).
 *
 * El código de la app usa el alias `@/ → src/` (configuración de
 * TypeScript/Metro, ver tsconfig.json) y rutas relativas sin extensión,
 * que Node no resuelve por sí solo. Este archivo registra un hook de
 * resolución que traduce ambas formas a archivos reales de `src/`.
 *
 * Uso: node --import ./tests/bootstrap.mjs --test tests/
 */
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Resuelve una ruta a un archivo real probando: exacta, `.ts`, `.tsx`
 * e `index.ts` (el equivalente mínimo de la resolución de bundlers).
 */
function resolveFile(candidate) {
  const options = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    path.join(candidate, 'index.ts'),
  ];
  for (const option of options) {
    try {
      if (existsSync(option) && statSync(option).isFile()) {
        return option;
      }
    } catch {
      // Se ignora y se prueba la siguiente variante.
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Alias del proyecto: @/foo → src/foo
    if (specifier.startsWith('@/')) {
      const resolved = resolveFile(path.join(ROOT, 'src', specifier.slice(2)));
      if (resolved) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
      }
    }

    // Rutas relativas sin extensión (estilo TypeScript/bundler).
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const resolved = resolveFile(path.resolve(parentDir, specifier));
      if (resolved) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});

