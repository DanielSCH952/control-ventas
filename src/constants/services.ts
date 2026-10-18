import type { ServiceType } from '@/types/Service';

/**
 * Catálogo centralizado de servicios del negocio.
 *
 * Los códigos (`ServiceType`) son los identificadores estables que se
 * almacenan en Firestore; las etiquetas existen solo para la interfaz.
 * No dupliques estas etiquetas en otros módulos.
 */
export const SERVICE_TYPES = [
  'COPY_BW',
  'COPY_COLOR',
  'PRINT_BW',
  'PRINT_COLOR',
  'RECHARGE',
  'OTHER',
] as const satisfies readonly ServiceType[];

export interface ServiceOption {
  type: ServiceType;
  /** Etiqueta comprensible para el usuario. */
  label: string;
}

export const SERVICE_OPTIONS: readonly ServiceOption[] = [
  { type: 'COPY_BW', label: 'Copia blanco y negro' },
  { type: 'COPY_COLOR', label: 'Copia a color' },
  { type: 'PRINT_BW', label: 'Impresión blanco y negro' },
  { type: 'PRINT_COLOR', label: 'Impresión a color' },
  { type: 'RECHARGE', label: 'Recarga' },
  { type: 'OTHER', label: 'Otro servicio' },
];

/** Devuelve la etiqueta visible de un servicio, o el código si no hay catálogo. */
export function getServiceLabel(serviceType: ServiceType): string {
  return SERVICE_OPTIONS.find((option) => option.type === serviceType)?.label ?? serviceType;
}

/**
 * Comprueba si un valor leído de Firestore corresponde a un servicio
 * conocido. Devuelve el tipado `ServiceType` o null si es inválido.
 */
export function toServiceType(value: unknown): ServiceType | null {
  const match = SERVICE_TYPES.find((serviceType) => serviceType === value);
  return match ?? null;
}
