import React, { useState } from 'react';
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
  WDL,
  dmy,
  vitalLine
} from '../lib/constants';
import {
  Bed,
  UserPlus,
  UserMinus,
  Syringe,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  LogOut,
  Users,
  HeartPulse,
  FileText,
  CalendarClock,
  Archive
} from 'lucide-react';
import { TabKey } from './Navigation';

interface DashboardTabProps {
  patients: Patient[];
  scheds: ScheduleItem[];
  beds: number;
  onUpdateBeds: (beds: number) => void;
  onGoToPatients: () => void;
  onGoToSchedule: () => void;
  onOpenDischargedList: () => void;
  onSignOut: () => void;
  onSelectTab?: (tab: TabKey) => void;
  todayGlucoseCount?: number;
  userEmail?: string | null;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  patients,
  scheds,
  beds,
  onUpdateBeds,
  onGoToPatients,
  onGoToSchedule,
  onOpenDischargedList,
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

  // 24h newly admitted
  const newIn24h = activePatients
    .filter((p) => now - p.admitAt < DAY)
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

  // Briefing Report text generator
  const [copiedGb, setCopiedGb] = useState(false);
  const generateGbText = () => {
    const L: string[] = [];
    const nowD = new Date(now);
    L.push('GIAO BAN – ĐƠN NGUYÊN CƠ XƯƠNG KHỚP');
    L.push(`${WDL[nowD.getDay()]}, ${dmy(now)} (Lập lúc ${hm(now)})`);
    L.push(`• Đang điều trị: ${activeCount}/${beds} giường (${occPct}%) | Nhập mới 24h: ${newIn24h.length} | Ra viện 24h: ${outToday} | Chờ ra viện: ${pendingDischarges}`);
    L.push('');
    L.push('DANH SÁCH BỆNH NHÂN ĐANG ĐIỀU TRỊ:');
    activePatients
      .slice()
      .sort((a, b) => String(a.room).localeCompare(String(b.room), 'vi', { numeric: true }))
      .forEach((p, idx) => {
        L.push(`${idx + 1}. [${p.room}] ${p.name} (${ageText(p)}) – Nhập viện: ${hm(p.admitAt)} ${dm(p.admitAt)}`);
        const v = vitalLine(p);
        if (v) L.push(`   DHST: ${v}`);
        if (p.note) L.push(`   Ghi chú: ${p.note}`);
      });

    L.push('');
    L.push(`CHỈ ĐỊNH HÔM NAY (${todayScheds.length}):`);
    if (!todayScheds.length) {
      L.push('Không có chỉ định nào.');
    } else {
      todayScheds.forEach((x) => {
        const pt = patients.find((p) => p.id === x.patientId);
        L.push(`- ${x.time} ${TYPE_LABELS[x.type]} – ${pt ? `[${pt.room}] ${pt.name}` : '?'} – ${x.site} (${x.who || 'Chưa phân công'})${x.done ? ' [ĐÃ LÀM]' : ''}`);
      });
    }

    const outs = patients
      .filter((p) => p.status === 'out' && p.outAt != null && (p.outAt > now || now - p.outAt < DAY))
      .sort((a, b) => (a.outAt || 0) - (b.outAt || 0));
    L.push('');
    L.push(`BÁO RA VIỆN & CHỜ RA VIỆN (${outs.length}):`);
    if (!outs.length) {
      L.push('Không có.');
    } else {
      outs.forEach((p) => {
        L.push(`- [${p.room}] ${p.name} – Ra: ${hm(p.outAt!)} ${dm(p.outAt!)}${p.outAt! > now ? ' (Chờ ra viện)' : ''}${p.outNote ? ` – ${p.outNote}` : ''}`);
      });
    }

    return L.join('\n');
  };

  const handleCopyGb = () => {
    const text = generateGbText();
    navigator.clipboard.writeText(text);
    setCopiedGb(true);
    setTimeout(() => setCopiedGb(false), 2500);
  };

