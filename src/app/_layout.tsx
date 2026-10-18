import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import '../global.css';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        {/* La primera ruta alfabética del grupo (onboarding) no es la de
            bienvenida; initialRouteName garantiza que la app abra en el
            flujo de configuración correcto. */}
        <Stack initialRouteName="welcome" screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}

