import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  startOAuthLogin as startOAuthLoginApi,
  validateSession,
  type AuthUser,
  type LoginPayload,
  type OAuthProvider,
  type RegisterPayload,
} from "../apis/authApi";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  startOAuthLogin: (provider: OAuthProvider) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await validateSession();
      const nextUser = response.data.valid && response.data.user ? response.data.user : null;
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      try {
        const sessionUser = await refreshUser();
        if (!mounted) {
          return;
        }
        setUser(sessionUser);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginApi(payload);
    const nextUser = response.data?.user as AuthUser;
    setUser(nextUser ?? null);
    return nextUser;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await registerApi(payload);
    const nextUser = response.data?.user as AuthUser;
    setUser(nextUser ?? null);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  const startOAuthLogin = useCallback((provider: OAuthProvider) => {
    startOAuthLoginApi(provider);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      refreshUser,
      startOAuthLogin,
    }),
    [user, isLoading, login, register, logout, refreshUser, startOAuthLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
