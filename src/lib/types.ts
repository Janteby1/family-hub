export type Role = "parent" | "child";

export interface FamilyMember {
  id: string;
  auth_user_id: string | null;
  display_name: string;
  role: Role;
  color: string;
  avatar_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  assigned_member_id: string | null;
  created_by: string | null;
  source: "manual" | "photo_import";
  created_at: string;
  updated_at: string;
}

export type Recurrence = "daily" | "weekdays" | "weekends" | "weekly" | "none";

export interface ChoreTemplate {
  id: string;
  title: string;
  assigned_member_id: string | null;
  is_up_for_grabs: boolean;
  recurrence: Recurrence;
  recurrence_meta: Record<string, unknown> | null;
  category: string | null;
  star_value: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ChoreInstance {
  id: string;
  template_id: string;
  occurrence_date: string;
  claimed_by_member_id: string | null;
  completed: boolean;
  completed_at: string | null;
  completed_by_member_id: string | null;
  created_at: string;
}

export interface List {
  id: string;
  name: string;
  list_type: string;
  owner_member_id: string | null;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  label: string;
  normalized_label: string | null;
  quantity: string | null;
  checked: boolean;
  checked_at: string | null;
  added_by_member_id: string | null;
  source: "manual" | "recipe_import";
  source_recipe_id: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  source_url: string | null;
  image_url: string | null;
  steps: string[];
  servings: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  raw_text: string;
  quantity: string | null;
  unit: string | null;
  name: string | null;
  sort_order: number;
}

export type MealSlot =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "dinner_kids"
  | "dinner_adults";

export interface MealPlanEntry {
  id: string;
  plan_date: string;
  meal_slot: MealSlot;
  recipe_id: string | null;
  free_text: string | null;
  created_at: string;
}

export interface StarLedgerEntry {
  id: string;
  member_id: string;
  delta: number;
  reason: "chore_completed" | "redeemed";
  chore_instance_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StarBalance {
  member_id: string;
  balance: number;
}

export type BadgeModule =
  | "calendar"
  | "tasks"
  | "lists"
  | "meals"
  | "recipes"
  | "rewards";

export interface ModuleLastSeen {
  auth_user_id: string;
  module: BadgeModule;
  last_seen_at: string;
}
