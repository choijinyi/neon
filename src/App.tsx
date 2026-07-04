import {Clapperboard, Link2, Loader2, Wand2} from 'lucide-react';
import {useEffect, useState} from 'react';
import Footer from './components/Footer';
import HighlightList from './components/HighlightList';
import ShortsPlayer from './components/ShortsPlayer';
import {analyzeSermon} from './services/gemini';
import type {AnalysisResult, DurationOption, DurationSeconds} from './types';
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

export default function App() {
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState<DurationSeconds>(60);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 분석 중 안내 문구를 주기적으로 교체
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const id = window.setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_MESSAGES.length - 1));
    }, 12000);
    return () => window.clearInterval(id);
  }, [loading]);

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
      const analysis = await analyzeSermon(`https://www.youtube.com/watch?v=${id}`, duration);
      setVideoId(id);
      setResult(analysis);
      setSelectedIndex(0);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && e.message.includes('하이라이트')
          ? e.message
          : '영상 분석에 실패했습니다. 공개된 유튜브 영상인지 확인하고 다시 시도해 주세요.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-white">
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 sm:py-14">
        {/* 헤더 */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400/15 ring-1 ring-amber-400/30 mb-4">
            <Clapperboard className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight break-keep">
            설교 쇼츠 <span className="text-amber-400">자동 생성기</span>
          </h1>
          <p className="mt-3 text-stone-400 leading-relaxed break-keep">
            설교 유튜브 링크를 넣으면 AI가 하이라이트를 찾아
            <br className="hidden sm:block" />
            자막이 들어간 쇼츠를 만들어 드립니다.
          </p>
        </header>

        {/* 입력 영역 */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7 space-y-5">
          <div>
            <label htmlFor="youtube-url" className="block text-sm font-semibold text-stone-300 mb-2">
              1. 설교 유튜브 링크
            </label>
            <div className="relative">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                id="youtube-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-stone-950/70 border border-white/10 text-white placeholder-stone-600 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition-all"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-stone-300 mb-2">2. 쇼츠 길이</p>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  type="button"
                  onClick={() => setDuration(opt.seconds)}
                  className={`py-3 rounded-xl font-bold transition-all ${
                    duration === opt.seconds
                      ? 'bg-amber-400 text-stone-900 shadow-lg shadow-amber-900/30'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
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
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-extrabold text-lg hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                하이라이트 찾아 쇼츠 만들기
              </>
            )}
          </button>

          {loading && (
            <p className="text-center text-sm text-amber-300/90 animate-pulse break-keep">
              {LOADING_MESSAGES[loadingStep]}
              <span className="block mt-1 text-stone-500 text-xs">
                영상 길이에 따라 1~3분 정도 걸릴 수 있습니다.
              </span>
            </p>
          )}

          {error && (
            <p className="text-center text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 break-keep">
              {error}
            </p>
          )}
        </section>

        {/* 결과 영역 */}
        {result && videoId && (
          <section className="mt-10 space-y-8">
            <h2 className="text-center text-lg font-bold text-stone-200 break-keep">
              🎬 {result.videoTitle}
            </h2>
            <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start">
              <HighlightList
                highlights={result.highlights}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
              <ShortsPlayer
                videoId={videoId}
                highlight={result.highlights[selectedIndex]}
              />
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
