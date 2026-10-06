import { describe, expect, it, vi } from 'vitest';

// form.js imports gsap for its shake animation; the rules don't need it.
vi.mock('gsap', () => ({ gsap: {} }));
const { RULES } = await import('../src/site/ui/form.js');

describe('enquiry form rules', () => {
  it('requires a name of at least two characters', () => {
    expect(RULES.name('A')).not.toBe('');
    expect(RULES.name('  Al  ')).toBe('');
  });

  it('validates email addresses', () => {
    expect(RULES.email('ana@studio.com')).toBe('');
    expect(RULES.email('ana@studio')).not.toBe('');
    expect(RULES.email('ana studio@x.com')).not.toBe('');
  });

  it('treats phone as optional but checks it when given', () => {
    expect(RULES.phone('')).toBe('');
    expect(RULES.phone('+91 98765 43210')).toBe('');
    expect(RULES.phone('call me')).not.toBe('');
  });

  it('requires a project type', () => {
    expect(RULES.type('')).not.toBe('');
    expect(RULES.type('villa')).toBe('');
  });

  it('requires a message of at least 12 characters', () => {
    expect(RULES.message('Too short')).not.toBe('');
    expect(RULES.message('A three-storey extension')).toBe('');
  });
});
