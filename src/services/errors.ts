/**
 * Error con mensaje apto para mostrar en la interfaz y un código estable
 * para que las pantallas puedan tomar decisiones (por ejemplo, redirigir
 * cuando el usuario ya pertenece a un negocio).
 *
 * El detalle técnico se registra con console.warn en los servicios.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
