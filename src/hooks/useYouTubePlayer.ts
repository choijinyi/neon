import {useEffect, useRef, useState} from 'react';

// YouTube IFrame API 최소 타입
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  unloadModule(module: string): void;
  destroy(): void;
}

/** 유튜브 자체 자막(CC)을 끈다. 우리 자막과 이중으로 표시되는 것 방지 */
function disableYouTubeCaptions(player: YTPlayer) {
  try {
    player.unloadModule('captions'); // html5 플레이어
    player.unloadModule('cc'); // 구형 플레이어
  } catch {
    // 자막 모듈이 없는 영상이면 무시
  }
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, options: unknown) => YTPlayer;
      PlayerState: {PLAYING: number; ENDED: number; PAUSED: number};
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

interface Options {
  videoId: string;
  startSeconds: number;
  endSeconds: number;
}

/**
 * 하이라이트 구간을 반복 재생하는 유튜브 플레이어.
 * currentTime을 폴링해 자막 동기화에 쓴다.
 */
export function useYouTubePlayer({videoId, startSeconds, endSeconds}: Options) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startSeconds);
  const rangeRef = useRef({start: startSeconds, end: endSeconds});
  rangeRef.current = {start: startSeconds, end: endSeconds};

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    // API 로드 후 컨테이너에 플레이어 생성
    loadIframeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          disablekb: 1,
          start: Math.floor(startSeconds),
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player;
            if (player) disableYouTubeCaptions(player);
            setReady(true);
          },
          onStateChange: (e: {data: number}) => {
            if (cancelled || !window.YT) return;
            // 재생이 시작될 때마다 유튜브 자막이 다시 켜질 수 있어 반복해서 끈다
            if (player && e.data === window.YT.PlayerState.PLAYING) {
              disableYouTubeCaptions(player);
            }
            setPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      setReady(false);
      setPlaying(false);
      playerRef.current = null;
      player?.destroy();
    };
    // videoId가 바뀔 때만 플레이어를 다시 만든다 (구간 변경은 seek로 처리)
  }, [videoId]);

  // 구간이 바뀌면 시작점으로 이동
  useEffect(() => {
    if (!ready) return;
    playerRef.current?.seekTo(startSeconds, true);
    setCurrentTime(startSeconds);
  }, [ready, startSeconds, endSeconds]);

  // 재생 위치 폴링: 자막 동기화 + 구간 반복
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const t = player.getCurrentTime();
      setCurrentTime(t);
      const {start, end} = rangeRef.current;
      if (t >= end || t < start - 1) {
        player.seekTo(start, true);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [ready]);

  const play = () => playerRef.current?.playVideo();
  const pause = () => playerRef.current?.pauseVideo();
  const restart = () => {
    playerRef.current?.seekTo(rangeRef.current.start, true);
    playerRef.current?.playVideo();
  };

  return {containerRef, ready, playing, currentTime, play, pause, restart};
}
