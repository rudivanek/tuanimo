import { describe, it, expect } from 'vitest';
import { buildAdaptiveChips, getChipInsertText } from './adaptiveChips';
import { chipCopyByMood } from './chipCopyByMood';
import type { MoodState } from '../../types/mood';
import type { MoodKey } from '../../types/mood';

function makeMood(overrides: Partial<MoodState> = {}): MoodState {
  return {
    mood: 'neutral',
    valence: 0,
    arousal: 0.5,
    confidence: 0.8,
    reasons: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildAdaptiveChips — selection rules', () => {
  it('returns 1–4 chips for any mood', () => {
    const moods: MoodKey[] = [
      'joy', 'calm', 'sadness', 'anxiety', 'anger', 'stress',
      'loneliness', 'overwhelm', 'uncertainty', 'neutral',
    ];
    for (const mood of moods) {
      const chips = buildAdaptiveChips(makeMood({ mood }), 4);
      expect(chips.length).toBeGreaterThan(0);
      expect(chips.length).toBeLessThanOrEqual(4);
    }
  });

  it('returns small_next_step for anxiety', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'anxiety', arousal: 0.8 }), 4);
    const keys = chips.map(c => c.intentKey);
    expect(keys).toContain('small_next_step');
  });

  it('returns body_signal for high-arousal anxiety', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'anxiety', arousal: 0.85 }), 4);
    const keys = chips.map(c => c.intentKey);
    expect(keys).toContain('body_signal');
  });

  it('returns gratitude for joy', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'joy', valence: 0.8 }), 4);
    const keys = chips.map(c => c.intentKey);
    expect(keys).toContain('gratitude');
  });

  it('returns values for joy with high valence', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'joy', valence: 0.9 }), 4);
    const keys = chips.map(c => c.intentKey);
    expect(keys).toContain('values');
  });

  it('returns boundary for anger', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'anger', arousal: 0.8 }), 4);
    const keys = chips.map(c => c.intentKey);
    expect(keys).toContain('boundary');
  });

  it('returns support_request for sadness', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'sadness' }), 4);
    const keys = chips.map(c => c.intentKey);
    expect(keys).toContain('support_request');
  });

  it('returns support_request or relationship_checkin for loneliness', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'loneliness' }), 4);
    const keys = chips.map(c => c.intentKey);
    expect(keys.some(k => k === 'support_request' || k === 'relationship_checkin')).toBe(true);
  });

  it('returns crisis chips for crisis mood state', () => {
    const crisisMood = makeMood({
      mood: 'overwhelm', valence: -1, arousal: 1, reasons: ['crisis'],
    });
    const chips = buildAdaptiveChips(crisisMood, 3);
    const keys = chips.map(c => c.intentKey);
    expect(keys).toContain('support_request');
    expect(keys).toContain('explore_feeling');
    expect(keys).toContain('small_next_step');
  });

  it('each chip has a non-empty label', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'stress' }), 4);
    for (const chip of chips) {
      expect(chip.label.length).toBeGreaterThan(0);
    }
  });

  it('each chip has a unique id', () => {
    const chips = buildAdaptiveChips(makeMood({ mood: 'uncertainty' }), 4);
    const ids = chips.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getChipInsertText — first-person enforcement', () => {
  const SECOND_PERSON_PREFIXES = [
    'cuéntame', 'cuéntanos', 'pláticame', 'platicame',
    'comparte', 'dime', 'háblame', 'háblanos',
    'describe', 'explícame', 'explícanos',
  ];

  it('returns non-empty insert text for all moods × intents in chipCopyByMood', () => {
    for (const [_mood, intentMap] of Object.entries(chipCopyByMood)) {
      for (const [_intentKey, variants] of Object.entries(intentMap ?? {})) {
        for (const variant of variants ?? []) {
          expect(variant.length).toBeGreaterThan(0);
          const lower = variant.toLowerCase();
          for (const prefix of SECOND_PERSON_PREFIXES) {
            expect(lower.startsWith(prefix)).toBe(false);
          }
        }
      }
    }
  });

  it('crisis insert text starts with "Quiero" or "Quiero dar"', () => {
    const crisisMood: MoodState = {
      mood: 'overwhelm', valence: -1, arousal: 1, confidence: 1,
      reasons: ['crisis'], updatedAt: new Date().toISOString(),
    };
    const chips = buildAdaptiveChips(crisisMood, 3);
    for (const chip of chips) {
      const text = getChipInsertText(chip, crisisMood);
      expect(text.length).toBeGreaterThan(0);
      expect(text).toMatch(/^(Quiero|Me gustaría)/i);
    }
  });

  it('normal mood insert text starts with first-person phrases', () => {
    const FIRST_PERSON_STARTS = [
      'quiero', 'me gustaría', 'siento', 'necesito', 'creo',
    ];
    const moods: MoodKey[] = ['sadness', 'anxiety', 'joy', 'anger', 'stress'];
    for (const mood of moods) {
      const moodState = makeMood({ mood, confidence: 0.9 });
      const chips = buildAdaptiveChips(moodState, 4);
      for (const chip of chips) {
        const text = getChipInsertText(chip, moodState).toLowerCase();
        const startsWithFirstPerson = FIRST_PERSON_STARTS.some(p => text.startsWith(p));
        expect(startsWithFirstPerson, `Expected first-person for ${mood}/${chip.intentKey}: "${text}"`).toBe(true);
      }
    }
  });
});
