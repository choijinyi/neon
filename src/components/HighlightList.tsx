import {Sparkles} from 'lucide-react';
import {motion} from 'motion/react';
import type {Highlight} from '../types';
import {formatTime} from '../utils/youtube';

interface Props {
  highlights: Highlight[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function HighlightList({highlights, selectedIndex, onSelect}: Props) {
  return (
    <div className="space-y-3.5">
      <h2 className="flex items-center gap-2 text-stone-300 text-sm font-semibold tracking-wide">
        <Sparkles className="w-4 h-4 text-amber-300" />
        AI가 찾은 하이라이트 {highlights.length}개
      </h2>
      {highlights.map((h, i) => {
        const selected = i === selectedIndex;
        return (
          <motion.button
            key={i}
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.45, delay: i * 0.1, ease: 'easeOut'}}
            type="button"
            onClick={() => onSelect(i)}
            className={`relative w-full text-left p-5 pl-6 rounded-2xl border overflow-hidden transition-all duration-300 ${
              selected
                ? 'border-amber-300/40 bg-gradient-to-br from-amber-400/[0.12] to-amber-400/[0.03] shadow-[0_12px_40px_-12px_rgba(251,191,36,0.25)]'
                : 'border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
            }`}
          >
            {/* 선택 표시 골드 바 */}
            <span
              className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                selected ? 'bg-gradient-to-b from-amber-300 to-amber-500' : 'bg-transparent'
              }`}
            />
            <div className="flex items-start justify-between gap-3">
              <p
                className={`font-bold leading-snug break-keep ${
                  selected ? 'text-amber-200' : 'text-stone-100'
                }`}
              >
                {i + 1}. {h.title}
              </p>
              <span className="shrink-0 mt-0.5 px-2 py-1 rounded-md bg-black/40 border border-white/[0.06] text-[11px] text-stone-400 font-mono">
                {formatTime(h.startSeconds)}~{formatTime(h.endSeconds)}
              </span>
            </div>
            <p className="mt-2 text-sm text-stone-400 leading-relaxed break-keep">{h.reason}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
