import { Link } from "react-router-dom";
import { clsx } from "clsx";

export function TopBar({
  title,
  back,
  actions,
}: {
  title: string;
  back?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#121417]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        {back ? (
          <Link to={back} className="rounded-lg p-2 text-gray-300 hover:bg-white/10" aria-label="Back">
            ←
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 font-bold text-black">
            A
          </span>
        )}
        <h1 className="flex-1 truncate text-[17px] font-semibold text-white">{title}</h1>
        {actions}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  subtitle,
  to,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  to?: string;
  actionLabel?: string;
}) {
  const inner = (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[13px] text-gray-400">{subtitle}</p>}
      </div>
      {to && <span className="shrink-0 text-[13px] font-medium text-emerald-400">{actionLabel ?? "More →"}</span>}
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-xl px-1 py-1 hover:bg-white/5">
      {inner}
    </Link>
  ) : (
    <div className="px-1 py-1">{inner}</div>
  );
}

export function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
        active
          ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Empty({ icon = "◌", title, hint, action }: { icon?: string; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="font-medium text-white">{title}</p>
      {hint && <p className="max-w-sm text-sm text-gray-400">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="text-4xl">⚠️</div>
      <p className="text-sm text-gray-300">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
          Retry
        </button>
      )}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

const IMG_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#23262c"/><text x="64" y="82" font-size="56" text-anchor="middle" fill="#5b636e" font-family="sans-serif">?</text></svg>`,
  );

/**
 * App artwork image.
 *
 * Deliberately eager (no loading="lazy"): Safari unreliably loads lazy
 * images inside horizontal scroll strips (home carousels, screenshot rows),
 * which left icons/screenshots blank. referrerPolicy avoids leaking the
 * local origin; onError swaps in a neutral placeholder instead of a
 * broken-image glyph.
 */
export function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src || IMG_FALLBACK}
      alt={alt}
      className={className}
      draggable={false}
      referrerPolicy="no-referrer"
      onError={(e) => {
        const el = e.currentTarget;
        if (!el.src.endsWith("?") && el.src !== IMG_FALLBACK) el.src = IMG_FALLBACK;
      }}
    />
  );
}
