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
  fold,
  isNewAdmitted
} from '../lib/constants';
import { Search, Plus, Edit2, HeartPulse, CalendarPlus, LogOut, ArrowLeft, Clock, ChevronRight, X } from 'lucide-react';
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
  onSaveVitalRecord?: (record: VitalRecord, updatedVitals: Partial<Patient>) => void;
  onDeleteVitalRecord?: (id: number) => void;
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
  onSaveVitalRecord,
  onDeleteVitalRecord,
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
        patients={patients}
        recs={recs}
        glucoseRecords={glucoseRecords}
        insulins={insulins}
        onBack={() => setSelectedPatientId(null)}
        onEditPatient={onEditPatient}
        onOpenRecordVitals={onOpenRecordVitals || onOpenVitals}
        onSaveVitalRecord={onSaveVitalRecord}
        onDeleteVitalRecord={onDeleteVitalRecord}
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
    return fold(`${p.name} ${p.room} ${p.doctor || ''}`).includes(qClean);
  };

  const activePatients = patients.filter((p) => isIn(p, now)).filter(match);
  const newPatients = activePatients.filter((p) => isNewAdmitted(p.admitAt, now));
  const newIds = new Set(newPatients.map((p) => p.id));
  const olderPatients = activePatients.filter((p) => !newIds.has(p.id));

  // Scheduled for discharge list (patients with scheduled discharge in the future)
  const scheduledDischargePatients = activePatients
    .filter((p) => p.status === 'out' && p.outAt != null && p.outAt > now)
    .sort((a, b) => (a.outAt || 0) - (b.outAt || 0));

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
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#DDE1DC] shadow-xs">
        <div className="flex items-center gap-2.5">
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

          {showOut && (
            <div className="shrink-0 mr-1">
              <h2 className="text-sm sm:text-base font-bold text-[#0F2F2A] flex items-center gap-2">
                <span>Danh sách báo ra viện</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {dischargedAll.length}
                </span>
                {pendingDischargeCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                    {pendingDischargeCount} chờ ra
                  </span>
                )}
              </h2>
            </div>
          )}

          {/* Search box - stretched */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder="Tìm tên, bác sĩ, số phòng..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-[#F9FAF9] focus:bg-white transition-colors"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Admit button */}
          <button
            type="button"
            onClick={onOpenAdmit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nhập viện</span>
          </button>
        </div>
      </div>

      {/* View: Inpatients */}
      {!showOut && (
        <div className="space-y-4">
          {/* Danh sách ra viện */}
          <div id="danh-sach-ra-vien" className="bg-white rounded-2xl border border-amber-200/90 shadow-xs overflow-hidden scroll-mt-24">
            <div className="p-3.5 bg-amber-50/75 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-200/90 text-amber-900 text-[11px] font-bold">
                  Báo ra
                </span>
                <h3 className="text-xs md:text-sm font-bold text-[#0F2F2A]">
                  Danh sách ra viện · {scheduledDischargePatients.length}
                </h3>
              </div>
            </div>

            <div className="divide-y divide-amber-100/60">
              {!scheduledDischargePatients.length ? (
                <div className="p-4 text-xs text-center text-[#56615C]">
                  Chưa có bệnh nhân nào lên lịch ra viện.
                </div>
              ) : (
                scheduledDischargePatients.map((p) => renderScheduledDischargeRow(p))
              )}
            </div>
          </div>

          {/* Newly admitted */}
          <div className="bg-white rounded-2xl border border-[#DDE1DC] shadow-xs overflow-hidden">
            <div className="p-3.5 bg-[#FDF0E5]/60 border-b border-[#F5D8C4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#FCE6D5] text-[#7E3204] text-[11px] font-bold">
                  Mới
                </span>
                <h3 className="text-xs md:text-sm font-bold text-[#0F2F2A]">
                  Mới nhập viện · {newPatients.length}
                </h3>
              </div>
            </div>

            <div className="divide-y divide-[#EEF0ED]">
              {!newPatients.length ? (
                <div className="p-4 text-xs text-center text-[#56615C]">
                  Chưa có bệnh nhân mới nhập viện.
                </div>
              ) : (
                newPatients.map((p) => renderPatientRow(p))
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

  function renderScheduledDischargeRow(p: Patient) {
    const kind = p.outKind || 'ra';
    const kindLabel = KIND_LABELS[kind] || 'Ra viện';

    return (
      <div
        key={`discharge-${p.id}`}
        onClick={() => setSelectedPatientId(p.id)}
        className="p-3.5 md:p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-amber-50/50 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Room badge */}
          <span className="px-2.5 py-1 rounded-lg bg-[#0F2F2A] group-hover:bg-[#0E6B5E] text-white font-bold text-xs shrink-0 transition-colors">
            {p.room}
          </span>

          {/* Patient Info */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm text-[#17201D] group-hover:text-[#0E6B5E] transition-colors">
                {p.name}
              </span>
              <span className="text-xs text-[#56615C]">{ageText(p)}</span>

              {/* Hình thức */}
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  kind === 'ck'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : kind === 'cv'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                {kindLabel}
              </span>

              <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#0E6B5E] transition-colors" />
            </div>

            {/* Giờ ra & Ghi chú */}
            <div className="text-xs text-[#2B3531] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>
                Giờ ra: <strong className="text-amber-950 font-bold">{hm(p.outAt!)} {dm(p.outAt!)}</strong>
              </span>
              {p.doctor && (
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  BS: {p.doctor}
                </span>
              )}
            </div>

            {p.outNote && (
              <div className="text-xs text-[#4A5550] mt-1 bg-amber-50/60 px-2 py-1 rounded-lg border border-amber-100 max-w-xl">
                <span className="font-semibold text-amber-950">Ghi chú:</span> {p.outNote}
              </div>
            )}
          </div>
        </div>

        {/* Action Button: Sửa báo ra */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onOpenDischarge(p)}
            className="px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Sửa kế hoạch báo ra"
          >
            Sửa
          </button>
        </div>
      </div>
    );
  }

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
          <div className="text-[11px] text-[#56615C] flex flex-wrap items-center gap-1.5 mt-0.5">
            <span>{ageText(p)} · vào {hm(p.admitAt)} · {dm(p.admitAt)}</span>
            {p.doctor && (
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                BS: {p.doctor}
              </span>
            )}
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
