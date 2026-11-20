export interface InputVisibilityMetrics {
  inputTop: number;
  inputBottom: number;
  viewportTop: number;
  viewportBottom: number;
  margin: number;
}

/**
 * Devuelve el desplazamiento vertical necesario para dejar un input dentro
 * del viewport. Un valor positivo baja el contenido; uno negativo lo sube.
 * Si el campo ya es completamente visible, devuelve cero.
 */
export function getInputScrollDelta({
  inputTop,
  inputBottom,
  viewportTop,
  viewportBottom,
  margin,
}: InputVisibilityMetrics): number {
  const safeMargin = Math.max(0, margin);
  const topLimit = viewportTop + safeMargin;
  const bottomLimit = viewportBottom - safeMargin;
  const availableHeight = bottomLimit - topLimit;

  if (availableHeight <= 0 || inputBottom < inputTop) {
    return 0;
  }

  // Un campo más alto que el viewport no puede mostrarse completo: se alinea
  // su parte superior para que el usuario pueda seguir leyendo y escribiendo.
  if (inputBottom - inputTop >= availableHeight) {
    return inputTop - topLimit;
  }

  if (inputBottom > bottomLimit) {
    return inputBottom - bottomLimit;
  }

  if (inputTop < topLimit) {
    return inputTop - topLimit;
  }

  return 0;
}
