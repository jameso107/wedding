import type { CSSProperties } from "react";
import Image from "next/image";
import bayPointe from "../public/images/bay-pointe.jpg";
import event from "./event.json";

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(event) }}
      />
      <main className="hero">
        <Image
          src={bayPointe}
          alt="Watercolor of Bay Pointe Inn on the shore of Gun Lake"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="painting"
        />
        <div className="wash" aria-hidden="true" />

        <article className="card">
          <p className="kicker rise" style={{ "--d": "0.35s" } as CSSProperties}>
            Save the Date
          </p>
          <h1 className="names rise" style={{ "--d": "0.5s" } as CSSProperties}>
            Hannah <span className="amp">&amp;</span> James
          </h1>
          <p className="date rise" style={{ "--d": "0.7s" } as CSSProperties}>
            <time dateTime="2027-07-04">07 · 04 · 27</time>
          </p>
          <p className="place rise" style={{ "--d": "0.85s" } as CSSProperties}>
            Bay Pointe Inn · Gun Lake, Michigan
          </p>
          <p className="more rise" style={{ "--d": "1s" } as CSSProperties}>
            More information to follow
          </p>
        </article>
      </main>
    </>
  );
}
