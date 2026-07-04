import ytdl from '@distube/ytdl-core';
import type {VercelRequest, VercelResponse} from '@vercel/node';
import ffmpegPath from 'ffmpeg-static';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {SubtitleLine} from '../src/types';

export const config = {
  supportsResponseStreaming: true,
  maxDuration: 300,
};

const FONT_PATH = path.join(process.cwd(), 'api/fonts/NotoSansKR-Bold.otf');
const MAX_DURATION_SECONDS = 185;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface RenderBody {
  videoId?: string;
  title?: string;
  startSeconds?: number;
  endSeconds?: number;
  subtitles?: SubtitleLine[];
}

/**
 * 하이라이트 구간을 잘라 세로(720x1280) MP4로 인코딩해 스트리밍으로 내려준다.
 * 자막과 제목은 drawtext 필터로 영상에 직접 굽는다(burn-in).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'POST만 지원합니다.'});
    return;
  }

  const {videoId, title, startSeconds, endSeconds, subtitles} = (req.body ?? {}) as RenderBody;
  if (
    typeof videoId !== 'string' ||
    !/^[\w-]{11}$/.test(videoId) ||
    typeof startSeconds !== 'number' ||
    typeof endSeconds !== 'number' ||
    !(endSeconds > startSeconds) ||
    endSeconds - startSeconds > MAX_DURATION_SECONDS ||
    !Array.isArray(subtitles)
  ) {
    res.status(400).json({error: '잘못된 요청입니다.'});
    return;
  }
  const duration = endSeconds - startSeconds;

  // 1. 유튜브 스트림 URL 확보
  let videoUrl: string;
  let audioUrl: string | null;
  try {
    const info = await ytdl.getInfo(videoId, {
      requestOptions: {headers: {'user-agent': USER_AGENT}},
    });
    const videoFormat = pickFormat(info.formats, {video: true});
    const audioFormat = pickFormat(info.formats, {video: false});
    if (videoFormat && audioFormat) {
      videoUrl = videoFormat.url;
      audioUrl = audioFormat.url;
    } else {
      // 분리 스트림이 없으면 영상+소리가 합쳐진 포맷으로 폴백
      const muxed = ytdl.chooseFormat(info.formats, {
        quality: 'highest',
        filter: 'audioandvideo',
      });
      videoUrl = muxed.url;
      audioUrl = null;
    }
  } catch (e) {
    console.error('ytdl error:', e);
    res.status(502).json({
      error:
        '유튜브에서 영상을 가져오지 못했습니다. 공개 영상인지 확인 후 다시 시도해 주세요. (유튜브가 서버 요청을 일시 차단하는 경우도 있으니 잠시 후 재시도해 주세요.)',
    });
    return;
  }

  // 2. 자막/제목 텍스트 파일 + 필터 스크립트 작성 (textfile 사용으로 이스케이프 문제 회피)
  const workDir = mkdtempSync(path.join(tmpdir(), 'shorts-'));
  try {
    const filters: string[] = [
      "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'",
      'scale=720:1280',
      'setsar=1',
    ];

    if (title?.trim()) {
      const titleFile = path.join(workDir, 'title.txt');
      writeFileSync(titleFile, title.trim().slice(0, 60));
      filters.push(
        `drawtext=fontfile=${FONT_PATH}:textfile=${titleFile}:fontcolor=white:fontsize=38:x=(w-text_w)/2:y=110:box=1:boxcolor=black@0.45:boxborderw=16`,
      );
    }

    subtitles
      .filter(
        (s) =>
          typeof s?.text === 'string' &&
          s.text.trim() &&
          typeof s.start === 'number' &&
          typeof s.end === 'number' &&
          s.end > s.start,
      )
      .slice(0, 200)
      .forEach((s, i) => {
        const subFile = path.join(workDir, `sub-${i}.txt`);
        writeFileSync(subFile, s.text.trim().slice(0, 60));
        const from = Math.max(0, s.start - startSeconds).toFixed(2);
        const to = Math.min(duration, s.end - startSeconds).toFixed(2);
        filters.push(
          `drawtext=fontfile=${FONT_PATH}:textfile=${subFile}:fontcolor=white:fontsize=34:x=(w-text_w)/2:y=h-340:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,${from},${to})'`,
        );
      });

    const filterScript = path.join(workDir, 'filters.txt');
    writeFileSync(filterScript, `[0:v]${filters.join(',')}[v]`);

    // 3. ffmpeg 실행: 원격 스트림에서 구간만 읽어 인코딩, fragmented MP4로 스트리밍
    const httpArgs = [
      '-user_agent', USER_AGENT,
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
    ];
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      ...httpArgs, '-ss', String(startSeconds), '-i', videoUrl,
      ...(audioUrl ? [...httpArgs, '-ss', String(startSeconds), '-i', audioUrl] : []),
      '-t', String(duration),
      '-filter_complex_script', filterScript,
      '-map', '[v]',
      '-map', audioUrl ? '1:a:0' : '0:a:0?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ];

    if (!ffmpegPath) {
      res.status(500).json({error: '서버에 ffmpeg가 설치되지 않았습니다.'});
      return;
    }

    await new Promise<void>((resolve) => {
      const ffmpeg = spawn(ffmpegPath, args, {stdio: ['ignore', 'pipe', 'pipe']});
      let stderrTail = '';
      let sentData = false;

      ffmpeg.stderr.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-2000);
      });

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        if (!sentData) {
          sentData = true;
          res.status(200);
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="shorts.mp4"; filename*=UTF-8''${encodeURIComponent(
              `${(title ?? 'shorts').trim() || 'shorts'}.mp4`,
            )}`,
          );
        }
        res.write(chunk);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && sentData) {
          res.end();
        } else if (!sentData) {
          console.error('ffmpeg failed:', code, stderrTail);
          res
            .status(502)
            .json({error: '영상 인코딩에 실패했습니다. 잠시 후 다시 시도해 주세요.'});
        } else {
          console.error('ffmpeg aborted mid-stream:', code, stderrTail);
          res.end();
        }
        resolve();
      });

      ffmpeg.on('error', (err) => {
        console.error('ffmpeg spawn error:', err);
        if (!sentData) {
          res.status(500).json({error: '영상 인코딩을 시작하지 못했습니다.'});
        } else {
          res.end();
        }
        resolve();
      });

      // 클라이언트가 다운로드를 취소하면 인코딩 중단
      res.on('close', () => ffmpeg.kill('SIGKILL'));
    });
  } finally {
    rmSync(workDir, {recursive: true, force: true});
  }
}

function pickFormat(formats: ytdl.videoFormat[], {video}: {video: boolean}) {
  try {
    return ytdl.chooseFormat(formats, {
      quality: video ? 'highestvideo' : 'highestaudio',
      filter: (f) =>
        f.container === 'mp4' &&
        (video
          ? Boolean(f.hasVideo && !f.hasAudio && (f.height ?? 0) <= 1080)
          : Boolean(f.hasAudio && !f.hasVideo)),
    });
  } catch {
    return null;
  }
}
