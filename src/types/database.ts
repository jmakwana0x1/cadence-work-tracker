export type HabitStatus = "done" | "partial" | "skip";
export type TaskPriority = "low" | "medium" | "high";
export type BlockStatus = "hit" | "partial" | "missed";

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  category: string;
  target_frequency: number;
  color: string;
  freeze_tokens: number;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  logged_at: string; // date string YYYY-MM-DD
  status: HabitStatus;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  category: string;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TimeBlock {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  category: string;
  planned_label: string;
  actual_status: BlockStatus | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  google_event_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  synced_at: string | null;
  created_at: string;
}

export interface ScoreComponents {
  habit_pct: number;
  task_pct: number;
  schedule_pct: number;
}

export interface DailyScore {
  id: string;
  user_id: string;
  date: string;
  discipline_score: number;
  components: ScoreComponents;
  created_at: string;
}

// v2 Rhythm Engine. See src/lib/rhythm.ts and supabase/migrations/002_rhythm_daily.sql.
export type RhythmState =
  | "in-rhythm"
  | "building"
  | "slipping"
  | "recovering"
  | "overreaching"
  | "dormant";

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface Season {
  id: string;
  user_id: string;
  title: string;
  theme: string | null;
  started_on: string; // YYYY-MM-DD
  ends_on: string; // YYYY-MM-DD
  created_at: string;
}

export interface RhythmDaily {
  id: string;
  user_id: string;
  date: string;
  cadence: number;
  completion: number;
  attempts: number;
  load_acute: number;
  load_chronic: number;
  acwr: number;
  state: RhythmState;
  created_at: string;
}

// Habit with today's log status joined
export interface HabitWithTodayLog extends Habit {
  today_log: HabitLog | null;
}
