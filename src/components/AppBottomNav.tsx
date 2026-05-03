import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '../constants/theme';
import { AppText } from './AppText';

export type AppBottomNavTab = 'history' | 'home' | 'profile' | 'settings';

type AppBottomNavProps = {
  activeTab: AppBottomNavTab;
  onAddPress?: () => void;
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

function HomeNavIcon({ active = false }: NavIconProps) {
  return (
    <View style={styles.navIconHome} accessibilityElementsHidden>
      <View style={[styles.navHomeRoof, active && styles.navIconActive]} />
      <View style={[styles.navHomeBody, active && styles.navIconActive]} />
    </View>
  );
}

function HistoryNavIcon({ active = false }: NavIconProps) {
  return (
    <View
      style={[styles.navIconCircle, active && styles.navIconActive]}
      accessibilityElementsHidden
    >
      <View
        style={[styles.navClockMinute, active && styles.navIconFillActive]}
      />
      <View style={[styles.navClockHour, active && styles.navIconFillActive]} />
      <View
        style={[styles.navClockCenter, active && styles.navIconFillActive]}
      />
    </View>
  );
}

function ProfileNavIcon({ active = false }: NavIconProps) {
  return (
    <View style={styles.navIconProfile} accessibilityElementsHidden>
      <View style={[styles.navProfileHead, active && styles.navIconActive]} />
      <View style={[styles.navProfileBody, active && styles.navIconActive]} />
    </View>
  );
}

function SettingsNavIcon({ active = false }: NavIconProps) {
  return (
    <View style={styles.navIconSettings} accessibilityElementsHidden>
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothTop,
          active && styles.navIconFillActive,
        ]}
      />
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothRight,
          active && styles.navIconFillActive,
        ]}
      />
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothBottom,
          active && styles.navIconFillActive,
        ]}
      />
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothLeft,
          active && styles.navIconFillActive,
        ]}
      />
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothUpperRight,
          active && styles.navIconFillActive,
        ]}
      />
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothLowerRight,
          active && styles.navIconFillActive,
        ]}
      />
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothLowerLeft,
          active && styles.navIconFillActive,
        ]}
      />
      <View
        style={[
          styles.navGearTooth,
          styles.navGearToothUpperLeft,
          active && styles.navIconFillActive,
        ]}
      />
      <View style={[styles.navGearRing, active && styles.navIconActive]}>
        <View
          style={[styles.navGearCenter, active && styles.navIconFillActive]}
        />
      </View>
    </View>
  );
}

export function AppBottomNav({ activeTab, onAddPress }: AppBottomNavProps) {
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
            router.navigate(item.route);
          }
        }}
        style={({ pressed }) => [
          styles.navItem,
          pressed && !isActive ? styles.navItemPressed : null,
        ]}
      >
        <Icon active={isActive} />
        <AppText
          style={[styles.navLabel, isActive && styles.navLabelActive]}
          variant="caption"
        >
          {item.label}
        </AppText>
        {isActive ? <View style={styles.navActiveIndicator} /> : null}
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
        <AppText style={styles.navAddButtonText} variant="button">
          +
        </AppText>
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
  navActiveIndicator: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    bottom: 1,
    height: 2,
    opacity: 0.82,
    position: 'absolute',
    width: 12,
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
  navAddButtonText: {
    color: theme.colors.card,
    fontSize: 30,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 32,
    marginTop: -2,
  },
  navClockCenter: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 3.2,
    left: 8.9,
    position: 'absolute',
    top: 8.9,
    width: 3.2,
  },
  navClockHour: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 1.8,
    left: 9.6,
    position: 'absolute',
    top: 10.1,
    width: 5.3,
  },
  navClockMinute: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 6.2,
    left: 9.6,
    position: 'absolute',
    top: 5.2,
    width: 1.8,
  },
  navGearCenter: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 3.4,
    width: 3.4,
  },
  navGearRing: {
    alignItems: 'center',
    borderColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    borderWidth: 1.7,
    height: 12.5,
    justifyContent: 'center',
    width: 12.5,
  },
  navGearTooth: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 1.8,
    position: 'absolute',
    width: 4.4,
  },
  navGearToothBottom: {
    bottom: 1.4,
    left: 8.8,
    transform: [{ rotate: '90deg' }],
  },
  navGearToothLeft: {
    left: 1.4,
    top: 10.1,
  },
  navGearToothLowerLeft: {
    bottom: 4.1,
    left: 3.8,
    transform: [{ rotate: '45deg' }],
  },
  navGearToothLowerRight: {
    bottom: 4.1,
    right: 3.8,
    transform: [{ rotate: '-45deg' }],
  },
  navGearToothRight: {
    right: 1.4,
    top: 10.1,
  },
  navGearToothTop: {
    left: 8.8,
    top: 1.4,
    transform: [{ rotate: '90deg' }],
  },
  navGearToothUpperLeft: {
    left: 3.8,
    top: 4.1,
    transform: [{ rotate: '-45deg' }],
  },
  navGearToothUpperRight: {
    right: 3.8,
    top: 4.1,
    transform: [{ rotate: '45deg' }],
  },
  navHomeBody: {
    borderColor: theme.colors.muted,
    borderRadius: 3,
    borderWidth: 1.8,
    height: 11,
    marginTop: 7,
    width: 14,
  },
  navHomeRoof: {
    borderColor: theme.colors.muted,
    borderLeftWidth: 1.8,
    borderTopWidth: 1.8,
    height: 12,
    position: 'absolute',
    top: 2,
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  navIconActive: {
    borderColor: theme.colors.greenDark,
  },
  navIconCircle: {
    alignItems: 'center',
    borderColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    borderWidth: 1.8,
    height: 21,
    justifyContent: 'center',
    position: 'relative',
    width: 21,
  },
  navIconFillActive: {
    backgroundColor: theme.colors.greenDark,
  },
  navIconHome: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 22,
  },
  navIconProfile: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  navIconSettings: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    position: 'relative',
    width: 22,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 46,
    position: 'relative',
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
  navProfileBody: {
    borderColor: theme.colors.muted,
    borderRadius: 8,
    borderWidth: 1.8,
    height: 8,
    marginTop: 2,
    width: 16,
  },
  navProfileHead: {
    borderColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    borderWidth: 1.8,
    height: 8,
    width: 8,
  },
});
