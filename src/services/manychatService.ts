import { supabase } from '../config/supabase';

export interface ManychatSubscriber {
  id: string | number;
  page_id: string;
  status: string;
  first_name: string;
  last_name: string;
  name: string;
  gender: string;
  profile_pic: string;
  locale: string;
  language: string;
  live_chat_url: string;
  last_interaction: string;
  opted_in_at: string | null;
  subscribed: string;
  last_seen: string;
  custom_fields: ManychatCustomField[];
  phone?: string;
  email?: string;
}

export interface ManychatCustomField {
  id: number;
  name: string;
  type: string;
  value: string | number | boolean | null;
  description?: string;
}

export interface ManychatPageCustomField {
  id: number;
  name: string;
  type: string;
  description: string;
}

class ManychatService {
  private async invoke<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('manychat-api', {
      body,
    });

    console.log('[ManychatService] invoke response:', { action: body.action, data, error });

    if (error) {
      throw new Error(error.message || 'Error al comunicarse con Manychat');
    }

    if (!data) {
      throw new Error('No se recibió respuesta del servidor');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data as T;
  }

  async testConnection(): Promise<{ success: boolean; message: string; fields?: { id: number; expected_name: string; found: boolean; actual_name: string | null; type: string | null }[] }> {
    try {
      const data = await this.invoke<{ success: boolean; message: string; fields?: { id: number; expected_name: string; found: boolean; actual_name: string | null; type: string | null }[] }>({
        action: 'test-connection',
      });
      return data;
    } catch (error: any) {
      return { success: false, message: error.message || 'Error al conectar con Manychat' };
    }
  }

  async findSubscriberByPhone(phone: string): Promise<ManychatSubscriber | null> {
    const data = await this.invoke<{ status: string; data: ManychatSubscriber[] }>({
      action: 'find-by-system-field',
      field: 'phone',
      value: phone,
    });
    const subscribers = data?.data || [];
    return subscribers.length > 0 ? subscribers[0] : null;
  }

  async findSubscriberByEmail(email: string): Promise<ManychatSubscriber | null> {
    const data = await this.invoke<{ status: string; data: ManychatSubscriber[] }>({
      action: 'find-by-system-field',
      field: 'email',
      value: email,
    });
    const subscribers = data?.data || [];
    return subscribers.length > 0 ? subscribers[0] : null;
  }

  async findSubscriberByCustomField(fieldId: number, value: string): Promise<ManychatSubscriber | null> {
    console.log('[ManychatService] findSubscriberByCustomField:', { fieldId, value });
    const data = await this.invoke<{ status: string; data: ManychatSubscriber[] | ManychatSubscriber; _version?: string; _request_url?: string }>({
      action: 'find-by-custom-field',
      field_id: fieldId,
      value,
    });
    console.log('[ManychatService] findSubscriberByCustomField result:', JSON.stringify(data));
    console.log('[ManychatService] Edge function version:', (data as any)?._version, 'Request URL:', (data as any)?._request_url);
    const rawData = data?.data;
    if (!rawData) return null;
    if (Array.isArray(rawData)) {
      return rawData.length > 0 ? rawData[0] : null;
    }
    if (typeof rawData === 'object' && (rawData as ManychatSubscriber).id) {
      return rawData as ManychatSubscriber;
    }
    return null;
  }

  async getSubscriberInfo(subscriberId: string | number): Promise<ManychatSubscriber> {
    const data = await this.invoke<{ status: string; data: ManychatSubscriber }>({
      action: 'get-subscriber-info',
      subscriber_id: subscriberId,
    });
    return data.data;
  }

  async setCustomField(subscriberId: string | number, fieldId: number, value: string | number | boolean): Promise<void> {
    await this.invoke({
      action: 'set-custom-field',
      subscriber_id: subscriberId,
      field_id: fieldId,
      field_value: value,
    });
  }

  async setCustomFieldByName(subscriberId: string | number, fieldName: string, value: string | number | boolean): Promise<void> {
    await this.invoke({
      action: 'set-custom-field-by-name',
      subscriber_id: subscriberId,
      field_name: fieldName,
      field_value: value,
    });
  }

  async getPageCustomFields(): Promise<ManychatPageCustomField[]> {
    const data = await this.invoke<{ status: string; data: ManychatPageCustomField[] }>({
      action: 'get-custom-fields',
    });
    return data.data || [];
  }

  async getSubscriberCustomFieldValue(subscriberId: string | number, fieldName: string): Promise<string | number | boolean | null> {
    const subscriber = await this.getSubscriberInfo(subscriberId);
    const field = subscriber.custom_fields?.find(f => f.name === fieldName);
    return field ? field.value : null;
  }

  async createWhatsAppSubscriber(phone: string, firstName: string, lastName: string): Promise<{ status: string; data: ManychatSubscriber }> {
    const data = await this.invoke<{ status: string; data: ManychatSubscriber }>({
      action: 'create-subscriber',
      first_name: firstName,
      last_name: lastName,
      whatsapp_phone: phone,
      consent_phrase: 'Acepto recibir mensajes',
    });
    return data;
  }

  async addTagByName(subscriberId: string | number, tagName: string): Promise<void> {
    await this.invoke({
      action: 'add-tag-by-name',
      subscriber_id: subscriberId,
      tag_name: tagName,
    });
  }

  async sendFlow(subscriberId: string | number, flowNs: string): Promise<{ status: string }> {
    const data = await this.invoke<{ status: string }>({
      action: 'send-flow',
      subscriber_id: subscriberId,
      flow_ns: flowNs,
    });
    return data;
  }

  async createContactAndTag(phone: string, firstName: string, lastName: string): Promise<ManychatSubscriber> {
    const result = await this.createWhatsAppSubscriber(phone, firstName, lastName);
    const subscriber = result.data;
    if (subscriber?.id) {
      await this.addTagByName(subscriber.id, 'Whats');
    }
    return subscriber;
  }

  async debugFind(fieldId: number, value: string): Promise<unknown> {
    const { data, error } = await supabase.functions.invoke('manychat-api', {
      body: { action: 'debug-find', field_id: fieldId, value },
    });
    console.log('[ManychatService] debugFind raw response:', { data, error });
    return data;
  }
}

export const manychatService = new ManychatService();
