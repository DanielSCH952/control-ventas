import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Sale } from '../src/types/Sale';
import type { ServiceType } from '../src/types/Service';
import {
  buildPeriodReport,
  formatPercentage,
  isReportableSale,
  percentageOfTotal,
} from '../src/utils/reportAggregations';
import { getDayPeriod, getWeekPeriod } from '../src/utils/reportPeriods';

/**
 * Pruebas de las agregaciones de reportes (Sprint 5).
 *
 * Son funciones puras: no se prueba Firestore real (ver FIREBASE.md para
 * las pruebas manuales recomendadas). Todas las fechas son locales.
 */

const BASE_DATE = new Date(2026, 9, 17, 12, 0); // 17 oct 2026, 12:00

interface SaleOverrides {
  id?: string;
  serviceType?: ServiceType;
  quantity?: number;
  unitPriceCents?: number;
  totalCents?: number;
  createdBy?: string;
  createdByName?: string;
  createdAt?: Date;
  updatedBy?: string;
  updatedByName?: string;
}

function makeSale(overrides: SaleOverrides = {}): Sale {
  return {
    id: overrides.id ?? 'venta-x',
    serviceType: overrides.serviceType ?? 'COPY_BW',
    quantity: overrides.quantity ?? 1,
    unitPriceCents: overrides.unitPriceCents ?? 100,
    totalCents: overrides.totalCents ?? 100,
    createdBy: overrides.createdBy ?? 'uid-a',
    createdByName: overrides.createdByName ?? 'Ana',
    createdAt: overrides.createdAt ?? BASE_DATE,
    updatedAt: overrides.createdAt ?? BASE_DATE,
    ...(overrides.updatedBy !== undefined ? { updatedBy: overrides.updatedBy } : {}),
    ...(overrides.updatedByName !== undefined
      ? { updatedByName: overrides.updatedByName }
      : {}),
  };
}

describe('buildPeriodReport: período vacío', () => {
  it('devuelve ceros, ticket promedio 0 y sin mayor venta', () => {
    const report = buildPeriodReport([], getDayPeriod(BASE_DATE));
    assert.equal(report.totals.totalCents, 0);
    assert.equal(report.totals.saleCount, 0);
    assert.equal(report.totals.quantityUnits, 0);
    assert.equal(report.totals.averageTicketCents, 0);
    assert.equal(report.totals.topSaleCents, null);
    assert.equal(report.users.length, 0);
    for (const row of report.services) {
      assert.equal(row.saleCount, 0);
      assert.equal(row.totalCents, 0);
      assert.equal(row.percentageOfTotal, 0);
    }
  });

  it('lista con ventas pero ninguna dentro del período también da ceros', () => {
    const otherDay = makeSale({ id: 'otro-dia', createdAt: new Date(2026, 9, 18, 10) });
    const report = buildPeriodReport([otherDay], getDayPeriod(BASE_DATE));
    assert.equal(report.totals.saleCount, 0);
    assert.equal(report.totals.totalCents, 0);
  });
});

describe('buildPeriodReport: una venta en el período', () => {
  it('suma su total, cuenta 1 venta y sus unidades', () => {
    const sale = makeSale({ id: 'v1', quantity: 8, unitPriceCents: 150, totalCents: 1200 });
    const report = buildPeriodReport([sale], getDayPeriod(BASE_DATE));
    assert.equal(report.totals.totalCents, 1200);
    assert.equal(report.totals.saleCount, 1);
    assert.equal(report.totals.quantityUnits, 8);
    assert.equal(report.totals.averageTicketCents, 1200);
    assert.equal(report.totals.topSaleCents, 1200);
  });
});

