import {Circle, Download, Pause, Play, RotateCcw, Square, Video} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useYouTubePlayer} from '../hooks/useYouTubePlayer';
import {isRecordingSupported, startShortsRecording} from '../services/recorder';
import type {Highlight} from '../types';
import {buildSrt, downloadTextFile, formatTime} from '../utils/youtube';

interface Props {
  videoId: string;
  highlight: Highlight;
}

/**
 * 9:16 세로 프레임 안에 16:9 유튜브 영상을 중앙 크롭으로 채우고,
 * 재생 시간에 맞춰 자막을 오버레이하는 쇼츠 미리보기 플레이어.
 * 화면 녹화 방식으로 자막이 입혀진 MP4를 만들 수 있다.
 */
export default function ShortsPlayer({videoId, highlight}: Props) {
  const {containerRef, ready, playing, currentTime, play, pause, restart} =
    useYouTubePlayer({
      videoId,
      startSeconds: highlight.startSeconds,
      endSeconds: highlight.endSeconds,
    });

  const frameRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);

  // 다른 하이라이트로 바꾸면 진행 중인 녹화를 중단
  useEffect(() => {
    setRecordError(null);
    return () => stopRef.current?.();
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

  const handleRecord = async () => {
    setRecordError(null);
    if (!isRecordingSupported()) {
      setRecordError('이 브라우저는 화면 녹화를 지원하지 않습니다. PC 크롬 또는 엣지에서 사용해 주세요.');
      return;
    }
    if (!ready || !frameRef.current) return;

    try {
      const controller = await startShortsRecording({
        element: frameRef.current,
        durationMs: Math.max(1000, (duration - 0.3) * 1000),
        onStart: () => {
          restart();
          setRecording(true);
          setSecondsLeft(Math.ceil(duration));
        },
        onTick: setSecondsLeft,
      });
      stopRef.current = controller.stop;

      const {blob, extension} = await controller.done;
      pause();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${highlight.title.replace(/\s+/g, '_')}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
        setRecordError('화면 공유가 취소되었습니다. 버튼을 다시 누르고 "이 탭"을 선택해 주세요.');
      } else {
        console.error(e);
        setRecordError(e instanceof Error ? e.message : '녹화에 실패했습니다. 다시 시도해 주세요.');
      }
    } finally {
      stopRef.current = null;
      setRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 9:16 쇼츠 프레임 (녹화 대상 영역) */}
      <div
        ref={frameRef}
        className="relative w-[300px] sm:w-[340px] aspect-[9/16] rounded-3xl overflow-hidden bg-black shadow-2xl shadow-amber-900/30 ring-1 ring-white/10"
      >
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

        {/* 진행 바 (녹화 중에는 영상에 안 들어가게 숨김) */}
        {!recording && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
            <div
              className="h-full bg-amber-400 transition-[width] duration-200 ease-linear"
              style={{width: `${progress * 100}%`}}
            />
          </div>
        )}

        {/* 클릭으로 재생/일시정지 (녹화 중에는 비활성) */}
        {!recording && (
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
        )}
      </div>

      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={recording}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold text-sm disabled:opacity-40 transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? '일시정지' : '재생'}
        </button>
        <button
          type="button"
          onClick={restart}
          disabled={recording}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-700 hover:bg-stone-600 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
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

      {/* MP4 녹화 */}
      {recording ? (
        <button
          type="button"
          onClick={() => stopRef.current?.()}
          className="w-full max-w-[340px] flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold transition-all"
        >
          <Square className="w-4 h-4" fill="currentColor" />
          녹화 중... {secondsLeft}초 남음 (누르면 여기까지 저장)
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRecord}
          disabled={!ready}
          className="w-full max-w-[340px] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-extrabold disabled:opacity-50 transition-all"
        >
          <Video className="w-5 h-5" />
          자막 입힌 영상(MP4) 만들기
        </button>
      )}

      {recording ? (
        <p className="max-w-[340px] text-center text-amber-300/90 text-xs break-keep flex items-center justify-center gap-1.5">
          <Circle className="w-2.5 h-2.5 text-red-500 animate-pulse" fill="currentColor" />
          녹화 중입니다. 이 탭을 벗어나거나 창을 가리지 마세요.
        </p>
      ) : (
        <p className="max-w-[340px] text-center text-stone-500 text-xs break-keep leading-relaxed">
          버튼을 누르면 화면 공유 창이 뜹니다. <b className="text-stone-400">"이 탭"</b>을 선택하고{' '}
          <b className="text-stone-400">"탭 오디오도 공유"</b>를 켠 뒤 공유를 누르면, 쇼츠가 처음부터
          재생되며 그대로 녹화되어 영상 파일로 저장됩니다. (PC 크롬/엣지 권장)
        </p>
      )}

      {recordError && (
        <p className="max-w-[340px] text-center text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 break-keep">
          {recordError}
        </p>
      )}

      <p className="text-stone-400 text-xs">
        구간 {formatTime(highlight.startSeconds)} ~ {formatTime(highlight.endSeconds)} ·{' '}
        {Math.round(duration)}초 · 구간 반복 재생
      </p>
    </div>
  );
}
