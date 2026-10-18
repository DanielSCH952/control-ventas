// Registra el alias "@/..." antes de que Node cargue los módulos de prueba.
// Solo para las pruebas manuales de terminal (ver scripts/smoke-tests.mjs).
import { register } from 'node:module';

register(new URL('./alias-loader.mjs', import.meta.url));