describe('buildPeriodReport: varias ventas del mismo día', () => {
  it('suma totales exactos en centavos enteros y cuenta cada venta una vez', () => {
    const sales = [
      makeSale({ id: 'v1', createdAt: new Date(2026, 9, 17, 9), totalCents: 999, quantity: 3 }),
      makeSale({ id: 'v2', createdAt: new Date(2026, 9, 17, 13), totalCents: 2500, quantity: 5 }),
      makeSale({ id: 'v3', createdAt: new Date(2026, 9, 17, 23, 30), totalCents: 1, quantity: 1 }),
    ];
    const report = buildPeriodReport(sales, getDayPeriod(BASE_DATE));
    assert.equal(report.totals.totalCents, 3500);
    assert.equal(report.totals.saleCount, 3);
    assert.equal(report.totals.quantityUnits, 9);
    assert.equal(report.totals.averageTicketCents, Math.round(3500 / 3));
    assert.equal(report.totals.topSaleCents, 2500);
  });

  it('usa precisión entera exacta con importes grandes', () => {
    const sales = [
      makeSale({ id: 'v1', totalCents: 9007199254740, quantity: 1 }),
      makeSale({ id: 'v2', totalCents: 9007199254740, quantity: 1 }),
    ];
    const report = buildPeriodReport(sales, getDayPeriod(BASE_DATE));
    // 2 * 9007199254740 = 18014398509480, exacto en enteros.
    assert.equal(report.totals.totalCents, 18014398509480);
  });

  it('incluye la venta exactamente en el inicio y excluye la del fin', () => {
    const start = makeSale({ id: 'inicio', createdAt: new Date(2026, 9, 17, 0, 0, 0, 0) });
    const end = makeSale({ id: 'fin', createdAt: new Date(2026, 9, 18, 0, 0, 0, 0) });
    const report = buildPeriodReport([start, end], getDayPeriod(BASE_DATE));
    assert.equal(report.totals.saleCount, 1);
    assert.equal(report.totals.totalCents, start.totalCents);
  });

  it('excluye ventas fuera de la semana consultada', () => {
    const sales = [
      makeSale({ id: 'antes', createdAt: new Date(2026, 9, 11, 23, 59, 59, 999) }), // domingo previo
      makeSale({ id: 'dentro', createdAt: BASE_DATE }), // sábado 17
      makeSale({ id: 'despues', createdAt: new Date(2026, 9, 19) }), // lunes siguiente
    ];
    const report = buildPeriodReport(sales, getWeekPeriod(BASE_DATE));
    assert.equal(report.totals.saleCount, 1);
    assert.equal(report.totals.totalCents, 100);
  });
});

describe('buildPeriodReport: desglose por servicio', () => {
  it('agrupa los seis tipos existentes en orden de catálogo', () => {
    const sales: Sale[] = [
      makeSale({ id: 'v1', serviceType: 'PRINT_COLOR', totalCents: 500 }),
      makeSale({ id: 'v2', serviceType: 'COPY_BW', totalCents: 100 }),
      makeSale({ id: 'v3', serviceType: 'RECHARGE', totalCents: 1000 }),
    ];
    const report = buildPeriodReport(sales);
    assert.equal(report.services.length, 6);
    assert.deepEqual(
      report.services.map((row) => row.serviceType),
      ['COPY_BW', 'COPY_COLOR', 'PRINT_BW', 'PRINT_COLOR', 'RECHARGE', 'OTHER'],
    );
    const byType = new Map(report.services.map((row) => [row.serviceType, row]));
    assert.equal(byType.get('COPY_BW')?.saleCount, 1);
    assert.equal(byType.get('COPY_BW')?.totalCents, 100);
    assert.equal(byType.get('COPY_COLOR')?.totalCents, 0);
    assert.equal(byType.get('PRINT_COLOR')?.totalCents, 500);
    assert.equal(byType.get('RECHARGE')?.totalCents, 1000);
    assert.equal(byType.get('OTHER')?.totalCents, 0);
  });

  it('cuenta unidades y ventas por servicio sin confundirlas', () => {
    const sales: Sale[] = [
      makeSale({ id: 'v1', serviceType: 'COPY_BW', quantity: 10, totalCents: 1000 }),
      makeSale({ id: 'v2', serviceType: 'COPY_BW', quantity: 5, totalCents: 500 }),
    ];
    const report = buildPeriodReport(sales);
    const bw = report.services.find((row) => row.serviceType === 'COPY_BW');
    assert.ok(bw);
    assert.equal(bw.saleCount, 2); // 2 ventas…
    assert.equal(bw.quantityUnits, 15); // …y 15 unidades.
  });
});

