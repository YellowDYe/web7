import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
  checkEmailExists: (email: string) => Promise<{ exists: boolean; hasAuth: boolean; customer?: Customer }>;
  updateCustomerProfile: (data: Partial<Customer>) => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Skip events that don't require re-fetching when user is already loaded
      if (user && session?.user?.id === user.id) {
        if (_event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
          return;
        }
      }

      (async () => {
        console.log('[CustomerAuth] Auth state changed, event:', _event);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchCustomerData(session.user.id, session.user.email);
        } else {
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
    console.log('[AUTH] checkEmailExists called with:', email);
    try {
      const { data, error } = await supabase.rpc('check_customer_email_exists', { p_email: email });

      console.log('[AUTH] RPC response - data:', data, 'error:', error);

      if (error) {
        console.error('[AUTH] RPC error:', error);
        throw new Error(`Error al verificar correo: ${error.message}`);
      }

      if (data && data.length > 0) {
        const result = data[0];
        console.log('[AUTH] Processing result:', result);
        return {
          exists: result.email_exists || false,
          hasAuth: result.has_auth || false,
          customer: result.customer_data ? {
            id: result.customer_data.id,
            customer_id: result.customer_data.customer_id,
            first_name: result.customer_data.customer_name,
            last_name: result.customer_data.customer_lastname,
            email: email,
            phone: result.customer_data.customer_phone,
            street_address: result.customer_data.customer_street,
            address_number: result.customer_data.customer_street_number,
            interior_number: result.customer_data.customer_interior_number,
            colonia: result.customer_data.customer_colonia,
            delegacion: result.customer_data.customer_delegacion,
            postal_code: result.customer_data.customer_postal_code,
            delivery_instructions: result.customer_data.customer_delivery_instructions,
            restrictions: result.customer_data.customer_restrictions || [],
            rfc: result.customer_data.rfc,
            invoice_name: result.customer_data.billing_name,
            tax_regime: result.customer_data.tax_regime,
            invoice_address: result.customer_data.billing_street,
          } as any : undefined
        };
      }

      console.log('[AUTH] No data returned, email does not exist');
      return { exists: false, hasAuth: false };
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

  const signup = async (email: string, password: string, customerData: Partial<Customer>) => {
    try {
      // Step 1: Check if email exists FIRST to get existing customer_id
      console.log('Step 1: Checking if email exists:', email);
      const emailCheck = await checkEmailExists(email);
      const existingCustomerId = emailCheck.customer?.id || null;

      if (emailCheck.hasAuth) {
        throw new Error('Esta dirección de correo ya tiene una cuenta. Por favor inicia sesión.');
      }

      console.log('Email check result:', {
        exists: emailCheck.exists,
        hasAuth: emailCheck.hasAuth,
        existingCustomerId
      });

      // Step 2: Create auth user
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

      console.log('Auth user created:', authData.user.id);

      // Step 3: Format family members for database
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
      console.log('Step 3: Creating customer account with family members:', familyMembers);

      // Step 4: Create customer account directly (no pending storage)
      const { data: accountResult, error: createError } = await supabase.rpc('create_customer_account', {
        p_auth_user_id: authData.user.id,
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

      console.log('Customer account created:', accountResult);

      // Step 5: Fetch the customer data to update state
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
