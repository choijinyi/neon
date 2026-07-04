import {Type} from '@google/genai';
import type {AnalysisResult, DurationSeconds, Highlight} from '../types';

/** 클라이언트/서버가 공유하는 설교 분석 프롬프트·스키마·후처리 로직 */

export const ANALYSIS_MODEL = 'gemini-2.5-flash';

export const responseSchema = {
  type: Type.OBJECT,
  properties: {
    videoTitle: {
      type: Type.STRING,
      description: '설교 영상의 제목 또는 핵심 주제 (한국어)',
    },
    highlights: {
      type: Type.ARRAY,
      description: '은혜로운 하이라이트 구간 3개',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: '쇼츠 제목으로 쓸 짧고 강력한 문구 (한국어, 20자 이내)',
          },
          reason: {
            type: Type.STRING,
            description: '이 구간을 하이라이트로 고른 이유 한 문장',
          },
          startSeconds: {
            type: Type.NUMBER,
            description: '하이라이트 시작 시각 (영상 전체 기준, 초)',
          },
          endSeconds: {
            type: Type.NUMBER,
            description: '하이라이트 종료 시각 (영상 전체 기준, 초)',
          },
          subtitles: {
            type: Type.ARRAY,
            description: '구간 내 발화를 받아쓴 자막',
            items: {
              type: Type.OBJECT,
              properties: {
                start: {type: Type.NUMBER, description: '자막 시작 시각 (영상 전체 기준, 초)'},
                end: {type: Type.NUMBER, description: '자막 종료 시각 (영상 전체 기준, 초)'},
                text: {type: Type.STRING, description: '자막 한 줄 (한국어, 20자 이내)'},
              },
              required: ['start', 'end', 'text'],
            },
          },
        },
        required: ['title', 'reason', 'startSeconds', 'endSeconds', 'subtitles'],
      },
    },
  },
  required: ['videoTitle', 'highlights'],
};

export function buildPrompt(duration: DurationSeconds): string {
  return `당신은 교회 미디어 사역을 돕는 설교 쇼츠 편집 전문가입니다.
이 설교 영상을 처음부터 끝까지 분석해서, 유튜브 쇼츠로 만들기 가장 좋은 하이라이트 구간 3개를 찾아주세요.

하이라이트 선정 기준:
- 설교의 핵심 메시지가 압축적으로 담긴 구간
- 은혜롭고 감동적이어서 공유하고 싶어지는 구간
- 문장이 중간에 끊기지 않고 완결되는 구간 (문장의 시작에서 시작하고 문장의 끝에서 끝나야 함)

길이 규칙 (매우 중요):
- 각 하이라이트는 정확히 ${duration}초 내외여야 합니다 (${Math.round(duration * 0.85)}초 ~ ${duration}초 사이, 절대 ${duration}초를 초과하지 말 것).

자막 규칙 (매우 중요):
- subtitles에는 해당 구간에서 설교자가 실제로 말한 내용을 그대로 받아쓰세요. 요약하거나 창작하지 마세요.
- 자막 한 줄은 화면에 한 번에 표시되므로 20자 이내로 짧게 끊으세요.
- 자막의 start/end는 실제 발화 타이밍과 정확히 일치해야 하며, 하이라이트 구간 전체를 빈틈없이 커버해야 합니다.
- 모든 시각(startSeconds, endSeconds, start, end)은 영상 전체 기준 초 단위입니다.

응답은 한국어로 작성하세요.`;
}

function sanitizeHighlight(h: Highlight, duration: DurationSeconds): Highlight {
  const startSeconds = Math.max(0, h.startSeconds);
  // 모델이 길이 규칙을 어겨도 선택한 길이를 넘지 않게 자른다.
  const endSeconds = Math.min(h.endSeconds, startSeconds + duration);
  const subtitles = (h.subtitles ?? [])
    .filter((s) => s.text?.trim() && s.end > startSeconds && s.start < endSeconds)
    .map((s) => ({
      start: Math.max(s.start, startSeconds),
      end: Math.min(s.end, endSeconds),
      text: s.text.trim(),
    }))
    .sort((a, b) => a.start - b.start);
  return {...h, startSeconds, endSeconds, subtitles};
}

/** Gemini 응답 텍스트를 파싱하고 검증한다. */
export function parseAnalysis(text: string, duration: DurationSeconds): AnalysisResult {
  const parsed = JSON.parse(text) as AnalysisResult;
  const highlights = (parsed.highlights ?? [])
    .filter((h) => h.endSeconds > h.startSeconds)
    .map((h) => sanitizeHighlight(h, duration));

  if (highlights.length === 0) {
    throw new Error('하이라이트를 찾지 못했습니다. 다른 영상으로 시도해 주세요.');
  }

  return {videoTitle: parsed.videoTitle ?? '설교 하이라이트', highlights};
}
