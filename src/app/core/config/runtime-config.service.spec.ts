import { describe, expect, it } from 'vitest';
import { mapApiBaseUrl } from './runtime-config.service';

describe('mapApiBaseUrl', () => {
  it('maps and normalizes an API URL', () => expect(mapApiBaseUrl({ apiBaseUrl: 'https://api.example.com/' })).toBe('https://api.example.com'));
  it('rejects missing and relative URLs', () => {
    expect(() => mapApiBaseUrl({})).toThrow();
    expect(() => mapApiBaseUrl({ apiBaseUrl: '/api' })).toThrow();
  });
});
