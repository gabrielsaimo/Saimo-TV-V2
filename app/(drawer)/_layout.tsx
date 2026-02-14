import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, TV } from '../../constants/Colors';
import TVPressable from '../../components/TVPressable';

const SIDEBAR_WIDTH = TV.sidebarWidth;
const SIDEBAR_COLLAPSED = TV.sidebarCollapsedWidth + 20; // Increased for better icon visual

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
  const widthAnim = useRef(new Animated.Value(SIDEBAR_COLLAPSED)).current;

  const toggleSidebar = useCallback((expand: boolean) => {
    setExpanded(expand);
    Animated.spring(widthAnim, {
      toValue: expand ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED,
      friction: 12,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [widthAnim]);

  const isActive = (route: string) => {
    if (route === '/(drawer)') {
      return pathname === '/' || pathname === '/(drawer)' || pathname === '/(drawer)/index';
    }
    return pathname.includes(route.replace('/(drawer)/', ''));
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, { width: widthAnim }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="tv" size={32} color={Colors.primary} />
          {expanded && (
            <Text style={styles.logoText}>Saimo TV</Text>
          )}
        </View>

        {/* Nav Items */}
        <View style={styles.navItems}>
          {NAV_ITEMS.map((item, index) => {
            const active = isActive(item.route);
            // We need to track focus locally to change icon/text color to white when focused
            // But since there are few items, we can't easily do it inside the map without extracting a component
            // For now, let's rely on the background style change.
            // Fix alignment: if collapsed, center the icon.
            
            return (
              <TVPressable
                key={item.route}
                style={[
                  styles.navItem,
                  active && styles.navItemActive,
                  !expanded && { justifyContent: 'center', paddingHorizontal: 0 } // Center when collapsed
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
                onFocus={() => toggleSidebar(true)}
                onBlur={() => toggleSidebar(false)}
                hasTVPreferredFocus={index === 0}
              >
                {({ focused }: { focused: boolean }) => (
                  <>
                    <Ionicons
                      name={(active ? item.iconFocused : item.icon) as any}
                      size={28}
                      color={focused ? '#FFF' : (active ? Colors.primary : Colors.textSecondary)}
                    />
                    {expanded && (
                      <Text
                        style={[
                          styles.navLabel,
                          active && styles.navLabelActive,
                          focused && { color: '#FFF' }
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    )}
                  </>
                )}
              </TVPressable>
            );
          })}
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          {expanded && (
            <Text style={styles.versionText}>v1.0.0</Text>
          )}
        </View>
      </Animated.View>

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
    zIndex: 100, // Ensure sidebar is above content for focus scaling
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center logo in both states
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    height: 60, // Fixed height for consistency
  },
  logoText: {
    color: Colors.text,
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
  },
  navItems: {
    flex: 1,
    gap: Spacing.sm, // Increase gap slightly
    paddingHorizontal: Spacing.xs, // Add padding for pill shape
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Align left but content will be centered if collapsed via padding
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderRadius: BorderRadius.lg, // More rounded
    marginHorizontal: 4,
    minHeight: 56,
  },
  navItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  navItemFocused: {
    backgroundColor: Colors.primary, // Solid primary when focused
    transform: [{ scale: 1.05 }],
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
  activeIndicator: {
    // Removed specific indicator, using background color instead
    display: 'none', 
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
