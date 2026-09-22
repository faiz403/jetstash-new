import type { DoorJourney, ScheduledTransport } from './door-to-door';

export function blankDoorJourney(): DoorJourney {
  return {
    home: { name: '', timeZone: 'Europe/London' }, departureAirport: { name: '', timeZone: 'Europe/London' },
    arrivalAirport: { name: '', timeZone: 'Asia/Kolkata' }, destination: { name: '', timeZone: 'Asia/Kolkata' },
    deadline: { date: '', time: '', timeZone: 'Asia/Kolkata' }, finalBuffer: null, connectionCushion: null,
    homeAccess: { minutes: null, buffer: null },
    toAirport: { kind: 'flexible', mode: 'car', minutes: null, buffer: null },
    departureProcess: { terminalTransfer: null, checkIn: null, security: null, boarding: null },
    arrivalProcess: { disembark: null, immigration: null, baggage: null, customs: null, walkToTransport: null },
    onward: null, finalMile: { kind: 'flexible', mode: 'taxi', minutes: null, buffer: null },
    flights: [{ label: 'Option A', priceGBP: null, departure: { date: '', time: '', timeZone: 'Europe/London' }, landing: { date: '', time: '', timeZone: 'Asia/Kolkata' } }],
  };
}

export function blankScheduled(fromZone: string, toZone: string): ScheduledTransport {
  return { kind: 'scheduled', mode: 'train', from: { name: '', timeZone: fromZone }, to: { name: '', timeZone: toZone }, minimumBeforeDeparture: null, services: [] };
}

/** Fictional worked example only. These services, fares and flight times are NOT real evidence. */
export function exampleDoorJourney(): DoorJourney {
  const input = blankDoorJourney();
  input.home.name = 'Home in Preston'; input.departureAirport.name = 'Manchester Airport';
  input.arrivalAirport.name = 'Ahmedabad Airport'; input.destination.name = 'Family house in Ahmedabad';
  input.deadline = { date: '2026-11-03', time: '19:00', timeZone: 'Asia/Kolkata' };
  input.finalBuffer = 10; input.connectionCushion = 15;
  input.homeAccess = { minutes: 10, buffer: 5 };
  input.toAirport = { ...blankScheduled('Europe/London', 'Europe/London'), from: { name: 'Preston station', timeZone: 'Europe/London' }, to: input.departureAirport, minimumBeforeDeparture: 10,
    services: [['05:48', '06:58'], ['06:12', '07:22']].map(([departure, arrival]) => ({ id: `Example train ${departure}`, departure: { date: '2026-11-02', time: departure, timeZone: 'Europe/London' }, arrival: { date: '2026-11-02', time: arrival, timeZone: 'Europe/London' } })) };
  input.departureProcess = { terminalTransfer: 10, checkIn: 60, security: 45, boarding: 65 };
  input.arrivalProcess = { disembark: 10, immigration: 45, baggage: 25, customs: 10, walkToTransport: 15 };
  input.onward = { ...blankScheduled('Asia/Kolkata', 'Asia/Kolkata'), from: { name: 'Example airport-area stop', timeZone: 'Asia/Kolkata' }, to: { name: 'Example local station', timeZone: 'Asia/Kolkata' }, minimumBeforeDeparture: 10,
    services: [['17:10', '18:02'], ['17:35', '18:27'], ['17:50', '18:36'], ['18:20', '19:05']].map(([departure, arrival]) => ({ id: `Example onward ${departure}`, departure: { date: '2026-11-03', time: departure, timeZone: 'Asia/Kolkata' }, arrival: { date: '2026-11-03', time: arrival, timeZone: 'Asia/Kolkata' } })) };
  input.finalMile = { kind: 'flexible', mode: 'rickshaw', minutes: 12, buffer: 8 };
  input.flights = [
    { label: 'Option A — example itinerary', priceGBP: 480, departure: { date: '2026-11-02', time: '11:15', timeZone: 'Europe/London' }, landing: { date: '2026-11-03', time: '15:55', timeZone: 'Asia/Kolkata' } },
    { label: 'Option B — example itinerary', priceGBP: 520, departure: { date: '2026-11-02', time: '10:15', timeZone: 'Europe/London' }, landing: { date: '2026-11-03', time: '14:40', timeZone: 'Asia/Kolkata' } },
  ];
  return input;
}
