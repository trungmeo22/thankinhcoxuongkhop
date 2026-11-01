import React, { useState, useRef, useEffect } from 'react';
import { Syringe, Maximize2, Minimize2 } from 'lucide-react';

interface ExpandableTreatmentInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  initiallyExpanded?: boolean;
}

export const ExpandableTreatmentInput: React.FC<ExpandableTreatmentInputProps> = ({
  value,
  onChange,
  label = 'Nội dung xử trí y lệnh / can thiệp',
  placeholder = 'Thuốc hạ sốt, giảm đau, truyền dịch, chỉ định xét nghiệm thêm...',
  className = '',
  minHeight = 'min-h-[130px]',
  initiallyExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto focus when expanding
  useEffect(() => {
    if (isExpanded) {
      // Focus textarea and move cursor to the end
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
          textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // If user clicked a button outside (e.g. Save, Cancel), delay collapsing slightly so click fires smoothly
        const clickedButton = (e.target as HTMLElement).closest('button');
        if (clickedButton) {
          setTimeout(() => {
            setIsExpanded(false);
          }, 150);
        } else {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const lineCount = value.trim() ? value.trim().split('\n').filter(Boolean).length : 0;

  return (
    <div ref={containerRef} className={`space-y-1 ${className}`}>
      {/* Label & Expand/Collapse Indicator */}
      <div className="flex items-center justify-between">
        <label
          onClick={() => setIsExpanded(true)}
          className="font-semibold text-[#0B5C51] text-xs flex items-center gap-1.5 cursor-pointer select-none"
        >
          <Syringe className="w-3.5 h-3.5 text-[#0E6B5E]" />
          <span>{label}</span>
        </label>

        {isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800 px-2 py-0.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            title="Thu gọn lại"
          >
            <Minimize2 className="w-3 h-3 text-gray-400" />
            <span>Thu gọn</span>
          </button>
        ) : (
          value.trim() && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0E6B5E] hover:underline cursor-pointer"
              title="Mở rộng"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Mở rộng</span>
            </button>
          )
        )}
      </div>

      {/* Main Input Box */}
      {isExpanded ? (
        /* EXPANDED STATE: Full Multi-line Textarea */
        <div className="space-y-1.5 animate-in fade-in duration-150">
          <textarea
            ref={textareaRef}
            rows={4}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsExpanded(false);
              }
            }}
            className={`w-full px-3 py-2.5 rounded-xl border border-[#0E6B5E] ring-2 ring-[#0E6B5E]/20 text-xs text-gray-800 leading-relaxed focus:outline-none resize-y ${minHeight} bg-white shadow-xs`}
          />
        </div>
      ) : (
        /* COLLAPSED STATE: Slim Compact 1-line Field */
        <div
          onClick={() => setIsExpanded(true)}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(true);
            }
          }}
          className="w-full min-h-[38px] px-3 py-2 rounded-xl border border-[#C3CAC4] bg-gray-50/70 hover:bg-white hover:border-[#0E6B5E]/60 focus:border-[#0E6B5E] focus:ring-1 focus:ring-[#0E6B5E] transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs group select-none"
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            {value.trim() ? (
              <span className="text-xs text-gray-800 font-medium truncate">
                {value.replace(/\n+/g, ' · ')}
              </span>
            ) : (
              <span className="text-xs text-gray-400 truncate">
                {placeholder}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="p-1 rounded-md text-gray-400 group-hover:text-[#0E6B5E] transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
