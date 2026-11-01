import React, { useState } from 'react';
import { Patient, VitalRecord, GlucoseRecord } from '../types';
import {
  hm,
  dm,
  dmy,
  ageText,
  DAY,
  KIND_LABELS,
  isIn,
  isOut,
  isoDay,
  fromIso
} from '../lib/constants';
import { GlucoseRecordModal } from './modals/GlucoseRecordModal';
import { GlucoseTimelineTable } from './GlucoseTimelineTable';
import { VitalsTimelineTable } from './VitalsTimelineTable';
import {
  ArrowLeft,
  Edit2,
  HeartPulse,
  Syringe,
  Activity,
  Plus,
  Clock,
  Calendar,
  AlertTriangle,
  User,
  CheckCircle2,
  CalendarPlus,
  LogOut,
  Trash2,
  FileText,
  RotateCcw
} from 'lucide-react';

interface PatientDetailViewProps {
  patient: Patient;
  recs: VitalRecord[];
  glucoseRecords: GlucoseRecord[];
  insulins?: string[];
  onBack: () => void;
  onEditPatient: (p: Patient) => void;
  onOpenRecordVitals: (p: Patient) => void;
  onAddTreatment: (recordId: number, text: string) => void;
  onSaveGlucoseRecord: (record: GlucoseRecord) => void;
  onDeleteGlucoseRecord: (id: number) => void;
  onOpenOrder: (p: Patient) => void;
  onOpenDischarge: (p: Patient) => void;
  onCancelDischarge?: (patientId: number) => void;
}

