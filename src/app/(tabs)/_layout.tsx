import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { LoadingView } from '@/components/loading-view';
import { useAuth } from '@/context/AuthContext';

/**
 * Layout del grupo principal. Solo se montan las pestañas cuando la sesión,
 * el perfil y el negocio están resueltos; antes de eso se redirige al flujo
 * de configuración (o se muestra el estado de carga).
 */
export default function TabsLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingView message="Preparando tu sesión…" />;
  }

  if (status !== 'ready') {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <AppTabs />;
}
