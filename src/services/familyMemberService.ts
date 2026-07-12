import { supabase } from '../config/supabase';
import { FamilyMember, CreateFamilyMemberData, UpdateFamilyMemberData, FamilyMemberSlot } from '../types/familyMember';
import { Customer } from '../types/customer';

export class FamilyMemberService {
  // Helper to get family member field names for a slot
  private getFamilyMemberFields(slot: FamilyMemberSlot): { name: string; restrictions: string; specialInstructions: string } {
    return {
      name: `family_member_${slot}_name`,
      restrictions: `family_member_${slot}_restrictions`,
      specialInstructions: `family_member_${slot}_special_instructions`
    };
  }

  // Helper to convert customer data to FamilyMember array
  private customerToFamilyMembers(customer: Customer): FamilyMember[] {
    const members: FamilyMember[] = [];

    for (let slot = 1; slot <= 5; slot++) {
      const slotNum = slot as FamilyMemberSlot;
      const fields = this.getFamilyMemberFields(slotNum);
      const name = (customer as any)[fields.name];

      if (name) {
        members.push({
          id: `${customer.id}-${slot}`,
          slot: slotNum,
          customer_id: customer.id,
          family_member_name: name,
          family_member_restrictions: (customer as any)[fields.restrictions] || [],
          family_member_special_instructions: (customer as any)[fields.specialInstructions] || null
        });
      }
    }

    return members;
  }

  // Find first available slot in customer record
  private async findFirstAvailableSlot(customerId: string): Promise<FamilyMemberSlot | null> {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      if (!customer) throw new Error('Customer not found');

      for (let slot = 1; slot <= 5; slot++) {
        const slotNum = slot as FamilyMemberSlot;
        const fields = this.getFamilyMemberFields(slotNum);
        if (!(customer as any)[fields.name]) {
          return slotNum;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding available slot:', error);
      throw error;
    }
  }

  // Validate that customer hasn't reached the 5 family member limit
  async validateFamilyMemberLimit(customerId: string): Promise<boolean> {
    try {
      const slot = await this.findFirstAvailableSlot(customerId);
      return slot !== null;
    } catch (error) {
      console.error('Error validating family member limit:', error);
      throw error;
    }
  }

  // Create a new family member
  async createFamilyMember(familyMemberData: CreateFamilyMemberData): Promise<FamilyMember> {
    try {
      // Find first available slot
      const slot = await this.findFirstAvailableSlot(familyMemberData.customer_id);
      if (!slot) {
        throw new Error('Customer already has maximum of 5 family members');
      }

      const fields = this.getFamilyMemberFields(slot);
      const updateData: any = {
        [fields.name]: familyMemberData.family_member_name,
        [fields.restrictions]: familyMemberData.family_member_restrictions || [],
        [fields.specialInstructions]: familyMemberData.family_member_special_instructions || null
      };

      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', familyMemberData.customer_id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: `${familyMemberData.customer_id}-${slot}`,
        slot: slot,
        customer_id: familyMemberData.customer_id,
        family_member_name: familyMemberData.family_member_name,
        family_member_restrictions: familyMemberData.family_member_restrictions || [],
        family_member_special_instructions: familyMemberData.family_member_special_instructions || null
      };
    } catch (error) {
      console.error('Error creating family member:', error);
      throw error;
    }
  }

