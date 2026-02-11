// Constantes de cores e tema do app - versão TV Box
// Escala aumentada para visualização à distância (10-foot experience)

export const Colors = {
  // Theme escuro profissional
  background: '#0A0A0F',
  surface: '#15151F',
  surfaceVariant: '#1E1E2D',
  surfaceHover: '#252538',

  // Cores primárias
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',

  // Cores secundárias
  secondary: '#8B5CF6',
  secondaryDark: '#7C3AED',
  secondaryLight: '#A78BFA',

  // Cores de destaque
  accent: '#F43F5E',
  accentDark: '#E11D48',

  // Cores de gradiente
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',

  // Texto
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  // Status
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',

  // Outros
  border: '#2D2D3D',
  borderLight: '#3F3F5A',
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // Live indicator
  live: '#EF4444',
  liveGlow: 'rgba(239, 68, 68, 0.4)',

  // Progress bar
  progressBg: '#374151',
  progressFill: '#6366F1',

  // Cards
  cardBg: '#15151F',
  cardBorder: '#2D2D3D',
  cardHover: '#1E1E2D',

  // Focus states (TV specific)
  focusBorder: '#6366F1',
  focusGlow: 'rgba(99, 102, 241, 0.4)',
  focusBorderWidth: 3,
};

// Espaçamentos - aumentados para TV
export const Spacing = {
  xs: 6,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
};

// Bordas arredondadas - maiores para TV
export const BorderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
};

// Tipografia - maior para TV (visualização à distância)
export const Typography = {
  h1: {
    fontSize: 40,
    fontWeight: '700' as const,
    lineHeight: 48,
  },
  h2: {
    fontSize: 30,
    fontWeight: '600' as const,
    lineHeight: 38,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  body: {
    fontSize: 20,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  bodyLarge: {
    fontSize: 22,
    fontWeight: '400' as const,
    lineHeight: 30,
  },
  caption: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
};

// Sombras
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

// TV-specific constants
export const TV = {
  // Sidebar width
  sidebarWidth: 280,
  sidebarCollapsedWidth: 80,

  // Card sizes for TV
  channelCardWidth: 300,
  channelCardHeight: 200,
  mediaCardWidth: 220,
  mediaCardHeight: 330,
  mediaCardLargeWidth: 280,
  mediaCardLargeHeight: 420,

  // Focus animation duration
  focusAnimDuration: 150,

  // Number of columns in grids
  channelColumns: 4,
  mediaColumns: 5,
};
