"use client";

/**
 * Small floating panel for the live demo that fires off console messages and
 * failed network requests on demand. Lets visitors see the diagnostics
 * capture in action without having to open devtools.
 *
 * Renders bottom-left so it stays out of the way of the SitePing FAB
 * (bottom-right by default).
 */
export function DiagnosticsTriggers() {
  function logSequence() {
    console.log("[demo] user clicked the diagnostics trigger");
    console.info("[demo] fetching dashboard data…");
    console.warn("[demo] feature flag missing: experimental_panel");
  }

  function logError() {
    console.error(new TypeError("Cannot read property 'foo' of undefined"));
  }

  async function failedFetch() {
    try {
      // A request to a definitely-broken endpoint — captured as a 500 in
      // the network buffer.
      await fetch("/api/this-endpoint-does-not-exist", { method: "POST" });
    } catch {
      // The wrapper above re-throws on network errors. Swallow here so the
      // page doesn't surface an "Unhandled" overlay in the demo.
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-30 flex flex-col gap-2">
      <p className="rounded-md bg-gray-900/80 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/90 backdrop-blur">
        Diagnostics demo
      </p>
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <button
          type="button"
          onClick={logSequence}
          className="rounded-md border border-gray-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          Log console messages
        </button>
        <button
          type="button"
          onClick={logError}
          className="rounded-md border border-red-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50"
        >
          Trigger console.error
        </button>
        <button
          type="button"
          onClick={failedFetch}
          className="rounded-md border border-red-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50"
        >
          Trigger failed fetch
        </button>
      </div>
    </div>
  );
}
