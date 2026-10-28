"use client";

import { useActionState, useRef } from "react";
import { submitRsvp, type RsvpState } from "./rsvp-action";

export function Rsvp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<RsvpState, FormData>(
    submitRsvp,
    {},
  );

  return (
    <>
      <button
        type="button"
        className="rsvp-open"
        onClick={() => dialog.current?.showModal()}
      >
        Start Your RSVP
      </button>

      <dialog
        ref={dialog}
        className="rsvp"
        aria-labelledby="rsvp-title"
        // Close when the backdrop (the dialog element itself) is clicked.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        <button
          type="button"
          className="rsvp-close"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>

        {state.ok ? (
          <div className="rsvp-done" role="status">
            <h2 id="rsvp-title">Thank you</h2>
            <p>
              {state.attending
                ? "We can't wait to celebrate with you."
                : "We'll miss you, and we're grateful you let us know."}
            </p>
            <p className="rsvp-note">Formal invitation to follow.</p>
          </div>
        ) : (
          <form action={action}>
            <h2 id="rsvp-title">Already know if you can make it?</h2>
            <p className="rsvp-lede">
              Let us know here. Formal invitation RSVP to follow.
            </p>

            <label className="rsvp-field">
              <span>Your name</span>
              <input
                name="name"
                autoFocus
                required
                maxLength={200}
                autoComplete="name"
              />
            </label>

            <fieldset className="rsvp-choice">
              <legend>Will you be there?</legend>
              <label>
                <input type="radio" name="attending" value="yes" required />
                <span>I&rsquo;m planning on it!</span>
              </label>
              <label>
                <input type="radio" name="attending" value="no" />
                <span>Unfortunately, I can&rsquo;t make it</span>
              </label>
            </fieldset>

            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="rsvp-trap"
              aria-hidden="true"
            />

            {state.error && (
              <p className="rsvp-error" role="alert">
                {state.error}
              </p>
            )}

            <button type="submit" className="rsvp-submit" disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
