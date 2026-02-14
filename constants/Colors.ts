// Constantes de cores e tema do app - versao TV Box
// Escala aumentada para visualizacao a distancia (10-foot experience)
import { Dimensions } from 'react-native';

// Responsive scaling: normalizes all sizes to a 1920px baseline
// Works correctly on 720p (1280), 1080p (1920), 1440p (2560), and 4K (3840)
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 1920;
export const scale = (size: number) => Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);
export const SCREEN = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };

export const Colors = {
  // Theme escuro profissional
  background: '#0A0A0F',
  surface: '#15151F',
  surfaceVariant: '#1E1E2D',
  surfaceHover: '#252538',

  // Cores primarias
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',

  // Cores secundarias
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

// Espacamentos - aumentados para TV
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

// Tipografia - maior para TV (visualizacao a distancia)
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

// TV-specific constants — computed dynamically from screen size
// Sidebar available width = SCREEN_WIDTH - sidebarCollapsedWidth
const CONTENT_WIDTH = SCREEN_WIDTH - scale(80);
const CARD_GAP = Spacing.lg; // gap between cards

// Calculate how many columns fit for channel cards (~300px each at 1920)
const CHANNEL_CARD_W = scale(300);
const channelCols = Math.max(2, Math.floor((CONTENT_WIDTH - Spacing.xl * 2) / (CHANNEL_CARD_W + CARD_GAP)));

// Calculate how many columns fit for media cards (~196px each at 1920)
// Reduced from 220 to 196 to fit one more column (User request)
const MEDIA_CARD_W = scale(196);
// Card has 20px padding on each side (40px total) due to SCALE_PADDING in TVMediaCard
const MEDIA_CARD_TOTAL_W = MEDIA_CARD_W + 40;
const mediaCols = Math.max(2, Math.floor((CONTENT_WIDTH - Spacing.xl * 2) / (MEDIA_CARD_TOTAL_W + Spacing.md)));

export const TV = {
  // Sidebar width
  sidebarWidth: scale(280),
  sidebarCollapsedWidth: scale(80),

  // Card sizes for TV — scale with resolution
  channelCardWidth: CHANNEL_CARD_W,
  channelCardHeight: scale(200),
  mediaCardWidth: MEDIA_CARD_W,
  mediaCardHeight: scale(330),
  mediaCardLargeWidth: scale(280),
  mediaCardLargeHeight: scale(420),

  // Focus animation duration
  focusAnimDuration: 150,

  // Number of columns in grids — computed from screen size
  channelColumns: channelCols,
  mediaColumns: mediaCols,
};
