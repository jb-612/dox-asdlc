/**
 * MonitoringPage — stub for P15-F07 (Monitoring Dashboard).
 *
 * Phase 0 Foundation PR: registers the route and shows a placeholder.
 * Full implementation is delivered in P15-F07.
 */
export default function MonitoringPage(): JSX.Element {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-gray-700 flex items-center justify-center">
          {/* Chart bars icon */}
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-200">Monitoring Dashboard</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Agent telemetry, session tracking, and live event streaming — coming in P15-F07.
        </p>
      </div>
    </div>
  );
}
