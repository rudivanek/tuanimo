import { describe, it, expect } from 'vitest';
import { heuristicDetect, isCrisisMessage } from './heuristicDetect';

describe('heuristicDetect — keyword mapping', () => {
  it('detects anxiety from "ansioso"', () => {
    const r = heuristicDetect('Me siento muy ansioso últimamente.');
    expect(r.mood).toBe('anxiety');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.valence).toBeLessThan(0);
  });

  it('detects anxiety from "no puedo" and "miedo"', () => {
    const r = heuristicDetect('No puedo dormir, tengo miedo de lo que viene.');
    expect(r.mood).toBe('anxiety');
  });

  it('detects sadness from "triste" and "llorar"', () => {
    const r = heuristicDetect('Estoy muy triste y quiero llorar todo el día.');
    expect(r.mood).toBe('sadness');
    expect(r.valence).toBeLessThan(0);
  });

  it('detects sadness from "me duele" and "vacío"', () => {
    const r = heuristicDetect('Me duele el corazón, me siento vacía por dentro.');
    expect(r.mood).toBe('sadness');
  });

  it('detects joy from "feliz" and "emocionado"', () => {
    const r = heuristicDetect('¡Estoy tan feliz y emocionado por lo que pasó!');
    expect(r.mood).toBe('joy');
    expect(r.valence).toBeGreaterThan(0);
  });

  it('detects joy from "qué bonito"', () => {
    const r = heuristicDetect('Hoy fue un día increíble, qué bonito lo que viví.');
    expect(r.mood).toBe('joy');
  });

  it('detects anger from "enojado" and "rabia"', () => {
    const r = heuristicDetect('Estoy enojado y siento una rabia enorme por lo que hizo.');
    expect(r.mood).toBe('anger');
    expect(r.arousal).toBeGreaterThan(0.5);
  });

  it('detects anger from "furioso" and "harto"', () => {
    const r = heuristicDetect('Estoy furioso y harto de que siempre pase lo mismo.');
    expect(r.mood).toBe('anger');
  });

  it('detects loneliness from "me siento aislado" and "nadie me"', () => {
    const r = heuristicDetect('Me siento aislado y nadie me entiende realmente.');
    expect(r.mood).toBe('loneliness');
    expect(r.valence).toBeLessThan(0);
  });

  it('detects overwhelm from "abrumado" and "demasiado"', () => {
    const r = heuristicDetect('Hay demasiado encima, me siento completamente abrumado.');
    expect(r.mood).toBe('overwhelm');
  });

  it('detects overwhelm from "no puedo más"', () => {
    const r = heuristicDetect('No puedo más, no doy abasto con todo esto.');
    expect(r.mood).toBe('overwhelm');
  });

  it('returns neutral when no keywords match', () => {
    const r = heuristicDetect('Hoy fui al supermercado y compré pan.');
    expect(r.mood).toBe('neutral');
    expect(r.confidence).toBeLessThanOrEqual(0.2);
  });

  it('respects negations: "no estoy triste" should not score sadness high', () => {
    const r = heuristicDetect('No estoy triste en lo absoluto, todo está bien.');
    expect(r.mood).not.toBe('sadness');
  });

  it('boosts arousal with exclamation marks', () => {
    const base = heuristicDetect('Estoy enojado.');
    const boosted = heuristicDetect('Estoy enojado!!!!');
    expect(boosted.arousal).toBeGreaterThanOrEqual(base.arousal);
  });

  it('returns reasons array with matched keywords', () => {
    const r = heuristicDetect('Me siento ansioso y angustiado.');
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons[0]).toBeTruthy();
  });
});

describe('isCrisisMessage', () => {
  it('detects "me quiero matar"', () => {
    expect(isCrisisMessage('Estoy tan mal, me quiero matar.')).toBe(true);
  });

  it('detects "no quiero vivir"', () => {
    expect(isCrisisMessage('Ya no quiero vivir así.')).toBe(true);
  });

  it('detects "quiero morir"', () => {
    expect(isCrisisMessage('A veces siento que quiero morir.')).toBe(true);
  });

  it('does not flag normal emotional messages', () => {
    expect(isCrisisMessage('Me siento muy triste hoy.')).toBe(false);
    expect(isCrisisMessage('Estoy enojado con mi familia.')).toBe(false);
  });
});
