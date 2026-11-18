// Lucian UX/UI Prompt #214 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#214
import React, { useEffect, useRef, useState } from 'react';
import { Patient, ScheduleItem } from '../types';
import {
  isIn,
  isOut,
  fromIso,
  isoDay,
  DAY,
  dm,
  WD,
  hm,
  ageText,
  TYPE_LABELS,
  dmy,
  isNewAdmitted
} from '../lib/constants';
import {
  ArrowRight,
  ShieldCheck,
  LogOut,
  Clock
} from 'lucide-react';
import {
  AnimatedUsersIcon,
  AnimatedHeartPulseIcon,
  AnimatedSyringeIcon,
  AnimatedFileTextIcon,
  AnimatedCalendarClockIcon,
  AnimatedArchiveIcon,
} from './AnimatedNavIcons';
import { TabKey } from './Navigation';

type BentoCardId = 'occ' | 'in' | 'out' | 'chart' | 'avg' | 'new' | 'proc' | 'sec';

const U214_DASHBOARD_CSS = `
.ux.u214-host{
  --ux-page:#F3F4F1;
  --ux-surface:#FFFFFF;
  --ux-surface-2:#F9FAF9;
  --ux-surface-3:#EEF0ED;
  --ux-ink:#17201D;
  --ux-ink-2:#3A4540;
  --ux-ink-3:#56615C;
  --ux-line:rgba(15,47,42,.09);
  --ux-line-2:rgba(15,47,42,.17);
  --ux-accent:#0E6B5E;
  --ux-accent-2:#0A8A76;
  --ux-accent-soft:rgba(14,107,94,.12);
  --ux-accent-ink:#FFFFFF;
  --ux-mint:#10B981;
  --ux-warn:#D6731E;
  --ux-danger:#D93A55;
  --ux-glass:rgba(255,255,255,.65);
  --ux-glass-line:rgba(255,255,255,.88);
  --ux-shadow:rgba(15,47,42,.14);
  --ux-shadow-strong:rgba(15,47,42,.26);
  --ux-grad:linear-gradient(120deg,#0E6B5E,#0A8A76 55%,#10B981);
  --ux-ease:cubic-bezier(.2,.8,.2,1);
  --ux-spring:cubic-bezier(.34,1.45,.64,1);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .ux.u214-host{
    --ux-page:#07080D;
    --ux-surface:#13141C;
    --ux-surface-2:#1A1B25;
    --ux-surface-3:#252632;
    --ux-ink:#F4F0E8;
    --ux-ink-2:rgba(244,240,232,.68);
    --ux-ink-3:rgba(244,240,232,.42);
    --ux-line:rgba(255,255,255,.08);
    --ux-line-2:rgba(255,255,255,.16);
    --ux-accent:#B7A4FF;
    --ux-accent-2:#7DB4FF;
    --ux-accent-soft:rgba(183,164,255,.15);
    --ux-accent-ink:#0B0C12;
    --ux-mint:#7EE8C0;
    --ux-warn:#FFB26B;
    --ux-danger:#FF7D8C;
    --ux-glass:rgba(255,255,255,.07);
    --ux-glass-line:rgba(255,255,255,.18);
    --ux-shadow:rgba(0,0,0,.45);
    --ux-shadow-strong:rgba(0,0,0,.72);
    --ux-grad:linear-gradient(120deg,#B7A4FF,#7DB4FF 55%,#A5F2D3);
  }
}
:root[data-theme="dark"] .ux.u214-host{
  --ux-page:#07080D;
  --ux-surface:#13141C;
  --ux-surface-2:#1A1B25;
  --ux-surface-3:#252632;
  --ux-ink:#F4F0E8;
  --ux-ink-2:rgba(244,240,232,.68);
  --ux-ink-3:rgba(244,240,232,.42);
  --ux-line:rgba(255,255,255,.08);
  --ux-line-2:rgba(255,255,255,.16);
  --ux-accent:#B7A4FF;
  --ux-accent-2:#7DB4FF;
  --ux-accent-soft:rgba(183,164,255,.15);
  --ux-accent-ink:#0B0C12;
  --ux-mint:#7EE8C0;
  --ux-warn:#FFB26B;
  --ux-danger:#FF7D8C;
  --ux-glass:rgba(255,255,255,.07);
  --ux-glass-line:rgba(255,255,255,.18);
  --ux-shadow:rgba(0,0,0,.45);
  --ux-shadow-strong:rgba(0,0,0,.72);
  --ux-grad:linear-gradient(120deg,#B7A4FF,#7DB4FF 55%,#A5F2D3);
}
.ux.u214-host :focus-visible{outline:2px solid var(--ux-accent);outline-offset:2px}

.ux.u214-host .u214-card{
  transition:transform .35s cubic-bezier(.3,1.4,.5,1),box-shadow .3s,border-color .3s;
}
.ux.u214-host .u214-card:hover,
.ux.u214-host .u214-card.is-on,
.ux.u214-host .u214-card:focus-within{
  transform:translateY(-3px);
  border-color:color-mix(in srgb,var(--ux-accent) 55%,transparent);
  box-shadow:0 14px 26px -16px var(--ux-accent);
}

/* Collaboration avatars + typing pill inside existing New Admissions card */
.ux.u214-host .u214-av{display:inline-flex;align-items:center}
.ux.u214-host .u214-av i{
  width:16px;height:16px;border-radius:50%;
  border:2px solid var(--ux-surface-2);
  margin-left:-5px;
  transition:transform .45s cubic-bezier(.3,1.5,.5,1);
}
.ux.u214-host .u214-av i:nth-child(1){background:#0E6B5E;transform:translateX(12px)}
.ux.u214-host .u214-av i:nth-child(2){background:#2F8FE0;transform:translateX(6px)}
.ux.u214-host .u214-av i:nth-child(3){background:#10B981}
.ux.u214-host .u214-card.is-on .u214-av i,
.ux.u214-host .u214-card:hover .u214-av i,
.ux.u214-host .u214-card:focus-within .u214-av i{transform:none}

.ux.u214-host .u214-ty{
  height:24px;padding:0 9px;border-radius:8px;
  background:var(--ux-surface-2);
  box-shadow:inset 0 0 0 1px var(--ux-line);
  display:flex;align-items:center;gap:4px;
  font-size:11px;font-weight:650;color:var(--ux-ink-2);
  overflow:hidden;
}
.ux.u214-host .u214-ty span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ux.u214-host .u214-cur{
  display:inline-block;width:1.5px;height:11px;background:var(--ux-accent);flex-shrink:0;
  animation:u214-blink 1s step-end infinite;
}
@keyframes u214-blink{0%,100%{opacity:1}50%{opacity:0}}

/* Search query pill + staggered bars inside existing Today's Procedures card */
.ux.u214-host .u214-sb{
  height:24px;padding:0 8px;border-radius:8px;
  background:var(--ux-surface-2);
  box-shadow:inset 0 0 0 1px var(--ux-line);
  display:flex;align-items:center;gap:5px;
  font-size:11px;font-weight:650;color:var(--ux-ink-2);
  overflow:hidden;
}
.ux.u214-host .u214-sr{display:grid;gap:5px}
.ux.u214-host .u214-sr span{
  display:block;height:6px;border-radius:99px;
  background:var(--ux-surface-3);
  transform-origin:left center;
  transform:scaleX(.32);
  transition:transform .45s cubic-bezier(.3,1.3,.5,1),background .3s;
  transition-delay:calc(var(--i) * 45ms);
}
.ux.u214-host .u214-card.is-on .u214-sr span,
.ux.u214-host .u214-card:hover .u214-sr span,
.ux.u214-host .u214-card:focus-within .u214-sr span{
  transform:scaleX(var(--w));
  background:color-mix(in srgb,var(--ux-accent) 42%,var(--ux-surface-3));
}
.ux.u214-host .u214-card.is-on .u214-sr span:first-child,
.ux.u214-host .u214-card:hover .u214-sr span:first-child,
.ux.u214-host .u214-card:focus-within .u214-sr span:first-child{
  background:var(--ux-accent);
}

/* Staggered bar growth inside existing 14-day chart, Avg Stay sparkline & KPI progress bar */
.ux.u214-host .u214-bars{height:36px;display:flex;align-items:flex-end;gap:4px}
.ux.u214-host .u214-bar{
  width:7px;height:100%;border-radius:3px 3px 1px 1px;
  background:color-mix(in srgb,var(--ux-accent) 30%,var(--ux-surface-3));
  transform-origin:bottom center;
  transform:scaleY(calc(var(--h) * .28));
  transition:transform .45s cubic-bezier(.3,1.3,.5,1),background .3s;
  transition-delay:calc(var(--i) * 45ms);
}
.ux.u214-host .u214-card.is-on .u214-bar,
.ux.u214-host .u214-card:hover .u214-bar,
.ux.u214-host .u214-card:focus-within .u214-bar{
  transform:scaleY(var(--h));
  background:var(--ux-grad);
}
.ux.u214-host .u214-chart-bar{
  transform-origin:bottom center;
  transition:background-color .35s cubic-bezier(.3,1.3,.5,1),filter .3s;
}
.ux.u214-host .u214-card.is-on .u214-chart-bar,
.ux.u214-host .u214-card:hover .u214-chart-bar,
.ux.u214-host .u214-card:focus-within .u214-chart-bar{
  background:var(--ux-grad);
  animation:u214-bar-wave .48s cubic-bezier(.3,1.3,.5,1) calc(var(--i) * 35ms) both;
}
@keyframes u214-bar-wave{
  0%{transform:scaleY(.22)}
  68%{transform:scaleY(1.06)}
  100%{transform:scaleY(1)}
}
.ux.u214-host .u214-chart-line{
  stroke-dasharray:100;
  stroke-dashoffset:0;
}
.ux.u214-host .u214-card.is-on .u214-chart-line,
.ux.u214-host .u214-card:hover .u214-chart-line,
.ux.u214-host .u214-card:focus-within .u214-chart-line{
  animation:u214-line-draw .7s var(--ux-ease) both;
}
@keyframes u214-line-draw{
  0%{stroke-dashoffset:100}
  100%{stroke-dashoffset:0}
}
.ux.u214-host .u214-chart-dot{
  transform-origin:center center;
}
.ux.u214-host .u214-card.is-on .u214-chart-dot,
.ux.u214-host .u214-card:hover .u214-chart-dot,
.ux.u214-host .u214-card:focus-within .u214-chart-dot{
  animation:u214-dot-pop .42s cubic-bezier(.3,1.3,.5,1) calc(var(--i) * 35ms) both;
}
@keyframes u214-dot-pop{
  0%{transform:scale(.45);opacity:.4}
  68%{transform:scale(1.22);opacity:1}
  100%{transform:scale(1);opacity:1}
}
.ux.u214-host .u214-occ-ring{
  transition:stroke-dashoffset .55s var(--ux-ease),stroke .3s;
}
.ux.u214-host .u214-card.is-on .u214-occ-ring,
.ux.u214-host .u214-card:hover .u214-occ-ring,
.ux.u214-host .u214-card:focus-within .u214-occ-ring{
  animation:u214-occ-ring-fill .65s var(--ux-ease) both;
}
@keyframes u214-occ-ring-fill{
  0%{stroke-dashoffset:100}
  100%{stroke-dashoffset:var(--occ-offset)}
}

/* Shield twin pulse rings inside existing Staff Account card */
.ux.u214-host .u214-sh{
  position:relative;
  width:34px;height:34px;border-radius:10px;
  background:var(--ux-accent-soft);
  color:var(--ux-accent);
  display:grid;place-items:center;flex-shrink:0;
}
.ux.u214-host .u214-sh::before,
.ux.u214-host .u214-sh::after{
  content:"";position:absolute;inset:0;border-radius:inherit;
  border:1.5px solid var(--ux-accent);opacity:0;pointer-events:none;
}
.ux.u214-host .u214-card.is-on .u214-sh::before,
.ux.u214-host .u214-card:hover .u214-sh::before,
.ux.u214-host .u214-card:focus-within .u214-sh::before{animation:u214-pulse 1.4s ease-out infinite}
.ux.u214-host .u214-card.is-on .u214-sh::after,
.ux.u214-host .u214-card:hover .u214-sh::after,
.ux.u214-host .u214-card:focus-within .u214-sh::after{animation:u214-pulse 1.4s ease-out .7s infinite}
@keyframes u214-pulse{
  0%{transform:scale(1);opacity:.55}
  100%{transform:scale(1.68);opacity:0}
}

/* Integrations marquee strip inside existing Staff Account card */
.ux.u214-host .u214-mq{
  overflow:hidden;max-width:220px;
  mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);
}
.ux.u214-host .u214-lt{
  display:flex;gap:6px;width:max-content;
  animation:u214-mq 9s linear infinite paused;
}
.ux.u214-host .u214-card.is-on .u214-lt,
.ux.u214-host .u214-card:hover .u214-lt,
.ux.u214-host .u214-card:focus-within .u214-lt{
  animation-duration:3.6s;animation-play-state:running;
}
.ux.u214-host .u214-lt button{
  width:24px;height:24px;border-radius:7px;
  background:var(--ux-surface-2);
  box-shadow:inset 0 0 0 1px var(--ux-line);
  display:grid;place-items:center;
  font-size:9px;font-weight:850;color:var(--ux-ink-2);
  flex-shrink:0;border:0;cursor:pointer;
}
.ux.u214-host .u214-lt button:hover{color:var(--ux-accent);background:var(--ux-accent-soft)}
@keyframes u214-mq{
  from{transform:translateX(0)}
  to{transform:translateX(-50%)}
}

@media (prefers-reduced-motion:reduce){
  .ux.u214-host,.ux.u214-host *,.ux.u214-host *::before,.ux.u214-host *::after{
    animation-duration:.001ms!important;
    animation-iteration-count:1!important;
    transition-duration:.001ms!important;
    scroll-behavior:auto!important;
  }
  .ux.u214-host .u214-av i{transform:none}
  .ux.u214-host .u214-sr span{transform:scaleX(var(--w))}
  .ux.u214-host .u214-bar{transform:scaleY(var(--h));background:var(--ux-grad)}
  .ux.u214-host .u214-chart-bar,.ux.u214-host .u214-chart-dot{animation:none!important;transform:none!important}
  .ux.u214-host .u214-occ-ring{animation:none!important;stroke-dashoffset:var(--occ-offset)!important}
  .ux.u214-host .u214-chart-line{animation:none!important;stroke-dashoffset:0!important}
  .ux.u214-host .u214-lt{animation:none;transform:none}
}
`;

