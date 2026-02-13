import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  Home, ClipboardList, PlusCircle, MessageSquare, Wallet,
  Settings, Bell, Languages, Banknote,
  FileText, CircleHelp, Users,
  ScrollText, Shield, X, LogOut
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text, Avatar } from '@/components/ui';
import { MOCK_CURRENT_USER } from '@/data/mock'
import { useAuthStore } from '@/stores/auth.store';

const Logo = require('@/assets/images/logo.png');

// Mobile-friendly sidebar config
interface MobileNavItem {
  name: string;
  route: string;
  icon: LucideIcon;
  description?: string;
}

interface MobileNavSection {
  title: string;
  items: MobileNavItem[];
}

function getMobileNavConfig(): MobileNavSection[] {
  return [
    {
      title: 'Main',
      items: [
        { name: 'Home', route: '/(tabs)/home', icon: Home, description: 'Browse gigs' },
        { name: 'My Gigs', route: '/(tabs)/my-gigs', icon: ClipboardList, description: 'Posted & Accepted' },
        { name: 'Post Gig', route: '/(tabs)/post', icon: PlusCircle, description: 'Create new' },
        { name: 'Messages', route: '/(tabs)/messages', icon: MessageSquare, description: 'Chat (future)' },
        { name: 'Wallet', route: '/(tabs)/wallet', icon: Wallet, description: 'Balance & Withdrawals' },
      ],
    },
    {
      title: 'Settings & Support',
      items: [
        { name: 'Settings', route: '/(tabs)/settings', icon: Settings },
        { name: 'Notifications', route: '/(tabs)/notifications', icon: Bell },
        { name: 'Language', route: '/(tabs)/language', icon: Languages },
        { name: 'Currency (₦/USD)', route: '/(tabs)/currency', icon: Banknote },
        { name: 'How It Works', route: '/(tabs)/how-it-works', icon: FileText, description: 'Tutorial' },
        { name: 'Help & Support', route: '/(tabs)/help', icon: CircleHelp, description: 'FAQs' },
        { name: 'Invite Friends', route: '/(tabs)/invite', icon: Users, description: 'Referral' },
      ],
    },
    {
      title: 'Legal',
      items: [
        { name: 'Terms of Service', route: '/(tabs)/terms', icon: ScrollText },
        { name: 'Privacy Policy', route: '/(tabs)/privacy', icon: Shield },
      ],
    },
  ]
}

interface DrawerContentProps {
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

export function DrawerContent({ onClose, onNavigate }: DrawerContentProps) {
  const { logout } = useAuthStore();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const user = MOCK_CURRENT_USER;
  const navigation = getMobileNavConfig();    

  const handleNavigate = (route: string) => {
    onClose();
    if (onNavigate) {
      onNavigate(route);
    } else {
      router.push(route as any);
    }
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/(auth)/connect-wallet');
  };

  const handleProfilePress = () => {
    onClose();
    router.push('/(tabs)/profile');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Image
          source={Logo}
          style={{
            width: 100,
            height: 36,
          }}
          contentFit="contain"
        />
        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.muted,
          }}
          activeOpacity={0.7}
        >
          <X size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* User Info */}
      <TouchableOpacity
        onPress={handleProfilePress}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: theme.spacing.md,
          backgroundColor: theme.colors.muted,
          marginHorizontal: theme.spacing.md,
          marginTop: theme.spacing.md,
          borderRadius: theme.radius.lg,
          gap: theme.spacing.md,
        }}
      >
        <Avatar src={''} name={user?.first_name || ''} size="lg" />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: theme.typography.sizes.base,
              fontFamily: theme.typography.fonts.display.semibold,
              color: theme.colors.text,
            }}
          >
            {user?.first_name} {user?.last_name}
          </Text>
          <Text
            style={{
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.textSub,
              textTransform: 'capitalize',
            }}
          >
            {'Member'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Navigation */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {navigation.map((section) => (
          <View key={section.title} style={{ marginBottom: theme.spacing.md }}>
            <Text
              style={{
                fontSize: theme.typography.sizes.sm,
                fontWeight: '700',
                color: theme.colors.textFaint,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                paddingHorizontal: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              }}
            >
              {section.title}
            </Text>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.route;
              return (
                <TouchableOpacity
                  key={item.name}
                  onPress={() => handleNavigate(item.route)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.md,
                    paddingHorizontal: theme.spacing.md,
                    gap: theme.spacing.md,
                    borderRadius: theme.radius.lg,
                    marginHorizontal: theme.spacing.sm,
                    backgroundColor: isActive ? theme.colors.muted : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: theme.radius.lg,
                      backgroundColor: theme.colors.background,
                      borderWidth: 1,
                      borderColor: isActive ? theme.colors.border : theme.colors.borderFaint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={24} color={theme.colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: theme.typography.sizes.base,
                        fontWeight: '600',
                        color: theme.colors.text,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: theme.typography.sizes.sm,
                        color: theme.colors.textSub,
                        marginTop: 2,
                      }}
                    >
                      {item.description ?? section.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Logout */}
        <View
          style={{
            padding: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: theme.spacing.md,
              backgroundColor: theme.colors.muted,
              borderRadius: theme.radius.lg,
              gap: theme.spacing.sm,
            }}
          >
            <LogOut size={18} color={theme.colors.danger} />
            <Text
              style={{
                fontSize: theme.typography.sizes.base,
                fontFamily: theme.typography.fonts.body.medium,
                color: theme.colors.danger,
              }}
            >
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
