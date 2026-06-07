// Dashboard page — UI components will be added after Claude Design prototype
// Data layer: /api/kpi  /api/timeseries  /api/table  /api/filters

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {process.env.NEXT_PUBLIC_PROJECT_DISPLAY_NAME ?? 'Aurora Scents'} · Meta Ads
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              High Mark Agency Platform
            </p>
          </div>
        </div>

        {/* Placeholder — replace with Claude Design components */}
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-400 text-lg font-medium">Dashboard UI</p>
          <p className="text-gray-400 text-sm mt-2">
            Claude Design компоненты будут интегрированы сюда.
          </p>
          <p className="text-gray-400 text-sm mt-1">
            API готов: <code className="bg-gray-100 px-1 rounded">/api/kpi</code>{' '}
            <code className="bg-gray-100 px-1 rounded">/api/timeseries</code>{' '}
            <code className="bg-gray-100 px-1 rounded">/api/table</code>{' '}
            <code className="bg-gray-100 px-1 rounded">/api/filters</code>
          </p>
        </div>

      </div>
    </div>
  )
}
