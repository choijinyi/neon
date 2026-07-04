export type DurationSeconds = 30 | 60 | 180;

export interface DurationOption {
  seconds: DurationSeconds;
  label: string;
}

export interface SubtitleLine {
  /** 영상 전체 기준 시작 시각 (초) */
  start: number;
  /** 영상 전체 기준 종료 시각 (초) */
  end: number;
  text: string;
}

export interface Highlight {
  title: string;
  reason: string;
  startSeconds: number;
  endSeconds: number;
  subtitles: SubtitleLine[];
}

export interface AnalysisResult {
  videoTitle: string;
  highlights: Highlight[];
}
