import { supabase } from '../config/supabase';
import { GmailConfig, GmailConfigForm } from '../types/gmailConfig';

class GmailConfigService {
  private cache: GmailConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private isCacheValid(): boolean {
    return this.cache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL;
  }

  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  async getConfig(): Promise<GmailConfig | null> {
    if (this.isCacheValid()) return this.cache;

    const { data, error } = await supabase
      .from('gmail_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching Gmail config:', error.message);
      return null;
    }

    this.cache = data;
    this.cacheTimestamp = Date.now();
    return data;
  }

  async getConfigForm(): Promise<GmailConfigForm> {
    const config = await this.getConfig();
    return {
      client_id: config?.client_id || '',
      client_secret: config?.client_secret || '',
      sync_label: config?.sync_label || 'INBOX',
    };
  }

  async updateConfig(form: GmailConfigForm): Promise<GmailConfig> {
    const existing = await this.getConfig();

    const payload = {
      client_id: form.client_id,
      client_secret: form.client_secret,
      sync_label: form.sync_label,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (existing) {
      const { data, error } = await supabase
        .from('gmail_config')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new Error(`Error updating Gmail config: ${error.message}`);
      result = data;
    } else {
      const { data, error } = await supabase
        .from('gmail_config')
        .insert([{ ...payload, is_active: false }])
        .select()
        .single();

      if (error) throw new Error(`Error creating Gmail config: ${error.message}`);
      result = data;
    }

    this.clearCache();
    return result;
  }

  async saveOAuthTokens(tokens: {
    refresh_token: string;
    access_token: string;
    token_expiry: string;
    connected_email: string;
  }): Promise<void> {
    const existing = await this.getConfig();
    if (!existing) throw new Error('Gmail config not found. Please save credentials first.');

    const { error } = await supabase
      .from('gmail_config')
      .update({
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expiry: tokens.token_expiry,
        connected_email: tokens.connected_email,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw new Error(`Error saving OAuth tokens: ${error.message}`);
    this.clearCache();
  }

  async disconnect(): Promise<void> {
    const existing = await this.getConfig();
    if (!existing) return;

    const { error } = await supabase
      .from('gmail_config')
      .update({
        refresh_token: '',
        access_token: '',
        token_expiry: null,
        connected_email: '',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw new Error(`Error disconnecting Gmail: ${error.message}`);
    this.clearCache();
  }

  async updateLastSync(): Promise<void> {
    const existing = await this.getConfig();
    if (!existing) return;

    const { error } = await supabase
      .from('gmail_config')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) console.error('Error updating last sync:', error.message);
    this.clearCache();
  }

  getOAuthUrl(clientId: string, redirectUri: string): string {
    const scope = 'https://www.googleapis.com/auth/gmail.readonly';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
}

export const gmailConfigService = new GmailConfigService();
