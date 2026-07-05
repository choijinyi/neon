import {GoogleGenAI} from '@google/genai';
import type {AnalysisResult, DurationSeconds} from '../types';
import {
  ANALYSIS_MODEL,
  buildPrompt,
  parseAnalysis,
  responseSchema,
} from '../../api/_lib/analysisCore';

/**
 * 설교 영상 분석.
 * 1순위: 사용자가 화면에서 입력한 API 키로 브라우저에서 직접 호출
 * 2순위: 배포 서버의 /api/analyze (서버 환경변수에 키가 있는 경우)
 * 3순위: 빌드 시 주입된 GEMINI_API_KEY (AI Studio/로컬 개발용)
 */
export async function analyzeSermon(
  youtubeUrl: string,
  duration: DurationSeconds,
  userApiKey?: string,
): Promise<AnalysisResult> {
  if (userApiKey?.trim()) {
    return clientAnalyze(youtubeUrl, duration, userApiKey.trim());
  }

  const serverResult = await tryServerAnalyze(youtubeUrl, duration);
  if (serverResult) return serverResult;

  const buildTimeKey = process.env.GEMINI_API_KEY;
  if (buildTimeKey) {
    return clientAnalyze(youtubeUrl, duration, buildTimeKey);
  }
  throw new Error('화면 상단의 입력칸에 Gemini API 키를 먼저 넣어주세요.');
}

async function tryServerAnalyze(
  youtubeUrl: string,
  duration: DurationSeconds,
): Promise<AnalysisResult | null> {
  let res: Response;
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({youtubeUrl, duration}),
    });
  } catch {
    return null; // 서버 없음(로컬 개발 등)
  }

  if (res.status === 404 || res.status === 405) return null; // API 라우트 없음

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (data?.code === 'NO_API_KEY') return null; // 서버에도 키 없음 → 다음 순위로
    throw new Error(data?.error ?? '서버 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return data as AnalysisResult;
}

async function clientAnalyze(
  youtubeUrl: string,
  duration: DurationSeconds,
  apiKey: string,
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({apiKey});
  const response = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {fileData: {fileUri: youtubeUrl, mimeType: 'video/*'}},
          {text: buildPrompt(duration)},
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.');
  }
  return parseAnalysis(text, duration);
}
