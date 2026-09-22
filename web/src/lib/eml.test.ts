import { describe, expect, it } from 'vitest';
import { buildEml } from './eml';

describe('buildEml', () => {
  it('produces an unsent, base64 HTML message with folded recipients', () => {
    const eml = buildEml({
      subject: 'Morning note — 22 Aug',
      html: '<p>Hello</p>',
      to: ['a@regis.ph'],
      bcc: ['b@x.com', 'c@y.com'],
    });
    expect(eml.startsWith('X-Unsent: 1\r\n')).toBe(true);
    expect(eml).toMatch(/\r\nTo: a@regis\.ph/);
    expect(eml).toMatch(/\r\nBcc: b@x\.com/);
    expect(eml).toContain('Content-Transfer-Encoding: base64');
    const body = eml.split('\r\n\r\n')[1].replace(/\r\n/g, '');
    expect(Buffer.from(body, 'base64').toString('utf8')).toBe('<p>Hello</p>');
  });

  it('encodes a non-ASCII subject', () => {
    const eml = buildEml({ subject: 'Café', html: '' });
    expect(eml).toMatch(/Subject: =\?utf-8\?/i);
  });
});
