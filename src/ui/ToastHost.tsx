import { useToast } from "../lib/toast.js";

export function ToastHost() {
  const text = useToast((s) => s.text);
  const href = useToast((s) => s.href);
  const hide = useToast((s) => s.hide);
  if (text === null) return null;
  const inner = <span className="text-sm text-slate-100">{text}</span>;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 shadow-lg shadow-black/50">
        {href === null ? (
          inner
        ) : (
          <a href={href} onClick={hide} className="underline-offset-2 hover:underline">
            {inner}
          </a>
        )}
      </div>
    </div>
  );
}
