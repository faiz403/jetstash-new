// Recheck the final local build against the read-only Production capture from this review.
// Only GETs localhost pages; never follows affiliate links or submits forms.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const folder = 'node_modules/.cache/fare-range-review';
const pages = JSON.parse(readFileSync(`${folder}/pages.json`, 'utf8'));
const cardPattern = /<article class="group relative flex flex-col\b[\s\S]*?<\/article>/g;
const text = html => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const outsideCards = html => text(html.replace(cardPattern, ''))
  .replace(/Checked \d+ days ago\./g, 'Checked [age] days ago.')
  .replace(/as of 20 October 2026, \d{2}:\d{2} BST/gi, 'as of [render time]');
const affiliateLinks = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)]
  .filter(match => /sponsored/.test(match[0])).map(match => match[1]).sort();

const results = [];
for (const page of pages) {
  const name = page.path.replaceAll('/', '_') + '.html';
  const before = readFileSync(`${folder}/production/${name}`, 'utf8');
  const response = await fetch(`http://localhost:3107${page.path}`);
  assert.equal(response.status, 200, page.path);
  const after = await response.text();
  writeFileSync(`${folder}/local/${name}`, after);
  assert.equal(outsideCards(after), outsideCards(before), `${page.path}: unexpected content outside cards`);
  assert.deepEqual(affiliateLinks(after), affiliateLinks(before), `${page.path}: affiliate destinations`);
  const oldCards = [...before.matchAll(cardPattern)].map(match => match[0]);
  const newCards = [...after.matchAll(cardPattern)].map(match => match[0]);
  assert.equal(oldCards.length, newCards.length, `${page.path}: card count`);
  const changedCards = newCards.filter((card, index) => text(card) !== text(oldCards[index])).length;
  results.push({ path: page.path, status: response.status, cards: newCards.length,
    changedCards, outsideCardsIdenticalAfterDatedNormalization: true, affiliateLinksIdentical: true });
}
writeFileSync(`${folder}/final-page-comparison.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ pages: results.length, routePages: results.filter(row => row.path.startsWith('/routes/')).length,
  unexpectedNonCardChanges: 0, affiliateChanges: 0, cardCountChanges: 0 }, null, 2));
