import {Eye, EyeOff, KeyRound, Link2, Loader2, Sparkles, Wand2} from 'lucide-react';
import {motion} from 'motion/react';
import {useEffect, useRef, useState} from 'react';
import Footer from './components/Footer';
import HighlightList from './components/HighlightList';
import ShortsPlayer, {type PlayerControl} from './components/ShortsPlayer';
import SubtitleEditor from './components/SubtitleEditor';
import {analyzeSermon} from './services/gemini';
import type {AnalysisResult, DurationOption, DurationSeconds, SubtitleLine} from './types';
import {extractVideoId} from './utils/youtube';

const DURATION_OPTIONS: DurationOption[] = [
  {seconds: 30, label: '30초'},
  {seconds: 60, label: '1분'},
  {seconds: 180, label: '3분'},
];

const LOADING_MESSAGES = [
  'AI가 설교 영상을 시청하고 있습니다...',
  '은혜로운 구간을 찾고 있습니다...',
  '설교 내용을 받아쓰는 중입니다...',
  '자막 타이밍을 맞추고 있습니다...',
  '거의 다 됐습니다. 조금만 기다려 주세요...',
];

const API_KEY_STORAGE = 'gemini_api_key';

const INPUT_CLASS =
  'w-full pl-12 pr-4 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-stone-600 outline-none transition-all duration-300 focus:border-amber-300/50 focus:bg-black/60 focus:shadow-[0_0_0_4px_rgba(251,191,36,0.08)]';

