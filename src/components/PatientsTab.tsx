import React, { useState } from 'react';
import { Patient, VitalRecord, GlucoseRecord } from '../types';
import {
  isIn,
  isOut,
  DAY,
  dm,
  hm,
  dmy,
  ageText,
  KIND_LABELS,
  fold
} from '../lib/constants';
import { Search, Plus, Edit2, HeartPulse, CalendarPlus, LogOut, ArrowLeft, Clock, ChevronRight } from 'lucide-react';
import { PatientDetailView } from './PatientDetailView';

interface PatientsTabProps {
  patients: Patient[];
  recs: VitalRecord[];
  glucoseRecords: GlucoseRecord[];
  insulins?: string[];
  onOpenAdmit: () => void;
  onEditPatient: (p: Patient) => void;
  onOpenVitals: (p: Patient) => void;
  onOpenRecordVitals?: (p: Patient) => void;
  onOpenOrder: (p: Patient) => void;
  onOpenDischarge: (p: Patient) => void;
  onAddTreatment: (recordId: number, text: string) => void;
  onSaveGlucoseRecord: (record: GlucoseRecord) => void;
  onDeleteGlucoseRecord: (id: number) => void;
  initialShowDischarged?: boolean;
  selectedPatientId?: number | null;
  onSelectPatientId?: (id: number | null) => void;
  onCancelDischarge?: (patientId: number) => void;
  onSelectTab?: (tab: any) => void;
  onGoBack?: () => void;
}

