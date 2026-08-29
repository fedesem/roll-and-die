/**
 * Application-wide standard z-index layer hierarchy.
 * Ensures modals, popovers, tooltips, board overlays, and top bars stack reliably.
 */
export const Z_INDEX = {
  /** Base document flow */
  BASE: 0,
  /** Battle map drawing and grid overlays */
  BOARD_CANVAS: 5,
  /** Battle map floating sidebar HUD and menus */
  BOARD_OVERLAY: 10,
  /** Sticky application top bar */
  APP_TOPBAR: 30,
  /** Primary modal backdrop and panel */
  MODAL_BACKDROP: 50,
  MODAL_PANEL: 55,
  /** Nested modal backdrop and panel (e.g. spell selection over progression, rest dialogs) */
  NESTED_MODAL_BACKDROP: 65,
  NESTED_MODAL_PANEL: 70,
  /** Floating tooltips, rule popovers, and context menus */
  FLOATING_LAYER: 85,
  /** System toasts and critical alert banners */
  TOAST_NOTIFICATION: 100
} as const;

export type LayerName = keyof typeof Z_INDEX;
