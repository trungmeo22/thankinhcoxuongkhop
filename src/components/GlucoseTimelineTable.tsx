import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GlucoseRecord } from '../types';
import { isoDay, DAY, fromIso, dmy } from '../lib/constants';
import {
  Clock,
  Syringe,
  Edit2,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface GlucoseTimelineTableProps {
  records: GlucoseRecord[];
  patientName: string;
  onEditRecord: (record: GlucoseRecord) => void;
  onDeleteRecord: (id: number) => void;
  onAddTest?: (dateStr?: string) => void;
}

interface DateGroup {
  date: string;
  displayLabel: string;
  isToday: boolean;
  isYesterday: boolean;
  tests: GlucoseRecord[];
  totalInsulin: number;
}

export const GlucoseTimelineTable: React.FC<GlucoseTimelineTableProps> = ({
  records,
  patientName,
  onEditRecord,
  onDeleteRecord,
  onAddTest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag-to-scroll state
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

  const now = Date.now();
  const todayStr = isoDay(now);
  const yestStr = isoDay(now - DAY);

  // Group and sort records chronologically (left to right: earliest -> newest)
  const sortedRecords = [...records].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.time.localeCompare(b.time);
  });

  const dateGroups: DateGroup[] = [];
  const groupsMap: Record<string, GlucoseRecord[]> = {};

  sortedRecords.forEach((r) => {
    if (!groupsMap[r.date]) {
      groupsMap[r.date] = [];
    }
    groupsMap[r.date].push(r);
  });

  // Dates in ascending order (timeline flow)
  const sortedDates = Object.keys(groupsMap).sort();

  sortedDates.forEach((dateStr) => {
    const tests = groupsMap[dateStr].sort((a, b) => a.time.localeCompare(b.time));
    const totalInsulin = tests.reduce((acc, t) => {
      const num = parseFloat(t.insulinDose || '0');
      return acc + (isNaN(num) ? 0 : num);
    }, 0);

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
      tests,
      totalInsulin,
    });
  });

  // Check scroll position for arrow buttons & edge fade gradients
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

    // Auto-scroll to the newest tests (far right) initially so user immediately sees latest data
    const timer = setTimeout(() => {
      if (el) {
        el.scrollLeft = el.scrollWidth;
        updateScrollState();
      }
    }, 50);

    const handleResize = () => updateScrollState();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [records.length, updateScrollState]);

  // Inertia momentum animation
  const startMomentum = () => {
    const decay = 0.92;
    const step = () => {
      const el = containerRef.current;
      if (!el) return;
      if (Math.abs(velocity.current) > 0.5) {
        el.scrollLeft -= velocity.current;
        velocity.current *= decay;
        updateScrollState();
        rafId.current = requestAnimationFrame(step);
      } else {
        velocity.current = 0;
        rafId.current = null;
      }
    };
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  };

  // Mouse Drag Events for Desktop
  const onMouseDown = (e: React.MouseEvent) => {
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
    lastX.current = e.pageX;
    lastTime.current = performance.now();
    velocity.current = 0;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isMouseDown.current || !el) return;
      const currentX = moveEvent.pageX;
      const deltaX = currentX - startX.current;

      if (Math.abs(deltaX) > 4) {
        hasDragged.current = true;
        setIsDragging(true);
      }

      // Calculate instant velocity
      const nowTime = performance.now();
      const dt = nowTime - lastTime.current;
      if (dt > 8) {
        velocity.current = ((currentX - lastX.current) / dt) * 12;
        lastX.current = currentX;
        lastTime.current = nowTime;
      }

      el.scrollLeft = scrollLeftStart.current - deltaX;
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

  // Smooth scroll buttons
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

  const getGlucoseBadgeColor = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (val < 3.9) return 'bg-red-50 text-red-700 border-red-300 font-bold';
    if (val <= 7.2) return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
    if (val <= 10.0) return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
    return 'bg-purple-50 text-purple-800 border-purple-300 font-bold';
  };

  const formatSlotLabel = (record: GlucoseRecord) => {
    if (record.slotType === '06:00') return '6h (Sáng)';
    if (record.slotType === '11:00') return '11h (Trưa)';
    if (record.slotType === '17:00') return '17h (Chiều)';
    if (record.slotType === '21:00') return '21h (Tối)';
    return `${record.time} (Khác)`;
  };

  if (!sortedRecords.length) {
    return (
      <div className="p-6 bg-white rounded-xl border border-dashed border-gray-300 text-center space-y-2">
        <p className="text-xs text-gray-500">Chưa có kết quả test đường huyết nào.</p>
        {onAddTest && (
          <button
            type="button"
            onClick={() => onAddTest()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0E6B5E] text-white text-xs font-bold hover:bg-[#0A5248] cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm test</span>
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
            <span>Lịch sử test</span>
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
            title="Đến ngày mới nhất"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Drag-to-Scroll Horizontal Viewport */}
      <div className="relative">
        {/* Left Gradient Indicator */}
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-28 sm:left-32 top-0 bottom-0 w-8 bg-gradient-to-r from-black/10 to-transparent z-25 transition-opacity" />
        )}

        {/* Right Gradient Indicator */}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/10 to-transparent z-25 transition-opacity" />
        )}

        {/* Scrollable Container with Drag Engine */}
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
                {/* Sticky Left Column: Thông số */}
                <th className="sticky left-0 z-30 p-2.5 text-left font-bold text-gray-700 bg-white border-r border-[#DDE1DC] w-28 sm:w-32 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0E6B5E]" />
                    <span>Ngày test</span>
                  </div>
                </th>

                {/* Date Group Columns */}
                {dateGroups.map((group) => (
                  <th
                    key={group.date}
                    colSpan={group.tests.length}
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
                          {group.tests.length} lần
                        </span>
                      </div>

                      {group.totalInsulin > 0 && (
                        <span className="text-[10px] font-semibold text-sky-800 bg-white/90 px-1.5 py-0.2 rounded border border-sky-200 shrink-0">
                          {group.totalInsulin} UI
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>

              {/* Row 2: Slot / Column Indicators */}
              <tr className="bg-[#FAFBF9] border-b border-[#EEF0ED]">
                <th className="sticky left-0 z-30 p-2 text-left font-bold text-gray-500 bg-white border-r border-[#DDE1DC] w-28 sm:w-32 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Mốc test
                </th>
                {sortedRecords.map((t, idx) => (
                  <th
                    key={t.id}
                    className="p-2 text-center font-bold text-[#0F2F2A] border-r border-[#EEF0ED] last:border-r-0 min-w-[130px] max-w-[150px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-900 text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span>{formatSlotLabel(t)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#EEF0ED]">
              {/* Hàng 1: Giờ test */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-32 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Giờ test
                </td>
                {sortedRecords.map((t) => (
                  <td
                    key={t.id}
                    className="p-2 text-center font-bold text-gray-800 border-r border-[#EEF0ED] last:border-r-0"
                  >
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>{t.time}</span>
                    </span>
                  </td>
                ))}
              </tr>

              {/* Hàng 2: Kết quả Đường huyết */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-32 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Đường huyết
                </td>
                {sortedRecords.map((t) => (
                  <td
                    key={t.id}
                    className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                  >
                    <div
                      className={`inline-block px-2.5 py-1 rounded-xl border text-xs md:text-sm ${getGlucoseBadgeColor(
                        t.glucoseValue
                      )}`}
                    >
                      {t.glucoseValue} <span className="text-[10px] font-normal">mmol/L</span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Hàng 3: Liều tiêm Insulin */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-32 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Liều Insulin
                </td>
                {sortedRecords.map((t) => (
                  <td
                    key={t.id}
                    className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                  >
                    {t.insulinDose ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 font-bold text-[11px]">
                        <Syringe className="w-3 h-3 text-sky-700" />
                        <span>{t.insulinDose} UI</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Hàng 4: Loại Insulin */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-32 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Loại Insulin
                </td>
                {sortedRecords.map((t) => (
                  <td
                    key={t.id}
                    className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                  >
                    {t.insulinType ? (
                      <span className="font-semibold text-gray-800 text-[11px]">
                        {t.insulinType}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Hàng 5: Ghi chú & Thao tác */}
              <tr>
                <td className="sticky left-0 z-20 p-2 font-semibold text-gray-600 bg-white border-r border-[#DDE1DC] w-28 sm:w-32 shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                  Ghi chú & Sửa
                </td>
                {sortedRecords.map((t) => (
                  <td
                    key={t.id}
                    className="p-2 text-center border-r border-[#EEF0ED] last:border-r-0"
                  >
                    <div className="flex items-center justify-between gap-1 px-1">
                      <span className="text-[10px] text-gray-500 truncate max-w-[70px]" title={t.note}>
                        {t.note || '—'}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (hasDragged.current) return;
                            e.stopPropagation();
                            onEditRecord(t);
                          }}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-emerald-700 cursor-pointer active:scale-90 transition-transform"
                          title="Sửa lần test này"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            if (hasDragged.current) return;
                            e.stopPropagation();
                            if (window.confirm(`Xóa lần test ${t.time} (${t.glucoseValue} mmol/L) của ${patientName}?`)) {
                              onDeleteRecord(t.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 cursor-pointer active:scale-90 transition-transform"
                          title="Xóa lần test này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
