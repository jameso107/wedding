export function Postmark() {
  return (
    <svg
      className="postmark"
      viewBox="0 0 220 220"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="stamp-bite" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g
        fill="none"
        stroke="#6B1020"
        strokeWidth="3.4"
        filter="url(#stamp-bite)"
      >
        <circle cx="110" cy="110" r="100" />
        <circle cx="110" cy="110" r="86" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="58" strokeWidth="1.15" />
      </g>
      <g
        fill="#6B1020"
        textAnchor="middle"
        filter="url(#stamp-bite)"
        style={{ fontFamily: "var(--font-stamp), sans-serif" }}
      >
        <text
          x="110"
          y="58"
          style={{ fontSize: "13px", letterSpacing: "0.22em", fontWeight: 700 }}
        >
          GUN LAKE MICH
        </text>
        <text
          x="110"
          y="96"
          style={{ fontSize: "22px", letterSpacing: "0.38em", fontWeight: 700 }}
        >
          JUL
        </text>
        <text
          x="110"
          y="142"
          style={{ fontSize: "54px", fontWeight: 800, letterSpacing: "-0.04em" }}
        >
          4
        </text>
        <text
          x="110"
          y="172"
          style={{ fontSize: "20px", letterSpacing: "0.32em", fontWeight: 700 }}
        >
          2027
        </text>
      </g>
    </svg>
  );
}
