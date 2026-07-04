import {GoogleGenAI} from '@google/genai';
import type {VercelRequest, VercelResponse} from '@vercel/node';
import {
  ANALYSIS_MODEL,
  buildPrompt,
  parseAnalysis,
  responseSchema,
} from '../src/services/analysisCore';
import type {DurationSeconds} from '../src/types';

export const config = {
  maxDuration: 300,
};

const VALID_DURATIONS = [30, 60, 180];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'POST만 지원합니다.'});
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      code: 'NO_API_KEY',
      error:
        '서버에 Gemini API 키가 없습니다. Vercel 프로젝트 설정 → Environment Variables에 GEMINI_API_KEY를 추가해 주세요.',
    });
    return;
  }

  const {youtubeUrl, duration} = (req.body ?? {}) as {
    youtubeUrl?: string;
    duration?: number;
  };
  if (
    typeof youtubeUrl !== 'string' ||
    !/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(youtubeUrl) ||
    !VALID_DURATIONS.includes(duration as number)
  ) {
    res.status(400).json({error: '잘못된 요청입니다.'});
    return;
  }

  try {
    const ai = new GoogleGenAI({apiKey});
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {fileData: {fileUri: youtubeUrl, mimeType: 'video/*'}},
            {text: buildPrompt(duration as DurationSeconds)},
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
      res.status(502).json({error: 'AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.'});
      return;
    }
    res.status(200).json(parseAnalysis(text, duration as DurationSeconds));
  } catch (e) {
    console.error('analyze error:', e);
    const message =
      e instanceof Error && e.message.includes('하이라이트')
        ? e.message
        : '영상 분석에 실패했습니다. 공개된 유튜브 영상인지 확인하고 다시 시도해 주세요.';
    res.status(502).json({error: message});
  }
}
