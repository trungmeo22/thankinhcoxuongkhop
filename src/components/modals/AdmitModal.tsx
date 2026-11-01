import React, { useState } from 'react';
import { Patient } from '../../types';
import { dtLocal, hm, dmy, DEFAULT_ROOMS } from '../../lib/constants';
import { X, Clock, AlertCircle } from 'lucide-react';

interface AdmitModalProps {
  patient?: Patient | null;
  rooms?: string[];
  onClose: () => void;
  onSave: (patientData: Partial<Patient>) => void;
}

export const AdmitModal: React.FC<AdmitModalProps> = ({ patient, rooms = DEFAULT_ROOMS, onClose, onSave }) => {
  const isEdit = Boolean(patient);
  const now = Date.now();

  const availableRooms = Array.from(new Set([...(rooms || DEFAULT_ROOMS), patient?.room].filter(Boolean))) as string[];
  const defaultRoom = patient?.room || availableRooms[0] || 'P.301';

  const [name, setName] = useState(patient?.name || '');
  const [age, setAge] = useState(patient?.age || '');
  const [room, setRoom] = useState(defaultRoom);
  const [admitTime, setAdmitTime] = useState(patient?.admitAt ? dtLocal(patient.admitAt) : dtLocal(now));
  const [pulse, setPulse] = useState(patient?.pulse || patient?.av?.pulse || '');
  const [bp, setBp] = useState(patient?.bp || patient?.av?.bp || '');
  const [temp, setTemp] = useState(patient?.temp || patient?.av?.temp || '');
  const [spo2, setSpo2] = useState(patient?.spo2 || patient?.av?.spo2 || '');
  const [rr, setRr] = useState(patient?.rr || patient?.av?.rr || '');
  const [note, setNote] = useState(patient?.note || '');
  const [err, setErr] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Vui lòng nhập họ tên bệnh nhân.');
      return;
    }
    if (!room.trim()) {
      setErr('Vui lòng chọn phòng điều trị.');
      return;
    }

    const at = new Date(admitTime).getTime();
    if (isNaN(at)) {
      setErr('Giờ nhập viện không hợp lệ.');
      return;
    }

    setErr('');
    onSave({
      name: name.trim(),
      age: age.trim(),
      room: room.trim(),
      admitAt: at,
      pulse: pulse.trim(),
      bp: bp.trim(),
      temp: temp.trim(),
      spo2: spo2.trim(),
      rr: rr.trim(),
      note: note.trim(),
      av: {
        pulse: pulse.trim(),
        bp: bp.trim(),
        temp: temp.trim(),
        spo2: spo2.trim(),
        rr: rr.trim(),
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed top */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEF0ED] bg-white shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-[#0F2F2A]">
            {isEdit ? 'Sửa thông tin bệnh nhân' : 'Khai báo nhập viện'}
          </h2>
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
            {/* Time banner */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-[#0B4F45] text-xs font-medium border border-emerald-100">
              <Clock className="w-4 h-4 shrink-0" />
              {isEdit ? (
                <div className="flex items-center gap-2 flex-1">
                  <span>Giờ nhập:</span>
                  <input
                    type="datetime-local"
                    value={admitTime}
                    onChange={(e) => setAdmitTime(e.target.value)}
                    className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-xs font-semibold focus:outline-none"
                  />
                </div>
              ) : (
                <span>
                  Giờ nhập tự động: <strong>{hm(now)} · {dmy(now)}</strong>
                </span>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">
                Họ tên bệnh nhân *
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs font-semibold focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                autoFocus
              />
            </div>

            {/* Age & Room Dropdown - Single select dropdown, NO room list chips */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#3A4540] mb-1">Tuổi</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="VD: 58"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3A4540] mb-1">Phòng điều trị *</label>
                <select
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs font-bold text-[#0F2F2A] bg-white focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none cursor-pointer"
                >
                  {availableRooms.map((rm) => (
                    <option key={rm} value={rm}>
                      Phòng {rm}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vitals Box */}
            <fieldset className="p-3 rounded-xl border border-[#DDE1DC] space-y-2">
              <legend className="px-2 font-bold text-[#0B5C51] text-[11px]">
                Dấu hiệu sinh tồn lúc vào viện
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Mạch (l/p)</label>
                  <input
                    type="text"
                    placeholder="80"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">HA (mmHg)</label>
                  <input
                    type="text"
                    placeholder="120/80"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Nhiệt (°C)</label>
                  <input
                    type="text"
                    placeholder="36.8"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">SpO₂ (%)</label>
                  <input
                    type="text"
                    placeholder="98"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">NT (l/p)</label>
                  <input
                    type="text"
                    placeholder="18"
                    value={rr}
                    onChange={(e) => setRr(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                  />
                </div>
              </div>
            </fieldset>

            {/* Notes */}
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">
                Chẩn đoán sơ bộ / Lý do vào viện
              </label>
              <textarea
                rows={2}
                placeholder="VD: Thoái hóa khớp gối 2 bên đợt cấp, tràn dịch khớp P..."
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
              {isEdit ? 'Lưu thay đổi' : 'Lưu nhập viện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
