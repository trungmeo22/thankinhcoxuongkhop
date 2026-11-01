import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Patient, TreatmentAction } from '../types';
import { isoDay, DAY, fromIso, dmy, hm, KIND_LABELS } from '../lib/constants';
import {
  Clock,
  HeartPulse,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Calendar,
  Syringe,
  X
} from 'lucide-react';
import { ExpandableTreatmentInput } from './ExpandableTreatmentInput';

export interface VitalsTimelineItem {
  id: number;
  pid: number;
  at: number;
  pulse?: string;
  bp?: string;
  temp?: string;
  spo2?: string;
  rr?: string;
  note?: string;
  abn?: boolean;
  tx?: TreatmentAction[];
  isAdmit?: boolean;
}

interface VitalsTimelineTableProps {
  items: VitalsTimelineItem[];
  patient: Patient;
  onAddVitals?: () => void;
  onAddTreatment?: (recordId: number, text: string) => void;
}

interface DateGroup {
  date: string;
  displayLabel: string;
  isToday: boolean;
  isYesterday: boolean;
  records: VitalsTimelineItem[];
  abnormalCount: number;
}

export const VitalsTimelineTable: React.FC<VitalsTimelineTableProps> = ({
  items,
  patient,
  onAddVitals,
  onAddTreatment,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag-to-scroll engine state
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const velocity = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const rafId = useRef<number | null>(null);
  const hasDragged = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Quick treatment modal for a column
  const [activeTxItem, setActiveTxItem] = useState<VitalsTimelineItem | null>(null);
  const [txInput, setTxInput] = useState('');

  const now = Date.now();
  const todayStr = isoDay(now);
  const yestStr = isoDay(now - DAY);

  // Sort chronologically (left to right: earliest -> newest)
  const sortedItems = [...items].sort((a, b) => a.at - b.at);

  // Group by date
  const dateGroups: DateGroup[] = [];
  const groupsMap: Record<string, VitalsTimelineItem[]> = {};

  sortedItems.forEach((r) => {
    const dStr = isoDay(r.at);
    if (!groupsMap[dStr]) {
      groupsMap[dStr] = [];
    }
    groupsMap[dStr].push(r);
  });

  const sortedDates = Object.keys(groupsMap).sort();

  sortedDates.forEach((dateStr) => {
    const dateRecords = groupsMap[dateStr].sort((a, b) => a.at - b.at);
    const abnormalCount = dateRecords.filter(
      (r) => r.abn || checkBadVitals(r)
    ).length;

    let displayLabel = dmy(fromIso(dateStr));
    const isToday = dateStr === todayStr;
    const isYesterday = dateStr === yestStr;
    if (isToday) displayLabel = `Hôm nay · ${displayLabel}`;
    else if (isYesterday) displayLabel = `Hôm qua · ${displayLabel}`;

    dateGroups.push({
      date: dateStr,
      displayLabel,
      isToday,
      isYesterday,
      records: dateRecords,
      abnormalCount,
    });
  });

  // Check scroll position
  const updateScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollState();

    // Auto-scroll to latest records at the far right
    const timer = setTimeout(() => {
      if (el) {
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
        updateScrollState();
      }
    }, 150);

    const onResize = () => updateScrollState();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [items.length, updateScrollState]);

  // Momentum decay loop
  const startMomentum = () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);

    const decay = () => {
      const el = containerRef.current;
      if (!el) return;

      if (Math.abs(velocity.current) > 0.25) {
        el.scrollLeft -= velocity.current;
        velocity.current *= 0.94; // Friction
        updateScrollState();
        rafId.current = requestAnimationFrame(decay);
      } else {
        velocity.current = 0;
        rafId.current = null;
      }
    };

    rafId.current = requestAnimationFrame(decay);
  };

  // Drag-to-scroll event handlers
  const onMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('a')
    ) {
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    isMouseDown.current = true;
    hasDragged.current = false;
    startX.current = e.pageX;
    scrollLeftStart.current = el.scrollLeft;
    velocity.current = 0;
    lastX.current = e.pageX;
    lastTime.current = performance.now();

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isMouseDown.current || !containerRef.current) return;
      const currentX = moveEvent.pageX;
      const deltaX = currentX - startX.current;

      if (Math.abs(deltaX) > 4) {
        hasDragged.current = true;
        setIsDragging(true);
      }

      const nowTime = performance.now();
      const dt = nowTime - lastTime.current;
      if (dt > 8) {
        velocity.current = ((currentX - lastX.current) / dt) * 12;
        lastX.current = currentX;
        lastTime.current = nowTime;
      }

      containerRef.current.scrollLeft = scrollLeftStart.current - deltaX;
      updateScrollState();
    };

    const onMouseUp = () => {
      isMouseDown.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      startMomentum();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Scroll buttons
  const scrollByAmount = (amount: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const scrollToStart = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const scrollToEnd = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  };

  // Abnormality checks
  function checkBadPulse(val?: string) {
    const n = parseFloat(val || '');
    return !isNaN(n) && (n > 100 || n < 50);
  }

  function checkBadBp(val?: string) {
    if (!val) return false;
    const parts = val.split(/[/ ]+/).map((s) => parseFloat(s));
    const sy = parts[0];
    const di = parts[1];
    return (
      (sy != null && !isNaN(sy) && (sy >= 160 || sy < 90)) ||
      (di != null && !isNaN(di) && (di >= 100 || di < 50))
    );
  }

  function checkBadTemp(val?: string) {
    const n = parseFloat(val || '');
    return !isNaN(n) && (n >= 38 || n < 36);
  }

  function checkBadSpo2(val?: string) {
    const n = parseFloat(val || '');
    return !isNaN(n) && n < 94;
  }

  function checkBadRr(val?: string) {
    const n = parseFloat(val || '');
    return !isNaN(n) && (n > 24 || n < 12);
  }

  function checkBadVitals(r: VitalsTimelineItem) {
    return (
      checkBadPulse(r.pulse) ||
      checkBadBp(r.bp) ||
      checkBadTemp(r.temp) ||
      checkBadSpo2(r.spo2) ||
      checkBadRr(r.rr)
    );
  }

  // Handle saving treatment for a column
  const handleSaveTreatment = () => {
    if (!activeTxItem || !txInput.trim() || !onAddTreatment) return;
    onAddTreatment(activeTxItem.id, txInput.trim());
    setActiveTxItem(null);
    setTxInput('');
  };

  if (!sortedItems.length) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-[#DDE1DC] text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-[#0E6B5E] flex items-center justify-center">
          <HeartPulse className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-gray-800">Chưa có kết quả DHST & Diễn biến</h4>
        {onAddVitals && (
          <button
            type="button"
            onClick={onAddVitals}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B5E] text-white text-xs font-bold hover:bg-[#0A5248] cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi DHST</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden select-none">
      {/* Table Navigation Top Bar */}
      <div className="p-2.5 bg-[#F9FAF9] border-b border-[#EEF0ED] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#0F2F2A] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#0E6B5E]" />
            <span>
              Lịch sử DHST & Diễn biến
            </span>
          </span>
        </div>

        {/* Scroll Control Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={scrollToStart}
            disabled={!canScrollLeft}
            className="p-1 rounded-lg text-gray-500 hover:text-[#0E6B5E] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Đến ngày đầu tiên"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(-280)}
            disabled={!canScrollLeft}
            className="p-1 rounded-lg text-gray-500 hover:text-[#0E6B5E] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Trượt sang trái"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(280)}
            disabled={!canScrollRight}
            className="p-1 rounded-lg text-gray-500 hover:text-[#0E6B5E] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Trượt sang phải"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={scrollToEnd}
            disabled={!canScrollRight}
            className="p-1 rounded-lg text-gray-500 hover:text-[#0E6B5E] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
            title="Đến lần đo mới nhất"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Drag-to-Scroll Horizontal Viewport */}
      <div className="relative">
        {/* Left Gradient Overlay */}
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-28 sm:left-36 top-0 bottom-0 w-8 bg-gradient-to-r from-black/10 to-transparent z-25 transition-opacity" />
        )}

        {/* Right Gradient Overlay */}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/10 to-transparent z-25 transition-opacity" />
        )}

        {/* Scrollable Container with Momentum Drag Engine */}
        <div
          ref={containerRef}
          onScroll={updateScrollState}
          onMouseDown={onMouseDown}
          className={`overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 will-change-scroll ${
            isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
          }}
        >
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Row 1: Date Group Headers */}
              <tr className="bg-[#FAFBF9] border-b border-[#EEF0ED]">
                <th className="sticky left-0 z-30 p-2.5 text-left font-bold text-gray-700 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0E6B5E]" />
                    <span>Ngày theo dõi</span>
                  </div>
                </th>

                {dateGroups.map((group) => (
                  <th
                    key={group.date}
                    colSpan={group.records.length}
                    className={`p-2 text-center font-bold border-r border-[#EEF0ED] last:border-r-0 ${
                      group.isToday
                        ? 'bg-emerald-50/80 text-emerald-950 border-emerald-200'
                        : 'bg-[#F4F6F3] text-[#0F2F2A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span>{group.displayLabel}</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-white/90 text-[10px] font-bold text-emerald-900 border border-emerald-200">
                          {group.records.length} lần đo
                        </span>
                      </div>

                      {group.abnormalCount > 0 && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>{group.abnormalCount} bất thường</span>
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>

              {/* Row 2: Measurement Slots */}
              <tr className="bg-[#FAFBF9] border-b border-[#EEF0ED]">
                <th className="sticky left-0 z-30 p-2 text-left font-bold text-gray-500 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Lần đo / Mốc
                </th>
                {sortedItems.map((r, idx) => (
                  <th
                    key={r.id ? r.id : `admit-${idx}`}
                    className="p-2 text-center font-bold text-[#0F2F2A] border-r border-[#EEF0ED] last:border-r-0 min-w-[130px] max-w-[160px]"
                  >
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-900 text-[10px] flex items-center justify-center font-bold">
                        #{idx + 1}
                      </span>
                      {r.isAdmit ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          Nhập viện
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold">{hm(r.at)}</span>
                      )}
                      {(r.abn || checkBadVitals(r)) && (
                        <span
                          className="w-3.5 h-3.5 rounded-full bg-red-100 text-red-700 flex items-center justify-center"
                          title="Có chỉ số bất thường"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#EEF0ED]">
              {/* Row 1: Giờ đo */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Giờ đo
                </td>
                {sortedItems.map((r, idx) => (
                  <td
                    key={r.id ? r.id : `admit-${idx}`}
                    className="p-2 text-center font-bold text-gray-800 border-r border-[#EEF0ED] last:border-r-0"
                  >
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>{hm(r.at)}</span>
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 2: Mạch (Pulse) */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Mạch (ck/p)
                </td>
                {sortedItems.map((r, idx) => {
                  const bad = checkBadPulse(r.pulse);
                  return (
                    <td
                      key={r.id ? r.id : `admit-${idx}`}
                      className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                    >
                      {r.pulse ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                            bad
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'text-gray-800'
                          }`}
                        >
                          {r.pulse}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row 3: Huyết áp (BP) */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Huyết áp (mmHg)
                </td>
                {sortedItems.map((r, idx) => {
                  const bad = checkBadBp(r.bp);
                  return (
                    <td
                      key={r.id ? r.id : `admit-${idx}`}
                      className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                    >
                      {r.bp ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                            bad
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'text-gray-800'
                          }`}
                        >
                          {r.bp}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row 4: Nhiệt độ (°C) */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Nhiệt độ (°C)
                </td>
                {sortedItems.map((r, idx) => {
                  const bad = checkBadTemp(r.temp);
                  return (
                    <td
                      key={r.id ? r.id : `admit-${idx}`}
                      className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                    >
                      {r.temp ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                            bad
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'text-gray-800'
                          }`}
                        >
                          {r.temp}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row 5: SpO2 (%) */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  SpO₂ (%)
                </td>
                {sortedItems.map((r, idx) => {
                  const bad = checkBadSpo2(r.spo2);
                  return (
                    <td
                      key={r.id ? r.id : `admit-${idx}`}
                      className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                    >
                      {r.spo2 ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                            bad
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'text-gray-800'
                          }`}
                        >
                          {r.spo2}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row 6: Nhịp thở (lần/phút) */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Nhịp thở (l/p)
                </td>
                {sortedItems.map((r, idx) => {
                  const bad = checkBadRr(r.rr);
                  return (
                    <td
                      key={r.id ? r.id : `admit-${idx}`}
                      className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                    >
                      {r.rr ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                            bad
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'text-gray-800'
                          }`}
                        >
                          {r.rr}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row 7: Diễn biến lâm sàng */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Diễn biến
                </td>
                {sortedItems.map((r, idx) => (
                  <td
                    key={r.id ? r.id : `admit-${idx}`}
                    className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0 max-w-[160px]"
                  >
                    {r.note ? (
                      <div
                        className="text-[11px] text-gray-700 bg-gray-50 p-1.5 rounded-lg text-left line-clamp-3 leading-snug cursor-help"
                        title={r.note}
                      >
                        {r.note}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 8: Xử trí & Can thiệp */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-36 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Xử trí / Y lệnh
                </td>
                {sortedItems.map((r, idx) => (
                  <td
                    key={r.id ? r.id : `admit-${idx}`}
                    className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0 max-w-[170px]"
                  >
                    <div className="space-y-1">
                      {r.tx && r.tx.length > 0 ? (
                        r.tx.map((t) => (
                          <div
                            key={t.id}
                            className="text-[11px] text-emerald-950 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 text-left line-clamp-2 leading-snug"
                            title={`${t.text} (${hm(t.at)})`}
                          >
                            <span className="font-semibold">{t.text}</span>
                            <span className="text-[10px] text-emerald-700 block mt-0.5">
                              {hm(t.at)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-300 block mb-1">—</span>
                      )}

                      {!r.isAdmit && onAddTreatment && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTxItem(r);
                            setTxInput('');
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0E6B5E] hover:underline cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Thêm xử trí</span>
                        </button>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Add Treatment Modal for a Column */}
      {activeTxItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EEF0ED]">
              <div>
                <h3 className="text-sm font-bold text-[#0F2F2A] flex items-center gap-1.5">
                  <Syringe className="w-4 h-4 text-[#0E6B5E]" />
                  <span>Thêm xử trí y lệnh / can thiệp</span>
                </h3>
                <p className="text-xs text-[#56615C]">
                  {patient.room} · {patient.name} (Lần đo lúc {hm(activeTxItem.at)} ngày{' '}
                  {dmy(activeTxItem.at)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTxItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ExpandableTreatmentInput
              value={txInput}
              onChange={setTxInput}
              initiallyExpanded={true}
              placeholder="Thuốc, truyền dịch, can thiệp lâm sàng đã thực hiện..."
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEF0ED]">
              <button
                type="button"
                onClick={() => setActiveTxItem(null)}
                className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveTreatment}
                disabled={!txInput.trim()}
                className="px-4 py-1.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] disabled:opacity-40 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Lưu xử trí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
