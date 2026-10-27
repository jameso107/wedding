// Who's using planning.oosterhouse.wedding. There's no password: the cookie
// just remembers whether this browser is Hannah or James, so tasks and the
// activity feed can say who did what.

export const SESSION_COOKIE = "planning_person";
export const SESSION_DAYS = 365;

export const PEOPLE = ["hannah", "james"] as const;
export type Person = (typeof PEOPLE)[number];

export function isPerson(value: unknown): value is Person {
  return PEOPLE.includes(value as Person);
}

export function readSessionValue(value: string | undefined): Person | null {
  return isPerson(value) ? value : null;
}
