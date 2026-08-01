import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Structural/source-scan checks for the Stage 1 Arrive By engine — the
 * same established convention as tests/metadata-audit.test.ts and
 * tests/not-found-page-title.test.ts (readFileSync + regex over a small,
 * known set of files, rather than a runtime mock of fetch/analytics).
 */

const ARRIVE_BY_DIR = join(process.cwd(), 'lib', 'arrive-by');
const files = readdirSync(ARRIVE_BY_DIR).filter((f) => f.endsWith('.ts'));
const sources = files.map((f) => ({ file: f, content: readFileSync(join(ARRIVE_BY_DIR, f), 'utf8') }));

describe('req 26: exact dates are not sent to analytics', () => {
  it('no file in lib/arrive-by imports or calls the analytics wrapper', () => {
    for (const { file, content } of sources) {
      expect(content, file).not.toMatch(/from ['"]@\/lib\/analytics['"]/);
      expect(content, file).not.toMatch(/\btrack\s*\(/);
    }
  });
});

describe('req 28: no external network call occurs', () => {
  it('no file in lib/arrive-by calls fetch, XMLHttpRequest, or an HTTP client', () => {
    for (const { file, content } of sources) {
      expect(content, file).not.toMatch(/\bfetch\s*\(/);
      expect(content, file).not.toMatch(/XMLHttpRequest/);
      expect(content, file).not.toMatch(/from ['"]axios['"]/);
      expect(content, file).not.toMatch(/require\(['"]https?['"]\)/);
    }
  });
});

describe('no public interface exists yet (Stage 1 scope)', () => {
  it('no route, page, or component imports lib/arrive-by — the engine is not wired to any UI', () => {
    const appDir = join(process.cwd(), 'app');
    const componentsDir = join(process.cwd(), 'components');
    const offenders: string[] = [];

    function scan(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = readFileSync(full, 'utf8');
          if (content.includes('arrive-by')) offenders.push(full);
        }
      }
    }
    scan(appDir);
    scan(componentsDir);
    expect(offenders).toEqual([]);
  });
});

describe('req 25 (shape check): the input/result types carry no personal-identification fields', () => {
  it('lib/arrive-by/types.ts declares no field named after a personal-identification concept', () => {
    // Strips comments first — the file's own doc comment deliberately
    // documents the ABSENCE of passport/visa/nationality data (that's the
    // point being tested), so scanning comments verbatim would false-positive
    // on the exact sentence proving the requirement is met. Only actual
    // field/type declarations are checked.
    const raw = readFileSync(join(ARRIVE_BY_DIR, 'types.ts'), 'utf8');
    const codeOnly = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .toLowerCase();
    for (const term of ['passport', 'visa', 'nationality', 'dateofbirth', 'date_of_birth', 'dob:', 'nino', 'national insurance']) {
      expect(codeOnly, term).not.toContain(term);
    }
  });
});

describe('data-file integrity (req 27 support)', () => {
  it('lib/arrive-by never imports from data/travel-ready-rules.ts — document readiness stays a separate feature', () => {
    for (const { file, content } of sources) {
      expect(content, file).not.toMatch(/travel-ready-rules/);
    }
  });
});
