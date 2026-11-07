import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';

/**
 * Pruebas de las reglas de seguridad de Firestore contra el EMULADOR
 * (Sprint 6).
 *
 * Cargan el archivo `firestore.rules` del repositorio en el emulador y
 * reproducen las operaciones REALES que hacen los servicios de la app
 * (`AuthContext` → `userService`/`businessService`), incluida la lectura del
 * perfil propio que ejecuta la app al arrancar.
 *
 * Requieren el emulador de Firestore en marcha:
 *
 *   npx firebase-tools emulators:start --only firestore --project demo-rules-ventas
 *   npm test
 *
 * Sin emulador, esta suite se REPORTA COMO SKIPPED (no falla), de modo que
 * `npm test` sigue siendo verde en entornos sin Java/emulador.
 *
 * Usa el proyecto de demostración `demo-rules-ventas`: el emulador nunca
 * toca datos del proyecto real (`app-control-ventas-9b329`).
 */

const PROJECT_ID = 'demo-rules-ventas';
const EMULATOR_PORT = 8080; // Puerto configurado en firebase.json.

// UIDs y documentos semilla (los mismos papeles que en la app real).
const ALICE = 'alice'; // Propietaria del negocio «neg-1».
const BOB = 'bob'; // Miembro que se unió por código.
const CAROL = 'carol'; // Usuario autenticado SIN perfil ni negocio.
const BUSINESS = 'neg-1';
const JOIN_CODE = 'ABC234';

let env: RulesTestEnvironment | null = null;

const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

before(async () => {
  const rules = readFileSync(path.resolve(import.meta.dirname, '../firestore.rules'), 'utf8');
  try {
    env = await Promise.race([
      initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { rules, host: '127.0.0.1', port: EMULATOR_PORT },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('emulator-timeout')), 10_000),
      ),
    ]);
  } catch {
    // Sin emulador: las pruebas de esta suite se marcan como skipped.
    env = null;
  }

  if (!env) {
    return;
  }

  // Datos semilla con las reglas desactivadas (estado «ya existente» en
  // producción): perfiles, negocio, membresías, código de invitación y venta.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`users/${ALICE}`).set({
      uid: ALICE,
      name: 'Alice',
      businessId: BUSINESS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await db.doc(`users/${BOB}`).set({
      uid: BOB,
      name: 'Bob',
      businessId: BUSINESS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await db.doc(`businesses/${BUSINESS}`).set({
      name: 'Papelería Alice',
      joinCode: JOIN_CODE,
      createdBy: ALICE,
      createdAt: serverTimestamp(),
    });
    await db.doc(`businesses/${BUSINESS}/users/${ALICE}`).set({
      uid: ALICE,
      name: 'Alice',
      role: 'owner',
      createdAt: serverTimestamp(),
    });
    await db.doc(`businesses/${BUSINESS}/users/${BOB}`).set({
      uid: BOB,
      name: 'Bob',
      role: 'member',
      joinCode: JOIN_CODE,
      createdAt: serverTimestamp(),
    });
    await db.doc(`joinCodes/${JOIN_CODE}`).set({ businessId: BUSINESS });
    await db.doc(`businesses/${BUSINESS}/sales/venta-1`).set({
      serviceType: 'COPY_BW',
      quantity: 2,
      unitPriceCents: 100,
      totalCents: 200,
      createdBy: ALICE,
      createdByName: 'Alice',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
});

after(async () => {
  await env?.cleanup();
});

describe('Reglas de Firestore: perfiles de usuario', () => {
  it('ESCENARIO 1: usuario autenticado con perfil existente lee SU PROPIO perfil (la consulta de AuthContext al arrancar)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(ALICE).firestore();
    const snapshot = await assertSucceeds(db.doc(`users/${ALICE}`).get());
    assert.equal(snapshot.exists, true);
    assert.equal(snapshot.data()?.name, 'Alice');
    assert.equal(snapshot.data()?.businessId, BUSINESS);
  });

  it('ESCENARIO 2: usuario autenticado SIN perfil consulta su perfil y la lectura es válida (documento inexistente, no error de permisos)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    const snapshot = await assertSucceeds(db.doc(`users/${CAROL}`).get());
    assert.equal(snapshot.exists, false);
  });

  it('un usuario autenticado NO puede leer el perfil de otro usuario', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(db.doc(`users/${ALICE}`).get());
  });

  it('ESCENARIO 6: usuario NO autenticado no puede leer ningún perfil', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.unauthenticatedContext().firestore();
    await assertFails(db.doc(`users/${ALICE}`).get());
  });
});

