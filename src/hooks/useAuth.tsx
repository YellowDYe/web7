import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { userManagementService } from '../services/userManagementService';
import { supabase } from '../config/supabase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  permissionsLoading: boolean;
  permissions: string[];
  passwordChangeRequired: boolean;
  noAdminAccess: boolean;
  noAdminAccessEmail: string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  checkPasswordChangeRequired: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [noAdminAccess, setNoAdminAccess] = useState(false);
  const [noAdminAccessEmail, setNoAdminAccessEmail] = useState<string | null>(null);

  const currentAuthUserId = useRef<string | null>(null);

  useEffect(() => {
    console.log('Setting up Supabase auth state listener...');

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);

      // Skip events that don't require a full re-verification when user is already loaded
      if (currentAuthUserId.current && session?.user?.id === currentAuthUserId.current) {
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          return;
        }
      }

      // Handle password recovery event
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery detected, user should be on /reset-password');
      }

      handleAuthChange(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthChange = async (session: Session | null) => {
    if (session?.user) {
      try {
        const userType = session.user.user_metadata?.user_type;

        // Customer accounts don't have admin access -- skip retries entirely
        if (userType === 'customer') {
          setNoAdminAccess(true);
          setNoAdminAccessEmail(session.user.email || null);
          setUser(null);
          setPermissions([]);
          setLoading(false);
          return;
        }

        // Try to fetch admin user with retry logic for trigger-based creation
        let appUser = null;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries && !appUser) {
          const { data, error } = await supabase
            .from('app_users')
            .select(`
              *,
              user_roles!inner(role_name)
            `)
            .eq('auth_user_id', session.user.id)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching app user:', error);
            if (retries === maxRetries - 1) {
              setUser(null);
              setPermissions([]);
              setLoading(false);
              return;
            }
          }

          if (data) {
            appUser = data;
          } else if (retries < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          retries++;
        }

        if (appUser) {
          const passwordRequired = appUser.password_change_required || false;
          setPasswordChangeRequired(passwordRequired);
          setPermissionsLoading(true);

          const user: User = {
            id: session.user.id,
            email: appUser.email,
            name: appUser.full_name,
            role: appUser.user_roles?.role_name as UserRole || 'ADMIN',
            createdAt: new Date(appUser.created_at),
            updatedAt: new Date(appUser.updated_at)
          };

          setUser(user);
          currentAuthUserId.current = session.user.id;
          setLoading(false);
          await loadUserPermissions(session.user.id);
          setPermissionsLoading(false);
        } else {
          // Check for orphaned app_user that can be linked
          const { data: unmappedUser } = await supabase
            .from('app_users')
            .select(`
              *,
              user_roles!inner(role_name)
            `)
            .eq('email', session.user.email)
            .is('auth_user_id', null)
            .maybeSingle();

          if (unmappedUser) {
            const { error: updateError } = await supabase
              .from('app_users')
              .update({
                auth_user_id: session.user.id,
                migrated_to_supabase_at: new Date().toISOString(),
                temp_password_set: false,
                updated_at: new Date().toISOString()
              })
              .eq('id', unmappedUser.id);

            if (!updateError) {
              setPermissionsLoading(true);
              const user: User = {
                id: session.user.id,
                email: unmappedUser.email,
                name: unmappedUser.full_name,
                role: unmappedUser.user_roles?.role_name as UserRole || 'ADMIN',
                createdAt: new Date(unmappedUser.created_at),
                updatedAt: new Date(unmappedUser.updated_at)
              };

              setUser(user);
              currentAuthUserId.current = session.user.id;
              setLoading(false);
              await loadUserPermissions(session.user.id);
              setPermissionsLoading(false);
            } else {
              console.error('Error linking user:', updateError);
              setNoAdminAccess(true);
              setNoAdminAccessEmail(session.user.email || null);
              setUser(null);
              setPermissions([]);
              setLoading(false);
            }
          } else {
            // No admin profile exists for this user
            setNoAdminAccess(true);
            setNoAdminAccessEmail(session.user.email || null);
            setUser(null);
            setPermissions([]);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
        setPermissions([]);
        setLoading(false);
      }
    } else {
      currentAuthUserId.current = null;
      setUser(null);
      setPermissions([]);
      setNoAdminAccess(false);
      setNoAdminAccessEmail(null);
      setLoading(false);
    }
  };

  const loadUserPermissions = async (authUserId: string) => {
    try {
      console.log('Fetching permissions for user:', authUserId);
      const userPermissions = await userManagementService.getUserPermissionsByAuthId(authUserId);
      const permissionNames = userPermissions.map(p => p.permission_id);
      console.log('Permissions loaded:', permissionNames);
      setPermissions(permissionNames);
      console.log('Permissions state updated. Auth loading complete.');
    } catch (error) {
      console.error('Error loading user permissions:', error);
      setPermissions([]);
    }
  };

  const refreshPermissions = async () => {
    if (user?.id) {
      await loadUserPermissions(user.id);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    if (!user) return false;
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    if (!user) return false;
    return requiredPermissions.every(permission => permissions.includes(permission));
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      console.log('Login successful for user:', data.user?.id);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      console.log('Attempting Google login...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;
      console.log('Google OAuth initiated');
    } catch (error: any) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      console.log('Attempting registration for email:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (error) throw error;
      console.log('Supabase user created successfully:', data.user?.id);
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      currentAuthUserId.current = null;
      setUser(null);
      setPermissions([]);
      setPasswordChangeRequired(false);
      setNoAdminAccess(false);
      setNoAdminAccessEmail(null);
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setPermissions([]);
      setPasswordChangeRequired(false);
      setNoAdminAccess(false);
      setNoAdminAccessEmail(null);
      throw error;
    }
  };

  const checkPasswordChangeRequired = async () => {
    if (user?.id) {
      try {
        const required = await userManagementService.checkPasswordChangeRequired(user.id);
        console.log('Password change required check:', required);
        setPasswordChangeRequired(required);
        return required;
      } catch (error) {
        console.error('Error checking password change required:', error);
        return false;
      }
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      permissionsLoading,
      permissions,
      passwordChangeRequired,
      noAdminAccess,
      noAdminAccessEmail,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshPermissions,
      checkPasswordChangeRequired
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
