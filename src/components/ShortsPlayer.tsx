import {Download, Pause, Play, RotateCcw} from 'lucide-react';
import {useMemo} from 'react';
import {useYouTubePlayer} from '../hooks/useYouTubePlayer';
import type {Highlight} from '../types';
import {buildSrt, downloadTextFile, formatTime} from '../utils/youtube';

interface Props {
  videoId: string;
  highlight: Highlight;
}

/**
 * 9:16 세로 프레임 안에 16:9 유튜브 영상을 중앙 크롭으로 채우고,
 * 재생 시간에 맞춰 자막을 오버레이하는 쇼츠 미리보기 플레이어.
 */
export default function ShortsPlayer({videoId, highlight}: Props) {
  const {containerRef, ready, playing, currentTime, play, pause, restart} =
    useYouTubePlayer({
      videoId,
      startSeconds: highlight.startSeconds,
      endSeconds: highlight.endSeconds,
    });

  const activeSubtitle = useMemo(
    () =>
      highlight.subtitles.find(
        (s) => currentTime >= s.start && currentTime < s.end,
      ),
    [highlight.subtitles, currentTime],
  );

  const duration = highlight.endSeconds - highlight.startSeconds;
  const progress = Math.min(
    1,
    Math.max(0, (currentTime - highlight.startSeconds) / duration),
  );

  const handleSrtDownload = () => {
    const srt = buildSrt(highlight.subtitles, highlight.startSeconds);
    downloadTextFile(`${highlight.title.replace(/\s+/g, '_')}.srt`, srt);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 9:16 쇼츠 프레임 */}
      <div className="relative w-[300px] sm:w-[340px] aspect-[9/16] rounded-3xl overflow-hidden bg-black shadow-2xl shadow-amber-900/30 ring-1 ring-white/10">
        {/* 16:9 영상을 세로 프레임에 맞춰 중앙 크롭 */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 aspect-video h-full pointer-events-none">
          <div ref={containerRef} className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full" />
        </div>

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
            영상 불러오는 중...
          </div>
        )}

        {/* 상단 제목 오버레이 */}
        <div className="absolute top-0 inset-x-0 p-4 pt-5 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <p className="text-white font-bold text-lg leading-snug text-center break-keep [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
            {highlight.title}
          </p>
        </div>

        {/* 자막 오버레이 */}
        <div className="absolute bottom-16 inset-x-0 px-4 flex justify-center pointer-events-none">
          {activeSubtitle && (
            <p className="max-w-full text-center text-white font-extrabold text-xl leading-relaxed break-keep px-3 py-1.5 rounded-xl bg-black/55 [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
              {activeSubtitle.text}
            </p>
          )}
        </div>

        {/* 진행 바 */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
          <div
            className="h-full bg-amber-400 transition-[width] duration-200 ease-linear"
            style={{width: `${progress * 100}%`}}
          />
        </div>

        {/* 클릭으로 재생/일시정지 */}
        <button
          type="button"
          aria-label={playing ? '일시정지' : '재생'}
          onClick={playing ? pause : play}
          className="absolute inset-0 flex items-center justify-center group"
        >
          {!playing && ready && (
            <span className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-white translate-x-0.5" fill="currentColor" />
            </span>
          )}
        </button>
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={playing ? pause : play}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold text-sm transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? '일시정지' : '재생'}
        </button>
        <button
          type="button"
          onClick={restart}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-700 hover:bg-stone-600 text-white font-semibold text-sm transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          처음부터
        </button>
        <button
          type="button"
          onClick={handleSrtDownload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-700 hover:bg-stone-600 text-white font-semibold text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          자막(SRT)
        </button>
      </div>

      <p className="text-stone-400 text-xs">
        구간 {formatTime(highlight.startSeconds)} ~ {formatTime(highlight.endSeconds)} ·{' '}
        {Math.round(duration)}초 · 구간 반복 재생
      </p>
    </div>
  );
}
