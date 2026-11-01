import React, { useState } from 'react';
import { Patient, DischargeKind } from '../../types';
import { KIND_LABELS, dtLocal, hm, dmy, ageText } from '../../lib/constants';
import { X, LogOut, Clock, AlertCircle, ArrowRightLeft } from 'lucide-react';

interface DischargeModalProps {
  patient: Patient;
  onClose: () => void;
  onSave: (kind: DischargeKind, time: number, note: string) => void;
  onCancelDischarge: (patientId: number) => void;
}

export const DischargeModal: React.FC<DischargeModalProps> = ({
  patient,
  onClose,
  onSave,
  onCancelDischarge,
}) => {
  const now = Date.now();
  const [kind, setKind] = useState<DischargeKind>(patient.outKind || 'ra');
  const [time, setTime] = useState(patient.outAt ? dtLocal(patient.outAt) : dtLocal(now));
  const [note, setNote] = useState(patient.outNote || '');
  const [err, setErr] = useState('');

  const isAlreadyReported = patient.status === 'out';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = new Date(time).getTime();
    if (isNaN(t)) {
      setErr('Vui lòng chọn thời gian ra viện / chuyển viện hợp lệ.');
      return;
    }
    if (t < patient.admitAt) {
      setErr(`Giờ ra viện phải sau giờ nhập viện (${hm(patient.admitAt)} ${dmy(patient.admitAt)}).`);
      return;
    }

    setErr('');
    onSave(kind, t, note.trim());
  };

  const getPlaceholder = () => {
    if (kind === 'ra') return 'Tình trạng ra viện, đơn thuốc về nhà, hẹn tái khám sau bao lâu...';
    if (kind === 'ck') return 'Chuyển đến khoa nào (VD: Hồi sức tích cực, Tim mạch...), lý do chuyển...';
    return 'Chuyển đến bệnh viện nào (VD: Bệnh viện Bạch Mai, Hữu Nghị...), lý do chuyển...';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEF0ED] bg-white shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#0F2F2A]">
              Báo ra viện / Chuyển khoa / Chuyển viện
            </h2>
            <p className="text-xs text-[#56615C]">
              {patient.room} · {patient.name} ({ageText(patient)}) · Vào viện {hm(patient.admitAt)} {dmy(patient.admitAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-3.5">
          {/* Discharge Kind Chips */}
          <div>
            <label className="block font-semibold text-[#3A4540] mb-1.5">
              Hình thức giải quyết người bệnh
            </label>
            <div className="flex flex-wrap gap-2">
              {(['ra', 'ck', 'cv'] as DischargeKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    kind === k
                      ? 'bg-[#0E6B5E] text-white shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0E6B5E]'
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Time with "Now" button */}
          <div>
            <label className="block font-semibold text-[#3A4540] mb-1">
              Thời gian dự kiến ra viện / chuyển
            </label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs font-semibold focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setTime(dtLocal(Date.now()))}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold transition-colors shrink-0"
              >
                Bây giờ
              </button>
            </div>
            <p className="text-[11px] text-[#56615C] mt-1">
              * Nếu chọn giờ trong tương lai (báo trước ca trực), giường bệnh vẫn được tính cho đến thời điểm đó.
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="block font-semibold text-[#3A4540] mb-1">
              {kind === 'ra' ? 'Ghi chú xuất viện' : 'Nơi chuyển & lý do chuyển'}
            </label>
            <textarea
              rows={3}
              placeholder={getPlaceholder()}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none resize-y"
            />
          </div>

          {err && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-[#EEF0ED] bg-[#F9FAF9] shrink-0">
            {isAlreadyReported ? (
              <button
                type="button"
                onClick={() => onCancelDischarge(patient.id)}
                className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold transition-colors text-xs cursor-pointer"
              >
                Hủy báo ra viện (Tiếp tục điều trị)
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#A3360F] hover:bg-[#86290A] text-white font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Lưu báo ra viện
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
