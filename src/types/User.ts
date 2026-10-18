export type UserRole = 'owner' | 'member';

export interface BusinessUser {
  uid: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/**
 * Perfil del usuario en `users/{uid}`.
 *
 * `businessId` es la referencia explícita entre el usuario y su negocio.
 * Es la "fuente de verdad" que usa la app para recuperar el negocio al
 * reabrir la aplicación; el documento de membresía
 * (`businesses/{businessId}/users/{uid}`) es quien autoriza el acceso
 * según las reglas de seguridad. Ambos se escriben juntos de forma atómica.
 */
export interface UserProfile {
  uid: string;
  name: string;
  businessId: string | null;
  createdAt: Date;
  updatedAt: Date;
}