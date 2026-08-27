export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_actions_log: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_manual_email_recipients: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          manual_email_id: string
          resend_message_id: string | null
          send_status: string
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          manual_email_id: string
          resend_message_id?: string | null
          send_status?: string
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          manual_email_id?: string
          resend_message_id?: string | null
          send_status?: string
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_manual_email_recipients_manual_email_id_fkey"
            columns: ["manual_email_id"]
            isOneToOne: false
            referencedRelation: "admin_manual_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_manual_emails: {
        Row: {
          audience_type: string
          body_text: string
          created_at: string
          created_by_admin_id: string
          failure_count: number
          id: string
          recipient_count: number
          status: string
          subject: string
          success_count: number
        }
        Insert: {
          audience_type: string
          body_text: string
          created_at?: string
          created_by_admin_id: string
          failure_count?: number
          id?: string
          recipient_count?: number
          status?: string
          subject: string
          success_count?: number
        }
        Update: {
          audience_type?: string
          body_text?: string
          created_at?: string
          created_by_admin_id?: string
          failure_count?: number
          id?: string
          recipient_count?: number
          status?: string
          subject?: string
          success_count?: number
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      ai_user_overrides: {
        Row: {
          chat_model: string | null
          note: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          chat_model?: string | null
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          chat_model?: string | null
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_admins: {
        Row: {
          created_at: string
          email: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      boundary_events: {
        Row: {
          boundary_attempts: number
          conversation_id: string
          created_at: string
          id: string
          message_snippet: string
          user_id: string
        }
        Insert: {
          boundary_attempts?: number
          conversation_id?: string
          created_at?: string
          id?: string
          message_snippet?: string
          user_id: string
        }
        Update: {
          boundary_attempts?: number
          conversation_id?: string
          created_at?: string
          id?: string
          message_snippet?: string
          user_id?: string
        }
        Relationships: []
      }
      boundary_test_runs: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          results: Json
          summary: Json
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          results?: Json
          summary?: Json
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          results?: Json
          summary?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chip_meta: Json | null
          content_enc: string
          created_at: string
          enc_version: number
          id: string
          meta: Json
          sender: string
          thread_id: string
          user_id: string
        }
        Insert: {
          chip_meta?: Json | null
          content_enc: string
          created_at?: string
          enc_version?: number
          id?: string
          meta?: Json
          sender: string
          thread_id: string
          user_id: string
        }
        Update: {
          chip_meta?: Json | null
          content_enc?: string
          created_at?: string
          enc_version?: number
          id?: string
          meta?: Json
          sender?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_signal_daily_agg: {
        Row: {
          created_at: string
          id: string
          message_count: number
          score: number
          signal_date: string
          signal_type: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number
          score?: number
          signal_date: string
          signal_type: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number
          score?: number
          signal_date?: string
          signal_type?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          linked_journal_entry_id: string | null
          memory_extracted_at: string | null
          sort_order: number
          title: string
          updated_at: string
          user_id: string
          welcome_inserted: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          linked_journal_entry_id?: string | null
          memory_extracted_at?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          user_id: string
          welcome_inserted?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          linked_journal_entry_id?: string | null
          memory_extracted_at?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
          welcome_inserted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_linked_journal_entry_id_fkey"
            columns: ["linked_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_to_journal_logs: {
        Row: {
          chat_id: string
          cost_usd: number
          created_at: string
          deny_reason: string
          http_status: number
          id: string
          input_chars: number
          latency_ms: number
          message_count: number
          model: string
          outcome: string
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          chat_id: string
          cost_usd?: number
          created_at?: string
          deny_reason?: string
          http_status?: number
          id?: string
          input_chars?: number
          latency_ms?: number
          message_count?: number
          model?: string
          outcome?: string
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          chat_id?: string
          cost_usd?: number
          created_at?: string
          deny_reason?: string
          http_status?: number
          id?: string
          input_chars?: number
          latency_ms?: number
          message_count?: number
          model?: string
          outcome?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: []
      }
      chip_stats: {
        Row: {
          clicks_30d: number
          cooldown_until: string | null
          impressions_30d: number
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks_30d?: number
          cooldown_until?: string | null
          impressions_30d?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks_30d?: number
          cooldown_until?: string | null
          impressions_30d?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commitments: {
        Row: {
          created_at: string
          id: string
          resolved_at: string | null
          source: string
          status: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          source?: string
          status?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          source?: string
          status?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      crisis_events: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          meta: Json | null
          model: string | null
          session_id: string | null
          severity: string
          source: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          meta?: Json | null
          model?: string | null
          session_id?: string | null
          severity: string
          source: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          meta?: Json | null
          model?: string | null
          session_id?: string | null
          severity?: string
          source?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crisis_resources: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          phone: string | null
          resource_name: string
          sort_order: number
          updated_at: string
          website: string | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          resource_name: string
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          resource_name?: string
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      elena_memories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_referenced_at: string
          note_enc: string
          sensitive: boolean
          type: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_referenced_at?: string
          note_enc: string
          sensitive?: boolean
          type: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_referenced_at?: string
          note_enc?: string
          sensitive?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      email_campaign_config: {
        Row: {
          campaign_type: string
          enabled: boolean
          frequency_days: number
          inactive_trigger_days: number
          min_sessions: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          campaign_type: string
          enabled?: boolean
          frequency_days?: number
          inactive_trigger_days?: number
          min_sessions?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          campaign_type?: string
          enabled?: boolean
          frequency_days?: number
          inactive_trigger_days?: number
          min_sessions?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_lifecycle_events: {
        Row: {
          created_at: string
          email_type: string
          id: string
          metadata: Json
          resend_message_id: string | null
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_type: string
          id?: string
          metadata?: Json
          resend_message_id?: string | null
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_type?: string
          id?: string
          metadata?: Json
          resend_message_id?: string | null
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_user_overrides: {
        Row: {
          campaign_type: string
          enabled: boolean | null
          frequency_days: number | null
          id: string
          note: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          campaign_type: string
          enabled?: boolean | null
          frequency_days?: number | null
          id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          campaign_type?: string
          enabled?: boolean | null
          frequency_days?: number | null
          id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flight_recorder_events: {
        Row: {
          app_area: string | null
          created_at: string
          event_name: string
          id: string
          payload: Json | null
          recorded_by_admin_user_id: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          app_area?: string | null
          created_at?: string
          event_name: string
          id?: string
          payload?: Json | null
          recorded_by_admin_user_id?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          app_area?: string | null
          created_at?: string
          event_name?: string
          id?: string
          payload?: Json | null
          recorded_by_admin_user_id?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      intentions: {
        Row: {
          content_enc: string
          created_at: string
          enc_version: number
          id: string
          last_referenced_at: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_enc: string
          created_at?: string
          enc_version?: number
          id?: string
          last_referenced_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_enc?: string
          created_at?: string
          enc_version?: number
          id?: string
          last_referenced_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_daily_usage: {
        Row: {
          bytes_saved: number
          created_at: string
          day: string
          saves_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes_saved?: number
          created_at?: string
          day: string
          saves_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes_saved?: number
          created_at?: string
          day?: string
          saves_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content_bytes: number
          content_enc: string
          created_at: string
          emotion_score_at_creation: number | null
          enc_version: number
          id: string
          is_draft: boolean
          linked_chat_id: string | null
          origin: string
          prompt: string | null
          saved_at: string | null
          sort_order: number
          source_chat_id: string | null
          tags: string[]
          title: string
          trigger_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content_bytes?: number
          content_enc: string
          created_at?: string
          emotion_score_at_creation?: number | null
          enc_version?: number
          id?: string
          is_draft?: boolean
          linked_chat_id?: string | null
          origin?: string
          prompt?: string | null
          saved_at?: string | null
          sort_order?: number
          source_chat_id?: string | null
          tags?: string[]
          title: string
          trigger_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content_bytes?: number
          content_enc?: string
          created_at?: string
          emotion_score_at_creation?: number | null
          enc_version?: number
          id?: string
          is_draft?: boolean
          linked_chat_id?: string | null
          origin?: string
          prompt?: string | null
          saved_at?: string | null
          sort_order?: number
          source_chat_id?: string | null
          tags?: string[]
          title?: string
          trigger_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_linked_chat_id_fkey"
            columns: ["linked_chat_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      model_pricing: {
        Row: {
          cache_read_per_mtok: number
          cache_write_per_mtok: number
          effective_from: string
          input_per_mtok: number
          model: string
          note: string | null
          output_per_mtok: number
        }
        Insert: {
          cache_read_per_mtok?: number
          cache_write_per_mtok?: number
          effective_from?: string
          input_per_mtok: number
          model: string
          note?: string | null
          output_per_mtok: number
        }
        Update: {
          cache_read_per_mtok?: number
          cache_write_per_mtok?: number
          effective_from?: string
          input_per_mtok?: number
          model?: string
          note?: string | null
          output_per_mtok?: number
        }
        Relationships: []
      }
      mood_logs: {
        Row: {
          created_at: string
          emoji: string
          enc_version: number
          id: string
          local_date: string
          note_enc: string | null
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          enc_version?: number
          id?: string
          local_date: string
          note_enc?: string | null
          timezone: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          enc_version?: number
          id?: string
          local_date?: string
          note_enc?: string | null
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_weekly_insights: {
        Row: {
          created_at: string
          id: string
          insight_text: string
          signal_meta: Json | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          insight_text: string
          signal_meta?: Json | null
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          insight_text?: string
          signal_meta?: Json | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          cycle_end: string | null
          cycle_start: string
          deleted_at: string | null
          deletion_reason: string | null
          deletion_requested_by: string | null
          deletion_scheduled_for: string | null
          email_insights_opt_in: boolean
          email_opt_in: boolean
          email_reminders_opt_in: boolean
          email_sequence_status: string
          email_sequence_step: number
          email_weekly_insight_opt_in: boolean
          enc_version: number
          encryption_secret: string
          first_name: string | null
          first_session_at: string | null
          flight_recorder_enabled: boolean
          full_name: string
          id: string
          is_admin: boolean
          is_disabled: boolean
          journal_storage_bytes_allowed: number
          journal_storage_bytes_used: number
          language: string
          last_active_at: string | null
          last_email_sent_at: string | null
          last_email_type: string | null
          last_name: string | null
          lifecycle_started_at: string | null
          onboarding_v2_completed: boolean
          plan_key: string
          preferred_name: string | null
          sessions_count: number
          signup_at: string | null
          sound_enabled: boolean
          sound_journal_saved_enabled: boolean
          sound_journal_suggestion_enabled: boolean
          sound_response_enabled: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_for?: string | null
          email_insights_opt_in?: boolean
          email_opt_in?: boolean
          email_reminders_opt_in?: boolean
          email_sequence_status?: string
          email_sequence_step?: number
          email_weekly_insight_opt_in?: boolean
          enc_version?: number
          encryption_secret: string
          first_name?: string | null
          first_session_at?: string | null
          flight_recorder_enabled?: boolean
          full_name?: string
          id: string
          is_admin?: boolean
          is_disabled?: boolean
          journal_storage_bytes_allowed?: number
          journal_storage_bytes_used?: number
          language?: string
          last_active_at?: string | null
          last_email_sent_at?: string | null
          last_email_type?: string | null
          last_name?: string | null
          lifecycle_started_at?: string | null
          onboarding_v2_completed?: boolean
          plan_key?: string
          preferred_name?: string | null
          sessions_count?: number
          signup_at?: string | null
          sound_enabled?: boolean
          sound_journal_saved_enabled?: boolean
          sound_journal_suggestion_enabled?: boolean
          sound_response_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string
          deleted_at?: string | null
          deletion_reason?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_for?: string | null
          email_insights_opt_in?: boolean
          email_opt_in?: boolean
          email_reminders_opt_in?: boolean
          email_sequence_status?: string
          email_sequence_step?: number
          email_weekly_insight_opt_in?: boolean
          enc_version?: number
          encryption_secret?: string
          first_name?: string | null
          first_session_at?: string | null
          flight_recorder_enabled?: boolean
          full_name?: string
          id?: string
          is_admin?: boolean
          is_disabled?: boolean
          journal_storage_bytes_allowed?: number
          journal_storage_bytes_used?: number
          language?: string
          last_active_at?: string | null
          last_email_sent_at?: string | null
          last_email_type?: string | null
          last_name?: string | null
          lifecycle_started_at?: string | null
          onboarding_v2_completed?: boolean
          plan_key?: string
          preferred_name?: string | null
          sessions_count?: number
          signup_at?: string | null
          sound_enabled?: boolean
          sound_journal_saved_enabled?: boolean
          sound_journal_suggestion_enabled?: boolean
          sound_response_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      sim_run_items: {
        Row: {
          completion_tokens: number
          cost_usd: number
          created_at: string
          error: string | null
          id: string
          language: string
          persona_label: string
          prompt_tokens: number
          run_id: string
          scenario_id: string
          total_latency_ms: number
          total_tokens: number
          turn_details: Json
          turns_count: number
          type: string
        }
        Insert: {
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          error?: string | null
          id?: string
          language?: string
          persona_label?: string
          prompt_tokens?: number
          run_id: string
          scenario_id: string
          total_latency_ms?: number
          total_tokens?: number
          turn_details?: Json
          turns_count?: number
          type: string
        }
        Update: {
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          error?: string | null
          id?: string
          language?: string
          persona_label?: string
          prompt_tokens?: number
          run_id?: string
          scenario_id?: string
          total_latency_ms?: number
          total_tokens?: number
          turn_details?: Json
          turns_count?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sim_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_runs: {
        Row: {
          admin_user_id: string
          config: Json
          created_at: string
          id: string
          status: string
          summary: Json | null
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          config?: Json
          created_at?: string
          id?: string
          status?: string
          summary?: Json | null
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          config?: Json
          created_at?: string
          id?: string
          status?: string
          summary?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          action_text: string
          active: boolean
          created_at: string
          duration_minutes: number
          id: string
          reflection_prompt: string | null
          theme: string
        }
        Insert: {
          action_text: string
          active?: boolean
          created_at?: string
          duration_minutes?: number
          id?: string
          reflection_prompt?: string | null
          theme: string
        }
        Update: {
          action_text?: string
          active?: boolean
          created_at?: string
          duration_minutes?: number
          id?: string
          reflection_prompt?: string | null
          theme?: string
        }
        Relationships: []
      }
      token_plan_limits: {
        Row: {
          daily_token_limit: number
          monthly_token_limit: number
          plan_key: string
          updated_at: string
        }
        Insert: {
          daily_token_limit?: number
          monthly_token_limit?: number
          plan_key: string
          updated_at?: string
        }
        Update: {
          daily_token_limit?: number
          monthly_token_limit?: number
          plan_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          cache_read_tokens: number
          cache_write_tokens: number
          completion_tokens: number
          created_at: string
          id: string
          metadata: Json | null
          model: string
          operation: string
          prompt_tokens: number
          thread_id: string | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          completion_tokens?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          model: string
          operation: string
          prompt_tokens?: number
          thread_id?: string | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          completion_tokens?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          model?: string
          operation?: string
          prompt_tokens?: number
          thread_id?: string | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage_daily_rollup: {
        Row: {
          cache_read_tokens: number
          cache_write_tokens: number
          calls: number
          completion_tokens: number
          cost_usd: number
          model: string
          operation: string
          prompt_tokens: number
          rollup_day: string
          total_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          calls?: number
          completion_tokens?: number
          cost_usd?: number
          model: string
          operation: string
          prompt_tokens?: number
          rollup_day: string
          total_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          calls?: number
          completion_tokens?: number
          cost_usd?: number
          model?: string
          operation?: string
          prompt_tokens?: number
          rollup_day?: string
          total_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_daily_tasks: {
        Row: {
          assigned_date: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_date: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_date?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory: {
        Row: {
          created_at: string
          enc_version: number
          id: string
          key: string
          last_confirmed_at: string
          source: string
          user_id: string
          value_enc: string
        }
        Insert: {
          created_at?: string
          enc_version?: number
          id?: string
          key: string
          last_confirmed_at?: string
          source?: string
          user_id: string
          value_enc: string
        }
        Update: {
          created_at?: string
          enc_version?: number
          id?: string
          key?: string
          last_confirmed_at?: string
          source?: string
          user_id?: string
          value_enc?: string
        }
        Relationships: []
      }
    }
    Views: {
      analytics_raw_excel: {
        Row: {
          costo_usd: number | null
          fecha: string | null
          in_tokens: number | null
          modelo: string | null
          operacion: string | null
          out_tokens: number | null
          plan: string | null
          total_tokens: number | null
          user_id: string | null
          usuario: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_backfill_activity: {
        Args: { p_user_id?: string }
        Returns: {
          first_session_at: string
          last_active_at: string
          sessions_count: number
          user_id: string
        }[]
      }
      admin_clear_flight_recorder_events: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
      admin_cost_per_cycle: {
        Args: never
        Returns: {
          calls: number
          completion_tokens: number
          cost_usd: number
          cycle_start: string
          plan_key: string
          prompt_tokens: number
          total_tokens: number
          user_id: string
          user_label: string
        }[]
      }
      admin_engagement_bounds: {
        Args: never
        Returns: {
          min_date: string
        }[]
      }
      admin_engagement_daily: {
        Args: { p_from_date: string; p_to_date: string; p_user_id?: string }
        Returns: {
          chats: number
          day: string
          diario: number
        }[]
      }
      admin_engagement_report: {
        Args: { p_from_date: string; p_to_date: string; p_user_id?: string }
        Returns: {
          chats: number
          cost_usd: number
          diario: number
          email: string
          name: string
          user_id: string
        }[]
      }
      admin_fetch_flight_events: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          app_area: string
          created_at: string
          event_name: string
          id: string
          payload: Json
          session_id: string
          user_id: string
        }[]
      }
      admin_get_token_plan_limits: {
        Args: never
        Returns: {
          daily_token_limit: number
          journal_storage_bytes: number
          monthly_token_limit: number
          plan_key: string
          updated_at: string
        }[]
      }
      admin_insert_profile: {
        Args: { p_full_name?: string; p_user_id: string }
        Returns: undefined
      }
      admin_list_crisis_events: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_severity?: string
          p_source?: string
          p_user_id?: string
        }
        Returns: {
          created_at: string
          id: string
          message_id: string
          meta: Json
          model: string
          session_id: string
          severity: string
          source: string
          thread_id: string
          user_id: string
          user_label: string
        }[]
      }
      admin_list_flight_recorder_users: {
        Args: never
        Returns: {
          email: string
          event_count: number
          flight_recorder_enabled: boolean
          full_name: string
          latest_event_at: string
          user_id: string
        }[]
      }
      admin_list_lifecycle_events: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          email: string
          email_type: string
          id: string
          metadata: Json
          resend_message_id: string
          sent_at: string
          status: string
          user_id: string
        }[]
      }
      admin_list_lifecycle_users: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          email: string
          email_opt_in: boolean
          email_sequence_status: string
          email_sequence_step: number
          emails_sent: number
          last_email_sent_at: string
          last_email_type: string
          lifecycle_started_at: string
          sessions_count: number
          signup_at: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: { p_include_deleted?: boolean; p_search?: string }
        Returns: {
          chat_model_override: string
          created_at: string
          deleted_at: string
          email: string
          first_name: string
          flight_recorder_enabled: boolean
          full_name: string
          id: string
          is_admin_user: boolean
          is_disabled: boolean
          last_name: string
          plan_key: string
        }[]
      }
      admin_list_users_with_usage: {
        Args: never
        Returns: {
          user_id: string
          user_label: string
        }[]
      }
      admin_purge_user_data: { Args: { p_user_id: string }; Returns: undefined }
      admin_reconcile_journal_storage: {
        Args: { p_user_id?: string }
        Returns: {
          entries_fixed: number
          users_updated: number
        }[]
      }
      admin_reset_token_usage: { Args: { p_user_id: string }; Returns: Json }
      admin_reset_user_data: { Args: { p_user_id: string }; Returns: Json }
      admin_set_chat_model: {
        Args: { p_model: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_flight_recorder: {
        Args: { p_enabled: boolean; p_target_user_id: string }
        Returns: undefined
      }
      admin_soft_delete_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_token_cost_report: {
        Args: { p_from: string; p_group_by?: string; p_to: string }
        Returns: {
          calls: number
          cost_usd: number
          group_label: string
          total_tokens: number
        }[]
      }
      admin_token_usage_by_model: {
        Args: { p_date_from: string; p_date_until: string; p_user_id?: string }
        Returns: {
          cache_read_tokens: number
          cache_write_tokens: number
          calls: number
          completion_tokens: number
          cost_usd: number
          model: string
          prompt_tokens: number
          total_tokens: number
        }[]
      }
      admin_token_usage_report: {
        Args: { p_date_from: string; p_date_until: string; p_user_id?: string }
        Returns: {
          completion_tokens: number
          out_user_id: string
          prompt_tokens: number
          total_cost_usd: number
          total_tokens: number
          usage_date: string
          user_label: string
        }[]
      }
      admin_token_usage_sessions: {
        Args: { p_date_from: string; p_date_until: string; p_user_id?: string }
        Returns: {
          cache_read_tokens: number
          cache_write_tokens: number
          cfg_history_cap: boolean
          cfg_history_messages: number
          cfg_max_tokens: number
          cfg_model: string
          completion_tokens: number
          cost_if_sonnet: number
          cost_usd: number
          created_at_local: string
          model: string
          operation: string
          prompt_tokens: number
          saving_pct: number
          thread_id: string
          thread_title: string
          total_tokens: number
          usage_id: string
          user_email: string
        }[]
      }
      admin_top_users_by_cost: {
        Args: { p_from: string; p_limit?: number; p_to: string }
        Returns: {
          calls: number
          cost_usd: number
          total_tokens: number
          user_label: string
        }[]
      }
      admin_update_token_plan_limits: {
        Args: { p_daily: number; p_monthly: number; p_plan_key: string }
        Returns: {
          daily_token_limit: number
          journal_storage_bytes: number
          monthly_token_limit: number
          plan_key: string
          updated_at: string
        }[]
      }
      admin_upsert_user_profile: {
        Args: {
          p_first_name?: string
          p_is_disabled?: boolean
          p_last_name?: string
          p_plan_key?: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_user_cycle_summary: {
        Args: never
        Returns: {
          cycle_cost_usd: number
          cycle_end: string
          cycle_start: string
          cycle_tokens_limit: number
          cycle_tokens_used: number
          daily_tokens_limit: number
          daily_tokens_used: number
          email: string
          plan_key: string
          signup_date: string
          user_id: string
        }[]
      }
      apply_journal_storage_limit: {
        Args: { p_user_id: string }
        Returns: {
          allowed: number
          tier: string
          used: number
        }[]
      }
      calc_token_cost: {
        Args: {
          p_cache_read_tokens?: number
          p_cache_write_tokens?: number
          p_completion_tokens: number
          p_model: string
          p_on?: string
          p_prompt_tokens: number
        }
        Returns: number
      }
      check_token_budget: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          daily_limit: number
          daily_used: number
          monthly_limit: number
          monthly_used: number
          reason: string
        }[]
      }
      check_user_data_remnants: {
        Args: { p_user_id: string }
        Returns: {
          rows_found: number
          source_column: string
          source_table: string
        }[]
      }
      cron_generate_weekly_insights: { Args: never; Returns: Json }
      cron_purge_crisis_events: { Args: never; Returns: Json }
      cron_rolling_insight_trigger: { Args: never; Returns: Json }
      cron_rollup_token_usage: { Args: never; Returns: Json }
      get_ai_settings: { Args: never; Returns: Json }
      get_my_email: { Args: never; Returns: string }
      get_my_usage_summary: { Args: never; Returns: Json }
      get_users_needing_rolling_insight: {
        Args: never
        Returns: {
          rolling_week_start: string
          user_id: string
        }[]
      }
      get_users_needing_weekly_insight: {
        Args: { p_week_end: string; p_week_start: string }
        Returns: {
          user_id: string
        }[]
      }
      is_admin:
        | { Args: { p_email: string; p_uid: string }; Returns: boolean }
        | { Args: { uid?: string }; Returns: boolean }
      journal_storage_bytes_for_plan: {
        Args: { p_plan_key: string }
        Returns: number
      }
      purge_old_crisis_events: {
        Args: never
        Returns: {
          deleted_count: number
        }[]
      }
      release_journal_storage: {
        Args: { p_bytes_to_subtract: number; p_user_id: string }
        Returns: undefined
      }
      reserve_journal_storage: {
        Args: { p_bytes_to_add: number; p_user_id: string }
        Returns: Json
      }
      rollup_token_usage_for_day: {
        Args: { p_day: string }
        Returns: undefined
      }
      rollup_token_usage_missing_days: {
        Args: { p_days_back?: number }
        Returns: {
          processed_day: string
          raw_rows: number
        }[]
      }
      rollup_token_usage_range: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      touch_user_activity: { Args: { p_at?: string }; Returns: Json }
      upsert_chat_signal_daily_agg: {
        Args: {
          p_message_count: number
          p_score: number
          p_signal_date: string
          p_signal_type: string
        }
        Returns: undefined
      }
      upsert_chat_signal_daily_agg_internal: {
        Args: {
          p_message_count: number
          p_score: number
          p_signal_date: string
          p_signal_type: string
          p_source?: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const