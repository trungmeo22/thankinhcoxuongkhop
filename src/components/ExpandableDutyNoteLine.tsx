import React, { useState, useRef, useEffect } from 'react';
import { Clock, X, Maximize2, Minimize2 } from 'lucide-react';
import { hm } from '../lib/constants';

interface ExpandableDutyNoteLineProps {
  time: string;
  text: string;
  placeholder?: string;
  onTimeChange: (time: string) => void;
  onTextChange: (text: string) => void;
  onAddLine?: () => void;
  onRemoveLine: () => void;
  canRemove: boolean;
}

export const ExpandableDutyNoteLine: React.FC<ExpandableDutyNoteLineProps> = ({
  time,
  text,
  placeholder = 'Nội dung diễn biến lâm sàng...',
  onTimeChange,
  onTextChange,
  onAddLine,
  onRemoveLine,
  canRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto focus textarea when expanded
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Click outside or blur to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 max-w-full transition-all duration-150 ${
        isExpanded
          ? 'p-2.5 sm:p-3 bg-white border border-[#0E6B5E] shadow-xs rounded-xl space-y-2'
          : 'flex items-center gap-1.5'
      }`}
    >
      {isExpanded ? (
        /* EXPANDED VIEW: Multi-line rich input with full text visible */
        <div className="w-full min-w-0 space-y-2">
          {/* Header Bar with Time & Collapse Button */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#EEF0ED] pb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg border border-[#C3CAC4]">
                <Clock className="w-3.5 h-3.5 text-[#0E6B5E] shrink-0" />
                <span className="text-[11px] font-semibold text-[#0F2F2A]">Giờ:</span>
                <input
                  type="text"
                  placeholder="08:30"
                  value={time}
                  onChange={(e) => onTimeChange(e.target.value)}
                  className="w-12 text-xs font-mono font-bold text-center focus:outline-none bg-transparent"
                  title="Giờ diễn biến"
                />
              </div>
              <button
                type="button"
                onClick={() => onTimeChange(hm(Date.now()))}
                className="text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 font-bold cursor-pointer transition-colors shrink-0"
                title="Lấy giờ hiện tại"
              >
                Bây giờ
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#0E6B5E] bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                title="Thu gọn lại"
              >
                <Minimize2 className="w-3 h-3" />
                <span>Thu gọn</span>
              </button>
              {canRemove && (
                <button
                  type="button"
                  onClick={onRemoveLine}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                  title="Xóa dòng này"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Full Multi-line Textarea */}
          <textarea
            ref={textareaRef}
            rows={3}
            placeholder={placeholder}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsExpanded(false);
              }
            }}
            className="w-full p-2 sm:p-2.5 rounded-lg border border-[#C3CAC4] text-xs leading-relaxed focus:outline-none focus:border-[#0E6B5E] resize-y min-h-[75px] bg-[#FAFBF9] block box-border"
          />
        </div>
      ) : (
        /* COLLAPSED VIEW: Slim compact 1-line item */
        <>
          {/* Time Input */}
          <div
            className="flex items-center gap-1 shrink-0 bg-white px-2 py-1.5 rounded-xl border border-[#C3CAC4] shadow-2xs"
            title="Giờ diễn biến"
          >
            <Clock className="w-3.5 h-3.5 text-[#0E6B5E] shrink-0" />
            <input
              type="text"
              placeholder="08:30"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-12 text-xs font-mono font-bold text-center focus:outline-none bg-transparent"
            />
          </div>

          {/* Collapsed 1-Line Preview Bar */}
          <div
            onClick={() => setIsExpanded(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsExpanded(true);
              }
            }}
            className="flex-1 min-w-0 min-h-[34px] px-2.5 py-1.5 rounded-xl border border-[#C3CAC4] bg-white hover:border-[#0E6B5E]/70 text-xs cursor-pointer flex items-center justify-between gap-1.5 shadow-2xs group select-none transition-all"
            title="Bấm để mở rộng nhập liệu chi tiết"
          >
            <div className="flex-1 min-w-0 overflow-hidden">
              {text.trim() ? (
                <span className="text-xs text-gray-800 font-medium truncate block">
                  {text.replace(/\n+/g, ' · ')}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic truncate block">
                  {placeholder}
                </span>
              )}
            </div>

            <div className="text-gray-400 group-hover:text-[#0E6B5E] shrink-0 transition-colors">
              <Maximize2 className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Action Buttons */}
          {canRemove && (
            <button
              type="button"
              onClick={onRemoveLine}
              className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
              title="Xóa dòng này"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
