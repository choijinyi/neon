import {Sparkles} from 'lucide-react';
import type {Highlight} from '../types';
import {formatTime} from '../utils/youtube';

interface Props {
  highlights: Highlight[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function HighlightList({highlights, selectedIndex, onSelect}: Props) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-stone-200 font-semibold">
        <Sparkles className="w-4 h-4 text-amber-400" />
        AI가 찾은 하이라이트 {highlights.length}개
      </h2>
      {highlights.map((h, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`w-full text-left p-4 rounded-2xl border transition-all ${
              selected
                ? 'border-amber-400/70 bg-amber-400/10 shadow-lg shadow-amber-900/20'
                : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`font-bold break-keep ${selected ? 'text-amber-300' : 'text-white'}`}>
                {i + 1}. {h.title}
              </p>
              <span className="shrink-0 text-xs text-stone-400 font-mono mt-1">
                {formatTime(h.startSeconds)}~{formatTime(h.endSeconds)}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-stone-400 leading-relaxed break-keep">{h.reason}</p>
          </button>
        );
      })}
    </div>
  );
}
