"use server";

import { db } from "@/lib/planning/db";

export type RsvpState = { ok?: boolean; attending?: boolean; error?: string };

export async function submitRsvp(
  _prev: RsvpState,
  form: FormData,
): Promise<RsvpState> {
  // Hidden field only bots fill in; pretend it worked.
  if (form.get("website")) return { ok: true, attending: true };

  const name = String(form.get("name") ?? "").trim();
  const choice = form.get("attending");
  if (!name) return { error: "Please tell us your name." };
  if (name.length > 200) return { error: "That name is a bit long." };
  if (choice !== "yes" && choice !== "no") {
    return { error: "Please let us know if you can make it." };
  }

  const attending = choice === "yes";
  const { error } = await db().from("wedding_rsvps").insert({ name, attending });
  if (error) {
    console.error("rsvp insert failed", error.message);
    return { error: "Something went wrong. Please try again." };
  }
  return { ok: true, attending };
}
