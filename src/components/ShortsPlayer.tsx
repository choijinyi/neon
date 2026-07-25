import {
  Circle,
  Download,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Square,
  Video,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {useYouTubePlayer} from '../hooks/useYouTubePlayer';
import {isRecordingSupported, startShortsRecording} from '../services/recorder';
import type {Highlight} from '../types';
import {buildSrt, downloadTextFile, formatTime, toSafeFilename} from '../utils/youtube';

export interface PlayerControl {
  /** 특정 시점(영상 전체 기준 초)부터 재생 */
  previewAt: (seconds: number) => void;
}

interface Props {
  videoId: string;
  highlight: Highlight;
  /** 재생 위치를 상위(자막 편집기)로 전달 */
  onTimeUpdate?: (seconds: number) => void;
  /** 상위에서 플레이어를 제어할 수 있게 하는 ref */
  controlRef?: RefObject<PlayerControl | null>;
}

type FsState = 'ready' | 'countdown' | 'playing' | 'done';

const IS_IOS =
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * 9:16 세로 프레임 안에 16:9 유튜브 영상을 중앙 크롭으로 채우고,
 * 재생 시간에 맞춰 자막을 오버레이하는 쇼츠 미리보기 플레이어.
 * PC: 탭 캡처(getDisplayMedia) 녹화 / 모바일: 전체화면 + 기기 화면 녹화 안내.
 */
export default function ShortsPlayer({videoId, highlight, onTimeUpdate, controlRef}: Props) {
  // 모바일 전체화면 녹화 모드
  const [fsMode, setFsMode] = useState(false);
  const [fsState, setFsState] = useState<FsState>('ready');
  const [count, setCount] = useState(3);
  const fsWrapperRef = useRef<HTMLDivElement>(null);
  const countdownTimer = useRef(0);

  const {containerRef, ready, playing, currentTime, play, pause, restart, previewAt} =
    useYouTubePlayer({
      videoId,
      startSeconds: highlight.startSeconds,
      endSeconds: highlight.endSeconds,
      loop: !fsMode,
      onSegmentEnd: () => setFsState('done'),
    });

  // 재생 위치를 자막 편집기로 전달
  useEffect(() => {
    onTimeUpdate?.(currentTime);
  }, [currentTime, onTimeUpdate]);

  // 상위에서 특정 시점 재생을 호출할 수 있게 등록
  useEffect(() => {
    if (controlRef) controlRef.current = {previewAt};
  });

  // PC 탭 캡처 녹화
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

  const exitFsMode = useCallback(() => {
    window.clearInterval(countdownTimer.current);
    document.exitFullscreen?.().catch(() => {});
    setFsMode(false);
    setFsState('ready');
    pause();
  }, [pause]);

  // 모드 UI는 CSS 오버레이(fixed)가 담당하므로, 네이티브 전체화면이 중간에
  // 풀려도(ESC 등) 오버레이는 유지된다 — 종료는 X/나가기 버튼으로만 한다.
  useEffect(() => () => window.clearInterval(countdownTimer.current), []);

  const enterFsMode = () => {
    setRecordError(null);
    pause();
    setFsState('ready');
    setFsMode(true);
    // 네이티브 전체화면이 안 되는 브라우저(구형 iOS 등)는 CSS 오버레이로 대체됨
    fsWrapperRef.current?.requestFullscreen?.().catch(() => {});
  };

  const startFsPlayback = () => {
    setFsState('countdown');
    setCount(3);
    let n = 3;
    countdownTimer.current = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCount(n);
      } else {
        window.clearInterval(countdownTimer.current);
        restart();
        setFsState('playing');
      }
    }, 1000);
  };

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
    downloadTextFile(`${toSafeFilename(highlight.title)}.srt`, srt);
  };

  const handleRecord = async () => {
    setRecordError(null);
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
      a.download = `${toSafeFilename(highlight.title)}.${extension}`;
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

  const hideChrome = recording || fsMode; // 진행바 등 녹화에 안 들어갈 UI 숨김

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 전체화면 래퍼: 모바일 녹화 모드에서 화면 전체를 검게 채우고 프레임을 중앙 배치 */}
      <div
        ref={fsWrapperRef}
        className={
          fsMode ? 'fixed inset-0 z-50 bg-black flex items-center justify-center' : 'contents'
        }
      >
        {/* 9:16 쇼츠 프레임 (녹화 대상 영역) */}
        <div
          ref={frameRef}
          className={`relative aspect-[9/16] overflow-hidden bg-black ${
            fsMode
              ? ''
              : 'w-[300px] sm:w-[340px] rounded-[1.75rem] shadow-[0_32px_80px_-20px_rgba(251,191,36,0.15),0_24px_60px_-16px_rgba(0,0,0,0.9)] ring-1 ring-white/10'
          }`}
          style={fsMode ? {height: 'min(100dvh, calc(100dvw * 16 / 9))'} : undefined}
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
            <p
              className={`text-white font-bold leading-snug text-center break-keep [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] ${
                fsMode ? 'text-2xl pt-6' : 'text-lg'
              }`}
            >
              {highlight.title}
            </p>
          </div>

          {/* 자막 오버레이 */}
          <div
            className={`absolute inset-x-0 px-4 flex justify-center pointer-events-none ${
              fsMode ? 'bottom-24' : 'bottom-16'
            }`}
          >
            {activeSubtitle && (
              <p
                className={`max-w-full text-center text-white font-extrabold leading-relaxed break-keep px-3 py-1.5 rounded-xl bg-black/55 [text-shadow:0_2px_6px_rgba(0,0,0,0.9)] ${
                  fsMode ? 'text-3xl' : 'text-xl'
                }`}
              >
                {activeSubtitle.text}
              </p>
            )}
          </div>

          {/* 진행 바 */}
          {!hideChrome && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
              <div
                className="h-full bg-amber-400 transition-[width] duration-200 ease-linear"
                style={{width: `${progress * 100}%`}}
              />
            </div>
          )}

          {/* 일반 모드: 클릭으로 재생/일시정지 */}
          {!hideChrome && (
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

          {/* ===== 모바일 전체화면 녹화 모드 오버레이 ===== */}
          {fsMode && fsState === 'ready' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <button
                type="button"
                aria-label="나가기"
                onClick={exitFsMode}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <p className="text-white font-bold text-xl break-keep">📱 기기 화면 녹화로 저장하기</p>
              <ol className="text-stone-300 text-base leading-relaxed break-keep text-left space-y-2">
                <li>
                  1. {IS_IOS
                    ? '제어 센터를 열고(오른쪽 위에서 아래로 쓸어내리기) ⏺ 화면 기록을 켜세요'
                    : '화면 위에서 아래로 쓸어내려 빠른 설정에서 [화면 녹화]를 켜세요'}
                </li>
                <li>2. 아래 [재생 시작]을 누르면 3초 후 쇼츠가 한 번 재생됩니다</li>
                <li>3. 재생이 끝나면 화면 녹화를 중지하세요 — 갤러리에 저장됩니다</li>
              </ol>
              <button
                type="button"
                onClick={startFsPlayback}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-extrabold text-lg"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                재생 시작
              </button>
              <p className="text-stone-500 text-xs break-keep">
                앞뒤 안내 화면은 갤러리 편집이나 쇼츠 업로드 시 잘라내면 됩니다
              </p>
            </div>
          )}

          {fsMode && fsState === 'countdown' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="text-white font-extrabold text-8xl">{count}</span>
            </div>
          )}

          {fsMode && fsState === 'playing' && (
            <button
              type="button"
              aria-label="중단"
              onClick={() => {
                pause();
                setFsState('ready');
              }}
              className="absolute inset-0"
            >
              {!playing && (
                <span className="absolute bottom-6 inset-x-0 text-center text-stone-400 text-sm">
                  재생이 안 되면 화면을 한 번 더 탭하세요
                </span>
              )}
            </button>
          )}

          {fsMode && fsState === 'done' && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <p className="text-white font-bold text-2xl break-keep">✅ 재생 완료!</p>
              <p className="text-stone-300 text-base break-keep">
                이제 {IS_IOS ? '제어 센터에서 화면 기록을' : '화면 녹화를'} 중지하세요.
                <br />
                영상이 갤러리에 저장됩니다.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={startFsPlayback}
                  className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-stone-700 text-white font-bold"
                >
                  <RotateCcw className="w-4 h-4" />
                  다시 재생
                </button>
                <button
                  type="button"
                  onClick={exitFsMode}
                  className="px-5 py-3 rounded-xl bg-amber-500 text-stone-900 font-bold"
                >
                  나가기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={recording}
          className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 text-stone-950 font-semibold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-40 transition-all duration-300"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? '일시정지' : '재생'}
        </button>
        <button
          type="button"
          onClick={restart}
          disabled={recording}
          className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-stone-200 font-semibold text-sm disabled:opacity-40 transition-all duration-300"
        >
          <RotateCcw className="w-4 h-4" />
          처음부터
        </button>
        <button
          type="button"
          onClick={handleSrtDownload}
          className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-stone-200 font-semibold text-sm transition-all duration-300"
        >
          <Download className="w-4 h-4" />
          자막(SRT)
        </button>
      </div>

      {/* 영상 만들기: PC는 탭 캡처, 모바일은 전체화면 + 기기 화면 녹화 */}
      {isRecordingSupported() ? (
        recording ? (
          <button
            type="button"
            onClick={() => stopRef.current?.()}
            className="w-full max-w-[340px] flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold shadow-xl shadow-red-600/25 transition-all duration-300"
          >
            <Square className="w-4 h-4" fill="currentColor" />
            녹화 중... {secondsLeft}초 남음 (누르면 여기까지 저장)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRecord}
            disabled={!ready}
            className="w-full max-w-[340px] flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-rose-400 via-rose-500 to-amber-500 bg-[length:200%_100%] bg-left hover:bg-right text-white font-extrabold shadow-xl shadow-rose-500/20 disabled:opacity-45 disabled:shadow-none transition-all duration-500"
          >
            <Video className="w-5 h-5" />
            자막 입힌 영상(MP4) 만들기
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={enterFsMode}
          disabled={!ready}
          className="w-full max-w-[340px] flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-rose-400 via-rose-500 to-amber-500 bg-[length:200%_100%] bg-left hover:bg-right text-white font-extrabold shadow-xl shadow-rose-500/20 disabled:opacity-45 disabled:shadow-none transition-all duration-500"
        >
          <Smartphone className="w-5 h-5" />
          자막 입힌 영상 만들기 (화면 녹화)
        </button>
      )}

      {recording ? (
        <p className="max-w-[340px] text-center text-amber-300/90 text-xs break-keep flex items-center justify-center gap-1.5">
          <Circle className="w-2.5 h-2.5 text-red-500 animate-pulse" fill="currentColor" />
          녹화 중입니다. 이 탭을 벗어나거나 창을 가리지 마세요.
        </p>
      ) : isRecordingSupported() ? (
        <p className="max-w-[340px] text-center text-stone-500 text-xs break-keep leading-relaxed">
          버튼을 누르면 화면 공유 창이 뜹니다. <b className="text-stone-400">"이 탭"</b>을 선택하고{' '}
          <b className="text-stone-400">"탭 오디오도 공유"</b>를 켠 뒤 공유를 누르면, 쇼츠가 처음부터
          재생되며 그대로 녹화되어 영상 파일로 저장됩니다.
        </p>
      ) : (
        <p className="max-w-[340px] text-center text-stone-500 text-xs break-keep leading-relaxed">
          버튼을 누르면 전체화면으로 바뀝니다. 휴대폰의{' '}
          <b className="text-stone-400">{IS_IOS ? '화면 기록(제어 센터)' : '화면 녹화(빠른 설정)'}</b>
          을 켜고 재생하면 자막이 입혀진 영상이 갤러리에 저장됩니다.
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
