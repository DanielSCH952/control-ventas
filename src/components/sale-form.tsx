import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { SERVICE_OPTIONS } from '@/constants/services';
import { AppError } from '@/services/errors';
import {
  MAX_SALE_NOTES_LENGTH,
  MAX_SALE_QUANTITY,
  MAX_UNIT_PRICE_CENTS,
} from '@/services/saleService';
import { computeTotalCents, getSuggestedUnitPrice } from '@/utils/pricing';
import { centsToInputString, formatCents, parseMoneyToCents } from '@/utils/currency';
import type { ServiceType } from '@/types/Service';
import type { CreateSaleInput } from '@/types/Sale';

const QUANTITY_MAX_LENGTH = 4;
const PRICE_MAX_LENGTH = 12;

/** Convierte el texto de cantidad a entero, o null si es vacío/inválido. */
function parseQuantityText(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/** Valores iniciales del formulario (pantalla de edición). */
export interface SaleFormInitialValues {
  serviceType: ServiceType;
  quantity: number;
  unitPriceCents: number;
  notes?: string;
}

interface SaleFormProps {
  /**
   * Valores con los que arranca el formulario. Si se reciben (edición), el
   * precio cargado se considera una decisión previa del usuario y no se
   * sobrescribe automáticamente al cambiar la cantidad.
   */
  initialValues?: SaleFormInitialValues;
  /** Etiqueta del botón de envío. */
  submitLabel: string;
  /** Etiqueta del botón mientras la escritura está en curso. */
  savingLabel: string;
  /**
   * Recibe la entrada ya validada y devuelve una promesa que se resuelve
   * cuando la escritura se confirma. Si la promesa se rechaza con un
   * `AppError`, el formulario muestra el mensaje y conserva los datos.
   */
  onSubmit: (input: CreateSaleInput) => Promise<void>;
}

/**
 * Formulario compartido de ventas (Sprint 4).
 *
 * Encapsula la lógica del Sprint 3 (selección de servicio, cantidad, precio
 * con tarifa sugerida, total y observaciones) para reutilizarla tanto en el
 * registro (`/sales/new`) como en la edición (`/sales/edit`).
 *
 * Comportamiento del precio:
 *  - Al elegir un servicio se muestra/rellena el precio sugerido (si la
 *    tarifa existe) y se descarta cualquier precio personalizado previo.
 *  - Al cambiar la cantidad se recalcula la tarifa aplicable solo si el
 *    usuario NO ha editado el precio manualmente (en edición, el precio
 *    original cuenta como decisión manual).
 *  - Una edición manual nunca se sobrescribe con renderizaciones.
 */
export function SaleForm({ initialValues, submitLabel, savingLabel, onSubmit }: SaleFormProps) {
  const [serviceType, setServiceType] = useState<ServiceType | null>(
    initialValues?.serviceType ?? null,
  );
  const [quantityText, setQuantityText] = useState(
    initialValues ? String(initialValues.quantity) : '',
  );
  const [unitPriceText, setUnitPriceText] = useState(
    initialValues ? centsToInputString(initialValues.unitPriceCents) : '',
  );
  // En edición, el precio guardado es una decisión previa: la cantidad no
  // debe sobrescribirla automáticamente.
  const [priceEdited, setPriceEdited] = useState(initialValues !== undefined);
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const quantity = parseQuantityText(quantityText);
  const suggestedUnitPriceCents =
    serviceType && quantity !== null && quantity >= 1
      ? getSuggestedUnitPrice(serviceType, quantity)
      : null;

  let totalCents: number | null = null;
  if (quantity !== null && quantity >= 1) {
    try {
      totalCents = computeTotalCents(quantity, parseMoneyToCents(unitPriceText));
    } catch {
      totalCents = null;
    }
  }

  function applySuggestionFor(type: ServiceType, rawQuantity: string): void {
    const parsedQuantity = parseQuantityText(rawQuantity);
    const suggestion =
      parsedQuantity !== null && parsedQuantity >= 1
        ? getSuggestedUnitPrice(type, parsedQuantity)
        : null;
    setUnitPriceText(suggestion !== null ? centsToInputString(suggestion) : '');
    setPriceEdited(false);
  }

  function handleSelectService(type: ServiceType): void {
    if (saving) {
      return;
    }
    setServiceType(type);
    setFormError(null);
    // Cambiar de servicio implica otra tarifa: se descarta el precio
    // personalizado y se aplica el nuevo precio sugerido.
    applySuggestionFor(type, quantityText);
  }

  function handleQuantityChange(text: string): void {
    setQuantityText(text);
    setFormError(null);
    // Si el usuario no personalizó el precio, la nueva tarifa por volumen
    // se aplica automáticamente.
    if (!priceEdited && serviceType) {
      const parsedQuantity = parseQuantityText(text);
      const suggestion =
        parsedQuantity !== null && parsedQuantity >= 1
          ? getSuggestedUnitPrice(serviceType, parsedQuantity)
          : null;
      if (suggestion !== null) {
        setUnitPriceText(centsToInputString(suggestion));
      }
    }
  }

  function handleUnitPriceChange(text: string): void {
    setUnitPriceText(text);
    setPriceEdited(true);
    setFormError(null);
  }

  function handleSubmit(): void {
    // Evita envíos duplicados mientras la escritura está en curso.
    if (saving) {
      return;
    }
    if (!serviceType) {
      setFormError('Selecciona un servicio.');
      return;
    }
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1) {
      setFormError('La cantidad debe ser un número entero mayor que 0.');
      return;
    }
    if (quantity > MAX_SALE_QUANTITY) {
      setFormError(`La cantidad no puede superar ${MAX_SALE_QUANTITY}.`);
      return;
    }

    let unitPriceCents: number;
    try {
      unitPriceCents = parseMoneyToCents(unitPriceText);
    } catch (error) {
      setFormError(
        error instanceof AppError
          ? error.message
          : 'Escribe un precio válido, por ejemplo 1.50.',
      );
      return;
    }
    if (unitPriceCents < 1) {
      setFormError('El precio unitario debe ser mayor que $0.00.');
      return;
    }
    if (unitPriceCents > MAX_UNIT_PRICE_CENTS) {
      setFormError('El precio unitario es demasiado alto.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > MAX_SALE_NOTES_LENGTH) {
      setFormError(`Las observaciones no pueden superar ${MAX_SALE_NOTES_LENGTH} caracteres.`);
      return;
    }

    // Total verificado en el cliente y revalidado por las reglas y el
    // servicio: siempre `quantity * unitPriceCents`.
    const saleTotalCents = computeTotalCents(quantity, unitPriceCents);

    setSaving(true);
    setFormError(null);

    onSubmit({
      serviceType,
      quantity,
      unitPriceCents,
      totalCents: saleTotalCents,
      notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
    })
      .catch((error: unknown) => {
        setFormError(
          error instanceof AppError
            ? error.message
            : 'No pudimos guardar los datos. Revisa tu conexión e inténtalo de nuevo.',
        );
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Servicio
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {SERVICE_OPTIONS.map((option) => {
            const selected = option.type === serviceType;
            return (
              <Pressable
                key={option.type}
                onPress={() => handleSelectService(option.type)}
                disabled={saving}
                accessibilityRole="button"
                className={`rounded-xl border px-4 py-3 ${
                  selected
                    ? 'border-neutral-900 bg-neutral-900 dark:border-white dark:bg-white'
                    : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                }`}>
                <Text
                  className={
                    selected
                      ? 'text-sm font-semibold text-white dark:text-neutral-900'
                      : 'text-sm text-neutral-900 dark:text-white'
                  }>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FormInput
        label="Cantidad"
        value={quantityText}
        onChangeText={handleQuantityChange}
        maxLength={QUANTITY_MAX_LENGTH}
        placeholder="Ej. 8"
        keyboardType="number-pad"
        returnKeyType="done"
      />

      {suggestedUnitPriceCents !== null ? (
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          Precio sugerido: {formatCents(suggestedUnitPriceCents)} por unidad
          {priceEdited ? ' (has modificado el precio)' : ''}
        </Text>
      ) : serviceType ? (
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          Este servicio no tiene tarifa automática: escribe el precio manualmente.
        </Text>
      ) : null}

      <FormInput
        label="Precio unitario (MXN)"
        value={unitPriceText}
        onChangeText={handleUnitPriceChange}
        maxLength={PRICE_MAX_LENGTH}
        placeholder="Ej. 1.50"
        keyboardType="decimal-pad"
        returnKeyType="done"
      />

      <View className="flex-row items-center justify-between rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">Total</Text>
        <Text className="text-xl font-bold text-neutral-900 dark:text-white">
          {totalCents !== null ? formatCents(totalCents) : '—'}
        </Text>
      </View>

      <FormInput
        label="Observaciones (opcional)"
        value={notes}
        onChangeText={(text) => {
          setNotes(text);
          setFormError(null);
        }}
        maxLength={MAX_SALE_NOTES_LENGTH}
        placeholder="Ej. trabajo con muchas imágenes, precio especial…"
        multiline
      />

      {formError ? (
        <Text className="text-sm text-red-600 dark:text-red-400">{formError}</Text>
      ) : null}

      <PrimaryButton
        label={saving ? savingLabel : submitLabel}
        onPress={handleSubmit}
        disabled={saving}
      />
    </View>
  );
}
