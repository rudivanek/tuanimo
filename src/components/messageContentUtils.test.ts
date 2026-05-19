/**
 * Unit tests for messageContentUtils.
 *
 * Test checklist:
 * - trimTrailingPunct strips trailing . , ; : ) ] } ! ? … "
 * - isSafeUrl: accepts https, rejects http / dangerous schemes / whitespace
 * - isSuspicious: flags IPv4, IPv6, xn--, length > 300
 * - parseText: produces correct segments for trailing punct, newlines, safe links,
 *   unsafe schemes, IP hosts, xn-- hosts, very long URLs
 *
 * Run with: npx vitest src/components/messageContentUtils.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  trimTrailingPunct,
  isSafeUrl,
  isSuspicious,
  parseText,
} from './messageContentUtils';

describe('trimTrailingPunct', () => {
  it('strips a trailing period', () => {
    expect(trimTrailingPunct('https://example.com.')).toEqual({
      clean: 'https://example.com',
      suffix: '.',
    });
  });

  it('strips multiple trailing chars (comma + period)', () => {
    expect(trimTrailingPunct('https://example.com,.')).toEqual({
      clean: 'https://example.com',
      suffix: ',.',
    });
  });

  it('strips trailing closing paren', () => {
    expect(trimTrailingPunct('https://example.com)')).toEqual({
      clean: 'https://example.com',
      suffix: ')',
    });
  });

  it('strips trailing semicolon', () => {
    expect(trimTrailingPunct('https://example.com;')).toEqual({
      clean: 'https://example.com',
      suffix: ';',
    });
  });

  it('strips trailing ellipsis character', () => {
    expect(trimTrailingPunct('https://example.com…')).toEqual({
      clean: 'https://example.com',
      suffix: '…',
    });
  });

  it('does not strip mid-URL dots (e.g. domain)', () => {
    const r = trimTrailingPunct('https://example.com/path');
    expect(r.clean).toBe('https://example.com/path');
    expect(r.suffix).toBe('');
  });

  it('does not strip parens that are part of the URL path', () => {
    const r = trimTrailingPunct('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(r.clean).toBe('https://en.wikipedia.org/wiki/Foo_(bar');
    expect(r.suffix).toBe(')');
  });
});

describe('isSafeUrl', () => {
  it('accepts a well-formed https URL', () => {
    expect(isSafeUrl('https://www.example.com')).toBe(true);
  });

  it('rejects http (non-https)', () => {
    expect(isSafeUrl('http://example.com')).toBe(false);
  });

  it('rejects javascript: scheme', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: scheme', () => {
    expect(isSafeUrl('data:text/html,<h1>x</h1>')).toBe(false);
  });

  it('rejects file: scheme', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects vbscript: scheme', () => {
    expect(isSafeUrl('vbscript:MsgBox(1)')).toBe(false);
  });

  it('rejects URL containing embedded javascript:', () => {
    expect(isSafeUrl('https://example.com/path?u=javascript:void(0)')).toBe(false);
  });

  it('rejects URL with internal whitespace', () => {
    expect(isSafeUrl('https://exam ple.com')).toBe(false);
  });
});

describe('isSuspicious', () => {
  it('flags IPv4 host', () => {
    expect(isSuspicious('https://192.168.1.1/path')).toBe(true);
  });

  it('flags IPv6 host (bracket notation)', () => {
    expect(isSuspicious('https://[::1]/path')).toBe(true);
  });

  it('flags IDN punycode host (xn--)', () => {
    expect(isSuspicious('https://xn--n3h.ws/page')).toBe(true);
  });

  it('flags subdomain with xn-- segment', () => {
    expect(isSuspicious('https://sub.xn--nxasmq6b.com/')).toBe(true);
  });

  it('flags URL longer than 300 characters', () => {
    const url = 'https://example.com/' + 'a'.repeat(290);
    expect(url.length).toBeGreaterThan(300);
    expect(isSuspicious(url)).toBe(true);
  });

  it('does not flag a normal https URL', () => {
    expect(isSuspicious('https://www.museumwien.at')).toBe(false);
  });

  it('does not flag a URL exactly 300 chars long', () => {
    const url = 'https://example.com/' + 'a'.repeat(280);
    expect(url.length).toBe(300);
    expect(isSuspicious(url)).toBe(false);
  });
});

describe('parseText', () => {
  it('returns a single text segment for plain text', () => {
    const segs = parseText('Hello world');
    expect(segs).toEqual([{ kind: 'text', text: 'Hello world' }]);
  });

  it('parses a bare https URL into a link segment', () => {
    const segs = parseText('https://example.com');
    expect(segs).toEqual([{ kind: 'link', url: 'https://example.com' }]);
  });

  it('splits text before and after a URL', () => {
    const segs = parseText('Visit https://example.com today');
    expect(segs[0]).toEqual({ kind: 'text', text: 'Visit ' });
    expect(segs[1]).toEqual({ kind: 'link', url: 'https://example.com' });
    expect(segs[2]).toEqual({ kind: 'text', text: ' today' });
  });

  it('strips trailing period from URL and keeps it as text', () => {
    const segs = parseText('See https://example.com.');
    expect(segs).toContainEqual({ kind: 'link', url: 'https://example.com' });
    expect(segs).toContainEqual({ kind: 'text', text: '.' });
  });

  it('strips trailing closing paren from URL', () => {
    const segs = parseText('(https://example.com)');
    expect(segs).toContainEqual({ kind: 'link', url: 'https://example.com' });
    expect(segs).toContainEqual({ kind: 'text', text: ')' });
  });

  it('emits br segments for newlines', () => {
    const segs = parseText('line1\nline2');
    expect(segs[0]).toEqual({ kind: 'text', text: 'line1' });
    expect(segs[1]).toEqual({ kind: 'br' });
    expect(segs[2]).toEqual({ kind: 'text', text: 'line2' });
  });

  it('places br between lines even when a line is a URL', () => {
    const segs = parseText('Check this:\nhttps://example.com\nDone.');
    expect(segs[0]).toEqual({ kind: 'text', text: 'Check this:' });
    expect(segs[1]).toEqual({ kind: 'br' });
    expect(segs[2]).toEqual({ kind: 'link', url: 'https://example.com' });
    expect(segs[3]).toEqual({ kind: 'br' });
    expect(segs[4]).toEqual({ kind: 'text', text: 'Done.' });
  });

  it('renders javascript: scheme as plain text (not matched by regex)', () => {
    const segs = parseText('javascript:alert(1)');
    expect(segs).toEqual([{ kind: 'text', text: 'javascript:alert(1)' }]);
    expect(segs.some(s => s.kind === 'link')).toBe(false);
  });

  it('renders file:// as plain text (not matched by regex)', () => {
    const segs = parseText('file:///etc/passwd');
    expect(segs.some(s => s.kind === 'link')).toBe(false);
  });

  it('renders IPv4 URL as suspicious (not a link)', () => {
    const segs = parseText('https://192.168.1.1/admin');
    expect(segs.some(s => s.kind === 'link')).toBe(false);
    expect(segs.some(s => s.kind === 'suspicious')).toBe(true);
  });

  it('renders IPv6 URL as suspicious (not a link)', () => {
    const segs = parseText('https://[::1]/secret');
    expect(segs.some(s => s.kind === 'link')).toBe(false);
    expect(segs.some(s => s.kind === 'suspicious')).toBe(true);
  });

  it('renders xn-- URL as suspicious (not a link)', () => {
    const segs = parseText('https://xn--n3h.ws');
    expect(segs.some(s => s.kind === 'link')).toBe(false);
    expect(segs.some(s => s.kind === 'suspicious')).toBe(true);
  });

  it('renders overly long URL as suspicious (not a link)', () => {
    const url = 'https://example.com/' + 'x'.repeat(290);
    const segs = parseText(url);
    expect(segs.some(s => s.kind === 'link')).toBe(false);
    expect(segs.some(s => s.kind === 'suspicious')).toBe(true);
  });

  it('handles multiple URLs on the same line', () => {
    const segs = parseText('A: https://a.com B: https://b.com');
    const links = segs.filter(s => s.kind === 'link');
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ kind: 'link', url: 'https://a.com' });
    expect(links[1]).toEqual({ kind: 'link', url: 'https://b.com' });
  });

  it('handles empty string', () => {
    const segs = parseText('');
    expect(segs).toEqual([]);
  });
});
