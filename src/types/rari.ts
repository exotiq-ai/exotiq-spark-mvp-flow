// Centralized Rari type definitions

export type RariSidebarState = 'closed' | 'minimized' | 'open';

export type EntityType = 'booking' | 'customer' | 'vehicle';

export type InsightType = 'pricing' | 'utilization' | 'maintenance' | 'revenue' | 'customer' | 'compliance' | 'booking';

export type InsightPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface RariContext {
  type: EntityType | null;
  id: string | null;
  data: any | null;
}

export interface RariCurrentEntity {
  type: EntityType | null;
  id: string | null;
  data: any;
  loadedAt: Date | null;
}

export interface RecentEntity {
  type: EntityType;
  id: string;
  name: string;
  viewedAt: Date;
}

export interface RariInsight {
  id: string;
  user_id: string;
  team_id: string | null;
  insight_type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  action_items: string[];
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsightActionItem {
  id: string;
  text: string;
  insightId: string;
  insightTitle: string;
  priority: InsightPriority;
  completed: boolean;
  snoozedUntil?: Date;
}

export interface RariPreferences {
  voiceEnabled: boolean;
  autoMinimize: boolean;
  notificationSound: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type ConversationTag = 
  | 'booking_inquiry'
  | 'vehicle_question'
  | 'payment_issue'
  | 'maintenance_request'
  | 'customer_complaint'
  | 'general_information'
  | 'fleet_performance'
  | 'pricing_question';
