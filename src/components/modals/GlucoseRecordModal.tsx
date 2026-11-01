import React, { useState } from 'react';
import { GlucoseRecord, GlucoseSlot } from '../../types';
import { isoDay, uid, DEFAULT_INSULINS } from '../../lib/constants';
import { X, Syringe, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GlucoseRecordModalProps {
  initialRecord?: GlucoseRecord | null;
  patientId: number;
  patientName: string;
  patientRoom: string;
  insulinList?: string[];
  onClose: () => void;
  onSave: (record: GlucoseRecord) => void;
}

export const GlucoseRecordModal: React.FC<GlucoseRecordModalProps> = ({
  initialRecord,
  patientId,
  patientName,
  patientRoom,
  insulinList,
  onClose,
  onSave,
}) => {
  const availableInsulins = insulinList && insulinList.length > 0 ? insulinList : DEFAULT_INSULINS;
  const isEdit = Boolean(initialRecord);
  const now = Date.now();
  const todayStr = isoDay(now);

  const initialIns = initialRecord?.insulinType || '';
  const [date, setDate] = useState<string>(initialRecord?.date || todayStr);
  const [slotType, setSlotType] = useState<GlucoseSlot>(initialRecord?.slotType || '06:00');
  const [customTime, setCustomTime] = useState<string>(
    initialRecord?.slotType === 'custom' ? initialRecord.time : '15:00'
  );
  const [glucoseValue, setGlucoseValue] = useState<string>(initialRecord?.glucoseValue || '');
  const [insulinDose, setInsulinDose] = useState<string>(initialRecord?.insulinDose || '');
  const [selectedInsulin, setSelectedInsulin] = useState<string>(() => {
    if (!initialIns) return '';
    if (availableInsulins.includes(initialIns)) return initialIns;
    return '__custom__';
  });
  const [customInsulin, setCustomInsulin] = useState<string>(() => {
    if (!initialIns) return '';
    if (!availableInsulins.includes(initialIns)) return initialIns;
    return '';
  });
  const [note, setNote] = useState<string>(initialRecord?.note || '');
  const [err, setErr] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = glucoseValue.trim().replace(',', '.');
    if (!val) {
      setErr('Vui lòng nhập chỉ số đường huyết.');
      return;
    }

    const numVal = parseFloat(val);
    if (isNaN(numVal) || numVal <= 0 || numVal > 50) {
      setErr('Chỉ số đường huyết không hợp lý (thường từ 1.0 đến 40.0 mmol/L).');
      return;
    }

    let finalTime = slotType;
    if (slotType === 'custom') {
      if (!customTime.trim()) {
        setErr('Vui lòng điền mốc giờ cụ thể.');
        return;
      }
      finalTime = customTime.trim() as any;
    }

    const finalInsulinType =
      selectedInsulin === '__custom__'
        ? customInsulin.trim()
        : selectedInsulin.trim();

    const record: GlucoseRecord = {
      id: initialRecord?.id || uid(),
      patientId,
      date,
      time: finalTime,
      slotType,
      glucoseValue: val,
      insulinDose: insulinDose.trim(),
      insulinType: finalInsulinType,
      note: note.trim(),
      createdAt: initialRecord?.createdAt || now,
    };

    onSave(record);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed top */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEF0ED] bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-[#0F2F2A] text-white font-bold text-xs shrink-0">
              {patientRoom}
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0F2F2A] leading-tight">
                {isEdit ? 'Sửa lần test đường huyết' : 'Ghi nhận Đường huyết & Tiêm Insulin'}
              </h2>
              <p className="text-xs text-[#56615C]">
                Bệnh nhân: <strong>{patientName}</strong>
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

        {/* Form with scrollable body and fixed footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-3.5">
            {/* Ngày test & Mốc giờ test - 2 cột tiết kiệm không gian */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#3A4540] mb-1">
                  Ngày kiểm tra
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#3A4540] mb-1">
                  Mốc giờ test
                </label>
                <select
                  value={slotType}
                  onChange={(e) => {
                    setSlotType(e.target.value as GlucoseSlot);
                    setErr('');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs font-semibold focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white cursor-pointer"
                >
                  <option value="06:00">06:00 (Sáng)</option>
                  <option value="11:00">11:00 (Trưa)</option>
                  <option value="17:00">17:00 (Chiều)</option>
                  <option value="21:00">21:00 (Tối)</option>
                  <option value="custom">Khác (Tự điền)...</option>
                </select>
              </div>
            </div>

            {/* Nếu chọn Khác -> hiện ô điền giờ */}
            {slotType === 'custom' && (
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-800 shrink-0" />
                <span className="font-semibold text-emerald-900 text-xs shrink-0">
                  Nhập giờ cụ thể:
                </span>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="flex-1 px-2.5 py-1 rounded-lg border border-[#C3CAC4] bg-white text-xs font-bold focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                  required
                />
              </div>
            )}

            {/* Chỉ số Đường huyết */}
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-amber-950 text-xs">
                  Chỉ số Đường huyết (Mao mạch / Huyết tương)
                </label>
                <span className="text-[11px] font-bold text-amber-800">mmol/L</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="VD: 6.8 hoặc 11.2"
                  value={glucoseValue}
                  onChange={(e) => {
                    setGlucoseValue(e.target.value);
                    setErr('');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm font-bold text-gray-900 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-600 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Bình thường: 3.9 - 7.2</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                  <span>Tăng: &gt; 10.0</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  <span>Hạ: &lt; 3.9</span>
                </span>
              </div>
            </div>

            {/* Tiêm Insulin */}
            <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 space-y-2">
              <div className="flex items-center gap-1.5 text-sky-950 font-bold text-xs">
                <Syringe className="w-3.5 h-3.5 text-sky-700" />
                <span>Tiêm Insulin (Nếu có chỉ định)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-gray-700 text-[11px] mb-1">
                    Loại Insulin
                  </label>
                  <select
                    value={selectedInsulin}
                    onChange={(e) => {
                      setSelectedInsulin(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] bg-white text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Không tiêm / Không dùng --</option>
                    {availableInsulins.map((ins) => (
                      <option key={ins} value={ins}>
                        {ins}
                      </option>
                    ))}
                    <option value="__custom__">Khác (Tự nhập tên loại)...</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 text-[11px] mb-1">
                    Liều tiêm (UI)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 4 UI hoặc 6"
                    value={insulinDose}
                    onChange={(e) => setInsulinDose(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] bg-white text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Nếu chọn loại khác -> hiện ô nhập tên loại */}
              {selectedInsulin === '__custom__' && (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Nhập tên loại Insulin..."
                    value={customInsulin}
                    onChange={(e) => setCustomInsulin(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-sky-300 bg-white text-xs font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Ghi chú thêm */}
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">
                Ghi chú lâm sàng (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="VD: Trước ăn 15p, sau ăn 2h, cảm giác đói, vã mồ hôi..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
              />
            </div>

            {err && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* Footer - Fixed bottom */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#EEF0ED] bg-[#F9FAF9] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {isEdit ? 'Lưu thay đổi' : 'Lưu kết quả'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
