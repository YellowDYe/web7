import { supabase } from '../config/supabase';
import { BankAccount, CreateBankAccountData, UpdateBankAccountData } from '../types/bankAccount';

export class BankAccountService {
  // Generate next bank account ID (BA1, BA2, BA3...)
  private async generateNextAccountId(): Promise<string> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('account_id');

    if (error) {
      console.error('Error fetching last bank account ID:', error);
      return `BA${Math.floor(Math.random() * 100000000)}`;
    }

    if (!data || data.length === 0) {
      return 'BA1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.account_id.replace('BA', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `BA${maxNumber + 1}`;
  }

  // Create new bank account
  async createAccount(accountData: CreateBankAccountData): Promise<BankAccount> {
    const account_id = await this.generateNextAccountId();

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert([
        {
          account_id,
          account_name: accountData.account_name,
          account_description: accountData.account_description,
          initial_balance: accountData.initial_balance || 0,
          reconciliation_date: accountData.reconciliation_date || new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating bank account: ${error.message}`);
    }

    return data;
  }

  // Get all bank accounts
  async getAccounts(): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error fetching bank accounts: ${error.message}`);
    }

    return data || [];
  }

  // Get single bank account by ID (UUID)
  async getAccountById(id: string): Promise<BankAccount | null> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching bank account: ${error.message}`);
    }

    return data;
  }

  // Get single bank account by account_id (human-readable ID like BA1, BA2, etc.)
  async getAccountByAccountId(accountId: string): Promise<BankAccount | null> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('account_id', accountId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching bank account: ${error.message}`);
    }

    return data;
  }

  // Update bank account
  async updateAccount(id: string, updateData: UpdateBankAccountData): Promise<BankAccount> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating bank account: ${error.message}`);
    }

    return data;
  }

  // Delete bank account
  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting bank account: ${error.message}`);
    }
  }

  // Get calculated balance for an account (using reconciliation logic)
  async getCalculatedBalance(accountId: string): Promise<number> {
    try {
      const { bankAccountMovementService } = await import('./bankAccountMovementService');
      return await bankAccountMovementService.getCalculatedBalance(accountId);
    } catch (error) {
      console.error('Error getting calculated balance:', error);
      throw error;
    }
  }

  // Reconcile account - directly sets balance without creating adjustment movements
  async reconcileAccount(
    accountId: string,
    newBalance: number,
    firebaseUid?: string,
    notes?: string
  ): Promise<{ account: BankAccount; reconciliation: any; adjustment: null }> {
    try {
      const account = await this.getAccountByAccountId(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      const currentBalance = await this.getCalculatedBalance(accountId);
      const reconciliationDate = new Date().toISOString();

      // Call the database function to reconcile (which directly sets the balance)
      const { data: reconciliationId, error: reconcileError } = await supabase
        .rpc('reconcile_account_balance', {
          p_account_id: accountId,
          p_old_balance: currentBalance,
          p_new_balance: newBalance,
          p_reconciliation_date: reconciliationDate
        });

      if (reconcileError) {
        throw new Error(`Error reconciling account: ${reconcileError.message}`);
      }

      // Get the reconciliation record
      const { data: reconciliation, error: fetchError } = await supabase
        .from('bank_account_reconciliations')
        .select('*')
        .eq('id', reconciliationId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Error fetching reconciliation: ${fetchError.message}`);
      }

      const refreshedAccount = await this.getAccountByAccountId(accountId);

      return {
        account: refreshedAccount || account,
        reconciliation,
        adjustment: null // No adjustment movements created with new system
      };
    } catch (error) {
      console.error('Error reconciling account:', error);
      throw error;
    }
  }
}

export const bankAccountService = new BankAccountService();