import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../../config/supabase';
import { User } from '@supabase/supabase-js';
import type { Customer } from '../../types/customer';
import { friendlyError } from '../utils/friendlyError';

interface CustomerAuthContextType {
  user: User | null;
  customer: Customer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (returnTo?: string) => Promise<void>;
  signup: (email: string, password: string, customerData: Partial<Customer>) => Promise<void>;
  signupGoogleUser: (customerData: Partial<Customer>) => Promise<void>;
  logout: () => Promise<void>;
  checkEmailExists: (email: string) => Promise<{ exists: boolean; hasAuth: boolean; hasCustomer: boolean; customer?: Customer }>;
  updateCustomerProfile: (data: Partial<Customer>) => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchCustomerData = async (authUserId: string, userEmail?: string) => {
    try {
      console.log('[CustomerAuth] Fetching customer data for auth_user_id:', authUserId);

      // First try to find customer by auth_user_id
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        console.error('[CustomerAuth] Error querying by auth_user_id:', error);
        throw error;
      }

      if (data) {
        console.log('[CustomerAuth] Customer found by auth_user_id:', data.id);
        setCustomer(data);
        return;
      }

      // If not found by auth_user_id, try to find by email as fallback
      if (userEmail) {
        console.log('[CustomerAuth] Customer not found by auth_user_id, trying email fallback:', userEmail);
        const { data: customerByEmail, error: emailError } = await supabase
          .from('customers')
          .select('*')
          .eq('customer_email', userEmail)
          .is('auth_user_id', null)
          .maybeSingle();

        if (emailError) {
          console.error('[CustomerAuth] Error querying by email:', emailError);
          throw emailError;
        }

        if (customerByEmail) {
          console.log('[CustomerAuth] Found customer by email, linking auth_user_id');
          // Link the auth_user_id to this customer
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              auth_user_id: authUserId,
              last_login: new Date().toISOString(),
              email_verified: true
            })
            .eq('id', customerByEmail.id);

          if (updateError) {
            console.error('[CustomerAuth] Error linking auth_user_id:', updateError);
            throw updateError;
          }

          // Fetch the updated customer data
          const { data: updatedCustomer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerByEmail.id)
            .single();

          console.log('[CustomerAuth] Customer linked successfully:', updatedCustomer?.id);
          setCustomer(updatedCustomer);
          return;
        }
      }

      // No customer found by either method
      console.log('[CustomerAuth] No customer found for auth_user_id:', authUserId);
      setCustomer(null);
    } catch (error) {
      console.error('[CustomerAuth] Error fetching customer data:', error);
      setCustomer(null);
    }
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const initAuth = async () => {
      try {
        console.log('[CustomerAuth] Initializing auth...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[CustomerAuth] Session:', session?.user?.id || 'none');

        setUser(session?.user ?? null);
        if (session?.user) {
          currentUserIdRef.current = session.user.id;
          await fetchCustomerData(session.user.id, session.user.email);
        }
      } catch (error) {
        console.error('[CustomerAuth] Error during auth initialization:', error);
      } finally {
        console.log('[CustomerAuth] Setting loading to false');
        setLoading(false);
      }
    };

    // Set a timeout to ensure loading doesn't hang forever
    timeoutId = setTimeout(() => {
      console.log('[CustomerAuth] Loading timeout reached, forcing loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // When the same user is already loaded, skip all events except sign-out
      if (currentUserIdRef.current && session?.user?.id === currentUserIdRef.current) {
        return;
      }

      (async () => {
        console.log('[CustomerAuth] Auth state changed, event:', _event);
        if (session?.user) {
          currentUserIdRef.current = session.user.id;
          setUser(session.user);
          await fetchCustomerData(session.user.id, session.user.email);
        } else {
          currentUserIdRef.current = null;
          setUser(null);
          setCustomer(null);
        }
      })();
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const checkEmailExists = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('check_customer_email_exists', { p_email: email });

      if (error) {
        console.error('[AUTH] RPC error:', error);
        throw new Error('No pudimos verificar el correo. Intenta de nuevo.');
      }

      if (data && data.length > 0) {
        const result = data[0];
        return {
          exists: result.email_exists || false,
          hasAuth: result.has_auth || false,
          hasCustomer: result.has_customer || false,
          customer: undefined,
        };
      }

      return { exists: false, hasAuth: false, hasCustomer: false };
    } catch (error: any) {
      console.error('[AUTH] Error checking email:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchCustomerData(data.user.id, data.user.email);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(friendlyError(error, 'Error al iniciar sesión'));
    }
  };

  const loginWithGoogle = async (returnTo?: string) => {
    try {
      const destination = returnTo || '/account';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${destination}`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Google login error:', error);
      throw new Error(friendlyError(error, 'Error al iniciar sesión con Google'));
    }
  };

  const buildFamilyMembers = (customerData: Partial<Customer>) => {
    const familyMembers: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const memberName = (customerData as any)[`family_member_${i}_name`];
      if (memberName) {
        familyMembers.push({
          family_member_name: memberName,
          family_member_restrictions: (customerData as any)[`family_member_${i}_restrictions`] || []
        });
      }
    }
    return familyMembers;
  };

  const callCreateCustomerAccount = async (authUserId: string, email: string, customerData: Partial<Customer>, existingCustomerId: string | null) => {
    const familyMembers = buildFamilyMembers(customerData);

    const { data: accountResult, error: createError } = await supabase.rpc('create_customer_account', {
      p_auth_user_id: authUserId,
      p_email: email,
      p_nombre: (customerData as any).first_name || '',
      p_apellidos: (customerData as any).last_name || '',
      p_telefono: (customerData as any).phone || '',
      p_rfc: (customerData as any).rfc || '',
      p_razon_social: (customerData as any).invoice_name || '',
      p_regimen_fiscal: (customerData as any).tax_regime || '',
      p_uso_cfdi: 'G03',
      p_codigo_postal: (customerData as any).postal_code || '',
      p_estado: '',
      p_ciudad: (customerData as any).delegacion || '',
      p_colonia: (customerData as any).colonia || '',
      p_calle: (customerData as any).street_address || '',
      p_numero_exterior: (customerData as any).address_number || '',
      p_numero_interior: (customerData as any).interior_number || '',
      p_referencias: (customerData as any).delivery_instructions || '',
      p_customer_notes: '',
      p_existing_customer_id: existingCustomerId,
      p_customer_restrictions: (customerData as any).restrictions || [],
      p_family_members: familyMembers
    });

    if (createError) {
      console.error('Error creating customer account:', createError);
      throw new Error(`Error al crear cuenta: ${createError.message}`);
    }

    return accountResult;
  };

  const ensureAuthenticatedSession = async (email: string, password: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user.id;

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;
    if (!signInData.user) throw new Error('Error al iniciar sesión');
    return signInData.user.id;
  };

  const signup = async (email: string, password: string, customerData: Partial<Customer>) => {
    try {
      const emailCheck = await checkEmailExists(email);
      const existingCustomerId = emailCheck.customer?.id || null;

      if (emailCheck.hasAuth && emailCheck.hasCustomer) {
        throw new Error('Esta dirección de correo ya tiene una cuenta. Por favor inicia sesión.');
      }

      let authUserId: string;

      if (emailCheck.hasAuth && !emailCheck.hasCustomer) {
        authUserId = await ensureAuthenticatedSession(email, password);
      } else {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/account`,
            data: { user_type: 'customer' },
          },
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('Error al crear usuario');

        authUserId = await ensureAuthenticatedSession(email, password);
      }

      const accountResult = await callCreateCustomerAccount(authUserId, email, customerData, existingCustomerId);
      console.log('Customer account created:', accountResult);

      await fetchCustomerData(authUserId, email);
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(friendlyError(error, 'Error al crear la cuenta'));
    }
  };

  const signupGoogleUser = async (customerData: Partial<Customer>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No hay sesión activa. Por favor intenta de nuevo.');

      const authUserId = session.user.id;
      const email = session.user.email || '';

      const emailCheck = await checkEmailExists(email);
      if (emailCheck.hasCustomer) {
        throw new Error('Esta cuenta de Google ya tiene un perfil. Por favor inicia sesión.');
      }

      const existingCustomerId = emailCheck.customer?.id || null;
      await callCreateCustomerAccount(authUserId, email, customerData, existingCustomerId);
      await fetchCustomerData(authUserId, email);
    } catch (error: any) {
      console.error('Google signup error:', error);
      throw new Error(friendlyError(error, 'Error al crear la cuenta'));
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      currentUserIdRef.current = null;
      setUser(null);
      setCustomer(null);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(friendlyError(error, 'Error al cerrar sesión'));
    }
  };

  const updateCustomerProfile = async (data: Partial<Customer>) => {
    try {
      if (!customer) throw new Error('No hay cliente conectado');

      const { error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', customer.id);

      if (error) throw error;

      setCustomer({ ...customer, ...data });
    } catch (error: any) {
      console.error('Update profile error:', error);
      throw new Error(friendlyError(error, 'Error al actualizar perfil'));
    }
  };

  const value = {
    user,
    customer,
    loading,
    login,
    loginWithGoogle,
    signup,
    signupGoogleUser,
    logout,
    checkEmailExists,
    updateCustomerProfile,
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
