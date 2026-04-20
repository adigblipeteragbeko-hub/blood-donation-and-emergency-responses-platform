import { Ionicons } from '@expo/vector-icons';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DonationHistoryScreen } from '../screens/DonationHistoryScreen';
import { DonorLoginScreen } from '../screens/DonorLoginScreen';
import { DonorRegisterScreen } from '../screens/DonorRegisterScreen';
import { EmergencyAlertsScreen } from '../screens/EmergencyAlertsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';

type PublicRoute = 'DonorLogin' | 'DonorRegister' | 'VerifyEmail';
type PrivateRoute = 'Dashboard' | 'EmergencyAlerts' | 'Appointments' | 'DonationHistory' | 'Profile';
const SIDEBAR_WIDTH = 250;

export function AppNavigator() {
  const { user, loading } = useAuth();
  const { width } = useWindowDimensions();
  const [publicRoute, setPublicRoute] = useState<PublicRoute>('DonorLogin');
  const [privateRoute, setPrivateRoute] = useState<PrivateRoute>('Dashboard');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const isDesktop = width >= 900;
  const mobileSidebarX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => {
    setPublicRoute('DonorLogin');
    setPrivateRoute('Dashboard');
    setMenuOpen(false);
  }, [user?.id]);

  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(mobileSidebarX, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(mobileSidebarX, {
      toValue: -SIDEBAR_WIDTH,
      duration: 170,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMenuOpen(false);
      }
    });
  };

  useEffect(() => {
    if (isDesktop) {
      setMenuOpen(false);
      mobileSidebarX.setValue(-SIDEBAR_WIDTH);
    }
  }, [isDesktop, mobileSidebarX]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#c8102e" />
      </View>
    );
  }

  if (!user) {
    if (publicRoute === 'DonorRegister') {
      return (
        <DonorRegisterScreen
          onBackToLogin={() => setPublicRoute('DonorLogin')}
          onRegistered={(email) => {
            setVerifyEmail(email);
            setPublicRoute('VerifyEmail');
          }}
        />
      );
    }

    if (publicRoute === 'VerifyEmail') {
      return (
        <VerifyEmailScreen
          email={verifyEmail}
          onBackToLogin={() => setPublicRoute('DonorLogin')}
        />
      );
    }

    return <DonorLoginScreen onGoRegister={() => setPublicRoute('DonorRegister')} />;
  }

  let authedScreen: ReactElement;
  switch (privateRoute) {
    case 'EmergencyAlerts':
      authedScreen = <EmergencyAlertsScreen />;
      break;
    case 'Appointments':
      authedScreen = <AppointmentsScreen />;
      break;
    case 'DonationHistory':
      authedScreen = <DonationHistoryScreen />;
      break;
    case 'Profile':
      authedScreen = <ProfileScreen />;
      break;
    case 'Dashboard':
    default:
      authedScreen = <DashboardScreen onNavigate={setPrivateRoute} />;
      break;
  }

  const items: Array<{ key: PrivateRoute; label: string }> = useMemo(
    () => [
      { key: 'Dashboard', label: 'Dashboard' },
      { key: 'EmergencyAlerts', label: 'Emergency Alerts' },
      { key: 'Appointments', label: 'Appointments' },
      { key: 'DonationHistory', label: 'Donation History' },
      { key: 'Profile', label: 'Profile' },
    ],
    [],
  );

  const edgePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => gestureState.x0 <= 24 && gestureState.dx > 12,
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx > 48 && !isDesktop && !menuOpen) {
            openMenu();
          }
        },
      }),
    [isDesktop, menuOpen],
  );

  const closePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => gestureState.dx < -12,
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx < -48) {
            closeMenu();
          }
        },
      }),
    [],
  );

  return (
    <View style={styles.root}>
      {!isDesktop && !menuOpen ? <View style={styles.edgeSwipeArea} {...edgePan.panHandlers} /> : null}
      {!isDesktop ? (
        <View style={styles.mobileBar}>
          <Pressable style={styles.menuButton} onPress={openMenu}>
            <Text style={styles.menuButtonText}>Menu</Text>
          </Pressable>
          <Text style={styles.mobileTitle}>Donor App</Text>
        </View>
      ) : null}

      <View style={styles.layout}>
        {isDesktop ? (
          <Sidebar items={items} active={privateRoute} onSelect={(route) => setPrivateRoute(route)} />
        ) : null}
        <View style={styles.content}>{authedScreen}</View>
      </View>

      {!isDesktop && menuOpen ? (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={closeMenu} />
          <Animated.View style={[styles.mobileSidebarWrap, { transform: [{ translateX: mobileSidebarX }] }]} {...closePan.panHandlers}>
            <Sidebar
              items={items}
              active={privateRoute}
              onSelect={(route) => {
                setPrivateRoute(route);
                closeMenu();
              }}
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

function Sidebar({
  items,
  active,
  onSelect,
}: {
  items: Array<{ key: PrivateRoute; label: string }>;
  active: PrivateRoute;
  onSelect: (route: PrivateRoute) => void;
}) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>Navigation</Text>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onSelect(item.key)}
          style={[styles.navItem, active === item.key && styles.navItemActive]}
        >
          <Ionicons
            name={iconFor(item.key)}
            size={18}
            color={active === item.key ? '#fff' : '#991b1b'}
            style={styles.navIcon}
          />
          <Text style={[styles.navText, active === item.key && styles.navTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function iconFor(route: PrivateRoute): keyof typeof Ionicons.glyphMap {
  switch (route) {
    case 'Dashboard':
      return 'grid-outline';
    case 'EmergencyAlerts':
      return 'warning-outline';
    case 'Appointments':
      return 'calendar-outline';
    case 'DonationHistory':
      return 'time-outline';
    case 'Profile':
      return 'person-outline';
    default:
      return 'ellipse-outline';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  layout: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
  mobileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  mobileTitle: { fontSize: 18, fontWeight: '700', color: '#991b1b' },
  menuButton: {
    backgroundColor: '#c8102e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuButtonText: { color: '#fff', fontWeight: '700' },
  sidebar: {
    width: 235,
    paddingTop: 16,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#fff',
    gap: 10,
  },
  sidebarTitle: { fontSize: 18, fontWeight: '700', color: '#991b1b', marginBottom: 4 },
  navItem: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navItemActive: { backgroundColor: '#c8102e', borderColor: '#c8102e' },
  navText: { color: '#991b1b', fontWeight: '600' },
  navTextActive: { color: '#fff' },
  navIcon: { width: 18, textAlign: 'center' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  mobileSidebarWrap: {
    marginTop: 56,
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: '#fff',
  },
  edgeSwipeArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 18,
    zIndex: 30,
  },
});
