import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';
import { hydrateFromDisk } from '../../services/streamingService';

// Habilita LayoutAnimation no Android (necessário para animação nativa de layout)
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const SIDEBAR_WIDTH = TV.sidebarWidth;
const SIDEBAR_COLLAPSED = TV.sidebarCollapsedWidth;

// Animação nativa de layout — roda no thread nativo, JS fica livre para D-pad
const LAYOUT_ANIM = LayoutAnimation.create(
  120,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

interface NavItem {
  route: string;
  label: string;
  icon: string;
  iconFocused: string;
}

const NAV_ITEMS: NavItem[] = [
  { route: '/(drawer)', label: 'TV ao Vivo', icon: 'tv-outline', iconFocused: 'tv' },
  { route: '/(drawer)/movies', label: 'Ondmed', icon: 'film-outline', iconFocused: 'film' },
  { route: '/(drawer)/favorites', label: 'Favoritos', icon: 'heart-outline', iconFocused: 'heart' },
  { route: '/(drawer)/settings', label: 'Ajustes', icon: 'settings-outline', iconFocused: 'settings' },
];

export default function DrawerLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  // Refs para estado síncrono — evitam stale closures nos handlers
  const expandedRef = useRef(false);
  const focusCountRef = useRef(0);
  // Timer de colapso com clearTimeout no focus para cancelar colapsos pendentes
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidrata o catálogo do disco de forma assíncrona no startup
  useEffect(() => {
    hydrateFromDisk().catch(() => {});
  }, []);

  // ============================
  // Sidebar focus handlers — deps VAZIAS, completamente estáveis
  // ============================
  // Por que NÃO usar {expanded && <Text>}:
  //   Quando expanded muda, React monta/desmonta o <Text> dentro do TVPressable focado.
  //   A mudança na árvore de filhos faz o focus engine do Android recalcular foco.
  //   Isso dispara blur → sidebar colapsa → remonta → focus → expande → ciclo infinito.
  //
  // Solução: sempre montar o <Text>, apenas mudar style (maxWidth/opacity).
  //   Mudança de style NÃO altera a árvore = focus engine não recalcula = sem blur espúrio.

  const handleItemFocus = useCallback(() => {
    focusCountRef.current += 1;
    // Cancela qualquer timer de colapso pendente (cobre o caso blur-antes-de-focus)
    if (collapseTimerRef.current !== null) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (!expandedRef.current) {
      expandedRef.current = true;
      LayoutAnimation.configureNext(LAYOUT_ANIM);
      setExpanded(true);
    }
  }, []);

  const handleItemBlur = useCallback(() => {
    focusCountRef.current = Math.max(0, focusCountRef.current - 1);
    // Limpa timer anterior
    if (collapseTimerRef.current !== null) {
      clearTimeout(collapseTimerRef.current);
    }
    // 200ms de debounce — generoso para Fire TV Lite (JS thread pode estar ocupada)
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = null;
      if (focusCountRef.current === 0 && expandedRef.current) {
        expandedRef.current = false;
        LayoutAnimation.configureNext(LAYOUT_ANIM);
        setExpanded(false);
      }
    }, 200);
  }, []);

  const isActive = (route: string) => {
    if (route === '/(drawer)') {
      return pathname === '/' || pathname === '/(drawer)' || pathname === '/(drawer)/index';
    }
    return pathname.includes(route.replace('/(drawer)/', ''));
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={[styles.sidebar, { width: expanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="tv" size={32} color={Colors.primary} />
          <Text style={[styles.logoText, !expanded && styles.textCollapsed]}>Saimo TV</Text>
        </View>

        {/* Nav Items */}
        <View style={styles.navItems}>
          {NAV_ITEMS.map((item, index) => {
            const active = isActive(item.route);
            return (
              <TVPressable
                key={item.route}
                style={[
                  styles.navItem,
                  active && styles.navItemActive,
                ]}
                focusedStyle={styles.navItemFocused}
                focusScale={1.05}
                onPress={() => {
                  if (item.route === '/(drawer)') {
                    router.replace('/');
                  } else {
                    router.replace(item.route as any);
                  }
                }}
                onFocus={handleItemFocus}
                onBlur={handleItemBlur}
                hasTVPreferredFocus={index === 0}
              >
                <Ionicons
                  name={(active ? item.iconFocused : item.icon) as any}
                  size={28}
                  color={active ? Colors.primary : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.navLabel,
                    active && styles.navLabelActive,
                    !expanded && styles.textCollapsed,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {active && <View style={styles.activeIndicator} />}
              </TVPressable>
            );
          })}
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, !expanded && styles.textCollapsed]}>v1.0.0</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  sidebar: {
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: Spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logoText: {
    color: Colors.text,
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
  },
  navItems: {
    flex: 1,
    gap: Spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: 0,
    minHeight: 56,
  },
  navItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  navItemFocused: {
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
  },
  navLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  // Style hiding: componente sempre montado, sem mudança na árvore DOM
  // maxWidth: 0 → não ocupa espaço horizontal (ícone fica centralizado)
  // opacity: 0 → invisível
  // overflow: 'hidden' → nenhum pixel vaza
  textCollapsed: {
    maxWidth: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '20%',
    bottom: '20%',
    width: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  versionContainer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: Typography.label.fontSize,
  },
});