export const PatientDetailView: React.FC<PatientDetailViewProps> = ({
  patient,
  recs,
  glucoseRecords,
  insulins,
  onBack,
  onEditPatient,
  onOpenRecordVitals,
  onAddTreatment,
  onSaveGlucoseRecord,
  onDeleteGlucoseRecord,
  onOpenOrder,
  onOpenDischarge,
  onCancelDischarge,
}) => {
  const [activeTab, setActiveTab] = useState<'vitals' | 'glucose'>('vitals');

  // Glucose modal state
  const [glucoseModalOpen, setGlucoseModalOpen] = useState(false);
  const [editingGlucoseRecord, setEditingGlucoseRecord] = useState<GlucoseRecord | null>(null);

  const now = Date.now();
  const daysInHospital = Math.max(1, Math.round(((patient.outAt || now) - patient.admitAt) / DAY));
  const isPendingOut = patient.status === 'out' && (patient.outAt || 0) > now;

  // Filter vitals
  const patientRecs = recs
    .filter((r) => r.pid === patient.id)
    .map((r) => ({ ...r, isAdmit: false }));

  const admitRecord = {
    id: 0,
    pid: patient.id,
    at: patient.admitAt,
    pulse: patient.av?.pulse || patient.pulse,
    bp: patient.av?.bp || patient.bp,
    temp: patient.av?.temp || patient.temp,
    spo2: patient.av?.spo2 || patient.spo2,
    rr: patient.av?.rr || patient.rr,
    note: patient.note,
    abn: false,
    tx: [],
    isAdmit: true,
  };

  const vitalsTimeline = [...patientRecs, admitRecord].sort((a, b) => b.at - a.at);

  // Filter glucose records for this patient
  const patientGlucose = glucoseRecords
    .filter((g) => g.patientId === patient.id)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.time.localeCompare(b.time);
    });

  return (
    <div className="space-y-4">
      {/* Top Bar with Back Button & Summary */}
      <div className="bg-white p-4 rounded-2xl border border-[#DDE1DC] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại danh sách</span>
          </button>

          <span className="px-3 py-1.5 rounded-xl bg-[#0F2F2A] text-white font-bold text-sm shrink-0">
            {patient.room}
          </span>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">
                {patient.name}
              </h2>
              {isPendingOut && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  Chờ ra viện
                </span>
              )}
              {patient.status === 'out' && !isPendingOut && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                  Đã {KIND_LABELS[patient.outKind || 'ra'].toLowerCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-[#56615C]">
              {ageText(patient)} · Vào viện: {hm(patient.admitAt)} {dmy(patient.admitAt)} ({daysInHospital} ngày)
            </p>
            {patient.note && (
              <p className="text-xs text-[#1F4E45] bg-[#E9F6F1] px-2.5 py-1 rounded-lg border border-[#C5E6DC] mt-1 max-w-xl">
                <span className="font-bold">Chẩn đoán:</span> {patient.note}
              </p>
            )}
            {patient.outAt && (
              <p className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 mt-1">
                Thời điểm {patient.outKind ? KIND_LABELS[patient.outKind].toLowerCase() : 'ra viện'}: <strong>{hm(patient.outAt)} {dmy(patient.outAt)}</strong>
                {patient.outNote && <span className="italic ml-1">({patient.outNote})</span>}
              </p>
            )}
          </div>
        </div>

        {/* Quick action buttons on top bar */}
        <div className="flex items-center gap-2">
          {patient.status === 'out' && onCancelDischarge && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Khôi phục bệnh nhân "${patient.name}" (Phòng ${patient.room}) trở lại danh sách đang điều trị?`
                  )
                ) {
                  onCancelDischarge(patient.id);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-[#0E6B5E] text-[#0B5C51] hover:text-white border border-emerald-300 font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
              title="Khôi phục bệnh nhân trở lại điều trị"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục điều trị</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEditPatient(patient)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#0E6B5E] bg-white hover:bg-[#E4F0EC] text-[#0B5C51] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Sửa thông tin</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenOrder(patient)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Chỉ định</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDischarge(patient)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              isPendingOut
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isPendingOut ? 'Sửa báo ra' : 'Ra viện'}</span>
          </button>
        </div>
      </div>

      {/* Main Sections Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDE1DC] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('vitals')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'vitals'
              ? 'bg-[#0E6B5E] text-white shadow-xs'
              : 'bg-white text-[#56615C] hover:bg-gray-100 hover:text-[#0F2F2A]'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>1. DHST & Diễn biến ({vitalsTimeline.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('glucose')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'glucose'
              ? 'bg-[#0E6B5E] text-white shadow-xs'
              : 'bg-white text-[#56615C] hover:bg-gray-100 hover:text-[#0F2F2A]'
          }`}
        >
          <Syringe className="w-4 h-4" />
          <span>2. Bảng theo dõi Đường huyết & Insulin ({patientGlucose.length})</span>
        </button>
      </div>
      {/* TAB 1: THẺ XEM DHST / DIỄN BIẾN */}
      {activeTab === 'vitals' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-[#DDE1DC] shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#0F2F2A]">Lịch sử theo dõi DHST & Diễn biến lâm sàng</h3>
              <p className="text-xs text-[#56615C]">Tổng cộng {vitalsTimeline.length} lần ghi nhận</p>
            </div>
            {isIn(patient) && (
              <button
                type="button"
                onClick={() => onOpenRecordVitals(patient)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Ghi DHST / Diễn biến mới</span>
              </button>
            )}
          </div>

          <VitalsTimelineTable
            items={vitalsTimeline}
            patient={patient}
            onAddVitals={isIn(patient) ? () => onOpenRecordVitals(patient) : undefined}
            onAddTreatment={onAddTreatment}
          />
        </div>
      )}

      {/* TAB 3: THẺ THEO DÕI ĐƯỜNG HUYẾT & INSULIN */}
      {activeTab === 'glucose' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#DDE1DC] shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#0F2F2A] flex items-center gap-2">
                <Syringe className="w-4 h-4 text-emerald-700" />
                <span>Bảng theo dõi Đường huyết mao mạch & Tiêm Insulin</span>
              </h3>
              <p className="text-xs text-[#56615C]">
                Theo dõi theo ngày các mốc 6h, 11h, 17h, 21h hoặc giờ chỉ định riêng
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingGlucoseRecord(null);
                setGlucoseModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm lần test đường huyết</span>
            </button>
          </div>

          {/* Unified Horizontal Timeline Table */}
          <GlucoseTimelineTable
            records={patientGlucose}
            patientName={patient.name}
            onEditRecord={(rec) => {
              setEditingGlucoseRecord(rec);
              setGlucoseModalOpen(true);
            }}
            onDeleteRecord={(id) => onDeleteGlucoseRecord(id)}
            onAddTest={() => {
              setEditingGlucoseRecord(null);
              setGlucoseModalOpen(true);
            }}
          />
        </div>
      )}

      {/* Glucose Record Modal */}
      {glucoseModalOpen && (
        <GlucoseRecordModal
          initialRecord={editingGlucoseRecord}
          patientId={patient.id}
          patientName={patient.name}
          patientRoom={patient.room}
          insulinList={insulins}
          onClose={() => {
            setGlucoseModalOpen(false);
            setEditingGlucoseRecord(null);
          }}
          onSave={(rec) => {
            onSaveGlucoseRecord(rec);
            setGlucoseModalOpen(false);
            setEditingGlucoseRecord(null);
          }}
        />
      )}
    </div>
  );
};
