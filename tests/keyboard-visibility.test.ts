import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getInputScrollDelta } from '../src/utils/keyboardVisibility';

const viewport = { viewportTop: 100, viewportBottom: 500, margin: 16 };

describe('getInputScrollDelta', () => {
  it('no desplaza un input que ya está completamente visible', () => {
    assert.equal(getInputScrollDelta({ ...viewport, inputTop: 180, inputBottom: 240 }), 0);
  });

  it('desplaza hacia abajo un input cubierto por el límite inferior', () => {
    // El límite útil es 484; el input termina en 520: faltan 36 puntos.
    assert.equal(getInputScrollDelta({ ...viewport, inputTop: 460, inputBottom: 520 }), 36);
  });

  it('recupera un input cuya parte superior quedó fuera del viewport', () => {
    // Alinear la parte superior a 116 requiere subir 56 puntos.
    assert.equal(getInputScrollDelta({ ...viewport, inputTop: 60, inputBottom: 110 }), -56);
  });

  it('alinea arriba un input multilínea más alto que el espacio disponible', () => {
    assert.equal(getInputScrollDelta({ ...viewport, inputTop: 140, inputBottom: 700 }), 24);
  });

  it('no calcula desplazamientos con un viewport sin altura útil', () => {
    assert.equal(
      getInputScrollDelta({
        inputTop: 100,
        inputBottom: 180,
        viewportTop: 100,
        viewportBottom: 100,
        margin: 16,
      }),
      0,
    );
  });
});
