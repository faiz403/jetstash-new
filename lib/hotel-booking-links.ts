/**
 * Central outbound hotel booking-link configuration — the hotel equivalent
 * of lib/booking-providers.ts's flight map, and deliberately separate from
 * it. Evidence (data/hotel-evidence.ts, what JetStash has factually
 * researched about a property) and commercial handoff (this file, where a
 * "Check current price" click actually goes) are kept in different files on
 * purpose: a hotel's factual context must never depend on whether an
 * affiliate link happens to exist for it, and an affiliate link must never
 * be treated as if it were researched evidence.
 *
 * Every URL below is the exact, unedited output of Trip.com's own Affiliate
 * Platform "Custom link" generator (Trip.com Affiliate Platform →
 * Affiliate Link → Create links), submitted with that exact property's own
 * canonical Trip.com hotel page URL and nothing else. Trip.com's system
 * appended the tracking parameters — Allianceid, SID, trip_sub1, trip_sub3
 * — automatically; none of them were typed, guessed, or edited by hand.
 * This is the same account, and the same Allianceid=9804124 / SID=327450313
 * identifiers, already live for flights in lib/booking-providers.ts —
 * confirmed via the account's own Commission Plan page to have
 * Hotel/Accommodation monetisation enabled (5% at the account's current
 * 0–199-booking tier).
 *
 * A property is deliberately ABSENT from this map — never filled with a
 * guessed or hand-built URL — until its exact page has been searched on
 * Trip.com, confirmed as an unambiguous single-property match, and run
 * through the dashboard generator exactly like the three below. Callers
 * MUST fail closed on `null`: render no "Check current price" CTA at all,
 * never a generic Trip.com hotel-search link, never a constructed URL.
 *
 * Nothing outside this file should construct or edit a Trip.com hotel URL
 * by hand — every hotel booking CTA in the app reads its outbound URL from
 * here, keyed by the property's stable `evidenceId` from
 * data/hotel-evidence.ts, never by hotel name (which can collide or be
 * retyped inconsistently).
 */

/** rel attribute for every Trip.com hotel outbound <a> — matches the flight CTA's own rel value. */
export const HOTEL_PROVIDER_REL = 'nofollow sponsored noopener noreferrer';

/**
 * evidenceId-keyed, exact dashboard-generated Trip.com hotel affiliate
 * links — see file header for provenance. Antalya MVP scope only: the
 * three properties already documented in data/hotel-evidence.ts's Antalya
 * Holiday Intelligence pilot.
 */
