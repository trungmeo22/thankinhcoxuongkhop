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
  ageText,
  byRoom,
  getVitals,
  hasVit,
  isOut,
  KIND_LABELS
} from '../lib/constants';
import { Plus, HeartPulse, FileSpreadsheet, AlertTriangle, Calendar, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
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
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
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

  // Extract distinct rooms
  const rooms = Array.from(new Set(vPatients.map((p) => p.room))).sort();

  // Filtered rooms
  const displayedRooms = rooms.filter((rm) => selectedRoom === 'all' || selectedRoom === rm);

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
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#DDE1DC] shadow-xs">
        <div className="flex items-center gap-2.5">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer mr-0.5"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
          )}
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">DHST / Diễn biến</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-[#F3F4F1] px-2.5 py-1 rounded-xl border border-[#DDE1DC]">
            <Calendar className="w-3.5 h-3.5 text-[#56615C]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#17201D] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(isoDay(Date.now()))}
            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 transition-colors"
          >
            Hôm nay
          </button>

          <button
            type="button"
            onClick={() => onOpenRecordModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi DHST</span>
          </button>
        </div>
      </div>

      {/* Room Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedRoom('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            selectedRoom === 'all'
              ? 'bg-[#0E6B5E] text-white shadow-xs'
              : 'bg-white text-[#3A4540] border border-[#C3CAC4] hover:border-[#0E6B5E]'
          }`}
        >
          Tất cả phòng ({vPatients.length} BN)
        </button>
        {rooms.map((rm) => {
          const count = vPatients.filter((p) => p.room === rm).length;
          const isSelected = selectedRoom === rm;
          return (
            <button
              key={rm}
              type="button"
              onClick={() => setSelectedRoom(rm)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-[#0E6B5E] text-white shadow-xs'
                  : 'bg-white text-[#3A4540] border border-[#C3CAC4] hover:border-[#0E6B5E]'
              }`}
            >
              {rm} ({count})
            </button>
          );
        })}
      </div>

      {/* Rooms Cards */}
      {!displayedRooms.length ? (
        <div className="bg-white p-8 rounded-2xl border border-[#DDE1DC] shadow-xs text-center text-xs text-[#56615C]">
          Không có bệnh nhân trong ngày {dm(dStart)}.
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRooms.map((rm) => {
            const roomPatients = vPatients.filter((p) => p.room === rm);
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
                    const records = getPatientDayRecords(p);
                    const out = isOut(p);

                    return (
                      <div key={p.id} className="p-4 space-y-3">
                        {/* Top: Name, Age, Action buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm text-[#17201D]">{p.name}</strong>
                            <span className="text-xs text-[#56615C]">{ageText(p)}</span>
                            {out && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                                {KIND_LABELS[p.outKind || 'ra']}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-100">
                              {fullTimeline.length} lần ghi nhận
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenRecordModal(p)}
                              className="px-2.5 py-1 rounded-lg border border-[#0E6B5E] bg-white hover:bg-[#E4F0EC] text-[#0B5C51] text-xs font-semibold transition-colors cursor-pointer"
                            >
                              + Ghi
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenPatientHistory(p)}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 transition-colors cursor-pointer"
                            >
                              Xem hồ sơ
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E4F0EC] hover:bg-[#d5e7e1] text-[#0B5C51] text-xs font-bold transition-colors cursor-pointer"
                              title={isExpanded ? 'Thu gọn dòng thời gian' : 'Xem dòng thời gian trượt ngang'}
                            >
                              <span>{isExpanded ? 'Thu gọn' : 'Dòng thời gian'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Full Timeline Table (when expanded) OR Single Day Table (when collapsed) */}
                        {isExpanded ? (
                          <div className="pt-2 animate-in fade-in duration-150">
                            <VitalsTimelineTable
                              items={fullTimeline}
                              patient={p}
                              onAddVitals={() => onOpenRecordModal(p)}
                              onAddTreatment={onAddTreatment}
                            />
                          </div>
                        ) : !records.length ? (
                          <div className="text-xs text-[#8A948F] italic py-1">
                            Chưa ghi nhận DHST trong ngày này.
                          </div>
                        ) : (
                          <div className="border border-[#E6E9E5] rounded-xl overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-6 bg-[#F3F4F1] text-[11px] font-bold text-[#3A4540] px-3 py-2 border-b border-[#E6E9E5]">
                              <div>Giờ</div>
                              <div>Mạch</div>
                              <div>Huyết áp</div>
                              <div>Nhiệt độ</div>
                              <div>SpO₂</div>
                              <div>Nhịp thở</div>
                            </div>

                            {/* Table Rows */}
                            <div className="divide-y divide-[#EEF0ED]">
                              {records.map((r, rIdx) => {
                                const details = getVitals(r);
                                return (
                                  <div key={rIdx} className="text-xs">
                                    <div className="grid grid-cols-6 px-3 py-2 font-medium">
                                      <div className="font-bold text-[#17201D]">{hm(r.at)}</div>
                                      {details.map((vd, vIdx) => (
                                        <div
                                          key={vIdx}
                                          className={
                                            vd.bad
                                              ? 'font-bold text-[#7E3204] bg-[#FDF0E5] px-1 rounded-xs inline-block'
                                              : 'text-[#2B3531]'
                                          }
                                        >
                                          {vd.raw}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Note if present */}
                                    {r.note && (
                                      <div className="px-3 pb-2 pt-0.5 text-xs text-[#2B3531] flex items-start gap-1.5">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                            r.isAdmit
                                              ? 'bg-blue-100 text-blue-800'
                                              : r.abn
                                              ? 'bg-amber-100 text-amber-900'
                                              : 'bg-gray-100 text-gray-700'
                                          }`}
                                        >
                                          {r.isAdmit ? 'Nhập viện' : r.abn ? 'Bất thường' : 'Ghi chú'}
                                        </span>
                                        <span className="flex-1">{r.note}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
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
