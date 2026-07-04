import {GoogleGenAI} from '@google/genai';
import type {AnalysisResult, DurationSeconds} from '../types';
import {ANALYSIS_MODEL, buildPrompt, parseAnalysis, responseSchema} from './analysisCore';

/**
 * 설교 영상 분석.
 * 1순위: 배포 서버의 /api/analyze (Vercel 서버리스, 키가 서버에만 존재)
 * 2순위: 빌드 시 주입된 GEMINI_API_KEY로 브라우저에서 직접 호출 (AI Studio/로컬 개발용)
 */
export async function analyzeSermon(
  youtubeUrl: string,
  duration: DurationSeconds,
): Promise<AnalysisResult> {
  const serverResult = await tryServerAnalyze(youtubeUrl, duration);
  if (serverResult) return serverResult;
  return clientAnalyze(youtubeUrl, duration);
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
    return null; // 서버 없음(로컬 개발 등) → 클라이언트 호출로 폴백
  }

  if (res.status === 404 || res.status === 405) return null; // API 라우트 없음

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // 서버가 키 미설정 등 명시적 오류를 반환한 경우, 클라이언트 키가 있으면 폴백
    if (data?.code === 'NO_API_KEY' && process.env.GEMINI_API_KEY) return null;
    throw new Error(data?.error ?? '서버 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return data as AnalysisResult;
}

async function clientAnalyze(
  youtubeUrl: string,
  duration: DurationSeconds,
): Promise<AnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'Gemini API 키가 설정되지 않았습니다. Vercel 프로젝트 환경변수에 GEMINI_API_KEY를 추가해 주세요.',
    );
  }
  const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
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
