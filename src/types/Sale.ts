import { ServiceType } from './Service';

export interface Sale {
  id: string;

  serviceType: ServiceType;

  quantity: number;

  unitPriceCents: number;

  totalCents: number;

  createdBy: string;

  createdByName: string;

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