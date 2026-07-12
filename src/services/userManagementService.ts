import { supabase } from '../config/supabase';
import { 
  AppUser, 
  UserRole, 
  Permission, 
  UserInvitation,
  CreateUserData, 
  UpdateUserData,
  CreateRoleData,
  UpdateRoleData,
  CreateInvitationData,
  AppUserWithDetails,
  UserRoleWithDetails,
  UserInvitationWithDetails
} from '../types/user';

export class UserManagementService {
  // Generate next user ID (USR1, USR2, USR3...)
  private async generateNextUserId(): Promise<string> {
    const { data, error } = await supabase
      .from('app_users')
      .select('user_id');

    if (error) {
      console.error('Error fetching last user ID:', error);
      return 'USR1';
    }

    if (!data || data.length === 0) {
      return 'USR1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.user_id.replace('USR', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `USR${maxNumber + 1}`;
  }

  // Generate next role ID (RL1, RL2, RL3...)
  private async generateNextRoleId(): Promise<string> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role_id')
      .not('role_id', 'in', '(ADMIN,AGENTE,DELIVERY)');

    if (error) {
      console.error('Error fetching last role ID:', error);
      return 'RL1';
    }

    if (!data || data.length === 0) {
      return 'RL1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.role_id.replace('RL', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `RL${maxNumber + 1}`;
  }

  // Generate next invitation ID (INV1, INV2, INV3...)
  private async generateNextInvitationId(): Promise<string> {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('invitation_id');

    if (error) {
      console.error('Error fetching last invitation ID:', error);
      return 'INV1';
    }

    if (!data || data.length === 0) {
      return 'INV1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.invitation_id.replace('INV', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `INV${maxNumber + 1}`;
  }

  // User Management
  async createUser(userData: CreateUserData): Promise<AppUser> {
    const user_id = await this.generateNextUserId();

    const { data, error } = await supabase
      .from('app_users')
      .insert([
        {
          user_id,
          auth_user_id: userData.firebase_uid || null,
          is_active: userData.is_active ?? true,
          email: userData.email,
          full_name: userData.full_name,
          role_id: userData.role_id
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }

    return data;
  }

  async getUsers(): Promise<AppUserWithDetails[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select(`
        *,
        user_roles!inner(role_name, role_description)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }

    return (data || []).map(item => ({
      ...item,
      role_name: item.user_roles?.role_name,
      role_description: item.user_roles?.role_description
    }));
  }

  async getUserById(id: string): Promise<AppUser | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching user: ${error.message}`);
    }

    return data;
  }

  async updateUser(id: string, updateData: UpdateUserData): Promise<AppUser> {
    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }

    return data;
  }

  async deleteUser(id: string): Promise<void> {
    try {
      // Step 1: Get user details
      const { data: userData, error: fetchError } = await supabase
        .from('app_users')
        .select('user_id, email, auth_user_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Error fetching user: ${fetchError.message}`);
      }

      if (!userData) {
        throw new Error('Usuario no encontrado');
      }

      console.log('Deleting user:', userData.user_id, userData.email);

      // Step 2: Check deletion dependencies
      const { data: dependencies, error: depError } = await supabase
        .rpc('check_user_deletion_dependencies', {
          p_user_id: userData.user_id
        });

      if (depError) {
        console.error('Error checking deletion dependencies:', depError);
        // Continue anyway - this is just for logging
      } else if (dependencies) {
        console.log('Deletion dependencies:', dependencies);
      }

      // Step 3: Delete from Supabase auth if auth_user_id exists
      if (userData.auth_user_id || userData.email) {
        console.log('Deleting from Supabase auth...');

        try {
          const { data: deleteAuthData, error: authError } = await supabase.functions.invoke(
            'delete-auth-user',
            {
              body: {
                email: userData.email,
                auth_user_id: userData.auth_user_id
              }
            }
          );

          if (authError) {
            console.error('Error calling delete-auth-user edge function:', authError);
            // Don't fail the entire operation if auth deletion fails
            // The user might not have an auth account
          } else if (deleteAuthData && !deleteAuthData.success) {
            console.warn('Auth user deletion returned non-success:', deleteAuthData);
            // Continue with app_users deletion anyway
          } else {
            console.log('Auth user deleted successfully');
          }
        } catch (authError) {
          console.error('Exception during auth user deletion:', authError);
          // Continue with app_users deletion even if auth deletion fails
        }
      } else {
        console.log('No auth_user_id or email, skipping auth deletion');
      }

      // Step 4: Delete from app_users table (cascades will handle related records)
      console.log('Deleting from app_users table...');
      const { error: deleteError } = await supabase
        .from('app_users')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(`Error al eliminar el usuario de la base de datos: ${deleteError.message}`);
      }

      console.log('User deleted successfully:', userData.user_id);
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error;
    }
  }

  // Role Management
  async createRole(roleData: CreateRoleData): Promise<UserRole> {
    const role_id = await this.generateNextRoleId();

    const { data, error } = await supabase
      .from('user_roles')
      .insert([
        {
          role_id,
          role_name: roleData.role_name,
          role_description: roleData.role_description,
          is_active: roleData.is_active ?? true,
          is_system_role: false
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating role: ${error.message}`);
    }

    // Assign permissions if provided
    if (roleData.permission_ids && roleData.permission_ids.length > 0) {
      await this.assignPermissionsToRole(role_id, roleData.permission_ids);
    }

    return data;
  }

  async getRoles(): Promise<UserRoleWithDetails[]> {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        *,
        role_permissions(
          permissions(*)
        )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching roles: ${error.message}`);
    }

    return (data || []).map(role => ({
      ...role,
      permissions: role.role_permissions?.map((rp: any) => rp.permissions) || []
    }));
  }

  async updateRole(id: string, updateData: UpdateRoleData): Promise<UserRole> {
    const { data, error } = await supabase
      .from('user_roles')
      .update({
        role_name: updateData.role_name,
        role_description: updateData.role_description,
        is_active: updateData.is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating role: ${error.message}`);
    }

    // Update permissions if provided
    if (updateData.permission_ids !== undefined) {
      const role = await this.getRoleById(id);
      if (role) {
        await this.assignPermissionsToRole(role.role_id, updateData.permission_ids);
      }
    }

    return data;
  }

  async deleteRole(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting role: ${error.message}`);
    }
  }

  async getRoleById(id: string): Promise<UserRole | null> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching role: ${error.message}`);
    }

    return data;
  }

  // Permission Management
  async getPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('permission_category', { ascending: true });

    if (error) {
      throw new Error(`Error fetching permissions: ${error.message}`);
    }

    return data || [];
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    // First, remove existing permissions
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) {
      throw new Error(`Error removing existing permissions: ${deleteError.message}`);
    }

    // Then, add new permissions
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId
      }));

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (insertError) {
        throw new Error(`Error assigning permissions: ${insertError.message}`);
      }
    }
  }

  // Invitation Management
  async getAppUserIdByAuthId(authUserId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('user_id')
      .eq('auth_user_id', authUserId)
      .limit(1);

    if (error) {
      throw new Error(`Error fetching app user ID: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0].user_id;
  }

