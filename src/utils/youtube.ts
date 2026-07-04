import type {SubtitleLine} from '../types';

/** 유튜브 URL에서 영상 ID를 추출한다. 지원: watch, youtu.be, shorts, live, embed */
export function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/(?:shorts|live|embed)\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** 초 → "m:ss" 또는 "h:mm:ss" */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function toSrtTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/** 하이라이트 구간 기준(0초 시작)으로 SRT 자막 텍스트를 생성한다. */
export function buildSrt(subtitles: SubtitleLine[], segmentStart: number): string {
  return subtitles
    .map((line, i) => {
      const start = toSrtTimestamp(line.start - segmentStart);
      const end = toSrtTimestamp(line.end - segmentStart);
      return `${i + 1}\n${start} --> ${end}\n${line.text}`;
    })
    .join('\n\n');
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
