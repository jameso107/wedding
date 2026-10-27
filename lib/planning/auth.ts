import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionValue, type Person } from "./session";

export async function currentPerson(): Promise<Person | null> {
  const store = await cookies();
  return readSessionValue(store.get(SESSION_COOKIE)?.value);
}

export async function requirePerson(): Promise<Person> {
  const person = await currentPerson();
  if (!person) redirect("/login");
  return person;
}
