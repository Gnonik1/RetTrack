import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { theme } from '../constants/theme';
import { AppText } from './AppText';

export type AppBottomNavTab = 'history' | 'home' | 'profile' | 'settings';

type AppBottomNavProps = {
  activeTab: AppBottomNavTab;
  onAddPress?: () => void;
  onTabPress?: (tab: AppBottomNavTab) => void;
};

const navItems = [
  {
    Icon: HomeNavIcon,
    key: 'home',
    label: 'Home',
    route: '/purchases',
  },
  {
    Icon: HistoryNavIcon,
    key: 'history',
    label: 'History',
    route: '/history',
  },
  {
    Icon: ProfileNavIcon,
    key: 'profile',
    label: 'Profile',
    route: '/profile',
  },
  {
    Icon: SettingsNavIcon,
    key: 'settings',
    label: 'Settings',
    route: '/settings',
  },
] as const;

type NavIconProps = {
  active?: boolean;
};

const NAV_ICON_SIZE = 24;
const NAV_ICON_STROKE_WIDTH = 2;

function getNavIconColor(active: boolean) {
  return active ? theme.colors.greenDark : theme.colors.muted;
}

function HomeNavIcon({ active = false }: NavIconProps) {
  const color = getNavIconColor(active);

  return (
    <Svg
      fill="none"
      height={NAV_ICON_SIZE}
      viewBox="0 0 24 24"
      width={NAV_ICON_SIZE}
    >
      <Path
        d="M3.8 10.8 12 3.8l8.2 7"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={NAV_ICON_STROKE_WIDTH}
      />
      <Path
        d="M5.6 10.1v8.6c0 .7.5 1.2 1.2 1.2H10v-5.5h4v5.5h3.2c.7 0 1.2-.5 1.2-1.2v-8.6"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={NAV_ICON_STROKE_WIDTH}
      />
    </Svg>
  );
}

function HistoryNavIcon({ active = false }: NavIconProps) {
  const color = getNavIconColor(active);

  return (
    <Svg
      fill="none"
      height={NAV_ICON_SIZE}
      viewBox="0 0 24 24"
      width={NAV_ICON_SIZE}
    >
      <Circle
        cx="12"
        cy="12"
        r="8.4"
        stroke={color}
        strokeWidth={NAV_ICON_STROKE_WIDTH}
      />
      <Path
        d="M12 7.5v4.9l3.4 2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={NAV_ICON_STROKE_WIDTH}
      />
    </Svg>
  );
}

function ProfileNavIcon({ active = false }: NavIconProps) {
  const color = getNavIconColor(active);

  return (
    <Svg
      fill="none"
      height={NAV_ICON_SIZE}
      viewBox="0 0 24 24"
      width={NAV_ICON_SIZE}
    >
      <Circle
        cx="12"
        cy="8.25"
        r="3.15"
        stroke={color}
        strokeWidth={NAV_ICON_STROKE_WIDTH}
      />
      <Path
        d="M5.4 20.1v-.45C5.4 16.4 8 14.1 12 14.1s6.6 2.3 6.6 5.55v.45"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={NAV_ICON_STROKE_WIDTH}
      />
    </Svg>
  );
}

function SettingsNavIcon({ active = false }: NavIconProps) {
  const color = getNavIconColor(active);

  return (
    <Svg
      fill="none"
      height={NAV_ICON_SIZE}
      viewBox="0 0 24 24"
      width={NAV_ICON_SIZE}
    >
      <Path
        d="M9.7 3.4h4.6l.5 2.45c.53.18 1.04.46 1.49.82l2.38-.8 2.3 4-1.86 1.64c.05.33.08.65.08.99s-.03.66-.08.99l1.86 1.64-2.3 4-2.38-.8c-.45.36-.96.64-1.49.82l-.5 2.45H9.7l-.5-2.45a6.1 6.1 0 0 1-1.49-.82l-2.38.8-2.3-4 1.86-1.64a6.8 6.8 0 0 1 0-1.98L3.03 9.87l2.3-4 2.38.8c.45-.36.96-.64 1.49-.82l.5-2.45Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
      <Circle
        cx="12"
        cy="12.5"
        r="3.05"
        stroke={color}
        strokeWidth={1.9}
      />
    </Svg>
  );
}

function AddNavIcon() {
  return (
    <Svg fill="none" height={24} viewBox="0 0 24 24" width={24}>
      <Line
        stroke={theme.colors.card}
        strokeLinecap="round"
        strokeWidth={2.6}
        x1="12"
        x2="12"
        y1="5.5"
        y2="18.5"
      />
      <Line
        stroke={theme.colors.card}
        strokeLinecap="round"
        strokeWidth={2.6}
        x1="5.5"
        x2="18.5"
        y1="12"
        y2="12"
      />
    </Svg>
  );
}

export function AppBottomNav({
  activeTab,
  onAddPress,
  onTabPress,
}: AppBottomNavProps) {
  const router = useRouter();

  const handleAddPress = () => {
    if (onAddPress) {
      onAddPress();
      return;
    }

    router.push('/add-purchase');
  };

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const isActive = item.key === activeTab;
    const Icon = item.Icon;

    return (
      <Pressable
        accessibilityLabel={item.label}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        key={item.key}
        onPress={() => {
          if (!isActive) {
            if (onTabPress) {
              onTabPress(item.key);
              return;
            }

            router.replace(item.route);
          }
        }}
        style={({ pressed }) => [
          styles.navItem,
          pressed && !isActive ? styles.navItemPressed : null,
        ]}
      >
        <View style={styles.navItemContent}>
          {isActive ? <View style={styles.navActiveCapsule} /> : null}
          <Icon active={isActive} />
          <AppText
            style={[
              styles.navLabel,
              item.key === 'home' && isActive && styles.navLabelHomeActive,
              isActive && styles.navLabelActive,
            ]}
            variant="caption"
          >
            {item.label}
          </AppText>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.bottomNav}>
      {renderNavItem(navItems[0])}
      {renderNavItem(navItems[1])}

      <Pressable
        accessibilityLabel="Add purchase"
        accessibilityRole="button"
        onPress={handleAddPress}
        style={({ pressed }) => [
          styles.navAddButton,
          pressed && styles.navAddButtonPressed,
        ]}
      >
        <AddNavIcon />
      </Pressable>

      {renderNavItem(navItems[2])}
      {renderNavItem(navItems[3])}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: theme.spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: theme.spacing.md,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  navAddButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    height: 52,
    justifyContent: 'center',
    marginHorizontal: 8,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 52,
  },
  navAddButtonPressed: {
    opacity: 0.82,
  },
  navActiveCapsule: {
    backgroundColor: theme.colors.sage,
    borderRadius: 18,
    bottom: 0,
    left: 0,
    opacity: 0.82,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 46,
    position: 'relative',
  },
  navItemContent: {
    alignItems: 'center',
    gap: 2,
    height: 46,
    justifyContent: 'center',
    paddingTop: 1,
    position: 'relative',
    width: 58,
  },
  navItemPressed: {
    opacity: 0.78,
  },
  navLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 14,
  },
  navLabelActive: {
    color: theme.colors.greenDark,
    fontWeight: theme.fontWeight.semibold,
  },
  navLabelHomeActive: {
    fontSize: 11.5,
  },
});
