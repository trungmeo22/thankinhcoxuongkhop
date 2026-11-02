import React, { useState } from 'react';
import { Patient, VitalRecord } from '../types';
import {
  isoDay,
  fromIso,
  DAY,
  dm,
  dmy,
  WDL,
  hm,
  byRoom,
  getVitals,
  hasVit,
  isOut,
  KIND_LABELS,
  fold,
} from '../lib/constants';
import { Plus, FileSpreadsheet, AlertTriangle, Calendar, ArrowLeft, Search, X } from 'lucide-react';
import { VitalsTimelineTable } from './VitalsTimelineTable';

interface VitalsTabProps {
  patients: Patient[];
  recs: VitalRecord[];
  onOpenRecordModal: (p?: Patient) => void;
  onOpenPatientHistory: (p: Patient) => void;
  onAddTreatment?: (recordId: number, text: string) => void;
  onGoBack?: () => void;
}

export const VitalsTab: React.FC<VitalsTabProps> = ({
  patients,
  recs,
  onOpenRecordModal,
  onOpenPatientHistory,
  onAddTreatment,
  onGoBack,
}) => {
  const [selectedDate, setSelectedDate] = useState(isoDay(Date.now()));
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());

  const toggleExpand = (pid: number) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const getPatientFullTimeline = (p: Patient) => {
    const patientRecs = recs
      .filter((r) => r.pid === p.id)
      .map((r) => ({ ...r, isAdmit: false }));
    const admitRecord = {
      id: 0,
      pid: p.id,
      at: p.admitAt,
      pulse: p.av?.pulse || p.pulse,
      bp: p.av?.bp || p.bp,
      temp: p.av?.temp || p.temp,
      spo2: p.av?.spo2 || p.spo2,
      rr: p.av?.rr || p.rr,
      note: p.note,
      abn: false,
      tx: [],
      isAdmit: true,
    };
    return [...patientRecs, admitRecord].sort((a, b) => a.at - b.at);
  };

  const dStart = fromIso(selectedDate);
  const dEnd = dStart + DAY;
  const isToday = selectedDate === isoDay(Date.now());
  const dayTitle = `${isToday ? 'Hôm nay · ' : ''}${WDL[new Date(dStart).getDay()]}, ${dmy(dStart)}`;

  // Find all patients active on or before this day or with records on this day
  const relevantPatientIds = new Set<number>();
  patients.forEach((p) => {
    if (p.admitAt < dEnd && (p.status === 'in' || (p.outAt || 0) >= dStart)) {
      relevantPatientIds.add(p.id);
    }
  });
  recs.forEach((r) => {
    if (r.at >= dStart && r.at < dEnd) {
      relevantPatientIds.add(r.pid);
    }
  });

  const vPatients = patients
    .filter((p) => relevantPatientIds.has(p.id))
    .sort(byRoom);

  const qClean = fold(searchQuery.trim());
  const filteredPatients = vPatients.filter((p) => {
    if (!qClean) return true;
    return fold(`${p.name} ${p.room} ${p.doctor || ''}`).includes(qClean);
  });

  // Extract distinct rooms from filtered patients
  const displayedRooms = Array.from(new Set(filteredPatients.map((p) => p.room))).sort((a, b) =>
    a.localeCompare(b, 'vi', { numeric: true })
  );

  // Helper to get day items for patient
  const getPatientDayRecords = (p: Patient) => {
    const list: Array<{
      at: number;
      pulse?: string;
      bp?: string;
      temp?: string;
      spo2?: string;
      rr?: string;
      note?: string;
      abn?: boolean;
      isAdmit?: boolean;
    }> = recs
      .filter((r) => r.pid === p.id && r.at >= dStart && r.at < dEnd)
      .map((r) => ({ ...r, isAdmit: false }));

    // Add admission record if admitted on this day
    if (p.av && p.admitAt >= dStart && p.admitAt < dEnd && hasVit(p.av)) {
      list.push({
        at: p.admitAt,
        ...p.av,
        note: p.note,
        abn: false,
        isAdmit: true
      });
    }

    return list.sort((a, b) => a.at - b.at);
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter & Action Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#DDE1DC] shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Back button (if present) & Search bar */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onGoBack && (
              <button
                type="button"
                onClick={onGoBack}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Quay lại"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Quay lại</span>
              </button>
            )}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, bác sĩ, phòng..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-[#F9FAF9] focus:bg-white transition-colors placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Date Picker, Quick Today & Ghi DHST Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5" title={dayTitle}>
              <div className="flex items-center gap-1.5 bg-[#F3F4F1] px-2.5 py-1.5 rounded-xl border border-[#DDE1DC]">
                <Calendar className="w-3.5 h-3.5 text-[#56615C] shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#17201D] focus:outline-none cursor-pointer"
                />
              </div>

              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(isoDay(Date.now()))}
                  className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 transition-colors cursor-pointer"
                  title="Về hôm nay"
                >
                  Hôm nay
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenRecordModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi DHST</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rooms Cards */}
      {!filteredPatients.length ? (
        <div className="bg-white p-8 rounded-2xl border border-[#DDE1DC] shadow-xs text-center text-xs text-[#56615C]">
          {searchQuery.trim()
            ? `Không tìm thấy bệnh nhân phù hợp với từ khóa "${searchQuery}".`
            : `Không có bệnh nhân trong ngày ${dm(dStart)}.`}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRooms.map((rm) => {
            const roomPatients = filteredPatients.filter((p) => p.room === rm);
            return (
              <div key={rm} className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
                {/* Room Header Banner */}
                <div className="px-4 py-2.5 bg-[#0F2F2A] text-white flex items-center justify-between">
                  <span className="font-bold text-sm">Phòng {rm}</span>
                  <span className="text-xs text-emerald-200 font-medium">
                    {roomPatients.length} bệnh nhân
                  </span>
                </div>

                {/* Patient Rows inside room */}
                <div className="divide-y divide-[#E6E9E5]">
                  {roomPatients.map((p) => {
                    const isExpanded = expandedPids.has(p.id);
                    const fullTimeline = getPatientFullTimeline(p);
                    const ageStr = p.age ? `${String(p.age).trim()}t` : '';

                    return (
                      <div key={p.id} className="transition-colors">
                        {/* Collapsed / Summary Header Row: Tên bệnh nhân, tuổi (t), nút Thêm DHST */}
                        <div
                          onClick={() => toggleExpand(p.id)}
                          className={`px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${
                            isExpanded ? 'bg-emerald-50/50 border-b border-emerald-100' : 'bg-white hover:bg-gray-50/80'
                          }`}
                        >
                          {/* Left: Tên bệnh nhân & Tuổi viết tắt (t) */}
                          <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                            <strong className="text-sm text-[#0F2F2A] font-bold truncate">
                              {p.name}
                            </strong>
                            {ageStr && (
                              <span className="text-xs text-gray-500 shrink-0 font-medium">
                                ({ageStr})
                              </span>
                            )}
                          </div>

                          {/* Right: Nút Thêm DHST thu nhỏ bề ngang, không còn mũi tên */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenRecordModal(p);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#0E6B5E] bg-white hover:bg-emerald-50 text-[#0B5C51] text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-xs whitespace-nowrap shrink-0"
                            title="Thêm lần đo DHST cho bệnh nhân này"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm DHST</span>
                          </button>
                        </div>

                        {/* Expanded Section: Mở trực tiếp timeline trượt ngang */}
                        {isExpanded && (
                          <div className="p-2.5 sm:p-3.5 bg-[#FAFBF9] border-t border-[#EEF0ED] animate-in fade-in duration-150">
                            <VitalsTimelineTable
                              items={fullTimeline}
                              patient={p}
                              onAddVitals={() => onOpenRecordModal(p)}
                              onAddTreatment={onAddTreatment}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