function StepBadge({n}: {n: number}) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/15 ring-1 ring-amber-400/30 text-amber-300 text-xs font-bold">
      {n}
    </span>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '');
  const [showKey, setShowKey] = useState(false);
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState<DurationSeconds>(60);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);
  const playerControlRef = useRef<PlayerControl | null>(null);

  // 자막 편집 결과를 결과 상태에 반영 (미리보기·녹화·SRT에 모두 적용됨)
  const updateSubtitles = (index: number, subtitles: SubtitleLine[]) => {
    setResult((prev) => {
      if (!prev) return prev;
      const highlights = prev.highlights.map((h, i) =>
        i === index ? {...h, subtitles} : h,
      );
      return {...prev, highlights};
    });
  };

  // 분석 중 안내 문구를 주기적으로 교체
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const id = window.setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_MESSAGES.length - 1));
    }, 12000);
    return () => window.clearInterval(id);
  }, [loading]);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem(API_KEY_STORAGE, value.trim());
  };

  const handleAnalyze = async () => {
    setError(null);
    const id = extractVideoId(url);
    if (!id) {
      setError('올바른 유튜브 링크를 입력해 주세요. (예: https://www.youtube.com/watch?v=...)');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const analysis = await analyzeSermon(
        `https://www.youtube.com/watch?v=${id}`,
        duration,
        apiKey,
      );
      setVideoId(id);
      setResult(analysis);
      setSelectedIndex(0);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : '';
      if (/API key|API_KEY|PERMISSION_DENIED/i.test(msg)) {
        setError('API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.');
      } else if (msg.includes('하이라이트') || msg.includes('API 키')) {
        setError(msg);
      } else {
        setError('영상 분석에 실패했습니다. 공개된 유튜브 영상인지 확인하고 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col text-stone-50 overflow-x-clip">
      {/* 배경 장식: 은은한 골드 광원 */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[480px] rounded-full bg-amber-400/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 -left-40 w-[480px] h-[400px] rounded-full bg-rose-500/[0.04] blur-[120px]" />
      </div>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-14 sm:py-20">
        {/* 헤더 */}
        <motion.header
          initial={{opacity: 0, y: 16}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.6, ease: 'easeOut'}}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-300/20 bg-amber-400/[0.06] text-amber-200/90 text-xs font-medium tracking-wide mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI 설교 미디어 도구
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-black tracking-tight leading-tight break-keep">
            설교의 은혜를
            <br />
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              쇼츠 한 편에
            </span>
          </h1>
          <p className="mt-5 text-stone-400 leading-relaxed break-keep">
            설교 유튜브 링크를 넣으면 AI가 하이라이트를 찾아
            <br className="hidden sm:block" />
            자막이 들어간 쇼츠를 만들어 드립니다.
          </p>
        </motion.header>

        {/* 입력 영역 */}
        <motion.section
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.6, delay: 0.15, ease: 'easeOut'}}
          className="rounded-[2rem] border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] p-6 sm:p-9 space-y-7"
        >
          <div>
            <label
              htmlFor="api-key"
              className="flex items-center gap-2.5 text-sm font-semibold text-stone-200 mb-3"
            >
              <StepBadge n={1} />
              Gemini API 키
              {apiKey.trim() && (
                <span className="text-emerald-400/90 text-xs font-medium">✓ 저장됨</span>
              )}
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                className={`${INPUT_CLASS} pr-12`}
              />
              <button
                type="button"
                aria-label={showKey ? '키 숨기기' : '키 보기'}
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-stone-300 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-500 leading-relaxed break-keep">
              한 번 입력하면 이 브라우저에 저장됩니다. 키가 없으면{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-amber-300/90 hover:text-amber-200 underline underline-offset-4 decoration-amber-300/30 transition-colors"
              >
                여기서 무료 발급
              </a>
              받으세요 (구글 로그인 → Create API Key)
            </p>
          </div>

          <div>
            <label
              htmlFor="youtube-url"
              className="flex items-center gap-2.5 text-sm font-semibold text-stone-200 mb-3"
            >
              <StepBadge n={2} />
              설교 유튜브 링크
            </label>
            <div className="relative">
              <Link2 className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                id="youtube-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
                placeholder="https://www.youtube.com/watch?v=..."
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <p className="flex items-center gap-2.5 text-sm font-semibold text-stone-200 mb-3">
              <StepBadge n={3} />
              쇼츠 길이
            </p>
            <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-black/40 border border-white/[0.06]">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  type="button"
                  onClick={() => setDuration(opt.seconds)}
                  className={`py-3 rounded-xl font-bold transition-all duration-300 ${
                    duration === opt.seconds
                      ? 'bg-gradient-to-b from-amber-300 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            className="group w-full flex items-center justify-center gap-2.5 py-4.5 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 bg-[length:200%_100%] bg-left hover:bg-right text-stone-950 font-extrabold text-lg shadow-xl shadow-amber-500/20 hover:shadow-amber-400/30 disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-500"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
                하이라이트 찾아 쇼츠 만들기
              </>
            )}
          </button>

          {loading && (
            <div className="text-center space-y-2">
              <p className="text-sm text-amber-200/90 animate-pulse break-keep">
                {LOADING_MESSAGES[loadingStep]}
              </p>
              <p className="text-stone-500 text-xs">영상 길이에 따라 1~3분 정도 걸릴 수 있습니다.</p>
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-red-300/90 bg-red-500/[0.08] border border-red-400/20 rounded-2xl px-5 py-3.5 break-keep">
              {error}
            </p>
          )}
        </motion.section>

        {/* 결과 영역 */}
        {result && videoId && (
          <motion.section
            initial={{opacity: 0, y: 24}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.6, ease: 'easeOut'}}
            className="mt-14 space-y-9"
          >
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-4">
                <span className="h-px w-12 bg-gradient-to-r from-transparent to-amber-300/40" />
                <span className="text-amber-300/80 text-xs font-semibold tracking-[0.2em] uppercase">
                  Result
                </span>
                <span className="h-px w-12 bg-gradient-to-l from-transparent to-amber-300/40" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-100 break-keep">
                {result.videoTitle}
              </h2>
            </div>
            <div className="grid gap-10 lg:grid-cols-[1fr_360px] items-start">
              <HighlightList
                highlights={result.highlights}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
              <div className="space-y-4 lg:sticky lg:top-8">
                <ShortsPlayer
                  videoId={videoId}
                  highlight={result.highlights[selectedIndex]}
                  onTimeUpdate={setPreviewTime}
                  controlRef={playerControlRef}
                />
                <SubtitleEditor
                  highlight={result.highlights[selectedIndex]}
                  currentTime={previewTime}
                  onChange={(subs) => updateSubtitles(selectedIndex, subs)}
                  onPreview={(sec) => playerControlRef.current?.previewAt(sec)}
                />
              </div>
            </div>
          </motion.section>
        )}
      </main>

      <Footer />
    </div>
  );
}
