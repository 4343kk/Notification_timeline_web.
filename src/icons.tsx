import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const S = ({ size = 18, children, ...rest }: P) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

/** 品牌标识 · 玻璃棱镜 */
export const IconLogo = ({ size = 30, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...rest}>
    <path d="M16 2.5 28.5 9.75v14.5L16 31.5 3.5 24.25V9.75L16 2.5Z" fill="rgba(245,168,60,0.16)" stroke="#f5a83c" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M16 2.5v29M3.5 9.75 28.5 24.25M28.5 9.75 3.5 24.25" stroke="#f5a83c" strokeWidth="1" opacity="0.55" />
    <circle cx="16" cy="16" r="3.4" fill="#f5a83c" />
    <circle cx="16" cy="16" r="6.2" stroke="#4adcc6" strokeWidth="1.2" opacity="0.9" />
  </svg>
);

export const IconBell = (p: P) => (
  <S {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10 19a2.2 2.2 0 0 0 4 0" />
  </S>
);

export const IconBellOff = (p: P) => (
  <S {...p}>
    <path d="M8.7 4.6A6 6 0 0 1 18 9c0 3.5 1 5.2 1.6 6M6.3 6.3C6.1 7.1 6 8 6 9c0 5-2 6-2 6h12" />
    <path d="M10 19a2.2 2.2 0 0 0 4 0" />
    <path d="M4 4l16 16" />
  </S>
);

export const IconClock = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </S>
);

export const IconPlus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);

export const IconPencil = (p: P) => (
  <S {...p}>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
    <path d="M14.5 6.5l3 3" />
  </S>
);

export const IconTrash = (p: P) => (
  <S {...p}>
    <path d="M4 7h16M9.5 7V4.8A1 1 0 0 1 10.5 4h3a1 1 0 0 1 1 .8V7M6.5 7l1 12.2a1.5 1.5 0 0 0 1.5 1.3h6a1.5 1.5 0 0 0 1.5-1.3l1-12.2" />
    <path d="M10 11v6M14 11v6" />
  </S>
);

export const IconGrip = (p: P) => (
  <S {...p} strokeWidth={0} fill="currentColor">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </S>
);

export const IconSend = (p: P) => (
  <S {...p}>
    <path d="M20.5 3.5 3.5 10.2l6.3 2.5 2.5 6.8 8.2-16Z" />
    <path d="M9.8 12.7l4.5-4.5" />
  </S>
);

export const IconRadio = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <path d="M7.7 16.3a6 6 0 0 1 0-8.6M16.3 7.7a6 6 0 0 1 0 8.6" />
    <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
  </S>
);

export const IconCheck = (p: P) => (
  <S {...p}>
    <path d="M4.5 12.5 10 18 19.5 6.5" />
  </S>
);

export const IconX = (p: P) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);

export const IconAlert = (p: P) => (
  <S {...p}>
    <path d="M12 3.5 22 20H2L12 3.5Z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.2" r="0.4" fill="currentColor" />
  </S>
);

export const IconDatabase = (p: P) => (
  <S {...p}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
    <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
    <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
  </S>
);

export const IconActivity = (p: P) => (
  <S {...p}>
    <path d="M2.5 12h4l2.5-7 5 14 2.5-7h5" />
  </S>
);

export const IconChevronUp = (p: P) => (
  <S {...p}>
    <path d="M6 14.5 12 9l6 5.5" />
  </S>
);

export const IconChevronDown = (p: P) => (
  <S {...p}>
    <path d="M6 9.5 12 15l6-5.5" />
  </S>
);

export const IconPin = (p: P) => (
  <S {...p}>
    <path d="M12 21s-6.5-5.6-6.5-10.4a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" />
    <circle cx="12" cy="10.4" r="2.3" />
  </S>
);

export const IconTerminal = (p: P) => (
  <S {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="M7 9.5l3 2.7-3 2.7M12.5 15.5H17" />
  </S>
);

export const IconInfo = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="7.8" r="0.4" fill="currentColor" />
  </S>
);

export const IconWindow = (p: P) => (
  <S {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="M3 9h18M6.2 6.8h.01M8.6 6.8h.01" />
  </S>
);

export const IconZap = (p: P) => (
  <S {...p}>
    <path d="M13 2.5 4.5 13.5H11L10 21.5 19.5 9.5H13l1-7Z" />
  </S>
);

export const IconClipboard = (p: P) => (
  <S {...p}>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <path d="M9 4.5V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2v1.3" />
    <path d="M8.5 13.2l2.3 2.3 4.7-5" />
  </S>
);

export const IconTarget = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.8" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </S>
);

export const IconArrowUp = (p: P) => (
  <S {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </S>
);

export const IconSpinner = (p: P) => (
  <S {...p} className={`animate-spin ${p.className ?? ''}`}>
    <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
  </S>
);

export const IconCalendar = (p: P) => (
  <S {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 2.8V6M16 2.8V6" />
    <path d="M7.5 13.5h3M7.5 16.5h6" />
  </S>
);

export const IconLayers = (p: P) => (
  <S {...p}>
    <path d="M12 3 21.5 8 12 13 2.5 8 12 3Z" />
    <path d="M2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5" opacity="0.7" />
  </S>
);
