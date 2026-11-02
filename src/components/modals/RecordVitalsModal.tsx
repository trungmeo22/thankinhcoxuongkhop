import React, { useState } from 'react';
import { Patient, VitalRecord } from '../../types';
import { hm, dmy, ageText, fold, hasVit, uid } from '../../lib/constants';
import { X, Clock, AlertCircle, HeartPulse, Search } from 'lucide-react';
import { ExpandableTreatmentInput } from '../ExpandableTreatmentInput';

interface RecordVitalsModalProps {
  initialPatient?: Patient | null;
  initialRecord?: VitalRecord | null;
  patients: Patient[];
  onClose: () => void;
  onSave: (record: VitalRecord, updatedPatientVitals: Partial<Patient>) => void;
}

export const RecordVitalsModal: React.FC<RecordVitalsModalProps> = ({
  initialPatient,
  initialRecord,
  patients,
  onClose,
  onSave,
}) => {
  const [selectedPid, setSelectedPid] = useState<number | null>(
    initialRecord?.pid || initialPatient?.id || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [pulse, setPulse] = useState(initialRecord?.pulse || '');
  const [bp, setBp] = useState(initialRecord?.bp || '');
  const [temp, setTemp] = useState(initialRecord?.temp || '');
  const [spo2, setSpo2] = useState(initialRecord?.spo2 || '');
  const [rr, setRr] = useState(initialRecord?.rr || '');
  const [note, setNote] = useState(initialRecord?.note || '');
  const [abn, setAbn] = useState(initialRecord?.abn || false);
  const [abnTouched, setAbnTouched] = useState(!!initialRecord);
  const [txText, setTxText] = useState(
    initialRecord?.tx?.map((t) => t.text).join('\n') || ''
  );
  const [err, setErr] = useState('');

  const now = Date.now();
  const selectedPatient = patients.find((p) => p.id === selectedPid);

  // Suggestions for patient picker
  const activePatients = patients.filter((p) => p.status === 'in');
  const suggestions = searchQuery.trim()
    ? activePatients
        .filter((p) => fold(`${p.name} ${p.room}`).includes(fold(searchQuery.trim())))
        .slice(0, 5)
    : [];

  const handleNoteChange = (val: string) => {
    setNote(val);
    if (!abnTouched) {
      setAbn(val.trim().length > 0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPid) {
      setErr('Vui lòng chọn bệnh nhân cần ghi nhận.');
      return;
    }

    const vitalsObj = { pulse: pulse.trim(), bp: bp.trim(), temp: temp.trim(), spo2: spo2.trim(), rr: rr.trim() };
    if (!hasVit(vitalsObj) && !note.trim()) {
      setErr('Vui lòng nhập ít nhất một chỉ số sinh tồn hoặc nội dung diễn biến.');
      return;
    }

    setErr('');
    const recordId = initialRecord ? initialRecord.id : uid();
    const recordAt = initialRecord ? initialRecord.at : now;

    let txItems = initialRecord?.tx || [];
    if (txText.trim()) {
      txItems = txText
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line, idx) => ({
          id: (initialRecord?.tx && initialRecord.tx[idx]?.id) || (recordId + 1 + idx),
          at: (initialRecord?.tx && initialRecord.tx[idx]?.at) || recordAt,
          text: line.trim()
        }));
    } else {
      txItems = [];
    }

    const newRecord: VitalRecord = {
      id: recordId,
      pid: selectedPid,
      at: recordAt,
      pulse: pulse.trim(),
      bp: bp.trim(),
      temp: temp.trim(),
      spo2: spo2.trim(),
      rr: rr.trim(),
      note: note.trim(),
      abn,
      tx: txItems
    };

    onSave(newRecord, vitalsObj);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#EEF0ED] bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-[#0E6B5E] flex items-center justify-center font-bold shrink-0">
              <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0F2F2A] leading-tight">
                {initialRecord ? 'Sửa DHST & Diễn biến' : 'Ghi DHST & Diễn biến'}
              </h2>
              {selectedPatient && (
                <p className="text-[11px] sm:text-xs text-[#56615C]">
                  <span className="font-bold text-[#0E6B5E]">P.{selectedPatient.room}</span> · {selectedPatient.name} ({ageText(selectedPatient)})
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form with Scrollable Body and Fixed Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 text-xs">
          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-3.5 space-y-3 min-h-0">
            {/* Time Banner */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 text-[#0B4F45] text-xs font-medium border border-emerald-100">
              <Clock className="w-4 h-4 shrink-0 text-[#0E6B5E]" />
              <span>
                Thời điểm ghi:{' '}
                <strong>
                  {hm(initialRecord ? initialRecord.at : now)} ·{' '}
                  {dmy(initialRecord ? initialRecord.at : now)}
                </strong>
              </span>
            </div>

            {/* Patient Selection if not initialPatient */}
            {!initialPatient && (
              <div>
                <label className="block font-semibold text-[#3A4540] mb-1">
                  Bệnh nhân *
                </label>

                {selectedPatient ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-[#0E6B5E]">
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
                      className="text-xs text-[#0E6B5E] hover:underline font-semibold cursor-pointer"
                    >
                      Đổi bệnh nhân
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
                        autoFocus={!initialPatient}
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
                            className="w-full p-2.5 text-left hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer"
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

            {/* Vitals inputs */}
            <fieldset className="p-2.5 sm:p-3 rounded-xl border border-[#DDE1DC] space-y-2 bg-[#FAFBF9]">
              <legend className="px-2 font-bold text-[#0B5C51] text-[11px]">
                Dấu hiệu sinh tồn hiện tại
              </legend>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5 text-center">Mạch (l/p)</label>
                  <input
                    type="text"
                    placeholder="80"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    autoFocus={!!initialPatient}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5 text-center">HA (mmHg)</label>
                  <input
                    type="text"
                    placeholder="120/80"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5 text-center">Nhiệt (°C)</label>
                  <input
                    type="text"
                    placeholder="36.8"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5 text-center">SpO₂ (%)</label>
                  <input
                    type="text"
                    placeholder="98"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5 text-center">NT (l/p)</label>
                  <input
                    type="text"
                    placeholder="18"
                    value={rr}
                    onChange={(e) => setRr(e.target.value)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-[#C3CAC4] text-center font-semibold text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
                  />
                </div>
              </div>
            </fieldset>

            {/* Evolution Note */}
            <div>
              <label className="block font-semibold text-[#3A4540] mb-1">
                Diễn biến lâm sàng
              </label>
              <textarea
                rows={2}
                placeholder="Ghi nhận tình trạng người bệnh (đau khớp, sưng nóng đỏ, đáp ứng thuốc...)"
                value={note}
                onChange={(e) => handleNoteChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none resize-y"
              />
            </div>

            {/* Abnormal Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none bg-amber-50/70 p-2 sm:p-2.5 rounded-xl border border-amber-200">
              <input
                type="checkbox"
                checked={abn}
                onChange={(e) => {
                  setAbn(e.target.checked);
                  setAbnTouched(true);
                }}
                className="w-4 h-4 rounded text-[#A3360F] focus:ring-amber-500"
              />
              <span className="text-xs text-[#7E3204]">
                Diễn biến bất thường – <strong>tự động đưa vào Báo cáo trực</strong>
              </span>
            </label>

            {/* Treatment Orders (Xử trí y lệnh / can thiệp) */}
            <ExpandableTreatmentInput
              value={txText}
              onChange={setTxText}
            />

            {err && (
              <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* Fixed Sticky Footer */}
          <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-t border-[#EEF0ED] bg-[#F9FAF9] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-semibold transition-colors shadow-xs cursor-pointer active:scale-95"
            >
              Lưu kết quả
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
