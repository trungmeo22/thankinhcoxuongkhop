import React, { useState } from 'react';
import { Patient, VitalRecord } from '../../types';
import { hm, dm, dmy, ageText, getVitals, KIND_LABELS, uid, isIn } from '../../lib/constants';
import { X, HeartPulse, Plus, Clock, AlertTriangle } from 'lucide-react';

interface PatientHistoryModalProps {
  patient: Patient;
  recs: VitalRecord[];
  onClose: () => void;
  onOpenRecordVitals: (p: Patient) => void;
  onAddTreatment: (recordId: number, text: string) => void;
}

export const PatientHistoryModal: React.FC<PatientHistoryModalProps> = ({
  patient,
  recs,
  onClose,
  onOpenRecordVitals,
  onAddTreatment,
}) => {
  const [activeTxRecordId, setActiveTxRecordId] = useState<number | null>(null);
  const [txInput, setTxInput] = useState('');

  // Collect records for patient and sort reverse chronologically
  const patientRecs = recs
    .filter((r) => r.pid === patient.id)
    .map((r) => ({ ...r, isAdmit: false }));

  // Add initial admission entry
  const admitRecord = {
    id: 0,
    pid: patient.id,
    at: patient.admitAt,
    pulse: patient.av?.pulse,
    bp: patient.av?.bp,
    temp: patient.av?.temp,
    spo2: patient.av?.spo2,
    rr: patient.av?.rr,
    note: patient.note,
    abn: false,
    tx: [],
    isAdmit: true,
  };

  const timeline = [...patientRecs, admitRecord].sort((a, b) => b.at - a.at);

  const handleSaveTx = (recordId: number) => {
    if (!txInput.trim()) return;
    onAddTreatment(recordId, txInput.trim());
    setActiveTxRecordId(null);
    setTxInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] p-5 my-8 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-3 border-b border-[#EEF0ED]">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-xl bg-[#0F2F2A] text-white font-bold text-sm">
              {patient.room}
            </span>
            <div>
              <h2 className="text-base md:text-lg font-bold text-[#0F2F2A] leading-tight">
                {patient.name}
              </h2>
              <p className="text-xs text-[#56615C]">
                {ageText(patient)} · Vào viện: {hm(patient.admitAt)} {dmy(patient.admitAt)}
                {patient.status === 'out' && (
                  <span className="text-amber-800 font-semibold ml-1">
                    · {KIND_LABELS[patient.outKind || 'ra']} {patient.outAt ? `${hm(patient.outAt)} ${dmy(patient.outAt)}` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isIn(patient) && (
          <div className="flex justify-between items-center bg-[#F3F4F1] p-2.5 rounded-xl">
            <span className="text-xs text-[#56615C]">
              Tổng số lần ghi nhận DHST & diễn biến: <strong>{timeline.length}</strong>
            </span>
            <button
              type="button"
              onClick={() => onOpenRecordVitals(patient)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi DHST / Diễn biến mới</span>
            </button>
          </div>
        )}

        {/* Timeline list */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {timeline.map((it, idx) => {
            const vitDetails = getVitals(it).filter((v) => v.has);
            const isOpenTx = activeTxRecordId === it.id;

            return (
              <div
                key={it.id || `admit-${idx}`}
                className="p-3.5 rounded-xl bg-[#FAFBF9] border border-[#E6E9E5] space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#17201D]">
                      {hm(it.at)} · {dmy(it.at)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        it.isAdmit
                          ? 'bg-blue-100 text-blue-800'
                          : it.abn
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {it.isAdmit ? 'Nhập viện' : it.abn ? 'Diễn biến bất thường' : 'DHST thường quy'}
                    </span>
                  </div>
                </div>

                {/* Vitals Badges */}
                {vitDetails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {vitDetails.map((v, vIdx) => (
                      <span
                        key={vIdx}
                        className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${
                          v.bad
                            ? 'bg-[#FDF0E5] text-[#7E3204] font-bold border border-orange-200'
                            : 'bg-white text-[#2B3531] border border-[#DDE1DC]'
                        }`}
                      >
                        <b className="font-semibold text-gray-500 mr-1">{v.label}:</b>
                        {v.text}
                      </span>
                    ))}
                  </div>
                )}

                {/* Note */}
                {it.note && (
                  <p className="text-xs text-[#2B3531] leading-relaxed pt-1 bg-white p-2 rounded-lg border border-gray-100">
                    {it.note}
                  </p>
                )}

                {/* Treatments List */}
                {it.tx && it.tx.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {it.tx.map((t) => (
                      <div
                        key={t.id}
                        className="p-2 rounded-lg bg-[#EAF3FB] text-[#1E3A5C] text-xs font-medium"
                      >
                        <b>Xử trí {hm(t.at)} {dm(t.at)}:</b> {t.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Treatment Input */}
                {!it.isAdmit && (
                  <div className="pt-1">
                    {isOpenTx ? (
                      <div className="space-y-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                        <textarea
                          rows={2}
                          placeholder="Nhập nội dung xử trí thuốc / can thiệp..."
                          value={txInput}
                          onChange={(e) => setTxInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTxRecordId(null);
                              setTxInput('');
                            }}
                            className="px-2.5 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-200 font-semibold"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveTx(it.id)}
                            className="px-3 py-1 rounded-md text-xs bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-semibold shadow-xs"
                          >
                            Lưu xử trí
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTxRecordId(it.id);
                          setTxInput('');
                        }}
                        className="text-xs text-[#0B5C51] font-semibold hover:underline"
                      >
                        + Thêm xử trí y lệnh
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
