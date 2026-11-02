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
      className={`rounded-xl transition-all duration-150 ${
        isExpanded
          ? 'p-2.5 bg-white border border-[#0E6B5E] shadow-xs ring-1 ring-[#0E6B5E]/20 space-y-2'
          : 'flex items-center gap-1.5'
      }`}
    >
      {isExpanded ? (
        /* EXPANDED VIEW: Multi-line rich input with full text visible */
        <div className="space-y-2">
          {/* Header Bar with Time & Collapse Button */}
          <div className="flex items-center justify-between gap-2 border-b border-[#EEF0ED] pb-1.5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0E6B5E]" />
              <span className="text-[11px] font-semibold text-[#0F2F2A]">Giờ:</span>
              <input
                type="text"
                placeholder="08:30"
                value={time}
                onChange={(e) => onTimeChange(e.target.value)}
                className="w-16 px-1.5 py-0.5 rounded-md border border-[#C3CAC4] text-xs font-mono font-bold text-center focus:ring-1 focus:ring-[#0E6B5E] focus:outline-none bg-white"
                title="Giờ diễn biến"
              />
              <button
                type="button"
                onClick={() => onTimeChange(hm(Date.now()))}
                className="text-[10px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold cursor-pointer transition-colors"
                title="Lấy giờ hiện tại"
              >
                Bây giờ
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800 px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                title="Thu gọn lại"
              >
                <Minimize2 className="w-3 h-3 text-gray-400" />
                <span>Thu gọn</span>
              </button>
              {canRemove && (
                <button
                  type="button"
                  onClick={onRemoveLine}
                  className="p-1 text-gray-400 hover:text-red-500 rounded cursor-pointer"
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
            className="w-full p-2.5 rounded-lg border border-[#C3CAC4] text-xs leading-relaxed focus:outline-none focus:border-[#0E6B5E] resize-y min-h-[75px] bg-[#FAFBF9]"
          />
        </div>
      ) : (
        /* COLLAPSED VIEW: Slim compact 1-line item */
        <>
          {/* Time Input */}
          <div className="flex items-center gap-1 shrink-0 bg-white px-2 py-1 rounded-lg border border-[#C3CAC4]" title="Giờ diễn biến">
            <Clock className="w-3 h-3 text-[#0E6B5E]" />
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
            className="flex-1 min-h-[32px] px-2.5 py-1.5 rounded-lg border border-[#C3CAC4] bg-white hover:border-[#0E6B5E]/60 text-xs cursor-pointer flex items-center justify-between gap-2 shadow-2xs group select-none transition-all"
            title="Bấm để mở rộng nhập liệu chi tiết"
          >
            <div className="flex items-center gap-1.5 overflow-hidden flex-1">
              {text.trim() ? (
                <span className="text-xs text-gray-800 font-medium truncate">
                  {text.replace(/\n+/g, ' · ')}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic truncate">
                  {placeholder}
                </span>
              )}
            </div>

            <div className="text-gray-400 group-hover:text-[#0E6B5E] shrink-0 transition-colors">
              <Maximize2 className="w-3 h-3" />
            </div>
          </div>

          {/* Action Buttons */}
          {canRemove && (
            <button
              type="button"
              onClick={onRemoveLine}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg cursor-pointer"
              title="Xóa dòng này"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
