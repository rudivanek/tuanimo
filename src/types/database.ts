export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          language: string;
          timezone: string;
          cycle_start: string;
          cycle_end: string | null;
          is_admin: boolean;
          full_name: string;
          first_name: string | null;
          last_name: string | null;
          is_disabled: boolean;
          deleted_at: string | null;
          encryption_secret: string;
          enc_version: number;
          plan_key: 'starter' | 'pro' | 'power';
          journal_storage_bytes_allowed: number;
          journal_storage_bytes_used: number;
          sound_enabled: boolean;
          sound_response_enabled: boolean;
          sound_journal_suggestion_enabled: boolean;
          sound_journal_saved_enabled: boolean;
          flight_recorder_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          language?: string;
          timezone?: string;
          cycle_start?: string;
          cycle_end?: string | null;
          is_admin?: boolean;
          full_name?: string;
          first_name?: string | null;
          last_name?: string | null;
          is_disabled?: boolean;
          deleted_at?: string | null;
          encryption_secret?: string;
          enc_version?: number;
          plan_key?: 'starter' | 'pro' | 'power';
          journal_storage_bytes_allowed?: number;
          journal_storage_bytes_used?: number;
          sound_enabled?: boolean;
          sound_response_enabled?: boolean;
          sound_journal_suggestion_enabled?: boolean;
          sound_journal_saved_enabled?: boolean;
          flight_recorder_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          language?: string;
          timezone?: string;
          cycle_start?: string;
          cycle_end?: string | null;
          is_admin?: boolean;
          full_name?: string;
          first_name?: string | null;
          last_name?: string | null;
          is_disabled?: boolean;
          deleted_at?: string | null;
          encryption_secret?: string;
          enc_version?: number;
          plan_key?: 'starter' | 'pro' | 'power';
          journal_storage_bytes_allowed?: number;
          journal_storage_bytes_used?: number;
          sound_enabled?: boolean;
          sound_response_enabled?: boolean;
          sound_journal_suggestion_enabled?: boolean;
          sound_journal_saved_enabled?: boolean;
          flight_recorder_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          sort_order: number;
          welcome_inserted: boolean;
          linked_journal_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          sort_order?: number;
          welcome_inserted?: boolean;
          linked_journal_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          sort_order?: number;
          welcome_inserted?: boolean;
          linked_journal_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          user_id: string;
          sender: 'user' | 'counselor';
          content_enc: string;
          enc_version: number;
          meta: Record<string, unknown>;
          chip_meta: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          user_id: string;
          sender: 'user' | 'counselor';
          content_enc: string;
          enc_version?: number;
          meta?: Record<string, unknown>;
          chip_meta?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          user_id?: string;
          sender?: 'user' | 'counselor';
          content_enc?: string;
          enc_version?: number;
          meta?: Record<string, unknown>;
          chip_meta?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content_enc: string;
          enc_version: number;
          content_bytes: number;
          prompt: string | null;
          tags: string[];
          sort_order: number;
          is_draft: boolean;
          origin: string;
          trigger_reason: string | null;
          emotion_score_at_creation: number | null;
          saved_at: string | null;
          source_chat_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content_enc: string;
          enc_version?: number;
          content_bytes?: number;
          prompt?: string | null;
          tags?: string[];
          sort_order?: number;
          is_draft?: boolean;
          origin?: string;
          trigger_reason?: string | null;
          emotion_score_at_creation?: number | null;
          saved_at?: string | null;
          source_chat_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content_enc?: string;
          enc_version?: number;
          content_bytes?: number;
          prompt?: string | null;
          tags?: string[];
          sort_order?: number;
          is_draft?: boolean;
          origin?: string;
          trigger_reason?: string | null;
          emotion_score_at_creation?: number | null;
          saved_at?: string | null;
          source_chat_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      journal_daily_usage: {
        Row: {
          user_id: string;
          day: string;
          bytes_saved: number;
          saves_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          day: string;
          bytes_saved?: number;
          saves_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          day?: string;
          bytes_saved?: number;
          saves_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      token_usage: {
        Row: {
          id: string;
          user_id: string;
          operation: string;
          model: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          operation: string;
          model: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          operation?: string;
          model?: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      token_plan_limits: {
        Row: {
          plan_key: string;
          daily_token_limit: number;
          monthly_token_limit: number;
          updated_at: string;
        };
        Insert: {
          plan_key: string;
          daily_token_limit?: number;
          monthly_token_limit?: number;
          updated_at?: string;
        };
        Update: {
          plan_key?: string;
          daily_token_limit?: number;
          monthly_token_limit?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      mood_logs: {
        Row: {
          id: string;
          user_id: string;
          local_date: string;
          emoji: string;
          note_enc: string | null;
          enc_version: number;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          local_date: string;
          emoji: string;
          note_enc?: string | null;
          enc_version?: number;
          timezone: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          local_date?: string;
          emoji?: string;
          note_enc?: string | null;
          enc_version?: number;
          timezone?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      mood_weekly_insights: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          insight_text: string;
          created_at: string;
          signal_meta: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          insight_text: string;
          created_at?: string;
          signal_meta?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          insight_text?: string;
          created_at?: string;
          signal_meta?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
      user_memory: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value_enc: string;
          enc_version: number;
          source: string;
          last_confirmed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          value_enc: string;
          enc_version?: number;
          source?: string;
          last_confirmed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key?: string;
          value_enc?: string;
          enc_version?: number;
          source?: string;
          last_confirmed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      app_admins: {
        Row: {
          id: string;
          user_id: string | null;
          email: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          email?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chip_stats: {
        Row: {
          user_id: string;
          impressions_30d: number;
          clicks_30d: number;
          cooldown_until: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          impressions_30d?: number;
          clicks_30d?: number;
          cooldown_until?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          impressions_30d?: number;
          clicks_30d?: number;
          cooldown_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      boundary_test_runs: {
        Row: {
          id: string;
          admin_user_id: string;
          results: unknown[];
          summary: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          results?: unknown[];
          summary?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          results?: unknown[];
          summary?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      crisis_events: {
        Row: {
          id: string;
          user_id: string;
          source: string;
          severity: string;
          created_at: string;
          thread_id: string | null;
          message_id: string | null;
          session_id: string | null;
          model: string | null;
          meta: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: string;
          severity: string;
          created_at?: string;
          thread_id?: string | null;
          message_id?: string | null;
          session_id?: string | null;
          model?: string | null;
          meta?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: string;
          severity?: string;
          created_at?: string;
          thread_id?: string | null;
          message_id?: string | null;
          session_id?: string | null;
          model?: string | null;
          meta?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
      boundary_events: {
        Row: {
          id: string;
          user_id: string;
          boundary_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          boundary_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          boundary_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_signal_daily_agg: {
        Row: {
          id: string;
          user_id: string;
          signal_date: string;
          signal_type: string;
          score: number;
          message_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          signal_date: string;
          signal_type: string;
          score?: number;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          signal_date?: string;
          signal_type?: string;
          score?: number;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sim_runs: {
        Row: {
          id: string;
          admin_user_id: string;
          config: Record<string, unknown>;
          status: string;
          summary: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          config?: Record<string, unknown>;
          status?: string;
          summary?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          config?: Record<string, unknown>;
          status?: string;
          summary?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sim_run_items: {
        Row: {
          id: string;
          run_id: string;
          scenario_id: string;
          type: string;
          persona_label: string;
          language: string;
          turns_count: number;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          cost_usd: number;
          total_latency_ms: number;
          turn_details: unknown[];
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          scenario_id: string;
          type: string;
          persona_label?: string;
          language?: string;
          turns_count?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost_usd?: number;
          total_latency_ms?: number;
          turn_details?: unknown[];
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          scenario_id?: string;
          type?: string;
          persona_label?: string;
          language?: string;
          turns_count?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost_usd?: number;
          total_latency_ms?: number;
          turn_details?: unknown[];
          error?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      flight_recorder_events: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          event_name: string;
          payload: Record<string, unknown> | null;
          session_id: string | null;
          app_area: string | null;
          recorded_by_admin_user_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          event_name: string;
          payload?: Record<string, unknown> | null;
          session_id?: string | null;
          app_area?: string | null;
          recorded_by_admin_user_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          event_name?: string;
          payload?: Record<string, unknown> | null;
          session_id?: string | null;
          app_area?: string | null;
          recorded_by_admin_user_id?: string | null;
        };
        Relationships: [];
      };
      chat_to_journal_logs: {
        Row: {
          id: string;
          user_id: string;
          chat_id: string;
          message_count: number;
          input_chars: number;
          model: string;
          tokens_in: number;
          tokens_out: number;
          cost_usd: number;
          latency_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          chat_id: string;
          message_count?: number;
          input_chars?: number;
          model?: string;
          tokens_in?: number;
          tokens_out?: number;
          cost_usd?: number;
          latency_ms?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          chat_id?: string;
          message_count?: number;
          input_chars?: number;
          model?: string;
          tokens_in?: number;
          tokens_out?: number;
          cost_usd?: number;
          latency_ms?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: { p_uid: string; p_email: string };
        Returns: boolean;
      };
      check_token_budget: {
        Args: { p_user_id: string };
        Returns: {
          allowed: boolean;
          daily_used: number;
          daily_limit: number;
          monthly_used: number;
          monthly_limit: number;
          reason: string;
        }[];
      };
      admin_list_users: {
        Args: { p_search?: string | null; p_include_deleted?: boolean };
        Returns: {
          id: string;
          email: string;
          full_name: string;
          first_name: string | null;
          last_name: string | null;
          plan_key: string;
          is_disabled: boolean;
          is_admin_user: boolean;
          deleted_at: string | null;
          created_at: string;
        }[];
      };
      admin_upsert_user_profile: {
        Args: {
          p_user_id: string;
          p_full_name?: string | null;
          p_is_disabled?: boolean | null;
          p_first_name?: string | null;
          p_last_name?: string | null;
          p_plan_key?: string | null;
        };
        Returns: void;
      };
      admin_soft_delete_user: {
        Args: { p_user_id: string };
        Returns: void;
      };
      admin_insert_profile: {
        Args: {
          p_user_id: string;
          p_full_name?: string;
        };
        Returns: void;
      };
      reserve_journal_storage: {
        Args: { p_user_id: string; p_bytes_to_add: number };
        Returns: {
          new_used: number;
          allowed: number;
          today_bytes: number;
          today_saves: number;
        };
      };
      release_journal_storage: {
        Args: { p_user_id: string; p_bytes_to_subtract: number };
        Returns: void;
      };
      apply_journal_storage_limit: {
        Args: { p_user_id: string };
        Returns: {
          allowed: number;
          used: number;
          tier: 'starter' | 'pro' | 'power';
        }[];
      };
      journal_storage_bytes_for_plan: {
        Args: { p_plan_key: string };
        Returns: number;
      };
      admin_get_token_plan_limits: {
        Args: Record<string, never>;
        Returns: {
          plan_key: 'starter' | 'pro' | 'power';
          daily_token_limit: number;
          monthly_token_limit: number;
          journal_storage_bytes: number;
          updated_at: string;
        }[];
      };
      admin_update_token_plan_limits: {
        Args: { p_plan_key: string; p_daily: number; p_monthly: number };
        Returns: {
          plan_key: 'starter' | 'pro' | 'power';
          daily_token_limit: number;
          monthly_token_limit: number;
          journal_storage_bytes: number;
          updated_at: string;
        }[];
      };
      admin_token_usage_report: {
        Args: {
          p_date_from: string;
          p_date_until: string;
          p_user_id?: string | null;
        };
        Returns: {
          user_id: string;
          user_label: string;
          usage_date: string;
          total_tokens: number;
          total_cost_usd: number;
        }[];
      };
      admin_list_users_with_usage: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          user_label: string;
        }[];
      };
      admin_token_cost_report: {
        Args: {
          p_from: string;
          p_to: string;
          p_group_by?: string;
        };
        Returns: {
          group_label: string;
          calls: number;
          total_tokens: number;
          cost_usd: number;
        }[];
      };
      admin_top_users_by_cost: {
        Args: {
          p_from: string;
          p_to: string;
          p_limit?: number;
        };
        Returns: {
          user_label: string;
          calls: number;
          total_tokens: number;
          cost_usd: number;
        }[];
      };
      admin_list_crisis_events: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_user_id?: string | null;
          p_severity?: string | null;
          p_source?: string | null;
        };
        Returns: {
          id: string;
          user_id: string;
          user_label: string;
          source: string;
          severity: string;
          created_at: string;
          thread_id: string | null;
          message_id: string | null;
          session_id: string | null;
          model: string | null;
          meta: Record<string, unknown> | null;
        }[];
      };
      upsert_chat_signal_daily_agg: {
        Args: {
          p_signal_date: string;
          p_signal_type: string;
          p_score: number;
          p_message_count: number;
        };
        Returns: void;
      };
      admin_set_flight_recorder: {
        Args: { p_target_user_id: string; p_enabled: boolean };
        Returns: void;
      };
      admin_list_flight_recorder_users: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          full_name: string;
          flight_recorder_enabled: boolean;
          event_count: number;
          latest_event_at: string | null;
        }[];
      };
      admin_clear_flight_recorder_events: {
        Args: { p_user_id?: string | null };
        Returns: void;
      };
      admin_reconcile_journal_storage: {
        Args: { p_user_id?: string | null };
        Returns: {
          users_updated: number;
          entries_fixed: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
};