const TRIPCOM_HOTEL_URLS: Readonly<Record<string, string>> = {
  'antalya-trendy-lara-2026-08-11':
    'https://uk.trip.com/hotels/detail/?cityEnName=Antalya&cityId=1217&hotelId=9618012&checkIn=2026-08-14&checkOut=2026-08-15&adult=2&children=0&crn=1&ages=&curr=GBP&barcurr=GBP&hoteluniquekey=H4sIAAAAAAAA_-PayMTFJMEktYqJ4_KVBzNZhRiNDO4zWmyVd9wh1_r6YvUGB08GEPDZ5BDAM4PxTstplo2M1SLr3B8y1TrsYGQ6wMh0grGZZQHTt-dbmE6xsHK8U5dgucSymTG6Wik7tVLJykRHqSSzJCdVyUopzDFESUcpJbU4GcgBshJz80vzSoBsU0M9AyOgQElihWcKWEtyYk5yaU5iSWpIZQFQq5GOUmaxc0lRZkFQam5mSUkqUFVaYk5xKkg8KLUYKJMMFgQZWwTlZ-bnQXQboIiFJeaUpkJUAu1zS4VaYVgb-4iFKTr2EwvDLxaGJlaGLlaGSaysHHM0JJh2sfI4Ovu6hpvpGupG6RpKKRsaGBiYGhqbmuoaJFomppolG-uaWJoZWZrpmhoYGhoYG5oaaRy7Muftf2MjEwVGLcH4EE93J8OU4qoyoN0VFgWFBoynGKUMzS1MTU1MzC3NTSxN9FJMkixCqwrKioIiAzwYg9gsnIxdjEyjbLiYQ4NdBOM1Twsc_yXlIMXs7hSgeHzXjl42AyUHLWbX0CBDdUOONTJS8g6BN-PL_OWmfbWPhMknsabm6bo7ZdwTLWBsYGTuYuQWYPRgjGCsAPIYVzGyczEbGBkKMG1gZNzB-B8GGF8xgiwBALP6eisaAgAA&masterhotelid_tracelogid=100051355-0a9ae6c3-496296-501103152&detailFilters=17%7C1%7E17%7E1*31%7C9618012%7E31%7E9618012*80%7C3%7C1%7E80%7E3*29%7C1%7E29%7E1%7C2&display=cmatotal&subStamp=132&isCT=true&isFlexible=F&locale=en-GB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'antalya-regnum-carya-2026-08-11':
    'https://uk.trip.com/hotels/detail/?cityEnName=Serik&cityId=40535&hotelId=3054789&checkIn=2026-08-14&checkOut=2026-08-15&adult=2&children=0&crn=1&ages=&curr=GBP&barcurr=GBP&hoteluniquekey=H4sIAAAAAAAA_-NqZ-FikmCSamDhaFzQPJNNiNPIxNDc0tjCwMhgKYdFZ7Lj9cUFtllXzzp4FtpyXT_cd8EhgGcG49Gduxg3MgbtkGt97TDLYQcj0wFGphOMx_kWMP1oXiByioWNY_EERgmWSyzfmKKrlbJTK5WsTHSUSjJLclKVrJQck5Pzc3PzUxJLMvPzFEoSK5R0lFJSi5OBUkBWYm5-aV4JkG1opmduCRQAKvBMUbIy1VFKTsxJLs1JLEkNqSwAGmSmo5RZ7FxSlFkQlJqbWVKSClSVlphTnAoSD0otBsokgwWV_IDGFEEFgHZCtBuiiIUl5pSmQlwAtNAtFWqHYa0OpgfCHENwOdlcz8IC4WaTAXJz7CMWpujYFyzX2T6xMPxiYWhiZehiZZjEysbxcj23BMsuVsEgT9MwUyNd54AId29P3ShdQyl5QwMDA1NDY1NTXYNEizQLM6NkXRNLMyNLM11zQzNLU40rzWfe_jc2MlFg1BKMD_F0dzJMKa4qA7qgwqKg0IDxFKOUobmFqamJibmluYmliV6KSZJFaFVBWVFQZIAHYxCbgYGzkaFBlA0Xc2iwi2C85mmB47-kHKSY3Z0CFI_v2tHLZqDkkMSamqfr7pRxTxQAqncYv4YAAAA&masterhotelid_tracelogid=100051355-0a8f862c-496296-71695&detailFilters=17%7C1%7E17%7E1*31%7C3054789%7E31%7E3054789*80%7C3%7C1%7E80%7E3*29%7C1%7E29%7E1%7C2&display=cmatotal&subStamp=288&isCT=true&isFlexible=F&locale=en-GB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19226342',
  'antalya-aydinbey-kings-palace-2026-08-11':
    'https://uk.trip.com/hotels/detail/?cityEnName=Manavgat&cityId=53071&hotelId=4228551&checkIn=2026-08-14&checkOut=2026-08-15&adult=2&children=0&crn=1&ages=&curr=GBP&barcurr=GBP&hoteluniquekey=H4sIAAAAAAAA_-Ni4mKQUjY0MDAwNTQ2NdU1SLRMTEo1T9Y1sTQzsjTTtTQ2MDM0NzI00Tg4-cnb_8ZGBlqC8SGe7k6GKcVVZTmlqRUWBYWnGKUMzS1MTU1MzC3NTSxN9FJMkixCqwrKioIiAzwYg9hczN0M3Yyi-KSY3Z0CFI_v2tHLZqDkkMSamqfr7pRxTxQAqncYv4YAAAA&masterhotelid_tracelogid=100051355-0a9abe7c-496296-930617214&detailFilters=17%7C1%7E17%7E1*31%7C4228551%7E31%7E4228551*80%7C3%7C1%7E80%7E3*29%7C1%7E29%7E1%7C2&display=cmatotal&subStamp=1056&isCT=true&isFlexible=F&locale=en-GB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19226412',
};

/**
 * The one lookup every hotel booking CTA in the app goes through. Returns
 * the exact dashboard-generated Trip.com hotel URL for a supported
 * property, or `null` for any evidenceId not in TRIPCOM_HOTEL_URLS.
 *
 * Callers MUST fail closed on `null`: render no "Check current price" CTA
 * at all, never a generic Trip.com hotel-search link, never a constructed
 * or guessed URL, and never fall back to any other provider.
 */
export function getTripComHotelUrl(evidenceId: string): string | null {
  return TRIPCOM_HOTEL_URLS[evidenceId] ?? null;
}

/** Whether a property has a real, dashboard-verified Trip.com hotel link — the fail-closed gate every hotel CTA checks before rendering. */
export function hasTripComHotelLink(evidenceId: string): boolean {
  return evidenceId in TRIPCOM_HOTEL_URLS;
}