export const PatientsTab: React.FC<PatientsTabProps> = ({
  patients,
  recs,
  glucoseRecords,
  insulins,
  onOpenAdmit,
  onEditPatient,
  onOpenVitals,
  onOpenRecordVitals,
  onOpenOrder,
  onOpenDischarge,
  onAddTreatment,
  onSaveGlucoseRecord,
  onDeleteGlucoseRecord,
  initialShowDischarged = false,
  selectedPatientId,
  onSelectPatientId,
  onCancelDischarge,
  onSelectTab,
  onGoBack,
}) => {
  const [q, setQ] = useState('');
  const [showOut, setShowOut] = useState(initialShowDischarged);
  const [internalSelectedPatientId, setInternalSelectedPatientId] = useState<number | null>(null);

  const activeSelectedPatientId = selectedPatientId !== undefined ? selectedPatientId : internalSelectedPatientId;
  const setSelectedPatientId = (id: number | null) => {
    if (onSelectPatientId) {
      onSelectPatientId(id);
    } else {
      setInternalSelectedPatientId(id);
    }
  };

  const selectedPatient = activeSelectedPatientId != null ? patients.find((p) => p.id === activeSelectedPatientId) : null;

  if (selectedPatient) {
    return (
      <PatientDetailView
        patient={selectedPatient}
        recs={recs}
        glucoseRecords={glucoseRecords}
        insulins={insulins}
        onBack={() => setSelectedPatientId(null)}
        onEditPatient={onEditPatient}
        onOpenRecordVitals={onOpenRecordVitals || onOpenVitals}
        onAddTreatment={onAddTreatment}
        onSaveGlucoseRecord={onSaveGlucoseRecord}
        onDeleteGlucoseRecord={onDeleteGlucoseRecord}
        onOpenOrder={onOpenOrder}
        onOpenDischarge={onOpenDischarge}
        onCancelDischarge={onCancelDischarge}
      />
    );
  }

  const now = Date.now();
  const qClean = fold(q.trim());

  // Filter patients
  const match = (p: Patient) => {
    if (!qClean) return true;
    return fold(`${p.name} ${p.room}`).includes(qClean);
  };

  const activePatients = patients.filter((p) => isIn(p, now)).filter(match);
  const newIn24h = activePatients.filter((p) => now - p.admitAt < DAY);
  const newIds = new Set(newIn24h.map((p) => p.id));
  const olderPatients = activePatients.filter((p) => !newIds.has(p.id));

  // Discharged list
  const dischargedAll = patients
    .filter((p) => p.status === 'out' && p.outAt != null)
    .sort((a, b) => {
      const aPend = (a.outAt || 0) > now;
      const bPend = (b.outAt || 0) > now;
      if (aPend !== bPend) return aPend ? -1 : 1;
      return aPend ? (a.outAt || 0) - (b.outAt || 0) : (b.outAt || 0) - (a.outAt || 0);
    })
    .filter(match);

  const pendingDischargeCount = patients.filter(
    (p) => p.status === 'out' && p.outAt != null && p.outAt > now
  ).length;

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
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
            <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">
              {showOut ? (
                <span className="flex items-center gap-2">
                  <span>Danh sách báo ra viện</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {dischargedAll.length}
                  </span>
                  {pendingDischargeCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                      {pendingDischargeCount} chờ ra
                    </span>
                  )}
                </span>
              ) : (
                <span>Bệnh nhân đang điều trị · {activePatients.length}</span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Tìm tên hoặc số phòng..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none w-48 md:w-56"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (onSelectTab) {
                onSelectTab('cu');
              } else {
                setShowOut(!showOut);
              }
            }}
            className="px-3 py-1.5 rounded-xl border border-[#0E6B5E] bg-white hover:bg-[#E4F0EC] text-[#0B5C51] text-xs font-semibold transition-colors cursor-pointer"
          >
            {onSelectTab
              ? `Bệnh nhân cũ (${patients.filter((p) => p.status === 'out').length})`
              : showOut
              ? '← Bệnh nhân hiện có'
              : `Danh sách báo ra viện (${patients.filter((p) => p.status === 'out').length})`}
          </button>

          {/* Admit button */}
          <button
            type="button"
            onClick={onOpenAdmit}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nhập viện</span>
          </button>
        </div>
      </div>

      {/* View: Inpatients */}
      {!showOut && (
        <div className="space-y-4">
          {/* Newly admitted 24h */}
          <div className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
            <div className="p-3.5 bg-[#FDF0E5]/60 border-b border-[#F5D8C4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#FCE6D5] text-[#7E3204] text-[11px] font-bold">
                  Mới
                </span>
                <h3 className="text-xs md:text-sm font-bold text-[#0F2F2A]">
                  Mới nhập viện (24h) · {newIn24h.length}
                </h3>
              </div>
            </div>

            <div className="divide-y divide-[#EEF0ED]">
              {!newIn24h.length ? (
                <div className="p-4 text-xs text-center text-[#56615C]">
                  Không có bệnh nhân mới trong 24 giờ qua.
                </div>
              ) : (
                newIn24h.map((p) => renderPatientRow(p))
              )}
            </div>
          </div>

          {/* Current Inpatients */}
          <div className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
            <div className="p-3.5 bg-[#F9FAF9] border-b border-[#E6E9E5]">
              <h3 className="text-xs md:text-sm font-bold text-[#0F2F2A]">
                Bệnh nhân hiện có · {olderPatients.length}
              </h3>
            </div>

            <div className="divide-y divide-[#EEF0ED]">
              {!olderPatients.length ? (
                <div className="p-4 text-xs text-center text-[#56615C]">
                  {qClean ? 'Không tìm thấy bệnh nhân phù hợp.' : 'Không có bệnh nhân nào.'}
                </div>
              ) : (
                olderPatients.map((p) => renderPatientRow(p))
              )}
            </div>
          </div>
        </div>
      )}

      {/* View: Discharged and Transfer log */}
      {showOut && (
        <div className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
          <div className="p-3.5 bg-[#F9FAF9] border-b border-[#E6E9E5] flex items-center justify-between">
            <span className="text-xs text-[#56615C]">
              Danh sách bệnh nhân đã ra viện hoặc chuyển khoa/chuyển viện
            </span>
          </div>

          <div className="divide-y divide-[#EEF0ED]">
            {!dischargedAll.length ? (
              <div className="p-6 text-center text-xs text-[#56615C]">
                Chưa có bệnh nhân nào báo ra viện hoặc chuyển.
              </div>
            ) : (
              dischargedAll.map((p) => {
                const isPending = (p.outAt || 0) > now;
                const days = Math.max(1, Math.round(((p.outAt || now) - p.admitAt) / DAY));
                const kind = p.outKind || 'ra';

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className="p-3.5 md:p-4 flex flex-wrap items-center gap-3 hover:bg-[#F2F8F5] transition-colors cursor-pointer group"
                  >
                    <span
                      className={`px-2.5 py-1.5 rounded-lg text-white font-bold text-xs shrink-0 ${
                        isPending ? 'bg-[#0F2F2A]' : 'bg-[#56615C]'
                      }`}
                    >
                      {p.room}
                    </span>

                    <div className="flex-1 min-w-[200px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-[#17201D] group-hover:text-[#0E6B5E] transition-colors">
                          {p.name}
                        </strong>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPending
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {isPending ? 'Chờ ' : 'Đã '}
                          {KIND_LABELS[kind].toLowerCase()}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#0E6B5E] transition-colors" />
                      </div>

                      <div className="text-xs text-[#2B3531] mt-0.5">
                        Thời điểm ra: <strong>{hm(p.outAt || now)} {dmy(p.outAt || now)}</strong>
                      </div>
                      <div className="text-[11px] text-[#56615C] mt-0.5">
                        {ageText(p)} · Vào: {dm(p.admitAt)} · Điều trị: {days} ngày
                      </div>

                      {p.outNote && (
                        <div className="mt-1.5 p-2 rounded-lg bg-[#F3F4F1] text-xs text-[#2B3531]">
                          {p.outNote}
                        </div>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenVitals(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 transition-colors"
                      >
                        DHST/Diễn biến
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDischarge(p)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors"
                      >
                        Sửa
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  function renderPatientRow(p: Patient) {
    const isPending = p.status === 'out' && (p.outAt || 0) > now;

    return (
      <div
        key={p.id}
        onClick={() => setSelectedPatientId(p.id)}
        className="p-3.5 md:p-4 flex flex-wrap items-center gap-3 hover:bg-[#F2F8F5] transition-colors cursor-pointer group"
      >
        {/* Room badge */}
        <span className="px-2.5 py-1 rounded-lg bg-[#0F2F2A] group-hover:bg-[#0E6B5E] text-white font-bold text-xs shrink-0 transition-colors">
          {p.room}
        </span>

        {/* Patient Info */}
        <div className="flex-1 min-w-[180px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm text-[#17201D] group-hover:text-[#0E6B5E] transition-colors">
              {p.name}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#0E6B5E] transition-colors" />
          </div>
          <div className="text-[11px] text-[#56615C]">
            {ageText(p)} · vào {hm(p.admitAt)} · {dm(p.admitAt)}
          </div>
          {p.note && (
            <div className="text-xs text-[#3A4540] truncate max-w-md mt-0.5">
              {p.note}
            </div>
          )}
          {isPending && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
              Báo ra viện lúc {hm(p.outAt!)} {dm(p.outAt!)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div
          className="flex flex-wrap items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onEditPatient(p)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Sửa thông tin bệnh nhân"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Sửa</span>
          </button>
          <button
            type="button"
            onClick={() => (onOpenRecordVitals ? onOpenRecordVitals(p) : onOpenVitals(p))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#0E6B5E] bg-white hover:bg-[#E4F0EC] text-[#0B5C51] text-xs font-semibold transition-colors cursor-pointer"
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>DHST</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenOrder(p)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#0E6B5E] bg-white hover:bg-[#E4F0EC] text-[#0B5C51] text-xs font-semibold transition-colors cursor-pointer"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Chỉ định</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenDischarge(p)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              isPending
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isPending ? 'Sửa báo ra' : 'Ra viện'}</span>
          </button>
        </div>
      </div>
    );
  }
};
