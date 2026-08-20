import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../../config/supabase';
import { User } from '@supabase/supabase-js';
import type { Customer } from '../../types/customer';

interface CustomerAuthContextType {
  user: User | null;
  customer: Customer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, password: string, customerData: Partial<Customer>) => Promise<void>;
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
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/account`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Google login error:', error);
      throw new Error(error.message || 'Error al iniciar sesión con Google');
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

  const signup = async (email: string, password: string, customerData: Partial<Customer>) => {
    let newAuthUserId: string | null = null;

    try {
      // Step 1: Check if email exists
      console.log('Step 1: Checking if email exists:', email);
      const emailCheck = await checkEmailExists(email);
      const existingCustomerId = emailCheck.customer?.id || null;

      console.log('Email check result:', {
        exists: emailCheck.exists,
        hasAuth: emailCheck.hasAuth,
        hasCustomer: emailCheck.hasCustomer,
        existingCustomerId
      });

      // If auth exists AND customer exists, signup is fully completed already
      if (emailCheck.hasAuth && emailCheck.hasCustomer) {
        throw new Error('Esta dirección de correo ya tiene una cuenta. Por favor inicia sesión.');
      }

      // If auth exists but NO customer row, this is a partially failed signup -- retry
      if (emailCheck.hasAuth && !emailCheck.hasCustomer) {
        console.log('Step 2 (retry): Auth user exists without customer row, signing in to complete signup');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw new Error('Tu cuenta fue creada parcialmente. Verifica tu contraseña e intenta de nuevo.');
        }

        if (!signInData.user) throw new Error('Error al iniciar sesión');

        console.log('Signed in to complete signup:', signInData.user.id);

        // Now create the customer record
        const accountResult = await callCreateCustomerAccount(signInData.user.id, email, customerData, existingCustomerId);
        console.log('Customer account created (retry):', accountResult);

        await fetchCustomerData(signInData.user.id, email);
        console.log('Signup recovery completed successfully');
        return;
      }

      // Normal flow: create auth user first
      console.log('Step 2: Creating auth user');
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/account`,
          data: {
            user_type: 'customer',
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Error al crear usuario');

      newAuthUserId = authData.user.id;
      console.log('Auth user created:', newAuthUserId);

      // Create customer account
      console.log('Step 3: Creating customer account');
      const accountResult = await callCreateCustomerAccount(authData.user.id, email, customerData, existingCustomerId);
      console.log('Customer account created:', accountResult);

      // Fetch the customer data to update state
      await fetchCustomerData(authData.user.id, email);
      console.log('Signup completed successfully');
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Error al crear la cuenta');
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
      throw new Error(error.message || 'Error al cerrar sesión');
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
      throw new Error(error.message || 'Error al actualizar perfil');
    }
  };

  const value = {
    user,
    customer,
    loading,
    login,
    loginWithGoogle,
    signup,
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
