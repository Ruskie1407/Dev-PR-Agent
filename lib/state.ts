export type EventItem = {
  t: string;                     // ISO time
  event: string;                 // x-github-event
  action?: string;               // payload.action
  repo?: string;
  pr?: number;
  note?: string;
};

const MAX = 50;
const events: EventItem[] = [];

export function addEvent(e: Omit<EventItem, "t">) {
  const item = { t: new Date().toISOString(), ...e };
  events.unshift(item);
  if (events.length > MAX) events.length = MAX;
}

export function getEvents() {
  return events.slice(0, MAX);
}
