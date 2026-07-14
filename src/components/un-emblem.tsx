export default function UnEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Organization emblem"
      className={className}
    >
      <circle cx="24" cy="24" r="23" fill="var(--un-blue-600)" />
      <circle
        cx="24"
        cy="24"
        r="23"
        fill="none"
        stroke="var(--un-blue-400)"
        strokeWidth="1"
      />
      <g fill="none" stroke="#f4ecd8" strokeWidth="1.4">
        <path d="M24 10 C17 15 15 22 16 32" />
        <path d="M24 10 C31 15 33 22 32 32" />
        <path d="M17 15 L20 15 M16.3 19 L19.5 19.4 M16 23 L19.2 23 M16.3 27 L19.5 26.7 M17.5 31 L20.4 30" />
        <path d="M31 15 L28 15 M31.7 19 L28.5 19.4 M32 23 L28.8 23 M31.7 27 L28.5 26.7 M30.5 31 L27.6 30" />
      </g>
      <text
        x="24"
        y="27.5"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#ffffff"
        fontFamily="var(--font-noto-sans), Arial, sans-serif"
      >
        UN
      </text>
    </svg>
  );
}
