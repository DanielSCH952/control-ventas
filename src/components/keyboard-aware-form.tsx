import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type TextInput,
} from 'react-native';

import {
  KeyboardAwareFormContext,
  type KeyboardAwareFormContextValue,
} from '@/context/KeyboardAwareFormContext';
import { getInputScrollDelta } from '@/utils/keyboardVisibility';

const DEFAULT_INPUT_MARGIN = 16;
const DEFAULT_BOTTOM_SPACING = 24;
const MIN_SCROLL_DELTA = 1;

interface KeyboardAwareFormProps extends ScrollViewProps {
  children: ReactNode;
  /** Offset del encabezado nativo, si existe. Las pantallas actuales no lo muestran. */
  keyboardVerticalOffset?: number;
  /** Margen visual mínimo alrededor del input enfocado. */
  inputMargin?: number;
  /** Espacio adicional para poder elevar el último campo y las acciones. */
  extraBottomSpacing?: number;
}

interface ScrollRequest {
  input: TextInput;
  targetY: number;
}

/**
 * Formulario vertical que mantiene visible el FormInput enfocado.
 * Android usa adjustResize; iOS usa KeyboardAvoidingView sin duplicar insets.
 */
export function KeyboardAwareForm({
  children,
  keyboardVerticalOffset = 0,
  inputMargin = DEFAULT_INPUT_MARGIN,
  extraBottomSpacing = DEFAULT_BOTTOM_SPACING,
  onContentSizeChange,
  onLayout,
  onScroll,
  onScrollBeginDrag,
  scrollEventThrottle = 16,
  style,
  ...scrollViewProps
}: KeyboardAwareFormProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const focusedInputRef = useRef<TextInput>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardVisibleRef = useRef(false);
  const viewportHeightRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const firstFrameRef = useRef<number | null>(null);
  const secondFrameRef = useRef<number | null>(null);
  const lastScrollRequestRef = useRef<ScrollRequest | null>(null);

  const ensureInputVisible = useCallback(() => {
    const input = focusedInputRef.current;
    const viewport = viewportRef.current;
    if (!mountedRef.current || !input || !viewport) {
      return;
    }

    viewport.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
      if (!mountedRef.current || focusedInputRef.current !== input || viewportHeight <= 0) {
        return;
      }

      input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
        if (!mountedRef.current || focusedInputRef.current !== input || inputHeight <= 0) {
          return;
        }

        const delta = getInputScrollDelta({
          inputTop,
          inputBottom: inputTop + inputHeight,
          viewportTop,
          viewportBottom: viewportTop + viewportHeight,
          margin: inputMargin,
        });

        if (Math.abs(delta) < MIN_SCROLL_DELTA) {
          lastScrollRequestRef.current = null;
          return;
        }

        const targetY = Math.max(0, scrollOffsetRef.current + delta);
        const previousRequest = lastScrollRequestRef.current;
        if (
          previousRequest?.input === input &&
          Math.abs(previousRequest.targetY - targetY) < MIN_SCROLL_DELTA
        ) {
          return;
        }

        lastScrollRequestRef.current = { input, targetY };
        scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
      });
    });
  }, [inputMargin]);

  const cancelMeasurement = useCallback(() => {
    if (firstFrameRef.current !== null) {
      cancelAnimationFrame(firstFrameRef.current);
      firstFrameRef.current = null;
    }
    if (secondFrameRef.current !== null) {
      cancelAnimationFrame(secondFrameRef.current);
      secondFrameRef.current = null;
    }
  }, []);

  const scheduleMeasurement = useCallback(() => {
    cancelMeasurement();
    // Espera el layout nativo. Una nueva notificación sustituye a la anterior.
    firstFrameRef.current = requestAnimationFrame(() => {
      firstFrameRef.current = null;
      secondFrameRef.current = requestAnimationFrame(() => {
        secondFrameRef.current = null;
        ensureInputVisible();
      });
    });
  }, [cancelMeasurement, ensureInputVisible]);

  const showInput = useCallback(
    (input: TextInput) => {
      focusedInputRef.current = input;
      lastScrollRequestRef.current = null;
      scheduleMeasurement();
    },
    [scheduleMeasurement],
  );

  const clearInput = useCallback(
    (input: TextInput) => {
      if (focusedInputRef.current === input) {
        focusedInputRef.current = null;
        lastScrollRequestRef.current = null;
        cancelMeasurement();
      }
    },
    [cancelMeasurement],
  );

  const contextValue = useMemo<KeyboardAwareFormContextValue>(
    () => ({ showInput, clearInput }),
    [showInput, clearInput],
  );

  const handleKeyboardShow = useCallback(() => {
    keyboardVisibleRef.current = true;
    scheduleMeasurement();
  }, [scheduleMeasurement]);

  const handleKeyboardHide = useCallback(() => {
    keyboardVisibleRef.current = false;
    lastScrollRequestRef.current = null;
    cancelMeasurement();
  }, [cancelMeasurement]);

  useEffect(() => {
    mountedRef.current = true;
    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
            Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
            Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
            Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
          ]
        : Platform.OS === 'android'
          ? [
              Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
              Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
            ]
          : [];

    return () => {
      mountedRef.current = false;
      subscriptions.forEach((subscription) => subscription.remove());
      focusedInputRef.current = null;
      cancelMeasurement();
    };
  }, [cancelMeasurement, handleKeyboardHide, handleKeyboardShow]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      const previousHeight = viewportHeightRef.current;
      viewportHeightRef.current = height;
      onLayout?.(event);

      // En Android 10 o inferior adjustResize puede no emitir eventos de
      // teclado. La reducción real del viewport sigue permitiendo reaccionar.
      const viewportShrank = previousHeight !== null && height < previousHeight - 1;
      if (keyboardVisibleRef.current || viewportShrank) {
        scheduleMeasurement();
      }
    },
    [onLayout, scheduleMeasurement],
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      onContentSizeChange?.(width, height);
      if (focusedInputRef.current) {
        scheduleMeasurement();
      }
    },
    [onContentSizeChange, scheduleMeasurement],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    [onScroll],
  );

  const handleScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // El gesto manual toma el control y permite una nueva medición posterior.
      lastScrollRequestRef.current = null;
      onScrollBeginDrag?.(event);
    },
    [onScrollBeginDrag],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={styles.container}>
      <View ref={viewportRef} style={styles.container} onLayout={handleLayout}>
        <ScrollView
          {...scrollViewProps}
          ref={scrollViewRef}
          style={[styles.scrollView, style]}
          automaticallyAdjustKeyboardInsets={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={scrollEventThrottle}
          scrollsChildToFocus={false}>
          <KeyboardAwareFormContext.Provider value={contextValue}>
            {children}
            <View pointerEvents="none" style={{ height: Math.max(0, extraBottomSpacing) }} />
          </KeyboardAwareFormContext.Provider>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});
