interface IconProps {
  className?: string;
}

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1V16a2 2 0 0 1 4 0v3.5a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function TasksIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12.5l2 2 4.5-5" />
    </svg>
  );
}

export function ListsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 6h11M8 12h11M8 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="2.5" />
    </svg>
  );
}

export function MealsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 3v6a2 2 0 0 0 4 0V3M9 9v12" />
      <path d="M16 3c-1.5 1-2 3-2 5s.5 3 2 3 2-1 2-3-.5-4-2-5Zm0 8v9" />
    </svg>
  );
}

export function RecipesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H8A3.5 3.5 0 0 1 4.5 16V5A.5.5 0 0 1 5 4.5Z" />
      <path d="M8.5 9h6M8.5 12.5h6" />
    </svg>
  );
}

export function RewardsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4.5 14 9l5 .7-3.6 3.5.9 4.9L12 15.8 7.7 18.1l.9-4.9L5 9.7 10 9Z" />
    </svg>
  );
}
