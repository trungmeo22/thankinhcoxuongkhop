import React, { useState } from 'react';
import { Patient } from '../../types';
import { DEFAULT_ROOMS, DEFAULT_INSULINS } from '../../lib/constants';
import { X, Bed, Plus, RotateCcw, AlertCircle, CheckCircle2, Settings as SettingsIcon, Info, Syringe } from 'lucide-react';

interface SettingsModalProps {
  currentBeds: number;
  currentRooms: string[];
  currentInsulins?: string[];
  patients: Patient[];
  onClose: () => void;
  onSave: (beds: number, rooms: string[], insulins?: string[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentBeds,
  currentRooms,
  currentInsulins,
  patients,
  onClose,
  onSave,
}) => {
  const [beds, setBeds] = useState<number>(currentBeds || 30);
  const [rooms, setRooms] = useState<string[]>(
    currentRooms && currentRooms.length ? [...currentRooms] : [...DEFAULT_ROOMS]
  );
  const [insulins, setInsulins] = useState<string[]>(
    currentInsulins && currentInsulins.length ? [...currentInsulins] : [...DEFAULT_INSULINS]
  );
  const [newRoom, setNewRoom] = useState('');
  const [newInsulin, setNewInsulin] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  // Count active patients per room
  const activePatients = patients.filter((p) => p.status === 'in');
  const patientCountByRoom = activePatients.reduce((acc, p) => {
    const key = (p.room || '').trim().toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleAddRoom = (roomToAdd?: string) => {
    const target = (roomToAdd || newRoom).trim().toUpperCase();
    if (!target) return;

    if (rooms.some((r) => r.trim().toUpperCase() === target)) {
      setErr(`Phòng "${target}" đã có trong danh sách.`);
      setNotice('');
      return;
    }

    setErr('');
    setRooms([...rooms, target]);
    if (!roomToAdd) setNewRoom('');
    setNotice(`Đã thêm phòng ${target} vào danh mục.`);
  };

  const handleRemoveRoom = (roomToRemove: string) => {
    if (rooms.length <= 1) {
      setErr('Danh mục phải giữ lại ít nhất 1 phòng điều trị.');
      setNotice('');
      return;
    }

    const target = roomToRemove.trim().toUpperCase();
    const occupied = patientCountByRoom[target] || 0;

    setRooms((prev) => prev.filter((r) => r.trim().toUpperCase() !== target));
    setErr('');

    if (occupied > 0) {
      setNotice(`Đã xóa "${roomToRemove}" khỏi danh sách chọn (lưu ý: hiện có ${occupied} bệnh nhân đang nằm phòng này).`);
    } else {
      setNotice(`Đã xóa phòng "${roomToRemove}" thành công.`);
    }
  };

  const handleResetRooms = () => {
    setRooms([...DEFAULT_ROOMS]);
    setErr('');
    setNotice('Đã khôi phục danh mục buồng phòng mặc định (P.301 - P.306).');
  };

  const handleAddInsulin = () => {
    const target = newInsulin.trim();
    if (!target) return;

    if (insulins.some((i) => i.trim().toLowerCase() === target.toLowerCase())) {
      setErr(`Loại insulin "${target}" đã có trong danh mục.`);
      setNotice('');
      return;
    }

    setErr('');
    setInsulins([...insulins, target]);
    setNewInsulin('');
    setNotice(`Đã thêm loại insulin "${target}" vào danh mục.`);
  };

  const handleRemoveInsulin = (insToRemove: string) => {
    if (insulins.length <= 1) {
      setErr('Danh mục phải giữ lại ít nhất 1 loại insulin.');
      setNotice('');
      return;
    }

    setInsulins((prev) => prev.filter((i) => i.trim().toLowerCase() !== insToRemove.trim().toLowerCase()));
    setErr('');
    setNotice(`Đã xóa "${insToRemove}" khỏi danh mục insulin.`);
  };

  const handleResetInsulins = () => {
    setInsulins([...DEFAULT_INSULINS]);
    setErr('');
    setNotice('Đã khôi phục danh mục insulin mặc định.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (beds < 1) {
      setErr('Công suất giường phải lớn hơn 0.');
      return;
    }
    if (!rooms.length) {
      setErr('Phải có ít nhất 1 phòng điều trị.');
      return;
    }
    if (!insulins.length) {
      setErr('Phải có ít nhất 1 loại insulin trong danh mục.');
      return;
    }
    setErr('');
    onSave(beds, rooms, insulins);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#DDE1DC] max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed top */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEF0ED] bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0E6B5E] flex items-center justify-center border border-emerald-100 shrink-0">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0F2F2A]">
                Cài đặt khoa phòng, Giường & Insulin
              </h2>
              <p className="text-xs text-gray-500">Cập nhật công suất giường, danh mục phòng & loại insulin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-4">
          {/* Bed capacity */}
          <div className="p-3.5 rounded-xl bg-[#F9FAF9] border border-[#E6E9E5] space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="bed-cap" className="font-bold text-sm text-[#0F2F2A] flex items-center gap-2">
                <Bed className="w-4 h-4 text-[#0E6B5E]" />
                Công suất giường bệnh (kế hoạch)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="bed-cap"
                  type="number"
                  min="1"
                  max="500"
                  value={beds}
                  onChange={(e) => setBeds(parseInt(e.target.value, 10) || 1)}
                  className="w-20 px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-center font-bold text-sm text-[#0F2F2A] focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
                />
                <span className="font-semibold text-gray-500">giường</span>
              </div>
            </div>
            <p className="text-[11px] text-[#56615C]">
              Dùng để hiển thị tỷ lệ công suất sử dụng buồng bệnh trên trang Tổng quan và giao ban.
            </p>
          </div>

          {/* Rooms management */}
          <div className="p-3.5 rounded-xl bg-[#F9FAF9] border border-[#E6E9E5] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#0F2F2A]">
                  Danh mục phòng điều trị ({rooms.length})
                </h3>
                <p className="text-[11px] text-[#56615C]">
                  Bấm dấu <strong className="text-red-500">×</strong> để xóa phòng khỏi danh sách chọn khi nhập viện.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetRooms}
                className="text-[11px] text-gray-500 hover:text-[#0E6B5E] font-medium flex items-center gap-1 cursor-pointer hover:underline px-2 py-1 rounded hover:bg-gray-100"
                title="Khôi phục lại danh sách phòng P.301 - P.306"
              >
                <RotateCcw className="w-3 h-3" />
                Mặc định
              </button>
            </div>

            {/* Room chips */}
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1.5 bg-white rounded-xl border border-[#E6E9E5]">
              {rooms.length === 0 ? (
                <p className="text-gray-400 italic text-center w-full py-2">Chưa có phòng nào. Vui lòng thêm ít nhất 1 phòng.</p>
              ) : (
                rooms.map((rm) => {
                  const target = rm.trim().toUpperCase();
                  const count = patientCountByRoom[target] || 0;
                  return (
                    <div
                      key={rm}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-[#17201D] transition-colors group"
                    >
                      <span>{rm}</span>
                      {count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-medium">
                          {count} BN
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveRoom(rm);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-red-500 transition-all cursor-pointer ml-0.5 active:scale-90"
                        title={`Xóa phòng ${rm}`}
                        aria-label={`Xóa phòng ${rm}`}
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add room input */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#EEF0ED]">
              <input
                type="text"
                placeholder="Nhập tên phòng mới (VD: P.307, CẤP CỨU...)"
                value={newRoom}
                onChange={(e) => {
                  setNewRoom(e.target.value);
                  setErr('');
                  setNotice('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRoom();
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none uppercase bg-white font-medium"
              />
              <button
                type="button"
                onClick={() => handleAddRoom()}
                disabled={!newRoom.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Thêm phòng
              </button>
            </div>
          </div>

          {/* Insulin management */}
          <div className="p-3.5 rounded-xl bg-[#F9FAF9] border border-[#E6E9E5] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Syringe className="w-4 h-4 text-[#0E6B5E]" />
                <div>
                  <h3 className="font-bold text-sm text-[#0F2F2A]">
                    Danh mục Insulin ({insulins.length})
                  </h3>
                  <p className="text-[11px] text-[#56615C]">
                    Các loại Insulin hiển thị trong menu chọn nhanh khi ghi nhận đường huyết
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetInsulins}
                className="text-[11px] text-gray-500 hover:text-[#0E6B5E] font-medium flex items-center gap-1 cursor-pointer hover:underline px-2 py-1 rounded hover:bg-gray-100"
                title="Khôi phục lại danh sách Insulin mặc định"
              >
                <RotateCcw className="w-3 h-3" />
                Mặc định
              </button>
            </div>

            {/* Insulin chips */}
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1.5 bg-white rounded-xl border border-[#E6E9E5]">
              {insulins.length === 0 ? (
                <p className="text-gray-400 italic text-center w-full py-2">Chưa có loại insulin nào. Vui lòng thêm ít nhất 1 loại.</p>
              ) : (
                insulins.map((ins) => (
                  <div
                    key={ins}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-semibold text-sky-900 transition-colors group"
                  >
                    <span>{ins}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveInsulin(ins);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded-md text-sky-400 hover:text-white hover:bg-red-500 transition-all cursor-pointer ml-0.5 active:scale-90"
                      title={`Xóa loại insulin ${ins}`}
                      aria-label={`Xóa loại insulin ${ins}`}
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add insulin input */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#EEF0ED]">
              <input
                type="text"
                placeholder="Nhập tên loại Insulin mới (VD: Ryzodeg, Toujeo...)"
                value={newInsulin}
                onChange={(e) => {
                  setNewInsulin(e.target.value);
                  setErr('');
                  setNotice('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInsulin();
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl border border-[#C3CAC4] text-xs focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white font-medium"
              />
              <button
                type="button"
                onClick={() => handleAddInsulin()}
                disabled={!newInsulin.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0E6B5E] hover:bg-[#0A5248] text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Thêm loại
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {err && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {notice && !err && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{notice}</span>
            </div>
          )}

          </div>

          {/* Modal action buttons - Fixed bottom */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#EEF0ED] bg-[#F9FAF9] shrink-0">
            <p className="text-[11px] text-gray-500 hidden sm:block">
              * Nhớ bấm <strong>Lưu cài đặt</strong> để cập nhật dữ liệu.
            </p>
            <div className="flex items-center gap-2 ml-auto">
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
                Lưu cài đặt
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
