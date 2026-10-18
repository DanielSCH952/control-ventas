// Resuelve el alias "@/..." al directorio src/ para poder ejecutar los
// módulos TypeScript puros directamente con Node (transform-types) en las
// pruebas manuales de terminal. No forma parte del bundle de la app.
// Nota: este archivo es .mjs, así que no puede contener sintaxis TypeScript.
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const srcDir = path.resolve(import.meta.dirname, '..', 'src');

/** Prueba rutas candidatas para importaciones TS sin extensión. */
function resolveAliasedFile(relative) {
  const base = path.join(srcDir, relative);
  const candidates = [
    ...(base.endsWith('.ts') || base.endsWith('.tsx') ? [base] : []),
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const resolved = resolveAliasedFile(specifier.slice(2));
    if (resolved) {
      return next(pathToFileURL(resolved).href, context);
    }
  }
  return next(specifier, context);
}

const srcDirUrl = pathToFileURL(srcDir + path.sep).href;

export function load(url, context, next) {
  // Asegura que los archivos TS bajo src/ se transformen aunque el hook de
  // resolución haya reescrito el especificador.
  if (url.startsWith(srcDirUrl) && (url.endsWith('.ts') || url.endsWith('.tsx'))) {
    return next(url, { ...context, format: 'module-typescript' });
  }
  return next(url, context);
}



