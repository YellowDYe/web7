// Family member slot positions (1-5)
export type FamilyMemberSlot = 1 | 2 | 3 | 4 | 5;

export interface FamilyMember {
  id: string; // Composite ID: "customerId-slotNumber"
  slot: FamilyMemberSlot; // Which slot (1-5) this family member occupies
  customer_id: string;
  family_member_name: string;
  family_member_restrictions: string[]; // Array of ingredient IDs
  family_member_special_instructions: string | null;
}

export interface CreateFamilyMemberData {
  customer_id: string;
  family_member_name: string;
  family_member_restrictions?: string[];
  family_member_special_instructions?: string | null;
}

export interface UpdateFamilyMemberData {
  family_member_name?: string;
  family_member_restrictions?: string[];
  family_member_special_instructions?: string | null;
}

export interface FamilyMemberWithRestrictionNames extends FamilyMember {
  restriction_names?: string[];
}
