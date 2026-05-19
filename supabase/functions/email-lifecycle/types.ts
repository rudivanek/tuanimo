export interface LifecycleUser {
  user_id: string;
  email: string;
  first_name: string | null;
  signup_at: string | null;
  lifecycle_started_at: string | null;
  sessions_count: number;
  email_sequence_step: number;
  email_sequence_status: string;
  email_opt_in: boolean;
  last_email_sent_at: string | null;
  last_email_type: string | null;
  last_active_at: string | null;
}

export interface LifecycleEvent {
  user_id: string;
  email_type: string;
  status: "sent" | "failed" | "skipped";
  resend_message_id?: string;
  metadata?: Record<string, unknown>;
}

export type EmailStep = {
  step: number;
  type: string;
  subject: string;
  delayHours: number;
};

export const EMAIL_STEPS: EmailStep[] = [
  { step: 1, type: "day1_empieza_simple",          subject: "Empieza simple",                                 delayHours: 0   },
  { step: 2, type: "day2_dos_minutos",              subject: "2 minutos son suficientes",                      delayHours: 48  },
  { step: 3, type: "day3_mas_cerca",                subject: "Estás más cerca de lo que crees",                delayHours: 72  },
  { step: 4, type: "day4_empieza_interesante",      subject: "Aquí es donde empieza a ponerse interesante",    delayHours: 96  },
  { step: 5, type: "day5_mayoria_se_detiene",       subject: "La mayoría se detiene demasiado pronto",         delayHours: 120 },
];

export const APP_URL = "https://tuanimo.app";
export const MAX_EMAILS_PER_24H = 1;
export const SUPPRESSION_SESSIONS_THRESHOLD = 3;
export const SUPPRESSION_RECENT_ACTIVE_HOURS = 24;