  return (
    <div className="space-y-5">
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
            className="p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left transition-all active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0E6B5E] flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
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
            className="p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left transition-all active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <HeartPulse className="w-5 h-5" />
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
            className="p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left transition-all active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Syringe className="w-5 h-5" />
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
            className="p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left transition-all active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
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
            className="p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left transition-all active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                <CalendarClock className="w-5 h-5" />
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
            onClick={onOpenDischargedList}
            className="p-3 rounded-2xl bg-white border border-[#DDE1DC] shadow-xs hover:border-[#0E6B5E] text-left transition-all active:scale-95 flex flex-col justify-between min-h-[74px] cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0E6B5E] flex items-center justify-center font-bold">
                <Archive className="w-5 h-5" />
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

      {/* KPI Cards Grid (3 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {/* Bed occupancy */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-xs font-semibold text-[#56615C]">Công suất giường</span>
            <span className="text-xs text-[#56615C] font-medium">{activeCount}/{beds} đang điều trị</span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-[#0F2F2A]">{occPct}%</div>
              <div className="text-xs text-[#56615C]">Còn trống: <strong className="text-emerald-700">{freeBeds}</strong> giường</div>
            </div>
            <div className="h-2 rounded-full bg-[#E6E9E5] overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, occPct)}%`,
                  backgroundColor: occPct >= 90 ? '#C2410C' : '#0A8A76',
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-[#56615C] pt-1 border-t border-[#EEF0ED]">
            <label htmlFor="bed-input" className="cursor-pointer">Tổng giường kế hoạch:</label>
            <input
              id="bed-input"
              type="number"
              min="1"
              value={beds}
              onChange={(e) => onUpdateBeds(parseInt(e.target.value, 10) || 1)}
              className="w-16 px-2 py-0.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Admissions today */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#56615C]">Vào viện hôm nay</div>
          <div className="text-3xl font-bold text-[#0A6E5E] my-1">{inToday}</div>
          <div className="text-xs text-[#56615C]">7 ngày qua: <strong>{in7}</strong> ca</div>
        </div>

        {/* Discharges today */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#56615C]">Ra viện hôm nay</div>
          <div className="text-3xl font-bold text-[#A4521A] my-1">{outToday}</div>
          <div className="flex items-center justify-between text-xs text-[#56615C]">
            <span>Chờ ra: <strong>{pendingDischarges}</strong></span>
            <button
              type="button"
              onClick={onOpenDischargedList}
              className="text-[#0E6B5E] hover:underline font-semibold"
            >
              Xem DS
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Chart + Right Aside */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 14-day Chart */}
        <div className="lg:col-span-8 bg-white p-4 md:p-5 rounded-2xl border border-[#DDE1DC] shadow-xs flex flex-col justify-between">
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
          <div className="overflow-x-auto">
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
                      className="w-full max-w-[26px] bg-[#BCD9D2] rounded-t-md transition-all duration-300 group-hover:bg-[#92C4B9]"
                      style={{ height: `${yv(d.census)}px` }}
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
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={inPts}
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
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={outPts}
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
                        className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#2A6FBF] ring-2 ring-white shadow-xs"
                        style={{ bottom: `${yv(d.nin) - 5}px` }}
                      />
                      <span
                        className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#D9782B] ring-2 ring-white shadow-xs"
                        style={{ bottom: `${yv(d.nout) - 5}px` }}
                      />
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
          {/* Quick Giao Ban report */}
          <div className="bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#0F2F2A]">Báo cáo giao ban</h3>
                <p className="text-xs text-[#56615C]">Tổng hợp nhanh tình hình khoa phòng</p>
              </div>
              <button
                type="button"
                onClick={handleCopyGb}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {copiedGb ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedGb ? 'Đã sao chép' : 'Sao chép'}
              </button>
            </div>
          </div>

          {/* 24h New Admissions */}
          <div className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between p-3.5 bg-[#F9FAF9] border-b border-[#E6E9E5]">
              <div className="font-bold text-xs text-[#0F2F2A] flex items-center gap-1.5">
                <span>Mới nhập viện (24h)</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                  {newIn24h.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onGoToPatients}
                className="text-xs text-[#0E6B5E] hover:underline font-semibold flex items-center gap-0.5"
              >
                Xem tất cả <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-[#EEF0ED] max-h-52 overflow-y-auto">
              {!newIn24h.length ? (
                <div className="p-4 text-xs text-center text-[#56615C]">Chưa có bệnh nhân mới nhập viện trong 24h.</div>
              ) : (
                newIn24h.slice(0, 5).map((p) => (
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

          {/* Today's Procedures */}
          <div className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
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

            <div className="divide-y divide-[#EEF0ED] max-h-52 overflow-y-auto">
              {!todayScheds.length ? (
                <div className="p-4 text-xs text-center text-[#56615C]">Không có lịch tiêm khớp hay điện cơ hôm nay.</div>
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

      {/* Staff Account & Log Out Panel */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#DDE1DC] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0E6B5E]" />
            <div>
              <h3 className="font-bold text-sm text-[#0F2F2A]">Tài khoản nhân viên đơn nguyên</h3>
              <p className="text-xs text-[#56615C]">
                {userEmail ? `Đang đăng nhập: ${userEmail}` : 'Đang đăng nhập bằng tài khoản đơn nguyên dùng chung'}
              </p>
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
  );
};
