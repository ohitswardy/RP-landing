/* Minimal 24-grid stroke icon set for the CMS shell.
   Single source so strokeWidth stays 1.5 everywhere. */

type IconProps = { size?: number; className?: string };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export const IconGauge = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 14a8 8 0 1 1 16 0" />
    <path d="M12 14l3.5-4.5" />
    <path d="M2.5 18h19" />
  </svg>
);

export const IconArticle = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
    <path d="M7.5 8h9M7.5 12h9M7.5 16h5.5" />
  </svg>
);

export const IconPeople = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 6a2.6 2.6 0 1 1 1.4 4.9M17.5 13.4c1.9.5 3 1.9 3 4.1" />
  </svg>
);

export const IconBriefcase = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="7" width="17" height="12.5" rx="1.5" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12h17" />
  </svg>
);

export const IconPath = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M8.2 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.8" />
  </svg>
);

export const IconChart = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 20.5v-17" />
    <path d="M3.5 20.5h17" />
    <path d="M7 15.5l4-5 3 2.5 5-6.5" />
  </svg>
);

export const IconMail = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
  </svg>
);

export const IconFile = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3.5h8L19 8.5v12H6z" />
    <path d="M13.5 4v5H19" />
  </svg>
);

export const IconImage = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4.5 17.5l4.5-4 3.5 3 3-2.5 4 3.5" />
  </svg>
);

export const IconShield = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
    <path d="M9.2 12l2 2 3.6-4" />
  </svg>
);

export const IconSignOut = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M13.5 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h7.5" />
    <path d="M16 8l4 4-4 4M20 12H9.5" />
  </svg>
);

export const IconPlus = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconX = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconTrash = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 6.5h15M9.5 6V4.5h5V6M6.5 6.5l.8 13h9.4l.8-13M10 10.5v5.5M14 10.5v5.5" />
  </svg>
);

export const IconPen = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20l.9-3.8L16.7 4.4a1.4 1.4 0 0 1 2 0l.9.9a1.4 1.4 0 0 1 0 2L7.8 19.1z" />
    <path d="M15.2 6l2.8 2.8" />
  </svg>
);

export const IconEye = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const IconEyeOff = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4l16 16" />
    <path d="M9.9 5.2A9.4 9.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4M6.1 7.4A16 16 0 0 0 2.5 12S6 19 12 19a8.9 8.9 0 0 0 3.7-.8" />
    <path d="M9.5 9.8a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export const IconArrowUp = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const IconArrowDown = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

export const IconCheck = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 12.5l5 5L19.5 7" />
  </svg>
);

export const IconCopy = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="1.5" />
    <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
  </svg>
);

export const IconDownload = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4v11M7 11l5 5 5-5M4.5 20h15" />
  </svg>
);

export const IconSearch = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15.5 15.5L20 20" />
  </svg>
);

export const IconMenu = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconExternal = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14 4h6v6M20 4L10.5 13.5" />
    <path d="M20 14v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V6a1.5 1.5 0 0 1 1.5-1.5H10" />
  </svg>
);

export const IconPin = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4h6l-.7 6.2 2.7 3.3H7l2.7-3.3zM12 13.5V20" />
  </svg>
);

export const IconReport = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3.5h8L19 8.5v12H6z" />
    <path d="M13.5 4v5H19" />
    <path d="M8.5 13h7M8.5 16.5h5" />
  </svg>
);

export const IconUpload = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 16V5M7 9l5-5 5 5M4.5 20h15" />
  </svg>
);

export const IconArrowRight = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* ── Rich-text toolbar ─────────────────────────────────────── */

export const IconUndo = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8.5 5L4 9.5 8.5 14" />
    <path d="M4 9.5h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const IconRedo = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M15.5 5L20 9.5 15.5 14" />
    <path d="M20 9.5H10a6 6 0 0 0 0 12h3" />
  </svg>
);

export const IconAlignLeft = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
  </svg>
);

export const IconAlignCenter = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
  </svg>
);

export const IconAlignRight = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
  </svg>
);

export const IconAlignJustify = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

export const IconListBullets = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11" />
    <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth={2.4} />
  </svg>
);

export const IconListNumbers = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 6.5h10.5M10 12h10.5M10 17.5h10.5" />
    <path d="M4 5l1.5-1v5M3.8 10.8c.3-.7 1.1-1 1.8-.7.9.4.8 1.4.2 2l-2 2.1h2.8M3.8 16.5h1.7a1.2 1.2 0 0 1 0 2.4H5a1.2 1.2 0 0 1 .5 2.4H3.8" />
  </svg>
);

export const IconIndent = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M11 10h9M11 14h9M4 18h16" />
    <path d="M4 9.5l3 2.5-3 2.5" />
  </svg>
);

export const IconOutdent = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M11 10h9M11 14h9M4 18h16" />
    <path d="M7 9.5L4 12l3 2.5" />
  </svg>
);

export const IconLink = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 14a4 4 0 0 0 6 .4l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.4 1.4" />
    <path d="M14 10a4 4 0 0 0-6-.4l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.4" />
  </svg>
);

export const IconTable = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10M15 9.5v10" />
  </svg>
);

export const IconCalendar = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </svg>
);

export const IconMinus = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12h16" />
  </svg>
);

export const IconBookmark = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6.5 3.75h11v16.5L12 16.1l-5.5 4.15z" />
  </svg>
);

/** Saved state of IconBookmark — same silhouette, filled. */
export const IconBookmarkFilled = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor">
    <path d="M6.5 3.75h11v16.5L12 16.1l-5.5 4.15z" />
  </svg>
);

export const IconStar = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.9l2.45 4.96 5.48.8-3.97 3.86.94 5.46L12 16.4l-4.9 2.58.94-5.46-3.97-3.86 5.48-.8z" />
  </svg>
);

/** Active state of IconStar — same silhouette, filled. */
export const IconStarFilled = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor">
    <path d="M12 3.9l2.45 4.96 5.48.8-3.97 3.86.94 5.46L12 16.4l-4.9 2.58.94-5.46-3.97-3.86 5.48-.8z" />
  </svg>
);
