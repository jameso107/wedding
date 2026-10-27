"use client";

import Link from "next/link";

export default function PlanningError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pl-page">
      <p className="pl-kicker">Something went sideways</p>
      <h1 className="pl-title">That didn’t save.</h1>
      <p className="pl-lede">{error.message}</p>
      <div className="pl-actions" style={{ justifyContent: "flex-start", marginTop: 20 }}>
        <button type="button" className="pl-btn" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="pl-link">
          Back to the overview
        </Link>
      </div>
    </div>
  );
}
