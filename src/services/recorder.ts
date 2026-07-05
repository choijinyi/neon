/**
 * 화면(탭) 캡처로 쇼츠 프레임 영역만 잘라 녹화해서 MP4(또는 WebM) 파일을 만든다.
 * 유튜브 영상을 서버에서 내려받는 방식은 유튜브가 차단하므로,
 * 사용자 브라우저에서 정상 재생되는 화면을 그대로 녹화하는 방식을 쓴다.
 */

export interface RecordingResult {
  blob: Blob;
  extension: 'mp4' | 'webm';
}

export interface RecordingController {
  /** 녹화를 조기 종료한다 (그때까지의 영상은 저장됨) */
  stop: () => void;
  done: Promise<RecordingResult>;
}

interface Options {
  /** 녹화할 화면 영역 (쇼츠 프레임 요소) */
  element: HTMLElement;
  durationMs: number;
  /** 탭 공유가 승인되고 녹화가 실제로 시작되기 직전에 호출 (재생 시작용) */
  onStart?: () => void;
  onTick?: (secondsLeft: number) => void;
}

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export async function startShortsRecording({
  element,
  durationMs,
  onStart,
  onTick,
}: Options): Promise<RecordingController> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: {frameRate: {ideal: 30}},
    audio: true,
    // Chrome 전용: 현재 탭을 기본 선택지로 제시
    preferCurrentTab: true,
  } as MediaStreamConstraints);

  const videoTrack = displayStream.getVideoTracks()[0];

  // 캡처 스트림을 숨김 video로 받아 캔버스에 프레임 영역만 크롭해 그린다
  const src = document.createElement('video');
  src.muted = true;
  src.playsInline = true;
  src.srcObject = new MediaStream([videoTrack]);
  await src.play();

  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    displayStream.getTracks().forEach((t) => t.stop());
    throw new Error('캔버스를 사용할 수 없는 브라우저입니다.');
  }

  const draw = () => {
    const settings = videoTrack.getSettings();
    const capW = settings.width ?? src.videoWidth;
    const capH = settings.height ?? src.videoHeight;
    if (!capW || !capH) return;
    const scaleX = capW / window.innerWidth;
    const scaleY = capH / window.innerHeight;
    const r = element.getBoundingClientRect();
    ctx.drawImage(
      src,
      r.left * scaleX,
      r.top * scaleY,
      r.width * scaleX,
      r.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };
  const drawTimer = window.setInterval(draw, 1000 / 30);

  const outStream = canvas.captureStream(30);
  displayStream.getAudioTracks().forEach((t) => outStream.addTrack(t));

  const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const recorder = new MediaRecorder(outStream, {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let tickTimer = 0;
  const cleanup = () => {
    window.clearInterval(drawTimer);
    window.clearInterval(tickTimer);
    displayStream.getTracks().forEach((t) => t.stop());
    outStream.getTracks().forEach((t) => t.stop());
    src.srcObject = null;
  };

  const done = new Promise<RecordingResult>((resolve, reject) => {
    recorder.onerror = () => {
      cleanup();
      reject(new Error('녹화 중 오류가 발생했습니다. 다시 시도해 주세요.'));
    };
    recorder.onstop = () => {
      cleanup();
      if (chunks.length === 0) {
        reject(new Error('녹화된 내용이 없습니다. 다시 시도해 주세요.'));
        return;
      }
      resolve({
        blob: new Blob(chunks, {type: mimeType || 'video/webm'}),
        extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm',
      });
    };
  });

  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };

  // 사용자가 브라우저의 "공유 중지"를 누르면 조기 종료
  videoTrack.addEventListener('ended', stop);

  // 재생을 구간 처음으로 되돌린 뒤 잠깐 기다렸다가 녹화 시작 (seek 프레임 안 들어가게)
  onStart?.();
  await new Promise((r) => setTimeout(r, 450));
  recorder.start(1000);
  const startedAt = Date.now();
  tickTimer = window.setInterval(() => {
    const left = durationMs - (Date.now() - startedAt);
    onTick?.(Math.max(0, Math.ceil(left / 1000)));
    if (left <= 0) stop();
  }, 250);

  return {stop, done};
}
