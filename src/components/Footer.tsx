import {Phone} from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-stone-950/80">
      <div className="max-w-3xl mx-auto px-4 py-6 text-center space-y-1">
        <p className="text-stone-300 text-sm font-medium">
          만든이 <span className="text-amber-300 font-semibold">한국AI교육협회 최진이회장</span>
        </p>
        <a
          href="tel:010-4009-0191"
          className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          010-4009-0191
        </a>
      </div>
    </footer>
  );
}
