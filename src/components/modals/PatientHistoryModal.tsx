import React, { useState } from 'react';
import { Patient, VitalRecord } from '../../types';
import { hm, dm, dmy, ageText, getVitals, KIND_LABELS, uid, isIn } from '../../lib/constants';
import { X, HeartPulse, Plus, Clock, AlertTriangle } from 'lucide-react';
import { VitalsTimelineTable } from '../VitalsTimelineTable';

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
  // Collect records for patient
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl xl:max-w-5xl bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between px-5 py-3.5 border-b border-[#EEF0ED] shrink-0 bg-white">
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
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-4">
          {isIn(patient) && (
            <div className="flex justify-between items-center bg-[#F3F4F1] p-2.5 rounded-xl">
              <span className="text-xs text-[#56615C]">
                Tổng số lần ghi nhận DHST & diễn biến: <strong>{timeline.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => onOpenRecordVitals(patient)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E6B5E] hover:bg-[#0A5248] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ghi DHST / Diễn biến mới</span>
              </button>
            </div>
          )}

          {/* Vitals Horizontal Timeline Table */}
          <VitalsTimelineTable
            items={timeline}
            patient={patient}
            onAddVitals={isIn(patient) ? () => onOpenRecordVitals(patient) : undefined}
            onAddTreatment={onAddTreatment}
          />
        </div>
      </div>
    </div>
  );
};
