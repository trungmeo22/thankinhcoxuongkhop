import React, { useState } from 'react';
import { Patient, ScheduleItem, ProcedureType } from '../../types';
import { SITES, TYPE_LABELS, isoDay, ageText, fold, uid, dm, fromIso } from '../../lib/constants';
import { X, Calendar, Clock, AlertCircle, Search, Syringe, Zap } from 'lucide-react';

interface OrderModalProps {
  initialPatient?: Patient | null;
  patients: Patient[];
  scheds: ScheduleItem[];
  onClose: () => void;
  onSave: (schedule: ScheduleItem) => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  initialPatient,
  patients,
  scheds,
  onClose,
  onSave,
}) => {
  const today = isoDay(Date.now());
  const [type, setType] = useState<ProcedureType>('tiem');
  const [selectedPid, setSelectedPid] = useState<number | null>(initialPatient?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [site, setSite] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('08:30');
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const selectedPatient = patients.find((p) => p.id === selectedPid);

  const activePatients = patients.filter((p) => p.status === 'in');
  const suggestions = searchQuery.trim()
    ? activePatients
        .filter((p) => fold(`${p.name} ${p.room}`).includes(fold(searchQuery.trim())))
        .slice(0, 5)
    : [];

  const sitePresets = SITES[type];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPid) {
      setErr('Vui lòng chọn bệnh nhân.');
      return;
    }
    if (!site.trim()) {
      setErr(type === 'tiem' ? 'Vui lòng chọn hoặc nhập vị trí khớp cần tiêm.' : 'Vui lòng chọn hoặc nhập vùng khảo sát điện cơ.');
      return;
    }
    if (!date || !time) {
      setErr('Vui lòng chọn ngày và giờ thực hiện.');
      return;
    }

    // Check clash
    const clash = scheds.find(
      (x) => !x.done && x.type === type && x.date === date && x.time === time
    );
    if (clash) {
      const clashPt = patients.find((p) => p.id === clash.patientId);
      setErr(
        `Trùng giờ: Đã có lịch ${TYPE_LABELS[type].toLowerCase()} lúc ${time} ngày ${dm(fromIso(date))} cho ${
          clashPt ? `[${clashPt.room}] ${clashPt.name}` : 'bệnh nhân khác'
        }.`
      );
      return;
    }

    setErr('');
    const newSchedule: ScheduleItem = {
      id: uid(),
      type,
      patientId: selectedPid,
      site: site.trim(),
      date,
      time,
      who: who.trim(),
      note: note.trim(),
      done: false
    };

    onSave(newSchedule);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] p-5 my-8 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-[#EEF0ED]">
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#0F2F2A]">Lên chỉ định thủ thuật</h2>
            {selectedPatient && (
              <p className="text-xs text-[#56615C]">
                {selectedPatient.room} · {selectedPatient.name} ({ageText(selectedPatient)})
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Toggle Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-[#F3F4F1] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setType('tiem');
              setSite('');
            }}
            className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              type === 'tiem'
                ? 'bg-white text-[#0B4F45] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Syringe className="w-4 h-4" />
            <span>Tiêm khớp</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setType('dien');
              setSite('');
            }}
            className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              type === 'dien'
                ? 'bg-white text-[#2B3889] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Điện cơ</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Patient Selection if not locked */}
          {!initialPatient && (
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">
                Bệnh nhân *
              </label>

              {selectedPatient ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-[#0E6B5E]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#0F2F2A] text-white font-bold text-xs">
                      {selectedPatient.room}
                    </span>
                    <strong className="text-xs text-[#17201D]">{selectedPatient.name}</strong>
                    <span className="text-xs text-gray-500">{ageText(selectedPatient)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPid(null);
                      setSearchQuery('');
                    }}
                    className="text-xs text-[#0E6B5E] hover:underline font-semibold"
                  >
                    Đổi
                  </button>
                </div>
              ) : (
                <div className="space-y-1 relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      placeholder="Gõ tên hoặc số phòng..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
                    />
                  </div>

                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#DDE1DC] rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-gray-100">
                      {suggestions.map((sg) => (
                        <button
                          key={sg.id}
                          type="button"
                          onClick={() => {
                            setSelectedPid(sg.id);
                            setSearchQuery('');
                          }}
                          className="w-full p-2.5 text-left hover:bg-gray-50 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-[#0F2F2A] text-white font-bold text-[10px]">
                              {sg.room}
                            </span>
                            <span className="font-semibold text-xs text-[#17201D]">{sg.name}</span>
                          </div>
                          <span className="text-[11px] text-gray-500">{ageText(sg)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Anatomical Site presets & input */}
          <div>
            <label className="block font-semibold text-[#3A4540] mb-1.5">
              {type === 'tiem' ? 'Vị trí khớp can thiệp *' : 'Vùng khảo sát điện cơ *'}
            </label>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {sitePresets.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSite(sp)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                    site === sp
                      ? 'bg-[#0E6B5E] text-white font-semibold'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0E6B5E]'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Hoặc nhập vị trí / khớp khác..."
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
            />
          </div>

          {/* Date, Time, Who */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">Ngày thực hiện</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">Giờ hẹn</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#3A4540] mb-1">Bác sĩ / KTV thực hiện</label>
            <input
              type="text"
              placeholder="VD: BS. Tuấn"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3A4540] mb-1">Ghi chú thủ thuật</label>
            <textarea
              rows={2}
              placeholder="Loại thuốc (Hyaluronic acid, Diprospan...), hướng dẫn siêu âm, test lẩy da..."
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

          <div className="flex justify-end gap-2 pt-2 border-t border-[#EEF0ED]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-semibold transition-colors shadow-xs"
            >
              Lưu chỉ định
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