  // Get all family members for a customer
  async getFamilyMembersByCustomerId(customerId: string): Promise<FamilyMember[]> {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      if (!customer) return [];

      return this.customerToFamilyMembers(customer as Customer);
    } catch (error) {
      console.error('Error fetching family members:', error);
      throw error;
    }
  }

  // Get family member by ID (composite ID format: "customerId-slotNumber")
  async getFamilyMemberById(familyMemberId: string): Promise<FamilyMember | null> {
    try {
      const lastHyphenIndex = familyMemberId.lastIndexOf('-');
      if (lastHyphenIndex === -1) {
        return null;
      }

      const customerId = familyMemberId.substring(0, lastHyphenIndex);
      const slotStr = familyMemberId.substring(lastHyphenIndex + 1);
      const slot = parseInt(slotStr) as FamilyMemberSlot;

      if (!customerId || isNaN(slot) || slot < 1 || slot > 5) {
        return null;
      }

      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!customer) return null;

      const fields = this.getFamilyMemberFields(slot);
      const name = (customer as any)[fields.name];

      if (!name) return null;

      return {
        id: familyMemberId,
        slot: slot,
        customer_id: customerId,
        family_member_name: name,
        family_member_restrictions: (customer as any)[fields.restrictions] || []
      };
    } catch (error) {
      console.error('Error fetching family member:', error);
      throw error;
    }
  }

  // Update family member
  async updateFamilyMember(
    familyMemberId: string,
    familyMemberData: UpdateFamilyMemberData
  ): Promise<FamilyMember> {
    try {
      const lastHyphenIndex = familyMemberId.lastIndexOf('-');
      if (lastHyphenIndex === -1) {
        throw new Error('Invalid family member ID format');
      }

      const customerId = familyMemberId.substring(0, lastHyphenIndex);
      const slotStr = familyMemberId.substring(lastHyphenIndex + 1);
      const slot = parseInt(slotStr) as FamilyMemberSlot;

      if (!customerId || isNaN(slot) || slot < 1 || slot > 5) {
        throw new Error('Invalid family member ID');
      }

      const fields = this.getFamilyMemberFields(slot);
      const updateData: any = {};

      if (familyMemberData.family_member_name !== undefined) {
        updateData[fields.name] = familyMemberData.family_member_name;
      }

      if (familyMemberData.family_member_restrictions !== undefined) {
        updateData[fields.restrictions] = familyMemberData.family_member_restrictions;
      }

      if (familyMemberData.family_member_special_instructions !== undefined) {
        updateData[fields.specialInstructions] = familyMemberData.family_member_special_instructions;
      }

      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw error;

      return {
        id: familyMemberId,
        slot: slot,
        customer_id: customerId,
        family_member_name: familyMemberData.family_member_name || (data as any)[fields.name],
        family_member_restrictions: familyMemberData.family_member_restrictions || (data as any)[fields.restrictions] || [],
        family_member_special_instructions: familyMemberData.family_member_special_instructions !== undefined
          ? familyMemberData.family_member_special_instructions
          : (data as any)[fields.specialInstructions] || null
      };
    } catch (error) {
      console.error('Error updating family member:', error);
      throw error;
    }
  }

  // Delete family member (clears the slot)
  async deleteFamilyMember(familyMemberId: string): Promise<void> {
    try {
      const lastHyphenIndex = familyMemberId.lastIndexOf('-');
      if (lastHyphenIndex === -1) {
        throw new Error('Invalid family member ID format');
      }

      const customerId = familyMemberId.substring(0, lastHyphenIndex);
      const slotStr = familyMemberId.substring(lastHyphenIndex + 1);
      const slot = parseInt(slotStr) as FamilyMemberSlot;

      if (!customerId || isNaN(slot) || slot < 1 || slot > 5) {
        throw new Error('Invalid family member ID');
      }

      const fields = this.getFamilyMemberFields(slot);
      const updateData: any = {
        [fields.name]: null,
        [fields.restrictions]: []
      };

      const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting family member:', error);
      throw error;
    }
  }

  // Get count of family members for a customer
  async getFamilyMembersCount(customerId: string): Promise<number> {
    try {
      const members = await this.getFamilyMembersByCustomerId(customerId);
      return members.length;
    } catch (error) {
      console.error('Error getting family members count:', error);
      throw error;
    }
  }

  // Get family member restrictions as ingredient IDs
  async getFamilyMemberRestrictions(familyMemberId: string): Promise<string[]> {
    try {
      const familyMember = await this.getFamilyMemberById(familyMemberId);
      if (!familyMember) {
        return [];
      }
      return familyMember.family_member_restrictions || [];
    } catch (error) {
      console.error('Error getting family member restrictions:', error);
      throw error;
    }
  }

  // Get family member with restriction names (ingredient names)
  async getFamilyMemberWithRestrictionNames(familyMemberId: string): Promise<{
    familyMember: FamilyMember | null;
    restrictionNames: string[];
  }> {
    try {
      const familyMember = await this.getFamilyMemberById(familyMemberId);
      if (!familyMember || !familyMember.family_member_restrictions || familyMember.family_member_restrictions.length === 0) {
        return {
          familyMember,
          restrictionNames: []
        };
      }

      const { data: ingredients, error } = await supabase
        .from('ingredients')
        .select('ingredient_id, ingredient_name')
        .in('ingredient_id', familyMember.family_member_restrictions);

      if (error) {
        console.error('Error fetching ingredient names:', error);
        return {
          familyMember,
          restrictionNames: []
        };
      }

      const restrictionNames = (ingredients || []).map(ing => ing.ingredient_name);
      return {
        familyMember,
        restrictionNames
      };
    } catch (error) {
      console.error('Error getting family member with restriction names:', error);
      throw error;
    }
  }
}

export const familyMemberService = new FamilyMemberService();
