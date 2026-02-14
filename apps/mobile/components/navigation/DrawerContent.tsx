import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  Home, ClipboardList, PlusCircle, Wallet,
  Settings, X, LogOut,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text, Avatar } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { spacing, radius } from '@/theme/tokens';

const Logo = require('@/assets/images/logo-full.png');

interface NavItem {
  name: string;
  route: string;
  icon: LucideIcon;
  description: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { name: 'Home', route: '/(tabs)/home', icon: Home, description: 'Browse gigs' },
      { name: 'My Gigs', route: '/(tabs)/my-gigs', icon: ClipboardList, description: 'Posted & Accepted' },
      { name: 'Post Gig', route: '/(tabs)/post', icon: PlusCircle, description: 'Create new' },
      { name: 'Wallet', route: '/(tabs)/wallet', icon: Wallet, description: 'Balance & Withdrawals' },
    ],
  },
  {
    title: 'Settings & Support',
    items: [
      { name: 'Settings', route: '/(tabs)/settings', icon: Settings, description: 'Preferences' },
    ],
  },
];

interface DrawerContentProps {
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

export function DrawerContent({ onClose, onNavigate }: DrawerContentProps) {
  const { user, logout } = useAuthStore();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(' ') || 'Anonymous';

  const handleNavigate = (route: string) => {
    onClose();
    if (onNavigate) {
      onNavigate(route);
    } else {
      router.push(route as never);
    }
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/(auth)/welcome');
  };

  const handleProfilePress = () => {
    onClose();
    router.push('/(tabs)/profile');
  };

  return (
    <View
      style={[
        s.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Header */}
      <View
        style={[s.header, { borderBottomColor: theme.colors.border }]}
      >
        <Image source={Logo} style={s.logo} contentFit="contain" />
        <TouchableOpacity
          onPress={onClose}
          style={[s.closeBtn, { backgroundColor: theme.colors.muted }]}
          activeOpacity={0.7}
        >
          <X size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* User Info */}
      <TouchableOpacity
        onPress={handleProfilePress}
        activeOpacity={0.7}
        style={[s.userCard, { backgroundColor: theme.colors.muted }]}
      >
        <Avatar src={user?.avatar_url} name={fullName} size="lg" />
        <View style={s.userMeta}>
          <Text
            variant="body"
            weight="semibold"
          >
            {fullName}
          </Text>
          <Text variant="caption" color={theme.colors.textSub}>
            Member
          </Text>
        </View>
      </TouchableOpacity>

      {/* Navigation */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {NAV_SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text
              variant="caption"
              weight="bold"
              color={theme.colors.textFaint}
              style={s.sectionTitle}
            >
              {section.title.toUpperCase()}
            </Text>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.route;
              return (
                <TouchableOpacity
                  key={item.name}
                  onPress={() => handleNavigate(item.route)}
                  activeOpacity={0.7}
                  style={[
                    s.navItem,
                    { backgroundColor: isActive ? theme.colors.muted : 'transparent' },
                  ]}
                >
                  <View
                    style={[
                      s.navIcon,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: isActive ? theme.colors.border : theme.colors.borderFaint,
                      },
                    ]}
                  >
                    <Icon size={24} color={theme.colors.text} />
                  </View>
                  <View style={s.navText}>
                    <Text variant="body" weight="semibold">
                      {item.name}
                    </Text>
                    <Text variant="caption" color={theme.colors.textSub}>
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Logout */}
        <View style={[s.logoutSection, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={[s.logoutBtn, { backgroundColor: theme.colors.muted }]}
          >
            <LogOut size={18} color={theme.colors.danger} />
            <Text variant="body" weight="medium" color={theme.colors.danger}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  logo: {
    width: 100,
    height: 36,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  userMeta: {
    flex: 1,
    gap: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  navIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    flex: 1,
    gap: 2,
  },
  logoutSection: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
});
