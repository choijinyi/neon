import {Clapperboard, Download, Loader2, Pause, Play, RotateCcw} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
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

  const [rendering, setRendering] = useState(false);
  const [receivedMb, setReceivedMb] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 다른 하이라이트로 바꾸면 진행 중인 MP4 생성을 취소
  useEffect(() => {
    setRenderError(null);
    return () => abortRef.current?.abort();
  }, [videoId, highlight]);

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

  const handleMp4Download = async () => {
    setRenderError(null);
    setRendering(true);
    setReceivedMb(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          videoId,
          title: highlight.title,
          startSeconds: highlight.startSeconds,
          endSeconds: highlight.endSeconds,
          subtitles: highlight.subtitles,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ??
            (res.status === 404
              ? 'MP4 생성은 배포된 사이트에서만 동작합니다.'
              : 'MP4 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
        );
      }

      // 스트리밍 수신 + 진행 표시
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          setReceivedMb(received / (1024 * 1024));
        }
      }
      if (received === 0) {
        throw new Error('MP4 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }

      const blob = new Blob(chunks, {type: 'video/mp4'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${highlight.title.replace(/\s+/g, '_')}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        console.error(e);
        setRenderError(
          e instanceof Error ? e.message : 'MP4 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }
    } finally {
      setRendering(false);
    }
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
      <div className="flex flex-wrap items-center justify-center gap-2">
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

      {/* MP4 생성 */}
      <button
        type="button"
        onClick={handleMp4Download}
        disabled={rendering}
        className="w-full max-w-[340px] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-extrabold disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {rendering ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            MP4 만드는 중... {receivedMb > 0 && `(${receivedMb.toFixed(1)}MB)`}
          </>
        ) : (
          <>
            <Clapperboard className="w-5 h-5" />
            자막 입힌 MP4 다운로드
          </>
        )}
      </button>
      {rendering && (
        <p className="text-stone-500 text-xs -mt-2 break-keep">
          영상 길이에 따라 1~4분 정도 걸립니다. 창을 닫지 마세요.
        </p>
      )}
      {renderError && (
        <p className="max-w-[340px] text-center text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 break-keep">
          {renderError}
        </p>
      )}

      <p className="text-stone-400 text-xs">
        구간 {formatTime(highlight.startSeconds)} ~ {formatTime(highlight.endSeconds)} ·{' '}
        {Math.round(duration)}초 · 구간 반복 재생
      </p>
    </div>
  );
}
