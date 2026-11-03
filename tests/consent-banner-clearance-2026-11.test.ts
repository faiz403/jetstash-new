import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Consent panel clearance (November 2026). The first-visit panel is fixed to the bottom of the screen. Measured on Production at
 * 320x568, Tab put "Flying from" fully underneath it, and at every size the last footer items could never scroll clear of it. The
 * panel now publishes its height while it is on screen, and the page reserves that space. Nothing about consent itself changes.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const banner = read('components/ui/cookie-consent-banner.tsx');
const css = read('app/globals.css');

describe('consent panel clearance', () => {
  it('publishes the panel height only while it is visible, and removes it when the panel closes', () => {
    const start = banner.indexOf("root.style.setProperty('--consent-banner-h'");
    expect(start).toBeGreaterThan(-1);
    const effect = banner.slice(banner.lastIndexOf('useEffect(() => {', start), banner.indexOf('}, [visible]);', start));
    expect(effect).toContain('if (!visible || !panel) return;');
    expect(effect).toContain("root.style.removeProperty('--consent-banner-h');");
    // Layout only: no consent is stored, granted or announced here.
    expect(effect).not.toMatch(/store(Consent|Statistics)Choice|setLoadTag|CONSENT_GRANTED_EVENT|setVisible/);
  });

  it('keeps focused controls and the end of the page clear of the panel, and falls back to 0 once a choice is made', () => {
    expect(css).toContain('scroll-padding-bottom: var(--consent-banner-h, 0px);');
    expect(css).toContain('padding-bottom: var(--consent-banner-h, 0px);');
  });
});