const MODULE_LINKS: Array<{ code: string; label: string; tab: TabKey }> = [
  { code: 'BN', label: 'Bệnh nhân', tab: 'bn' },
  { code: 'DH', label: 'DHST / Diễn biến', tab: 'dhst' },
  { code: 'ĐH', label: 'Báo đường huyết', tab: 'duonghuyet' },
  { code: 'TC', label: 'Báo cáo trực', tab: 'truc' },
  { code: 'LC', label: 'Lịch chỉ định', tab: 'lich' },
  { code: 'CŨ', label: 'Bệnh nhân cũ', tab: 'cu' },
];

interface DashboardTabProps {
  patients: Patient[];
  scheds: ScheduleItem[];
  beds: number;
  onUpdateBeds: (beds: number) => void;
  onGoToPatients: () => void;
  onGoToSchedule: () => void;
  onOpenDischargedList: () => void;
  onGoToScheduledDischarges?: () => void;
  onSignOut: () => void;
  onSelectTab?: (tab: TabKey) => void;
  todayGlucoseCount?: number;
  userEmail?: string | null;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  patients,
  scheds,
  beds,
  onGoToPatients,
  onGoToSchedule,
  onOpenDischargedList,
  onGoToScheduledDischarges,
  onSignOut,
  onSelectTab,
  todayGlucoseCount = 0,
  userEmail,
}) => {
  const now = Date.now();
  const today = isoDay(now);
  const activePatients = patients.filter((p) => isIn(p, now));
  const activeCount = activePatients.length;
  const occPct = Math.round((activeCount / Math.max(beds, 1)) * 100);
  const freeBeds = Math.max(0, beds - activeCount);

  // Today admissions and discharges
  const todayStart = fromIso(today);
  const inToday = patients.filter((p) => p.admitAt >= todayStart).length;
  const outToday = patients.filter((p) => isOut(p, now) && (p.outAt || 0) >= todayStart).length;

  const from7 = todayStart - 6 * DAY;
  const in7 = patients.filter((p) => p.admitAt >= from7).length;
  const out7 = patients.filter((p) => isOut(p, now) && (p.outAt || 0) >= from7).length;

  // Procedures today
  const todayScheds = scheds.filter((s) => s.date === today);
  const procToday = todayScheds.length;
  const tiemToday = todayScheds.filter((s) => s.type === 'tiem').length;
  const dienToday = procToday - tiemToday;
  const pendingProcToday = todayScheds.filter((s) => !s.done).length;

  // Newly admitted in current clinical shift (7h -> 6h59)
  const newPatients = activePatients
    .filter((p) => isNewAdmitted(p.admitAt, now))
    .sort((a, b) => b.admitAt - a.admitAt);

  // Pending discharges (waiting)
  const pendingDischarges = patients.filter(
    (p) => p.status === 'out' && p.outAt != null && p.outAt > now
  ).length;

  // 14-day series for census chart
  const series = [];
  let maxIO = 1;
  for (let i = 13; i >= 0; i--) {
    const a = todayStart - i * DAY;
    const b = a + DAY;
    const nin = patients.filter((p) => p.admitAt >= a && p.admitAt < b).length;
    const nout = patients.filter((p) => isOut(p, now) && (p.outAt || 0) >= a && (p.outAt || 0) < b).length;
    const end = Math.min(b, now);
    const census = patients.filter((p) => p.admitAt < end && (isIn(p, end) || (p.outAt || 0) >= end)).length;
    maxIO = Math.max(maxIO, nin, nout);
    series.push({ a, nin, nout, census, isToday: i === 0 });
  }

  const maxVal = Math.max(beds, 1, ...series.map((d) => Math.max(d.census, d.nin, d.nout)));
  const yv = (v: number) => Math.round((v / maxVal) * 150);
  const inPts = series.map((d, i) => `${(i + 0.5) * 100},${150 - yv(d.nin)}`).join(' ');
  const outPts = series.map((d, i) => `${(i + 0.5) * 100},${150 - yv(d.nout)}`).join(' ');

  // Ngày điều trị trung bình thực tế trong 7 ngày
  const out7DaysPatients = patients.filter(
    (p) => isOut(p, now) && (p.outAt || 0) >= from7 && (p.outAt || 0) <= now
  );

  const outStayDays = out7DaysPatients.map((p) => {
    const admitDate = fromIso(isoDay(p.admitAt));
    const outDate = fromIso(isoDay(p.outAt || now));
    const diff = Math.round((outDate - admitDate) / DAY);
    return Math.max(1, diff === 0 ? 1 : diff);
  });

  const avgOutStay =
    outStayDays.length > 0
      ? outStayDays.reduce((sum, d) => sum + d, 0) / outStayDays.length
      : null;

  const activeStayDays = activePatients.map((p) => {
    const admitDate = fromIso(isoDay(p.admitAt));
    const currentDate = fromIso(isoDay(now));
    const diff = Math.round((currentDate - admitDate) / DAY);
    return Math.max(1, diff === 0 ? 1 : diff);
  });

  const avgActiveStay =
    activeStayDays.length > 0
      ? activeStayDays.reduce((sum, d) => sum + d, 0) / activeStayDays.length
      : null;

  const hasOutData = avgOutStay !== null;
  const primaryAvg = hasOutData ? avgOutStay : avgActiveStay;
  const primaryAvgFormatted = primaryAvg !== null ? (Math.round(primaryAvg * 10) / 10).toFixed(1) : '—';
  const minStay = outStayDays.length > 0 ? Math.min(...outStayDays) : null;
  const maxStay = outStayDays.length > 0 ? Math.max(...outStayDays) : null;

  const last6Series = series.slice(-6);
  const maxCensus6 = Math.max(1, ...last6Series.map((d) => d.census));
  const bentoBars = last6Series.map((d) =>
    d.census <= 0
      ? 0.22
      : Number(Math.max(0.28, Math.min(1, d.census / maxCensus6)).toFixed(2))
  );

  const [activeBento, setActiveBento] = useState<BentoCardId | null>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el) return;
    const scrollToToday = () => {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    };
    scrollToToday();
    const raf = window.requestAnimationFrame(scrollToToday);
    return () => window.cancelAnimationFrame(raf);
  }, [today]);
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const newHandoverTarget =
    newPatients.length > 0
      ? `Bàn giao ${newPatients.length} ca mới · ${newPatients[0].room}`
      : `Đang theo dõi ${activeCount} ca nội trú`;

  const firstSched = todayScheds[0];
  const firstSchedPt = firstSched ? patients.find((p) => p.id === firstSched.patientId) : null;
  const procSearchTarget = firstSched
    ? `${firstSched.time} · ${TYPE_LABELS[firstSched.type]}${firstSchedPt ? ` (${firstSchedPt.room})` : ''}`
    : `${procToday} chỉ định · ${todayGlucoseCount} test ĐH`;

  const [typedNew, setTypedNew] = useState<string>(newHandoverTarget);
  const [typedProc, setTypedProc] = useState<string>(procSearchTarget);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (activeBento !== 'new' || prefersReduced) {
      setTypedNew(newHandoverTarget);
      return;
    }
    let idx = 0;
    setTypedNew('');
    const timer = window.setInterval(() => {
      idx += 1;
      setTypedNew(newHandoverTarget.slice(0, idx));
      if (idx >= newHandoverTarget.length) window.clearInterval(timer);
    }, 45);
    return () => window.clearInterval(timer);
  }, [activeBento, newHandoverTarget, prefersReduced]);

  useEffect(() => {
    if (activeBento !== 'proc' || prefersReduced) {
      setTypedProc(procSearchTarget);
      return;
    }
    let idx = 0;
    setTypedProc('');
    const timer = window.setInterval(() => {
      idx += 1;
      setTypedProc(procSearchTarget.slice(0, idx));
      if (idx >= procSearchTarget.length) window.clearInterval(timer);
    }, 45);
    return () => window.clearInterval(timer);
  }, [activeBento, procSearchTarget, prefersReduced]);

  const cardEvents = (id: BentoCardId) => ({
    onMouseEnter: () => setActiveBento(id),
    onMouseLeave: () => setActiveBento((prev) => (prev === id ? null : prev)),
    onFocus: () => setActiveBento(id),
    onBlur: () => setActiveBento((prev) => (prev === id ? null : prev)),
  });

  return (
    <div className="ux u214-host space-y-5">
      <style>{U214_DASHBOARD_CSS}</style>
      {/* Mobile Navigation Hub: Lưới các nút lớn ngay trên trang chính trên mobile */}
      <div className="block md:hidden space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-[#0F2F2A] uppercase tracking-wider">
            Chức năng chính
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Nút 1: Bệnh nhân */}
          <button
            type="button"
            onClick={onGoToPatients}
            className="u214-card p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0E6B5E] flex items-center justify-center font-bold">
                <AnimatedUsersIcon className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E4F0EC] text-[#0B5C51]">
                {activeCount} BN
              </span>
            </div>
            <div>
              <strong className="text-xs font-bold text-[#0F2F2A] block">Bệnh nhân</strong>
            </div>
          </button>

          {/* Nút 2: DHST & Diễn biến */}
          <button
            type="button"
            onClick={() => onSelectTab && onSelectTab('dhst')}
            className="u214-card p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <AnimatedHeartPulseIcon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <strong className="text-xs font-bold text-[#0F2F2A] block">DHST / Diễn biến</strong>
            </div>
          </button>

          {/* Nút 3: Báo đường huyết */}
          <button
            type="button"
            onClick={() => onSelectTab && onSelectTab('duonghuyet')}
            className="u214-card p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <AnimatedSyringeIcon className="w-5 h-5" />
              </div>
              {todayGlucoseCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  {todayGlucoseCount} test
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                  Toàn khoa
                </span>
              )}
            </div>
            <div>
              <strong className="text-xs font-bold text-[#0F2F2A] block">Báo đường huyết</strong>
            </div>
          </button>

          {/* Nút 4: Báo cáo trực */}
          <button
            type="button"
            onClick={() => onSelectTab && onSelectTab('truc')}
            className="u214-card p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <AnimatedFileTextIcon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <strong className="text-xs font-bold text-[#0F2F2A] block">Báo cáo trực</strong>
            </div>
          </button>

          {/* Nút 5: Lịch chỉ định */}
          <button
            type="button"
            onClick={onGoToSchedule}
            className="u214-card p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                <AnimatedCalendarClockIcon className="w-5 h-5" />
              </div>
              {pendingProcToday > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F0A061] text-[#2A1404]">
                  {pendingProcToday} chờ
                </span>
              )}
            </div>
            <div>
              <strong className="text-xs font-bold text-[#0F2F2A] block">Lịch chỉ định</strong>
            </div>
          </button>

          {/* Nút 6: Bệnh nhân cũ */}
          <button
            type="button"
            onClick={() => onSelectTab ? onSelectTab('cu') : onOpenDischargedList()}
            className="u214-card p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0E6B5E] flex items-center justify-center font-bold">
                <AnimatedArchiveIcon className="w-5 h-5" />
              </div>
              {pendingDischarges > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  {pendingDischarges} chờ
                </span>
              )}
            </div>
            <div>
              <strong className="text-xs font-bold text-[#0F2F2A] block">Bệnh nhân cũ</strong>
            </div>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (Square Bed Occupancy on left + 2 stacked rectangles on right) */}
      <div className="grid grid-cols-2 grid-rows-2 sm:grid-cols-[176px_minmax(0,1fr)] lg:grid-cols-[192px_minmax(0,1fr)] gap-3 md:gap-4 items-stretch">
        {/* Bed occupancy (Square with perimeter progress ring) */}
        <div
          {...cardEvents('occ')}
          className={`u214-card row-span-2 relative aspect-square overflow-hidden bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs flex flex-col justify-between ${
            activeBento === 'occ' ? 'is-on' : ''
          }`}
        >
          {/* Perimeter % progress bar wrapping all 4 edges clockwise */}
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 w-full h-full"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="96"
              height="96"
              rx="9"
              ry="9"
              fill="none"
              stroke="#E6E9E5"
              strokeWidth="4"
            />
            {occPct > 0 && (
              <rect
                x="2"
                y="2"
                width="96"
                height="96"
                rx="9"
                ry="9"
                pathLength={100}
                fill="none"
                stroke={occPct >= 90 ? '#C2410C' : '#0A8A76'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={100}
                strokeDashoffset={100 - Math.min(100, Math.max(0, occPct))}
                className="u214-occ-ring"
                style={
                  {
                    '--occ-offset': 100 - Math.min(100, Math.max(0, occPct)),
                  } as React.CSSProperties
                }
              />
            )}
          </svg>

          <div className="relative z-10 text-xs font-semibold text-[#56615C] leading-tight">
            Công suất giường
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold text-[#0F2F2A] leading-none">{occPct}%</div>
            <div className="text-[11px] text-[#56615C] font-medium mt-1">
              {activeCount}/{beds} đang điều trị
            </div>
          </div>
          <div className="relative z-10 text-[11px] text-[#56615C]">
            Còn trống: <strong className="text-emerald-700">{freeBeds}</strong> giường
          </div>
        </div>

        {/* Admissions today (Top stacked rectangle) */}
        <div
          {...cardEvents('in')}
          className={`u214-card bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-[#DDE1DC] shadow-xs flex items-center justify-between gap-2 min-w-0 ${
            activeBento === 'in' ? 'is-on' : ''
          }`}
        >
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs font-semibold text-[#56615C] truncate">
              Vào viện hôm nay
            </div>
            <div className="text-[11px] text-[#56615C] mt-0.5 truncate">
              7 ngày qua: <strong>{in7}</strong> ca
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0A6E5E] leading-none shrink-0">
            {inToday}
          </div>
        </div>

        {/* Discharges today (Bottom stacked rectangle) */}
        <div
          {...cardEvents('out')}
          className={`u214-card bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-[#DDE1DC] shadow-xs flex items-center justify-between gap-2 min-w-0 ${
            activeBento === 'out' ? 'is-on' : ''
          }`}
        >
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs font-semibold text-[#56615C] truncate">
              Ra viện hôm nay
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#56615C] mt-0.5 whitespace-nowrap">
              <span>
                Chờ ra: <strong>{pendingDischarges}</strong>
              </span>
              <button
                type="button"
                onClick={onGoToScheduledDischarges || onGoToPatients}
                className="text-[#0E6B5E] hover:underline font-semibold cursor-pointer"
                title="Xem danh sách ra viện"
              >
                Xem DS
              </button>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#A4521A] leading-none shrink-0">
            {outToday}
          </div>
        </div>
      </div>

      {/* Main Content: Chart + Right Aside */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 14-day Chart */}
        <div
          {...cardEvents('chart')}
          className={`u214-card lg:col-span-8 bg-white p-4 md:p-5 rounded-2xl border border-[#DDE1DC] shadow-xs flex flex-col justify-between ${
            activeBento === 'chart' ? 'is-on' : ''
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">Biểu đồ điều trị, vào & ra viện</h2>
              <p className="text-xs text-[#56615C] mt-0.5">14 ngày gần nhất · Nét đứt = công suất {beds} giường</p>
            </div>
            {/* Chart Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#3A4540]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#BCD9D2]"></span>
                Tổng BN (cột)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#2A6FBF] relative flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#2A6FBF] ring-1 ring-white"></span>
                </span>
                Vào viện
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#D9782B] relative flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#D9782B] ring-1 ring-white"></span>
                </span>
                Ra viện
              </span>
            </div>
          </div>

          {/* SVG & Bar Chart */}
          <div ref={chartScrollRef} className="overflow-x-auto">
            <div className="min-w-[520px] pt-4">
              <div className="relative h-44 flex items-end border-b border-[#C3CAC4]">
                {/* Bed capacity dashed line */}
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-[#8A948F]/70 pointer-events-none z-10"
                  style={{ bottom: `${yv(beds)}px` }}
                  title={`Tổng số giường: ${beds}`}
                ></div>

                {/* Bars */}
                {series.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full px-1 hover:bg-[#F3F4F1] rounded-t-lg transition-colors group relative cursor-pointer"
                    title={`${WD[new Date(d.a).getDay()]} ${dm(d.a)}: ${d.census} BN (${Math.round((d.census / beds) * 100)}% giường) · Vào: ${d.nin} · Ra: ${d.nout}`}
                  >
                    <span className="text-[10px] text-[#56615C] group-hover:font-bold group-hover:text-[#0F2F2A] mb-1">
                      {d.census}
                    </span>
                    <div
                      className="u214-chart-bar w-full max-w-[26px] bg-[#BCD9D2] rounded-t-md group-hover:bg-[#92C4B9]"
                      style={{ height: `${yv(d.census)}px`, '--i': idx } as React.CSSProperties}
                    />
                  </div>
                ))}

                {/* Polylines for admission and discharge */}
                <svg
                  viewBox="0 0 1400 150"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                >
                  {/* Line for In */}
                  <polyline
                    points={inPts}
                    pathLength={100}
                    className="u214-chart-line"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={inPts}
                    pathLength={100}
                    className="u214-chart-line"
                    fill="none"
                    stroke="#2A6FBF"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Line for Out */}
                  <polyline
                    points={outPts}
                    pathLength={100}
                    className="u214-chart-line"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={outPts}
                    pathLength={100}
                    className="u214-chart-line"
                    fill="none"
                    stroke="#D9782B"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* Dots on points */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {series.map((d, idx) => (
                    <div key={idx} className="flex-1 relative">
                      <span
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{ bottom: `${yv(d.nin) - 5}px` }}
                      >
                        <span
                          className="u214-chart-dot block w-2.5 h-2.5 rounded-full bg-[#2A6FBF] ring-2 ring-white shadow-xs"
                          style={{ '--i': idx } as React.CSSProperties}
                        />
                      </span>
                      <span
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{ bottom: `${yv(d.nout) - 5}px` }}
                      >
                        <span
                          className="u214-chart-dot block w-2.5 h-2.5 rounded-full bg-[#D9782B] ring-2 ring-white shadow-xs"
                          style={{ '--i': idx } as React.CSSProperties}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* X Axis labels */}
              <div className="flex pt-2 text-[11px] text-[#56615C]">
                {series.map((d, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 text-center truncate ${
                      d.isToday ? 'font-bold text-[#0F2F2A]' : ''
                    }`}
                  >
                    {d.isToday ? 'Hôm nay' : dm(d.a)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Aside: Briefing, 24h admits, today's schedule */}
        <div className="lg:col-span-4 space-y-4">
          {/* Ô: Ngày điều trị trung bình dựa vào trung bình thực tế trong 7 ngày */}
          <div
            {...cardEvents('avg')}
            className={`u214-card bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs space-y-3 ${
              activeBento === 'avg' ? 'is-on' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0E6B5E] flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0F2F2A] leading-tight">
                    Ngày điều trị trung bình
                  </h3>
                  <p className="text-[11px] text-[#56615C]">Thực tế 7 ngày gần nhất</p>
                </div>
              </div>
              <div className="u214-bars shrink-0" title="Xu hướng công suất 6 ngày gần nhất" aria-hidden="true">
                {bentoBars.map((h, i) => (
                  <span
                    key={i}
                    className="u214-bar"
                    style={{ '--i': i, '--h': h } as React.CSSProperties}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0E6B5E] tracking-tight">
                {primaryAvgFormatted}
              </span>
              <span className="text-xs font-semibold text-gray-600">ngày / bệnh nhân</span>
            </div>

            <div className="pt-2.5 border-t border-[#EEF0ED] space-y-1.5 text-xs text-[#56615C]">
              {hasOutData ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Số ca ra viện 7 ngày:</span>
                    <strong className="text-[#0F2F2A]">{out7DaysPatients.length} ca</strong>
                  </div>
                  {minStay !== null && maxStay !== null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Khoảng thời gian nằm:</span>
                      <span className="text-[#3A4540] font-medium">{minStay} - {maxStay} ngày</span>
                    </div>
                  )}
                  {avgActiveStay !== null && (
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Ca đang điều trị (n={activePatients.length}):</span>
                      <span>TB {(Math.round(avgActiveStay * 10) / 10).toFixed(1)} ngày</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span>Bệnh nhân đang điều trị:</span>
                    <strong className="text-[#0F2F2A]">{activePatients.length} bệnh nhân</strong>
                  </div>
                  <p className="text-[11px] text-gray-500 italic">
                    (Chưa có ca ra viện trong 7 ngày, tính theo ngày nằm trung bình hiện tại)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* New Admissions (Collaboration scene: gathering avatars + typing handover strip) */}
          <div
            {...cardEvents('new')}
            className={`u214-card bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden ${
              activeBento === 'new' ? 'is-on' : ''
            }`}
          >
            <div className="flex items-center justify-between p-3.5 bg-[#F9FAF9] border-b border-[#E6E9E5] gap-2">
              <div className="font-bold text-xs text-[#0F2F2A] flex items-center gap-2">
                <span>Mới nhập viện</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                  {newPatients.length}
                </span>
                <span className="u214-av" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <button
                type="button"
                onClick={onGoToPatients}
                className="text-xs text-[#0E6B5E] hover:underline font-semibold flex items-center gap-0.5 shrink-0"
              >
                Xem tất cả <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="px-3.5 pt-2.5">
              <div className="u214-ty" aria-hidden="true">
                <span>{typedNew}</span>
                <em className="u214-cur" />
              </div>
            </div>

            <div className="divide-y divide-[#EEF0ED] max-h-52 overflow-y-auto">
              {!newPatients.length ? (
                <div className="p-4 text-xs text-center text-[#56615C]">Chưa có bệnh nhân mới nhập viện.</div>
              ) : (
                newPatients.slice(0, 5).map((p) => (
                  <div key={p.id} className="p-3 flex items-center gap-2.5 text-xs">
                    <span className="px-2 py-1 rounded-md bg-[#0F2F2A] text-white font-bold text-[11px] shrink-0">
                      {p.room}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[#17201D] truncate">{p.name}</div>
                      <div className="text-[#56615C] text-[11px]">{ageText(p)} · vào {hm(p.admitAt)} {dm(p.admitAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Today's Procedures (Search scene: typing query + staggered indicator bars) */}
          <div
            {...cardEvents('proc')}
            className={`u214-card bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden ${
              activeBento === 'proc' ? 'is-on' : ''
            }`}
          >
            <div className="flex items-center justify-between p-3.5 bg-[#F9FAF9] border-b border-[#E6E9E5]">
              <div className="font-bold text-xs text-[#0F2F2A] flex items-center gap-1.5">
                <span>Chỉ định hôm nay</span>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                  {todayScheds.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onGoToSchedule}
                className="text-xs text-[#0E6B5E] hover:underline font-semibold flex items-center gap-0.5"
              >
                Mở lịch <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="px-3.5 pt-2.5 space-y-2">
              <div className="u214-sb" aria-hidden="true">
                <svg className="w-3 h-3 shrink-0 text-[#0E6B5E]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5L14 14" />
                </svg>
                <span className="truncate">{typedProc}</span>
              </div>
              {!todayScheds.length && (
                <div className="u214-sr pb-1" aria-hidden="true">
                  <span style={{ '--i': 0, '--w': 0.92 } as React.CSSProperties} />
                  <span style={{ '--i': 1, '--w': 0.7 } as React.CSSProperties} />
                  <span style={{ '--i': 2, '--w': 0.52 } as React.CSSProperties} />
                </div>
              )}
            </div>

            <div className="divide-y divide-[#EEF0ED] max-h-52 overflow-y-auto">
              {!todayScheds.length ? (
                <div className="p-4 pt-2 text-xs text-center text-[#56615C]">Không có lịch tiêm khớp hay điện cơ hôm nay.</div>
              ) : (
                todayScheds.map((x) => {
                  const pt = patients.find((p) => p.id === x.patientId);
                  return (
                    <div key={x.id} className="p-3 flex items-center gap-2 text-xs">
                      <span className="font-bold text-[#17201D] w-12">{x.time}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          x.type === 'tiem' ? 'bg-[#DDEFE9] text-[#0B4F45]' : 'bg-[#E3E7F8] text-[#2B3889]'
                        }`}
                      >
                        {TYPE_LABELS[x.type]}
                      </span>
                      <span className="truncate flex-1 font-medium">
                        {pt ? `${pt.room} · ${pt.name}` : '—'}
                      </span>
                      {x.done && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-semibold">
                          Đã làm
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Staff Account & Log Out Panel (Security shield pulse + Clinical integrations marquee) */}
      <div
        {...cardEvents('sec')}
        className={`u214-card bg-white p-4 md:p-5 rounded-2xl border border-[#DDE1DC] shadow-xs ${
          activeBento === 'sec' ? 'is-on' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="u214-sh" aria-hidden="true">
              <ShieldCheck className="w-4 h-4 relative z-10" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0F2F2A]">Tài khoản nhân viên đơn nguyên</h3>
              <p className="text-xs text-[#56615C]">
                {userEmail ? `Đang đăng nhập: ${userEmail}` : 'Đang đăng nhập bằng tài khoản đơn nguyên dùng chung'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="u214-mq" title="Truy cập nhanh các phân hệ lâm sàng">
              <div className="u214-lt">
                {[...MODULE_LINKS, ...MODULE_LINKS].map((mod, idx) => (
                  <button
                    key={`${mod.code}-${idx}`}
                    type="button"
                    onClick={() => onSelectTab?.(mod.tab)}
                    title={mod.label}
                    aria-label={`Mở phân hệ ${mod.label}`}
                  >
                    {mod.code}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
