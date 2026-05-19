import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import type { SoundType } from '../lib/audio';

export interface SoundSettings {
  soundEnabled: boolean;
  soundResponseEnabled: boolean;
  soundJournalSuggestionEnabled: boolean;
  soundJournalSavedEnabled: boolean;
}

const LS_KEY = 'tu_animo_sound_settings';

const DEFAULTS: SoundSettings = {
  soundEnabled: true,
  soundResponseEnabled: true,
  soundJournalSuggestionEnabled: true,
  soundJournalSavedEnabled: false,
};

function loadFromLS(): SoundSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveToLS(s: SoundSettings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { }
}

export function useSoundSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<SoundSettings>(loadFromLS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('sound_enabled, sound_response_enabled, sound_journal_suggestion_enabled, sound_journal_saved_enabled')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const s: SoundSettings = {
          soundEnabled: data.sound_enabled ?? true,
          soundResponseEnabled: data.sound_response_enabled ?? true,
          soundJournalSuggestionEnabled: data.sound_journal_suggestion_enabled ?? true,
          soundJournalSavedEnabled: data.sound_journal_saved_enabled ?? false,
        };
        setSettings(s);
        saveToLS(s);
      });
  }, [user]);

  const update = useCallback(async (patch: Partial<SoundSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveToLS(next);
    if (!user) return;
    setIsSaving(true);
    try {
      await supabase.from('profiles').update({
        sound_enabled: next.soundEnabled,
        sound_response_enabled: next.soundResponseEnabled,
        sound_journal_suggestion_enabled: next.soundJournalSuggestionEnabled,
        sound_journal_saved_enabled: next.soundJournalSavedEnabled,
      }).eq('id', user.id);
      qc.invalidateQueries({ queryKey: ['profile', user.id] });
    } finally {
      setIsSaving(false);
    }
  }, [settings, user, qc]);

  const canPlay = useCallback((type: SoundType): boolean => {
    if (!settings.soundEnabled) return false;
    if (type === 'response') return settings.soundResponseEnabled;
    if (type === 'journal-suggestion') return settings.soundJournalSuggestionEnabled;
    if (type === 'journal-saved') return settings.soundJournalSavedEnabled;
    return false;
  }, [settings]);

  return { settings, update, isSaving, canPlay };
}
