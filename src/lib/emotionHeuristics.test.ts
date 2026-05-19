import { describe, it, expect } from 'vitest';
import { evaluateDiarySuggestion } from './emotionHeuristics';

const FIXTURE_HEAVY = [
  'Hoy tuve un ataque de pánico en el trabajo, no podía respirar.',
  'Mi jefe me presionó mucho y me sentí abrumada todo el día.',
  'Llegué a casa llorando, estoy agotada y no sé cuánto más aguanto.',
  'Cada vez que pienso en mañana me da más ansiedad.',
  'Me siento perdida, no sé qué hacer con mi vida.',
];

const FIXTURE_REPETITION = [
  'Sigo pensando en el trabajo y en cómo el trabajo me agota.',
  'El trabajo me tiene estresado todo el día.',
  'No puedo dejar de preocuparme por el trabajo.',
  'Hoy de nuevo el trabajo me quitó las ganas de todo.',
];

const FIXTURE_INSUFFICIENT = [
  'Hoy fue un día normal.',
  'Comí pizza.',
];

const FIXTURE_ENGLISH_HEAVY = [
  'I had a panic attack at the office and felt completely overwhelmed.',
  'I have been crying every night this week, feeling so hopeless.',
  'The anxiety never stops, I feel exhausted and helpless.',
  'I am scared of what tomorrow will bring.',
];

describe('evaluateDiarySuggestion', () => {
  it('suggests when heaviness >= 3 (spanish heavy fixture)', () => {
    const result = evaluateDiarySuggestion(FIXTURE_HEAVY);
    expect(result.shouldSuggest).toBe(true);
    expect(result.heaviness).toBeGreaterThanOrEqual(3);
  });

  it('suggests when repetition >= 3 with heaviness >= 1', () => {
    const result = evaluateDiarySuggestion(FIXTURE_REPETITION);
    expect(result.shouldSuggest).toBe(true);
    expect(result.repetition).toBeGreaterThanOrEqual(3);
    expect(result.heaviness).toBeGreaterThanOrEqual(1);
  });

  it('does not suggest with fewer than 3 messages', () => {
    const result = evaluateDiarySuggestion(FIXTURE_INSUFFICIENT);
    expect(result.shouldSuggest).toBe(false);
    expect(result.reason).toBe('not_enough_messages');
  });

  it('suggests for english heavy transcript', () => {
    const result = evaluateDiarySuggestion(FIXTURE_ENGLISH_HEAVY);
    expect(result.shouldSuggest).toBe(true);
    expect(result.heaviness).toBeGreaterThanOrEqual(3);
  });

  it('does not suggest for emotionally neutral messages', () => {
    const neutral = [
      'I went for a walk today.',
      'Had lunch with a friend.',
      'Watched a movie in the evening.',
      'Planning a trip next weekend.',
    ];
    const result = evaluateDiarySuggestion(neutral);
    expect(result.shouldSuggest).toBe(false);
  });

  it('returns correct shape on every branch', () => {
    for (const msgs of [FIXTURE_HEAVY, FIXTURE_REPETITION, FIXTURE_INSUFFICIENT, FIXTURE_ENGLISH_HEAVY]) {
      const r = evaluateDiarySuggestion(msgs);
      expect(typeof r.shouldSuggest).toBe('boolean');
      expect(typeof r.reason).toBe('string');
      expect(typeof r.heaviness).toBe('number');
      expect(typeof r.repetition).toBe('number');
    }
  });
});
