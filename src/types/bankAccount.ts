export interface BankAccount {
  id: string;
  account_id: string;
  account_name: string;
  account_description: string;
  initial_balance: number;
  reconciliation_date: string;
  created_at: string;
  updated_at: string;
  account_balance?: number;
}

export interface CreateBankAccountData {
  account_name: string;
  account_description: string;
  initial_balance: number;
  reconciliation_date?: string;
}

export interface UpdateBankAccountData {
  account_name?: string;
  account_description?: string;
  initial_balance?: number;
  reconciliation_date?: string;
}