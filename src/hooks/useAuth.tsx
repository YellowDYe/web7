import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { userManagementService } from '../services/userManagementService';
import { supabase } from '../config/supabase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  permissions: string[];
  passwordChangeRequired: boolean;
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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

  useEffect(() => {
    console.log('Setting up Supabase auth state listener...');

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);

      // Handle password recovery event
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery detected, user should be on /reset-password');
      }

      // Handle user updates (like password changes)
      if (event === 'USER_UPDATED') {
        console.log('User updated, refreshing auth state');
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
        console.log('Supabase user authenticated:', session.user.id);
        console.log('User email:', session.user.email);

        // Try to fetch user with retry logic for trigger-based creation
        // The database trigger (handle_new_auth_user) creates the app_users record automatically
        // after Supabase Auth creates the auth.users record. This may take a moment.
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
            // Wait before retry (trigger might still be processing)
            console.log(`User not found, waiting for trigger... (attempt ${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          retries++;
        }

        console.log('App user query result:', { appUser, retries });

        if (appUser) {
          console.log('User found in database:', appUser.email);
          console.log('User role:', appUser.user_roles?.role_name);

          const passwordRequired = appUser.password_change_required || false;
          setPasswordChangeRequired(passwordRequired);

          const user: User = {
            id: session.user.id,
            email: appUser.email,
            name: appUser.full_name,
            role: appUser.user_roles?.role_name as UserRole || 'ADMIN',
            createdAt: new Date(appUser.created_at),
            updatedAt: new Date(appUser.updated_at)
          };

          setUser(user);
          await loadUserPermissions(session.user.id);
        } else {
          console.log('User not found in app_users, checking for linking...');

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
            console.log('Found existing user by email, linking to Supabase auth...');

            const { error: updateError } = await supabase
              .from('app_users')
              .update({
                auth_user_id: session.user.id,
                migrated_to_supabase_at: new Date().toISOString(),
                temp_password_set: false,
                updated_at: new Date().toISOString()
              })
              .eq('id', unmappedUser.id);

            if (updateError) {
              console.error('Error linking user:', updateError);
            } else {
              console.log('User linked successfully');
              const user: User = {
                id: session.user.id,
                email: unmappedUser.email,
                name: unmappedUser.full_name,
                role: unmappedUser.user_roles?.role_name as UserRole || 'ADMIN',
                createdAt: new Date(unmappedUser.created_at),
                updatedAt: new Date(unmappedUser.updated_at)
              };

              setUser(user);
              await loadUserPermissions(session.user.id);
            }
          } else {
            console.log('User creation by trigger failed or is taking too long');
            console.warn('Please try logging out and logging in again, or contact support');

            // Show user-friendly error message
            alert(
              'Tu cuenta de autenticación se creó correctamente, pero hubo un problema al configurar tu perfil de usuario.\n\n' +
              'Por favor:\n' +
              '1. Cierra sesión\n' +
              '2. Vuelve a iniciar sesión\n' +
              '3. Si el problema persiste, contacta al administrador\n\n' +
              `Email: ${session.user.email}`
            );

            setUser(null);
            setPermissions([]);
          }
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
        setPermissions([]);
      }
    } else {
      console.log('No Supabase session, clearing state');
      setUser(null);
      setPermissions([]);
    }

    console.log('Setting loading to false');
    setLoading(false);
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
      setUser(null);
      setPermissions([]);
      setPasswordChangeRequired(false);
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setPermissions([]);
      setPasswordChangeRequired(false);
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
      permissions,
      passwordChangeRequired,
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
