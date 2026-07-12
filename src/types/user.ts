export interface AppUser {
  id: string;
  user_id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role_id: string;
  is_active: boolean;
  last_login: string | null;
  invitation_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  role_id: string;
  role_name: string;
  role_description: string;
  is_system_role: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  permission_id: string;
  permission_name: string;
  permission_description: string;
  permission_category: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserInvitation {
  id: string;
  invitation_id: string;
  email: string;
  role_id: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_auth_id: string | null;
  created_user_id: string | null;
  temp_password: string | null;
  created_at: string;
}

export interface CreateUserData {
  email: string;
  full_name: string;
  role_id: string;
  is_active?: boolean;
}

export interface UpdateUserData {
  email?: string;
  full_name?: string;
  role_id?: string;
  is_active?: boolean;
}

export interface CreateRoleData {
  role_name: string;
  role_description: string;
  is_active?: boolean;
  permission_ids?: string[];
}

export interface UpdateRoleData {
  role_name?: string;
  role_description?: string;
  is_active?: boolean;
  permission_ids?: string[];
}

export interface CreateInvitationData {
  email: string;
  role_id: string;
  full_name?: string;
}

// Extended interfaces for display
export interface AppUserWithDetails extends AppUser {
  role_name?: string;
  role_description?: string;
  permissions?: Permission[];
}

export interface UserRoleWithDetails extends UserRole {
  permissions?: Permission[];
  user_count?: number;
}

export interface UserInvitationWithDetails extends UserInvitation {
  role_name?: string;
  invited_by_name?: string;
}