describe('buildPeriodReport: desglose por usuario', () => {
  it('agrupa por UID, no por nombre', () => {
    const sales: Sale[] = [
      makeSale({ id: 'v1', createdBy: 'uid-1', createdByName: 'Ana', totalCents: 300 }),
      makeSale({ id: 'v2', createdBy: 'uid-1', createdByName: 'Ana', totalCents: 700 }),
      makeSale({ id: 'v3', createdBy: 'uid-2', createdByName: 'Beto', totalCents: 200 }),
    ];
    const report = buildPeriodReport(sales);
    assert.equal(report.users.length, 2);
    const ana = report.users.find((row) => row.createdBy === 'uid-1');
    assert.ok(ana);
    assert.equal(ana.totalCents, 1000);
    assert.equal(ana.saleCount, 2);
    // Total del período 1200: Ana 83.33 %, Beto 16.67 %.
    assert.equal(ana.percentageOfTotal, 83.33);
    assert.equal(report.users[1].percentageOfTotal, 16.67);
  });

  it('mantiene a cada usuario con su UID aunque coincidan los nombres', () => {
    const sales: Sale[] = [
      makeSale({ id: 'v1', createdBy: 'uid-1', createdByName: 'Ana', totalCents: 100 }),
      makeSale({ id: 'v2', createdBy: 'uid-2', createdByName: 'Ana', totalCents: 200 }),
    ];
    const report = buildPeriodReport(sales);
    assert.equal(report.users.length, 2);
    assert.ok(report.users.every((row) => row.createdByName === 'Ana'));
  });

  it('ante nombres históricos distintos del mismo UID muestra el más reciente', () => {
    const sales: Sale[] = [
      makeSale({
        id: 'v1',
        createdBy: 'uid-1',
        createdByName: 'Ana Pérez',
        createdAt: new Date(2026, 9, 17, 9),
      }),
      makeSale({
        id: 'v2',
        createdBy: 'uid-1',
        createdByName: 'Ana G.',
        createdAt: new Date(2026, 9, 17, 15),
      }),
    ];
    const report = buildPeriodReport(sales);
    assert.equal(report.users.length, 1);
    assert.equal(report.users[0].createdByName, 'Ana G.');
    assert.equal(report.users[0].saleCount, 2);
  });

  it('una venta editada sigue atribuida al creador original', () => {
    const sales: Sale[] = [
      makeSale({
        id: 'v1',
        createdBy: 'uid-ana',
        createdByName: 'Ana',
        updatedBy: 'uid-beto',
        updatedByName: 'Beto',
        totalCents: 400,
      }),
    ];
    const report = buildPeriodReport(sales);
    assert.equal(report.users.length, 1);
    assert.equal(report.users[0].createdBy, 'uid-ana');
    assert.equal(report.users[0].createdByName, 'Ana');
    assert.equal(report.users[0].totalCents, 400);
  });

  it('una venta eliminada deja de contarse al recalcular el reporte', () => {
    const remaining = [makeSale({ id: 'v1', totalCents: 250, quantity: 2 })];
    const withDeleted = [...remaining, makeSale({ id: 'v2', totalCents: 750, quantity: 3 })];
    const before = buildPeriodReport(withDeleted, getDayPeriod(BASE_DATE));
    const after = buildPeriodReport(remaining, getDayPeriod(BASE_DATE));
    assert.equal(before.totals.saleCount, 2);
    assert.equal(before.totals.totalCents, 1000);
    assert.equal(after.totals.saleCount, 1);
    assert.equal(after.totals.totalCents, 250);
    assert.equal(after.totals.quantityUnits, 2);
  });

  it('ordena los usuarios por total vendido de forma determinista', () => {
    const sales: Sale[] = [
      makeSale({ id: 'v1', createdBy: 'uid-b', createdByName: 'Beto', totalCents: 100 }),
      makeSale({ id: 'v2', createdBy: 'uid-a', createdByName: 'Ana', totalCents: 900 }),
      makeSale({ id: 'v3', createdBy: 'uid-b', createdByName: 'Beto', totalCents: 400 }),
    ];
    const report = buildPeriodReport(sales);
    // uid-b suma 500 y uid-a 900: orden descendente por total vendido.
    assert.deepEqual(
      report.users.map((row) => row.createdBy),
      ['uid-a', 'uid-b'],
    );
    assert.deepEqual(
      report.users.map((row) => row.totalCents),
      [900, 500],
    );
  });
});

