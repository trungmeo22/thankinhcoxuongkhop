import { Patient, VitalRecord, VitalSignValues, ProcedureType, DischargeKind } from '../types';

export const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const WDL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export const HOUR = 3600000;
export const DAY = 86400000;

export const TYPE_LABELS: Record<ProcedureType, string> = {
  tiem: 'Tiêm khớp',
  dien: 'Điện cơ'
};

export const KIND_LABELS: Record<DischargeKind, string> = {
  ra: 'Ra viện',
  ck: 'Chuyển khoa',
  cv: 'Chuyển viện'
};

export const SITES: Record<ProcedureType, string[]> = {
  tiem: ['Khớp gối P', 'Khớp gối T', 'Khớp vai P', 'Khớp vai T', 'Khớp cổ tay', 'Khớp cổ chân', 'Khớp ngón tay', 'Khớp háng'],
  dien: ['Chi trên 2 bên', 'Chi dưới 2 bên', 'Chi trên P', 'Chi trên T', 'Chi dưới P', 'Chi dưới T']
};

export const DEFAULT_ROOMS = ['P.301', 'P.302', 'P.303', 'P.304', 'P.305', 'P.306'];

export const DEFAULT_INSULINS = [
  'Wosulin 30/70',
  'Wosulin R',
  'Lantus',
  'Novomix',
  'Novo Rapid',
  'Apidra',
  'Gralitus',
  'Levemir'
];

export const DEFAULT_DOCTORS = [
  'BS. Nguyễn Văn An',
  'BS. Trần Thị Bình',
  'BS. Lê Văn Cường',
  'BS. Phạm Thị Dung',
  'BS. Hoàng Văn Em'
];

export const VKEYS: (keyof VitalSignValues)[] = ['pulse', 'bp', 'temp', 'spo2', 'rr'];

export const pad = (n: number) => String(n).padStart(2, '0');

export function hm(t: number | string | Date): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dm(t: number | string | Date): string {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function dmy(t: number | string | Date): string {
  const d = new Date(t);
  return `${dm(d)}/${d.getFullYear()}`;
}

export function isoDay(t: number | string | Date): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIso(s: string): number {
  const a = String(s).split('-').map(Number);
  return new Date(a[0], a[1] - 1, a[2]).getTime();
}

export function dtLocal(t: number): string {
  const d = new Date(t);
  return `${isoDay(d)}T${hm(d)}`;
}

export function num(s: any): number | null {
  const x = parseFloat(String(s == null ? '' : s).replace(',', '.'));
  return isNaN(x) ? null : x;
}

export function ageText(p: { age?: string | number }): string {
  const a = String(p.age || '').trim();
  return a ? `${a} tuổi` : 'Chưa rõ tuổi';
}

export interface VitalDetail {
  label: string;
  has: boolean;
  raw: string;
  text: string;
  bad: boolean;
}

export function getVitals(p: VitalSignValues): VitalDetail[] {
  const m = num(p.pulse);
  const t = num(p.temp);
  const o = num(p.spo2);
  const r = num(p.rr);
  const bp = String(p.bp || '').split('/');
  const sy = num(bp[0]);
  const di = num(bp[1]);

  function row(label: string, val: string | undefined, unit: string, bad: boolean): VitalDetail {
    const v = String(val || '').trim();
    return {
      label,
      has: v !== '',
      raw: v || '—',
      text: v ? `${v} ${unit}` : '—',
      bad: Boolean(v && bad)
    };
  }

  return [
    row('Mạch', p.pulse, 'l/p', m != null && (m > 100 || m < 50)),
    row('HA', p.bp, 'mmHg', (sy != null && (sy >= 160 || sy < 90)) || (di != null && (di >= 100 || di < 50))),
    row('Nhiệt', p.temp, '°C', t != null && (t >= 38 || t < 36)),
    row('SpO₂', p.spo2, '%', o != null && o < 94),
    row('Nhịp thở', p.rr, 'l/p', r != null && (r > 24 || r < 12))
  ];
}

export function isBadVitals(p: VitalSignValues): boolean {
  return getVitals(p).some((v) => v.bad);
}

export function vitalLine(p: VitalSignValues): string {
  return getVitals(p)
    .filter((v) => v.has)
    .map((v) => `${v.label} ${v.text}${v.bad ? ' (!)' : ''}`)
    .join(', ');
}

export function badLine(p: VitalSignValues): string {
  return getVitals(p)
    .filter((v) => v.bad)
    .map((v) => `${v.label} ${v.text}`)
    .join(', ');
}

export function dayDiff(iso: string, today: string): number {
  return Math.round((fromIso(iso) - fromIso(today)) / DAY);
}

export function dayLabel(iso: string, today: string): string {
  const t = fromIso(iso);
  const base = `${WD[new Date(t).getDay()]} ${dm(t)}`;
  const d = dayDiff(iso, today);
  if (d === 0) return `Hôm nay · ${base}`;
  if (d === 1) return `Ngày mai · ${base}`;
  if (d < 0) return `Quá hạn · ${base}`;
  return base;
}

export function byRoom(a: Patient, b: Patient): number {
  return String(a.room).localeCompare(String(b.room), 'vi', { numeric: true });
}

export function isIn(p: Patient, now = Date.now()): boolean {
  return p.status === 'in' || (p.outAt != null && p.outAt > now);
}

export function isOut(p: Patient, now = Date.now()): boolean {
  return !isIn(p, now);
}

export function hasVit(r: VitalSignValues): boolean {
  return VKEYS.some((k) => String(r[k] || '').trim() !== '');
}

export function fold(x: string): string {
  return String(x || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function uid(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Lấy mốc thời gian bắt đầu (07:00 ngày làm việc hiện tại)
 * và kết thúc (06:59:59.999 ngày tiếp theo).
 * Nếu hiện tại < 7h sáng, ngày làm việc bắt đầu từ 07:00 hôm qua.
 * Nếu hiện tại >= 7h sáng, ngày làm việc bắt đầu từ 07:00 hôm nay.
 */
export function getClinicalDayWindow(now: number = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let start: number;
  if (d.getHours() < 7) {
    start = base.getTime() - DAY + 7 * HOUR;
  } else {
    start = base.getTime() + 7 * HOUR;
  }
  const end = start + DAY - 1; // 6h59:59.999 ngày hôm sau
  return { start, end };
}

export function isNewAdmitted(admitAt: number, now: number = Date.now()): boolean {
  const { start, end } = getClinicalDayWindow(now);
  return admitAt >= start && admitAt <= end;
}
