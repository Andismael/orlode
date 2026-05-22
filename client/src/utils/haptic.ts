/**
 * Haptic feedback helper for native-app-style touch response.
 *
 * Vibration API is supported on Android (Chrome, Firefox) — iOS Safari
 * silently ignores it (Apple restricts haptics to native apps). Always
 * guarded for SSR / older browsers.
 *
 * Usage:
 *   onClick={() => { haptic.light(); doStuff(); }}
 *   onTouchStart={() => haptic.light()}      // on tap-card
 *   onSuccess={() => haptic.success()}        // 3-pulse success
 */

const can = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function';

const buzz = (pattern: number | number[]) => {
  if (!can()) return;
  try { navigator.vibrate(pattern); } catch { /* noop */ }
};

export const haptic = {
  /** Standard tap — buttons, list items, cards. */
  light:   () => buzz(8),
  /** Medium — toggles, switches, segment changes. */
  medium:  () => buzz(15),
  /** Heavy — destructive actions, errors, modal opens. */
  heavy:   () => buzz(25),
  /** Two-pulse selection confirm. */
  select:  () => buzz([6, 30, 6]),
  /** Three-pulse success (payment confirmed, order saved). */
  success: () => buzz([10, 40, 10, 40, 10]),
  /** Single longer pulse for warnings. */
  warning: () => buzz([20, 60, 20]),
  /** Stop any running vibration. */
  stop:    () => buzz(0),
};
