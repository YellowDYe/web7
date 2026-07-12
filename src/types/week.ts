export interface Week {
  id: string;
  week_id: string;
  week_name: string;
  weekly_menu: string | null;
  week_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeekWithMenu extends Week {
  menu_name: string;
}

export interface WeekWithDetails extends WeekWithMenu {
  // Additional computed fields can be added here if needed
}

export interface SelectedWeek {
  week: WeekWithMenu;
  tempId: string;
}

export interface CreateWeekData {
  week_name: string;
  weekly_menu: string;
  week_date: string | null;
}