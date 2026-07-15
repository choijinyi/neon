import {ChevronDown, ChevronLeft, ChevronRight, Clock3, Play, Trash2} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {Highlight, SubtitleLine} from '../types';

interface Props {
  highlight: Highlight;
  /** 현재 재생 시점 (영상 전체 기준 초) — 재생 중인 자막 줄 표시용 */
  currentTime: number;
  onChange: (subtitles: SubtitleLine[]) => void;
  /** 해당 시점(영상 전체 기준 초)부터 재생 */
  onPreview: (seconds: number) => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 자막 싱크·내용 편집기.
 * 전체 밀기(싱크), 줄별 시간 미세조정, 텍스트 수정, 줄 삭제를 지원하며
 * 모든 변경은 미리보기·녹화·SRT에 즉시 반영된다.
 */
export default function SubtitleEditor({highlight, currentTime, onChange, onPreview}: Props) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  // 다른 하이라이트를 선택하면 누적 조정 표시를 리셋
  useEffect(() => {
    setOffset(0);
  }, [highlight.startSeconds, highlight.endSeconds]);

  const shiftAll = (delta: number) => {
    setOffset((o) => round1(o + delta));
    onChange(
      highlight.subtitles.map((s) => ({
        ...s,
        start: round1(s.start + delta),
        end: round1(s.end + delta),
      })),
    );
  };

  const shiftLine = (index: number, delta: number) => {
    onChange(
      highlight.subtitles.map((s, i) =>
        i === index ? {...s, start: round1(s.start + delta), end: round1(s.end + delta)} : s,
      ),
    );
  };

  const editText = (index: number, text: string) => {
    onChange(highlight.subtitles.map((s, i) => (i === index ? {...s, text} : s)));
  };

  const removeLine = (index: number) => {
    onChange(highlight.subtitles.filter((_, i) => i !== index));
  };

  return (
    <section className="w-full max-w-[340px] mx-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-stone-200 hover:bg-white/[0.04] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-amber-300" />
          자막 싱크 · 내용 편집
        </span>
        <ChevronDown
          className={`w-4 h-4 text-stone-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5">
          {/* 전체 싱크 조절 */}
          <div className="rounded-xl bg-black/30 border border-white/[0.06] p-4 space-y-3">
            <p className="text-xs text-stone-400 leading-relaxed break-keep">
              자막이 말보다 <b className="text-stone-200">늦게</b> 나오면{' '}
              <b className="text-amber-300">앞당기기</b>, 말보다{' '}
              <b className="text-stone-200">먼저</b> 나오면{' '}
              <b className="text-amber-300">늦추기</b>를 누르세요.
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => shiftAll(-0.5)}
                className="flex items-center justify-center gap-0.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-stone-200 text-xs font-bold transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 -mr-1" />
                <ChevronLeft className="w-3.5 h-3.5" />
                0.5
              </button>
              <button
                type="button"
                onClick={() => shiftAll(-0.1)}
                className="flex items-center justify-center gap-0.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-stone-200 text-xs font-bold transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                0.1
              </button>
              <button
                type="button"
                onClick={() => shiftAll(0.1)}
                className="flex items-center justify-center gap-0.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-stone-200 text-xs font-bold transition-colors"
              >
                0.1
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => shiftAll(0.5)}
                className="flex items-center justify-center gap-0.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-stone-200 text-xs font-bold transition-colors"
              >
                0.5
                <ChevronRight className="w-3.5 h-3.5 -ml-1" />
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">
                ◀ 앞당기기 · 늦추기 ▶ (단위: 초)
              </span>
              {offset !== 0 && (
                <button
                  type="button"
                  onClick={() => shiftAll(-offset)}
                  className="text-amber-300/90 hover:text-amber-200 font-semibold transition-colors"
                >
                  {offset > 0 ? `+${offset}` : offset}초 조정됨 · 원래대로
                </button>
              )}
            </div>
          </div>

          {/* 줄별 편집 */}
          <div className="space-y-2">
            <p className="text-xs text-stone-500 break-keep px-1">
              ▶를 누르면 그 자막 시점부터 재생됩니다. 내용은 바로 고칠 수 있어요.
            </p>
            {highlight.subtitles.length === 0 && (
              <p className="text-center text-stone-500 text-sm py-4">자막이 없습니다.</p>
            )}
            {highlight.subtitles.map((s, i) => {
              const active = currentTime >= s.start && currentTime < s.end;
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-2.5 space-y-2 transition-colors duration-300 ${
                    active
                      ? 'border-amber-300/50 bg-amber-400/[0.07]'
                      : 'border-white/[0.06] bg-black/25'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="이 자막부터 재생"
                      onClick={() => onPreview(s.start)}
                      className="shrink-0 w-7 h-7 rounded-lg bg-amber-400/15 hover:bg-amber-400/30 text-amber-300 flex items-center justify-center transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 translate-x-px" fill="currentColor" />
                    </button>
                    <span className="shrink-0 text-[11px] font-mono text-stone-500 w-16 text-center">
                      {Math.max(0, round1(s.start - highlight.startSeconds)).toFixed(1)}~
                      {Math.max(0, round1(s.end - highlight.startSeconds)).toFixed(1)}초
                    </span>
                    <button
                      type="button"
                      aria-label="이 줄 0.2초 앞당기기"
                      onClick={() => shiftLine(i, -0.2)}
                      className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-stone-300 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="이 줄 0.2초 늦추기"
                      onClick={() => shiftLine(i, 0.2)}
                      className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-stone-300 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="이 줄 삭제"
                      onClick={() => removeLine(i)}
                      className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-red-500/25 text-stone-500 hover:text-red-300 flex items-center justify-center transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={s.text}
                    onChange={(e) => editText(i, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-stone-100 text-sm outline-none focus:border-amber-300/50 transition-colors"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
