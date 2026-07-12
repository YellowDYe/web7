import { supabase } from '../config/supabase';
import { CreateWeekData } from '../types/week';
import { getCurrentMexicoDateString } from '../utils/timezone';

export interface Week {
  id: string;
  week_id: string;
  week_name: string;
  weekly_menu: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeekWithMenu extends Week {
  menu_name: string;
}

export class WeekService {
  // Generate next week ID
  private async generateNextWeekId(): Promise<string> {
    const { data, error } = await supabase
      .from('weeks')
      .select('week_id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Error generating week ID: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return 'W1';
    }

    const lastWeekId = data[0].week_id;
    const match = lastWeekId.match(/^W(\d+)$/);
    
    if (match) {
      const nextNumber = parseInt(match[1]) + 1;
      return `W${nextNumber}`;
    }
    
    return 'W1';
  }

  // Create a new week
  async createWeek(weekData: CreateWeekData): Promise<Week> {
    const week_id = await this.generateNextWeekId();

    const { data, error } = await supabase
      .from('weeks')
      .insert({
        week_id,
        week_name: weekData.week_name,
        weekly_menu: weekData.weekly_menu,
        week_date: weekData.week_date
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating week: ${error.message}`);
    }

    return data;
  }

  // Get all weeks
  async getWeeks(): Promise<WeekWithMenu[]> {
    const { data, error } = await supabase
      .from('weeks')
      .select(`
        *,
        weekly_menus!inner(menu_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching weeks: ${error.message}`);
    }

    return (data || []).map(week => ({
      ...week,
      menu_name: week.weekly_menus?.menu_name || 'Sin menú'
    }));
  }

  // Update week
  async updateWeek(id: string, updateData: Partial<CreateWeekData>): Promise<Week> {
    const { data, error } = await supabase
      .from('weeks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating week: ${error.message}`);
    }

    return data;
  }

  // Delete week
  async deleteWeek(id: string): Promise<void> {
    const { error } = await supabase
      .from('weeks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting week: ${error.message}`);
    }
  }

  // Search weeks by name
  async searchWeeks(searchTerm: string): Promise<WeekWithMenu[]> {
    if (!searchTerm.trim()) {
      return this.getWeeks();
    }

    const { data, error } = await supabase
      .from('weeks')
      .select(`
        *,
        weekly_menus!inner(menu_name)
      `)
      .ilike('week_name', `%${searchTerm}%`)
      .order('week_name', { ascending: true })
      .limit(20);

    if (error) {
      throw new Error(`Error searching weeks: ${error.message}`);
    }

    return (data || []).map(week => ({
      ...week,
      menu_name: week.weekly_menus?.menu_name || 'Sin menú'
    }));
  }

  // Get week by week_id
  async getWeekByWeekId(weekId: string): Promise<Week | null> {
    const { data, error } = await supabase
      .from('weeks')
      .select('*')
      .eq('week_id', weekId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching week: ${error.message}`);
    }

    return data;
  }

  // Get week by date with menu details
  async getWeekByDate(date: string): Promise<WeekWithMenu | null> {
    const { data, error } = await supabase
      .from('weeks')
      .select(`
        *,
        weekly_menus!inner(menu_name)
      `)
      .eq('week_date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching week by date: ${error.message}`);
    }

    return {
      ...data,
      menu_name: data.weekly_menus?.menu_name || 'Sin menú'
    };
  }

  // Get available week dates (excluding specified weeks)
  async getAvailableWeekDates(excludeWeeks: string[] = []): Promise<string[]> {
    let query = supabase
      .from('weeks')
      .select('week_date')
      .not('week_date', 'is', null)
      .order('week_date', { ascending: true });

    if (excludeWeeks.length > 0) {
      query = query.not('week_id', 'in', `(${excludeWeeks.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error fetching available week dates: ${error.message}`);
    }

    return (data || []).map(week => week.week_date).filter(date => date !== null);
  }

  // Get upcoming weeks for customer orders
  async getUpcomingWeeks(limit: number = 4): Promise<any[]> {
    const today = getCurrentMexicoDateString();

    const { data, error } = await supabase
      .from('weeks')
      .select(`
        *,
        weekly_menus!inner(
          menu_name,
          menu_id
        )
      `)
      .gte('week_date', today)
      .order('week_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching upcoming weeks: ${error.message}`);
    }

    return (data || []).map(week => ({
      ...week,
      menu_name: week.weekly_menus?.menu_name || 'Sin menú',
      menu_id: week.weekly_menus?.menu_id || null
    }));
  }
}

export const weekService = new WeekService();