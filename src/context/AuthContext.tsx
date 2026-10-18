import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';

import type { Business } from '@/types/Business';
import type { UserProfile } from '@/types/User';

import { authenticateUser, observeAuthState } from '@/services/authService';
import { getUserProfile } from '@/services/userService';
import { getBusinessById } from '@/services/businessService';

/**
 * Estados que atraviesa la app al arrancar y durante el flujo de identidad.
 * Determinan a qué grupo de pantallas redirige el router.
 */
export type AuthStatus =
  | 'loading' // Resolviendo sesión y perfil.
  | 'unauthenticated' // Sin sesión válida (se reintenta automáticamente).
  | 'needs-name' // Autenticado, pero sin perfil completo.
  | 'needs-business' // Con perfil, pero sin negocio.
  | 'ready'; // Ya pertenece a un negocio.

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  business: Business | null;
  /** Error del último intento de conexión/reinicio de sesión. */
  authError: string | null;
  /** Reintenta crear la sesión anónima tras un error. */
  retryAuthentication: () => void;
  /** Notifica al contexto que el nombre se guardó. */
  onNameSaved: (profile: UserProfile) => void;
  /** Notifica al contexto que el usuario ya tiene negocio. */
  onBusinessAttached: (business: Business) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // "resolving" se pone en true mientras se carga el perfil/negocio tras cada
  // evento de autenticación, para no redirigir con datos incompletos.
  const [resolving, setResolving] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Observar el estado de autenticación. El primer evento restaura la sesión
  // anónima persistida en AsyncStorage (si existe) sin crear una nueva.
  useEffect(() => {
    let cancelled = false;

    const unsubscribe = observeAuthState((currentUser) => {
      if (cancelled) {
        return;
      }
      setUser(currentUser);

      if (!currentUser) {
        // Sin sesión: intentar iniciar anónimamente (reutiliza uid si el
        // SDK todavía está restaurándolo o crea uno nuevo si es necesario).
        authenticateUser().catch((error) => {
          if (cancelled) {
            return;
          }
          console.warn('[AuthContext] Error al iniciar sesión anónima:', error);
          setAuthError('No pudimos iniciar tu sesión. Revisa tu conexión.');
          setResolving(false);
        });
        return;
      }

      // Sesión activa: cargar perfil y negocio.
      setResolving(true);
      (async () => {
        try {
          const loadedProfile = await getUserProfile(currentUser.uid);
          if (cancelled) {
            return;
          }
          setProfile(loadedProfile);

          if (loadedProfile?.businessId) {
            const loadedBusiness = await getBusinessById(loadedProfile.businessId);
            if (cancelled) {
              return;
            }
            setBusiness(loadedBusiness);
          } else {
            setBusiness(null);
          }
        } catch (error) {
          if (cancelled) {
            return;
          }
          console.warn('[AuthContext] Error al cargar perfil/negocio:', error);
          setAuthError('No pudimos recuperar tu información. Revisa tu conexión.');
        } finally {
          if (!cancelled) {
            setResolving(false);
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [retryCount]);

  const retryAuthentication = useCallback(() => {
    setAuthError(null);
    setResolving(true);
    setRetryCount((count) => count + 1);
  }, []);

  const onNameSaved = useCallback((savedProfile: UserProfile) => {
    setProfile(savedProfile);
  }, []);

  const onBusinessAttached = useCallback((attachedBusiness: Business) => {
    setProfile((current) => (current ? { ...current, businessId: attachedBusiness.id } : current));
    setBusiness(attachedBusiness);
  }, []);

  const status: AuthStatus = useMemo(() => {
    if (authError) {
      // Con error solo se puede reintentar; no se redirige a pantallas principales.
      return 'unauthenticated';
    }
    if (!user || resolving) {
      return 'loading';
    }
    if (!profile) {
      return 'needs-name';
    }
    if (!profile.businessId || !business) {
      return 'needs-business';
    }
    return 'ready';
  }, [authError, user, resolving, profile, business]);

  const value = useMemo(
    () => ({
      status,
      user,
      profile,
      business,
      authError,
      retryAuthentication,
      onNameSaved,
      onBusinessAttached,
    }),
    [status, user, profile, business, authError, retryAuthentication, onNameSaved, onBusinessAttached],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
