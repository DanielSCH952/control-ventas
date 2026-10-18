import { ServiceType } from './Service';

export interface Sale {
  id: string;

  serviceType: ServiceType;

  quantity: number;

  unitPriceCents: number;

  totalCents: number;

  createdBy: string;

  createdByName: string;

  /**
   * Auditoría de edición (Sprint 4). Los documentos creados en sprints
   * anteriores no tienen estos campos: se tratan como opcionales para que
   * la conversión de documentos antiguos siga funcionando.
   */
  updatedBy?: string;

  updatedByName?: string;

  createdAt: Date;

  updatedAt: Date;

  notes?: string;
}

export interface CreateSaleInput {
  serviceType: ServiceType;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  notes?: string;
}