  // Create app user from Supabase auth user if doesn't exist
  async ensureAppUserExists(authUser: { uid: string; email: string; displayName?: string }): Promise<string> {
    // First check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('app_users')
      .select('user_id')
      .eq('auth_user_id', authUser.uid)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Error checking existing user: ${checkError.message}`);
    }

    if (existingUser) {
      return existingUser.user_id;
    }

    // Create new app user with ADMIN role by default
    try {
      const newUser = await this.createUser({
        firebase_uid: authUser.uid,
        email: authUser.email,
        full_name: authUser.displayName || authUser.email.split('@')[0],
        role_id: 'ADMIN',
        is_active: true
      });

      return newUser.user_id;
    } catch (error) {
      console.error('Error creating new app user:', error);
      throw error;
    }
  }

  private generateTempPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  async createInvitation(invitationData: CreateInvitationData, invitedBy: string): Promise<any> {
    try {
      const email = invitationData.email.toLowerCase().trim();
      const fullName = invitationData.full_name || email.split('@')[0];
      const tempPassword = this.generateTempPassword();

      console.log('Creating invited user...');

      const { data: result, error: createError } = await supabase.rpc('create_invited_user', {
        p_email: email,
        p_full_name: fullName,
        p_role_id: invitationData.role_id,
        p_invited_by: invitedBy,
        p_temp_password: tempPassword
      });

      if (createError) {
        console.error('Error calling create_invited_user:', createError);
        throw new Error(`Error al crear el usuario: ${createError.message}`);
      }

      if (!result || !result.success) {
        throw new Error(result?.message || 'Error al crear el usuario');
      }

      console.log('App user created:', result.user_id);

      console.log('Calling edge function to create auth user...');
      const { data: authUserData, error: authError } = await supabase.functions.invoke('create-auth-user', {
        body: {
          email: email,
          password: tempPassword,
          full_name: fullName
        }
      });

      if (authError) {
        console.error('Error calling edge function:', authError);
        throw new Error(`Error al crear usuario de autenticación: ${authError.message}`);
      }

      if (!authUserData || !authUserData.success) {
        const errorMsg = authUserData?.error || 'Error desconocido al crear usuario de autenticación';
        console.error('Auth user creation failed:', errorMsg);
        throw new Error(`Error al crear usuario de autenticación: ${errorMsg}`);
      }

      console.log('Auth user created:', authUserData.auth_user_id);

      const { data: linkResult, error: linkError } = await supabase.rpc('link_auth_to_app_user', {
        p_email: email,
        p_auth_user_id: authUserData.auth_user_id
      });

      if (linkError || !linkResult?.success) {
        console.error('Error linking auth to app user:', linkError || linkResult);
      } else {
        console.log('Linked auth user to app user');
      }

      console.log('User created successfully. Temp password:', tempPassword);

      return {
        ...result,
        temp_password: tempPassword,
        auth_user_id: authUserData.auth_user_id
      };
    } catch (error) {
      console.error('Error in createInvitation:', error);
      throw error;
    }
  }

  async getInvitations(): Promise<UserInvitationWithDetails[]> {
    const { data, error } = await supabase
      .from('user_invitations')
      .select(`
        *,
        user_roles!inner(role_name),
        app_users!inner(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching invitations: ${error.message}`);
    }

    return (data || []).map(item => ({
      ...item,
      role_name: item.user_roles?.role_name,
      invited_by_name: item.app_users?.full_name
    }));
  }

  async checkPasswordChangeRequired(authUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_password_change_required', {
        p_user_id: authUserId
      });

      if (error) {
        console.error('Error checking password change required:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error in checkPasswordChangeRequired:', error);
      return false;
    }
  }

  async markPasswordChanged(authUserId: string): Promise<void> {
    try {
      // First get user's email from auth_user_id
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('email')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (userError || !userData) {
        console.error('Error fetching user for password change:', userError);
        throw new Error('Usuario no encontrado');
      }

      // Clear password change requirement using the new function
      const { data, error } = await supabase.rpc('clear_password_change_requirement', {
        p_email: userData.email
      });

      if (error) {
        console.error('Error marking password changed:', error);
        throw new Error(`Error al actualizar el estado de contraseña: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Error al actualizar el estado de contraseña');
      }

      console.log('Password change requirement cleared');
    } catch (error) {
      console.error('Error in markPasswordChanged:', error);
      throw error;
    }
  }

  async getPendingPasswordChanges(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('v_pending_password_changes')
        .select('*');

      if (error) {
        throw new Error(`Error fetching pending password changes: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPendingPasswordChanges:', error);
      throw error;
    }
  }


  async deleteInvitation(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_invitations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting invitation: ${error.message}`);
    }
  }


  // Check user permissions by auth user ID
  async getUserPermissionsByAuthId(authUserId: string): Promise<Permission[]> {
    try {
      // First get the user's role_id
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('role_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (userError || !userData) {
        console.error('Error fetching user role:', userError);
        return [];
      }

      // Then get permissions for that role
      const { data: rolePermissions, error: permError } = await supabase
        .from('role_permissions')
        .select(`
          permissions(*)
        `)
        .eq('role_id', userData.role_id);

      if (permError) {
        console.error('Error fetching role permissions:', permError);
        return [];
      }

      return rolePermissions?.map((rp: any) => rp.permissions).filter(Boolean) || [];
    } catch (error) {
      console.error('Error in getUserPermissionsByAuthId:', error);
      return [];
    }
  }

  // Backwards compatibility method - kept for gradual migration
  async getUserPermissions(userIdOrAuthId: string): Promise<Permission[]> {
    return this.getUserPermissionsByAuthId(userIdOrAuthId);
  }

  async resendCredentials(userId: string): Promise<{ success: boolean; tempPassword: string; email: string }> {
    try {
      // Get user details
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('email, full_name, role_id')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('Usuario no encontrado');
      }

      // Generate new temporary password
      const tempPassword = this.generateTempPassword();

      // Reset password using edge function (proper Supabase Admin API)
      const { data: resetData, error: resetError } = await supabase.functions.invoke(
        'reset-auth-user-password',
        {
          body: {
            email: userData.email,
            new_password: tempPassword
          }
        }
      );

      if (resetError) {
        console.error('Error calling reset-auth-user-password edge function:', resetError);
        throw new Error('Error al restablecer la contraseña en el sistema de autenticación');
      }

      if (!resetData || !resetData.success) {
        const errorMsg = resetData?.error || 'Error desconocido al restablecer contraseña';
        console.error('Password reset failed:', errorMsg);
        throw new Error(`Error al restablecer contraseña: ${errorMsg}`);
      }

      console.log('Password reset successfully via edge function');

      // Track password reset request in database
      const { error: trackError } = await supabase.rpc('track_password_reset_request', {
        p_email: userData.email
      });

      if (trackError) {
        console.error('Error tracking password reset:', trackError);
        // Don't fail the whole operation if tracking fails
      }

      return {
        success: true,
        tempPassword,
        email: userData.email
      };
    } catch (error) {
      console.error('Error in resendCredentials:', error);
      throw error;
    }
  }

  async hasPermission(authUserId: string, permissionName: string): Promise<boolean> {
    try {
      // First get the user's role_id
      const { data: userData, error: userError } = await supabase
        .from('app_users')
        .select('role_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (userError || !userData) {
        return false;
      }

      // Check if role has the permission
      const { data: rolePermission, error: permError } = await supabase
        .from('role_permissions')
        .select(`
          permissions!inner(permission_id)
        `)
        .eq('role_id', userData.role_id)
        .eq('permissions.permission_id', permissionName)
        .maybeSingle();

      if (permError) {
        return false;
      }

      return !!rolePermission;
    } catch (error) {
      console.error('Error in hasPermission:', error);
      return false;
    }
  }
}

export const userManagementService = new UserManagementService();