describe('Reglas de Firestore: negocios', () => {
  it('ESCENARIO 3: miembro del negocio puede leerlo (getBusinessById)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(BOB).firestore();
    const snapshot = await assertSucceeds(db.doc(`businesses/${BUSINESS}`).get());
    assert.equal(snapshot.exists, true);
  });

  it('ESCENARIO 4: propietario del negocio puede leerlo', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(ALICE).firestore();
    const snapshot = await assertSucceeds(db.doc(`businesses/${BUSINESS}`).get());
    assert.equal(snapshot.exists, true);
    assert.equal(snapshot.data()?.createdBy, ALICE);
  });

  it('ESCENARIO 5: usuario sin membresía NO puede leer el negocio', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(db.doc(`businesses/${BUSINESS}`).get());
  });

  it('usuario sin negocio puede crear UN negocio (paso 1 de createBusiness)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    await assertSucceeds(
      db.doc('businesses/intento-carol-1').set({
        name: 'Negocio de Carol',
        joinCode: 'XYZ234',
        createdBy: CAROL,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('usuario que YA pertenece a un negocio NO puede crear otro', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(
      db.doc('businesses/intento-bob-1').set({
        name: 'Segundo negocio de Bob',
        joinCode: 'QRS567',
        createdBy: BOB,
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('Reglas de Firestore: membresías', () => {
  it('un usuario puede leer SU PROPIA membresía aunque aún no sea miembro (relax del Sprint 6 para confirmar uniones)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    const snapshot = await assertSucceeds(db.doc(`businesses/${BUSINESS}/users/${CAROL}`).get());
    assert.equal(snapshot.exists, false);
  });

  it('un miembro puede leer su membresía con datos', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(BOB).firestore();
    const snapshot = await assertSucceeds(db.doc(`businesses/${BUSINESS}/users/${BOB}`).get());
    assert.equal(snapshot.data()?.role, 'member');
  });

  it('un usuario NO puede leer la membresía de otro (sin enumerar membresías ajenas)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(db.doc(`businesses/${BUSINESS}/users/${ALICE}`).get());
  });
});

describe('Reglas de Firestore: códigos de invitación y ventas', () => {
  it('un autenticado puede consultar UN código concreto (findBusinessIdByJoinCode)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    const snapshot = await assertSucceeds(db.doc(`joinCodes/${JOIN_CODE}`).get());
    assert.equal(snapshot.data()?.businessId, BUSINESS);
  });

  it('un miembro puede consultar las ventas del negocio', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(BOB).firestore();
    const snapshot = await assertSucceeds(
      db.collection(`businesses/${BUSINESS}/sales`).get(),
    );
    assert.ok(snapshot.size >= 1);
  });

  it('un no miembro NO puede consultar las ventas', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(db.collection(`businesses/${BUSINESS}/sales`).get());
  });

  it('un miembro puede registrar una venta válida (createSale)', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      db.collection(`businesses/${BUSINESS}/sales`).doc('venta-bob-1').set({
        serviceType: 'PRINT_COLOR',
        quantity: 1,
        unitPriceCents: 500,
        totalCents: 500,
        createdBy: BOB,
        createdByName: 'Bob',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('un no miembro NO puede registrar ventas', async (t) => {
    if (!env) return t.skip('Emulador de Firestore no disponible (puerto 8080).');
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(
      db.collection(`businesses/${BUSINESS}/sales`).doc('venta-carol-1').set({
        serviceType: 'COPY_BW',
        quantity: 1,
        unitPriceCents: 100,
        totalCents: 100,
        createdBy: CAROL,
        createdByName: 'Carol',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});



