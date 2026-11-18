import React, { useEffect } from 'react';

const NAV_ICON_ANIM_CSS = `
.nav-anim-svg{overflow:visible}

/* 1. Bệnh nhân: 2 silhouettes stepping subtly into formation */
.nav-anim-u1{animation:nav-u1 2.8s ease-in-out infinite}
.nav-anim-u2{animation:nav-u2 2.8s ease-in-out infinite}
@keyframes nav-u1{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-.9px)}
}
@keyframes nav-u2{
  0%,100%{transform:translateX(0);opacity:.85}
  50%{transform:translateX(1.1px);opacity:1}
}

/* 2. DHST / Diễn biến: Lub-dub heartbeat + sweeping ECG pulse */
.nav-anim-heart{transform-origin:12px 12px;animation:nav-heart 2.2s ease-in-out infinite}
.nav-anim-ecg{stroke-dasharray:55 45;animation:nav-ecg 2.2s linear infinite}
@keyframes nav-heart{
  0%,100%{transform:scale(1)}
  14%{transform:scale(1.1)}
  28%{transform:scale(1)}
  42%{transform:scale(1.06)}
  60%{transform:scale(1)}
}
@keyframes nav-ecg{
  0%{stroke-dashoffset:100}
  100%{stroke-dashoffset:0}
}

/* 3. Báo đường huyết: Plunger press + droplet pulse */
.nav-anim-plunger{animation:nav-plunger 2.6s ease-in-out infinite}
.nav-anim-drop{transform-origin:2.3px 21.8px;animation:nav-drop 2.6s ease-in-out infinite}
@keyframes nav-plunger{
  0%,100%{transform:translate(0,0)}
  45%,58%{transform:translate(-1.3px,1.3px)}
}
@keyframes nav-drop{
  0%,35%{transform:scale(.45);opacity:.35}
  60%{transform:scale(1.15);opacity:1}
  85%,100%{transform:scale(.6);opacity:.45}
}

/* 4. Báo cáo trực: Sequential writing lines */
.nav-anim-doc{transform-origin:12px 12px;animation:nav-doc 3.2s ease-in-out infinite}
.nav-anim-line{stroke-dasharray:100;animation:nav-line 2.8s ease-in-out infinite}
.nav-anim-l1{animation-delay:0s}
.nav-anim-l2{animation-delay:.28s}
.nav-anim-l3{animation-delay:.56s}
@keyframes nav-doc{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-.7px)}
}
@keyframes nav-line{
  0%{stroke-dashoffset:100;opacity:.4}
  35%,75%{stroke-dashoffset:0;opacity:1}
  100%{stroke-dashoffset:0;opacity:.75}
}

/* 5. Lịch chỉ định: Ticking clock hands */
.nav-anim-clock-min{transform-origin:16px 16px;animation:nav-clock 5s linear infinite}
.nav-anim-clock-hour{transform-origin:16px 16px;animation:nav-clock 24s linear infinite}
@keyframes nav-clock{
  from{transform:rotate(0deg)}
  to{transform:rotate(360deg)}
}

/* 6. Bệnh nhân cũ: Archive lid gently lifting open */
.nav-anim-lid{transform-origin:4px 6px;animation:nav-lid 3s ease-in-out infinite}
.nav-anim-handle{animation:nav-handle 3s ease-in-out infinite}
@keyframes nav-lid{
  0%,100%{transform:translateY(0) rotate(0deg)}
  45%,60%{transform:translateY(-1.5px) rotate(-3.5deg)}
}
@keyframes nav-handle{
  0%,100%{transform:translateY(0)}
  45%,60%{transform:translateY(.5px)}
}

/* Speed up cleanly on button/card hover or focus */
button:hover .nav-anim-heart,button:focus-visible .nav-anim-heart,
button:hover .nav-anim-plunger,button:focus-visible .nav-anim-plunger,
button:hover .nav-anim-lid,button:focus-visible .nav-anim-lid{
  animation-duration:1.3s;
}
button:hover .nav-anim-clock-min,button:focus-visible .nav-anim-clock-min{
  animation-duration:1.8s;
}
button:hover .nav-anim-ecg,button:focus-visible .nav-anim-ecg{
  animation-duration:1.2s;
}

@media (prefers-reduced-motion:reduce){
  .nav-anim-svg *{
    animation:none!important;
    transform:none!important;
    stroke-dashoffset:0!important;
    opacity:1!important;
  }
}
`;

export function useNavIconStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('nav-anim-icon-styles')) return;
    const style = document.createElement('style');
    style.id = 'nav-anim-icon-styles';
    style.textContent = NAV_ICON_ANIM_CSS;
    document.head.appendChild(style);
  }, []);
}

export interface AnimatedIconProps {
  className?: string;
}

export const AnimatedUsersIcon: React.FC<AnimatedIconProps> = ({ className = 'w-5 h-5' }) => {
  useNavIconStyles();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`nav-anim-svg ${className}`}
      aria-hidden="true"
    >
      <g className="nav-anim-u1">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </g>
      <g className="nav-anim-u2">
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </g>
    </svg>
  );
};

export const AnimatedHeartPulseIcon: React.FC<AnimatedIconProps> = ({ className = 'w-5 h-5' }) => {
  useNavIconStyles();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`nav-anim-svg ${className}`}
      aria-hidden="true"
    >
      <g className="nav-anim-heart">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </g>
      <path
        className="nav-anim-ecg"
        pathLength={100}
        d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"
      />
    </svg>
  );
};

export const AnimatedSyringeIcon: React.FC<AnimatedIconProps> = ({ className = 'w-5 h-5' }) => {
  useNavIconStyles();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`nav-anim-svg ${className}`}
      aria-hidden="true"
    >
      <g className="nav-anim-plunger">
        <path d="m18 2 4 4" />
        <path d="m17 7 3-3" />
      </g>
      <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" />
      <path d="m9 11 4 4" />
      <path d="m5 19-3 3" />
      <path d="m14 4 6 6" />
      <circle className="nav-anim-drop" cx="2.3" cy="21.8" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
};

export const AnimatedFileTextIcon: React.FC<AnimatedIconProps> = ({ className = 'w-5 h-5' }) => {
  useNavIconStyles();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`nav-anim-svg ${className}`}
      aria-hidden="true"
    >
      <g className="nav-anim-doc">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path className="nav-anim-line nav-anim-l1" pathLength={100} d="M10 9H8" />
        <path className="nav-anim-line nav-anim-l2" pathLength={100} d="M16 13H8" />
        <path className="nav-anim-line nav-anim-l3" pathLength={100} d="M16 17H8" />
      </g>
    </svg>
  );
};

export const AnimatedCalendarClockIcon: React.FC<AnimatedIconProps> = ({ className = 'w-5 h-5' }) => {
  useNavIconStyles();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`nav-anim-svg ${className}`}
      aria-hidden="true"
    >
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h5" />
      <circle cx="16" cy="16" r="6" />
      <path className="nav-anim-clock-hour" d="M16 16v-2.4" />
      <path className="nav-anim-clock-min" d="M16 16l2.2 1.4" />
    </svg>
  );
};

export const AnimatedArchiveIcon: React.FC<AnimatedIconProps> = ({ className = 'w-5 h-5' }) => {
  useNavIconStyles();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`nav-anim-svg ${className}`}
      aria-hidden="true"
    >
      <rect className="nav-anim-lid" width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path className="nav-anim-handle" d="M10 12h4" />
    </svg>
  );
};