describe('Validación de datos inválidos', () => {
  it('isReportableSale rechaza fechas, cantidades e importes inválidos', () => {
    assert.ok(!isReportableSale(makeSale({ createdAt: new Date('no-fecha') })));
    assert.ok(!isReportableSale(makeSale({ quantity: 0 })));
    assert.ok(!isReportableSale(makeSale({ quantity: 1.5 })));
    assert.ok(!isReportableSale(makeSale({ totalCents: -1 })));
    assert.ok(!isReportableSale(makeSale({ totalCents: 10.5 })));
    assert.ok(!isReportableSale({ ...makeSale(), createdBy: '' }));
    assert.ok(!isReportableSale({ ...makeSale(), createdByName: '' }));
    assert.ok(isReportableSale(makeSale()));
  });

  it('las ventas inválidas se excluyen, quedan contadas y no contaminan totales', () => {
    const invalid = { ...makeSale({ id: 'mala' }), totalCents: -5 } as Sale;
    const valid = makeSale({ id: 'buena', totalCents: 500 });
    const report = buildPeriodReport([invalid, valid], getDayPeriod(BASE_DATE));
    assert.equal(report.invalidSaleCount, 1);
    assert.equal(report.totals.saleCount, 1);
    assert.equal(report.totals.totalCents, 500);
  });

  it('una venta editada no cambia de período: prevalece createdAt', () => {
    const edited = makeSale({
      id: 'v1',
      createdAt: new Date(2026, 9, 16, 10),
      updatedBy: 'uid-beto',
      updatedByName: 'Beto',
    });
    const day16 = buildPeriodReport([edited], getDayPeriod(new Date(2026, 9, 16)));
    const day17 = buildPeriodReport([edited], getDayPeriod(new Date(2026, 9, 17)));
    assert.equal(day16.totals.saleCount, 1);
    assert.equal(day17.totals.saleCount, 0);
  });
});

describe('Porcentajes', () => {
  it('percentageOfTotal no divide entre cero y redondea a 2 decimales', () => {
    assert.equal(percentageOfTotal(100, 0), 0);
    assert.equal(percentageOfTotal(0, 500), 0);
    assert.equal(percentageOfTotal(250, 1000), 25);
    assert.equal(percentageOfTotal(1000, 3000), 33.33);
  });

  it('formatPercentage presenta enteros y decimales de forma estable', () => {
    assert.equal(formatPercentage(25), '25 %');
    assert.equal(formatPercentage(33.33), '33.33 %');
    assert.equal(formatPercentage(0), '0 %');
  });

  it('con total del período en cero todas las filas muestran 0 %', () => {
    const sales: Sale[] = [makeSale({ id: 'v1', totalCents: 0, quantity: 2 })];
    const report = buildPeriodReport(sales);
    assert.equal(report.totals.totalCents, 0);
    assert.ok(report.services.every((row) => row.percentageOfTotal === 0));
    assert.ok(report.users.every((row) => row.percentageOfTotal === 0));
  });
});
