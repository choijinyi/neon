import {Phone} from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative mt-auto">
      {/* 골드 헤어라인 */}
      <div className="h-px bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />
      <div className="bg-black/40 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center space-y-2.5">
          <p className="text-[11px] tracking-[0.25em] uppercase text-stone-500">Made by</p>
          <p className="text-stone-300 text-sm">
            <span className="font-serif font-bold text-amber-200">한국AI교육협회 최진이회장</span>
          </p>
          <a
            href="tel:010-4009-0191"
            className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-200 text-sm transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            010-4009-0191
          </a>
        </div>
      </div>
    </footer>
  );
}
