/**
 * Design tokens sampled from the reference screenshots.
 */

export const Colors = {
  background: '#FFFFFF',
  text: '#000000',

  // Beige surfaces (profile fields, point status card)
  surface: '#E9E2D0',
  surfaceLabel: '#3F3826',
  surfaceDivider: '#CCC5B3',
  headerDivider: '#DEDED4',

  // Product list
  textMuted: '#636363',

  error: '#C62828',
  /** Money received. */
  success: '#2E7D32',
  successSurface: '#E8F5E9',
  /** Dimmed backdrop behind pop-ups. */
  backdrop: 'rgba(0, 0, 0, 0.45)',
  switchOff: '#CFC8B6',

  // Bottom bar
  bar: '#FFD51E',
  barIndicator: '#F3CA18',
  barItem: '#7E5E00',
  barItemActive: '#6B5200',
  barLogout: '#2E1B00',
  scanButton: '#F8E388',
  scanContent: '#1A1400',

  // Glass bubble shown while touching the bottom bar
  glassFill: 'rgba(255, 255, 255, 0.32)',
  glassBorder: 'rgba(255, 255, 255, 0.9)',
  glassHighlight: 'rgba(255, 255, 255, 0.4)',

  // Promo carousel dots
  dotActive: '#222222',
  dotInactive: '#BDBDBD',
} as const;

export const Fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
} as const;

/** Horizontal page padding used by every screen. */
export const PagePadding = 16;
