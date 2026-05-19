import { describe, it, expect } from 'vitest';
import { getPreferredGreetingName, getWelcomeMessage } from './welcomeMessages';

describe('getPreferredGreetingName', () => {
  it('returns first_name when present', () => {
    expect(getPreferredGreetingName({ first_name: 'Ana', full_name: 'Ana García' })).toBe('Ana');
  });

  it('trims whitespace from first_name', () => {
    expect(getPreferredGreetingName({ first_name: '  Lucia  ', full_name: null })).toBe('Lucia');
  });

  it('falls back to first token of full_name when first_name is null', () => {
    expect(getPreferredGreetingName({ first_name: null, full_name: 'María López' })).toBe('María');
  });

  it('falls back to first token of full_name when first_name is empty string', () => {
    expect(getPreferredGreetingName({ first_name: '', full_name: 'Carlos Ruiz' })).toBe('Carlos');
  });

  it('returns single token when full_name has no spaces', () => {
    expect(getPreferredGreetingName({ first_name: null, full_name: 'Pedro' })).toBe('Pedro');
  });

  it('handles extra whitespace in full_name', () => {
    expect(getPreferredGreetingName({ first_name: null, full_name: '  Sofía   Torres  ' })).toBe('Sofía');
  });

  it('returns null when both first_name and full_name are null', () => {
    expect(getPreferredGreetingName({ first_name: null, full_name: null })).toBeNull();
  });

  it('returns null when both are empty strings', () => {
    expect(getPreferredGreetingName({ first_name: '', full_name: '' })).toBeNull();
  });

  it('returns null when full_name is only whitespace', () => {
    expect(getPreferredGreetingName({ first_name: null, full_name: '   ' })).toBeNull();
  });
});

describe('getWelcomeMessage personalization', () => {
  it('inserts the name into "Hola, soy Elena" greetings', () => {
    const result = getWelcomeMessage('calm', { first_name: 'Ana', full_name: null });
    expect(result.text).toMatch(/Hola Ana,/);
  });

  it('inserts the name into "¡Hola! Soy Elena" greetings', () => {
    const result = getWelcomeMessage('energetic', { first_name: 'Javier', full_name: null });
    expect(result.text).toMatch(/¡Hola Javier!|Hola Javier,/);
  });

  it('inserts the name into "Holaa, soy Elena" greetings', () => {
    const result = getWelcomeMessage('youthful', { first_name: 'Mia', full_name: null });
    expect(result.text).toMatch(/Holaa? Mia,|Hola Mia,/);
  });

  it('returns unmodified greeting when profile is null', () => {
    const result = getWelcomeMessage('calm', null);
    expect(result.text).not.toMatch(/Hola \w+,/);
    expect(result.text).toMatch(/^Hola,/);
  });

  it('returns unmodified greeting when no name is available', () => {
    const result = getWelcomeMessage('mature', { first_name: null, full_name: null });
    expect(result.text).toMatch(/^Hola, soy Elena/);
  });

  it('falls back to full_name first token when first_name is absent', () => {
    const result = getWelcomeMessage('reflective', { first_name: null, full_name: 'Rosa Díaz' });
    expect(result.text).toMatch(/Hola Rosa,/);
  });
});
