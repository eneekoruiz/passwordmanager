with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_statement = "import { SyncDiffViewer } from './components/SyncDiffViewer'\n"
if "SyncDiffViewer" not in content:
    content = content.replace("import { Sidebar } from './components/Sidebar'", import_statement + "import { Sidebar } from './components/Sidebar'")

target_modal = """  const cloudDownloadModal = pendingCloudDownload ? (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-white/50 bg-white/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-2.25 2.25M12 9.75l2.25 2.25M6.75 18.75h10.5a3.75 3.75 0 00.98-7.37A6.001 6.001 0 006.36 9.18a4.5 4.5 0 00.39 9.57z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold tracking-tight text-text-primary">Hay datos nuevos en la nube</h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{pendingCloudDownload.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-black/[0.06] bg-surface p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Este dispositivo</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{pendingCloudDownload.localPlatformCount ?? 0} contraseñas</p>
            <p className="text-xs text-text-tertiary">{pendingCloudDownload.localLocalItemCount ?? 0} secretos locales</p>
            <p className="text-xs text-text-tertiary">{pendingCloudDownload.localLocalCategoryCount ?? 0} secciones</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Google Cloud</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{pendingCloudDownload.cloudPlatformCount ?? 0} contraseñas</p>
            <p className="text-xs text-text-tertiary">{pendingCloudDownload.cloudLocalItemCount ?? 0} secretos locales</p>
            <p className="text-xs text-text-tertiary">{pendingCloudDownload.cloudLocalCategoryCount ?? 0} secciones</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setPendingCloudDownload(null)}
            disabled={downloadingCloud}
            className="min-h-11 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={handleConfirmCloudDownload}
            disabled={downloadingCloud}
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
          >
            {downloadingCloud ? 'Descargando...' : 'Descargar de la nube'}
          </button>
        </div>
      </div>
    </div>
  ) : null"""

replacement_modal = """  const cloudDownloadModal = pendingCloudDownload ? (
    pendingCloudDownload.diffResult ? (
      <SyncDiffViewer
        diffResult={pendingCloudDownload.diffResult}
        onConfirm={handleConfirmCloudDownload}
        onCancel={() => setPendingCloudDownload(null)}
        isDownloading={downloadingCloud}
      />
    ) : (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md animate-fade-in">
        <div className="w-full max-w-lg rounded-3xl border border-white/50 bg-white/95 p-6 shadow-[0_34px_100px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-vault-morph">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-2.25 2.25M12 9.75l2.25 2.25M6.75 18.75h10.5a3.75 3.75 0 00.98-7.37A6.001 6.001 0 006.36 9.18a4.5 4.5 0 00.39 9.57z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-text-primary">Hay datos nuevos en la nube</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{pendingCloudDownload.message}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-black/[0.06] bg-surface p-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Este dispositivo</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{pendingCloudDownload.localPlatformCount ?? 0} contraseñas</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.localLocalItemCount ?? 0} secretos locales</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.localLocalCategoryCount ?? 0} secciones</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Google Cloud</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{pendingCloudDownload.cloudPlatformCount ?? 0} contraseñas</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.cloudLocalItemCount ?? 0} secretos locales</p>
              <p className="text-xs text-text-tertiary">{pendingCloudDownload.cloudLocalCategoryCount ?? 0} secciones</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setPendingCloudDownload(null)}
              disabled={downloadingCloud}
              className="min-h-11 rounded-xl border border-black/5 bg-surface px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={handleConfirmCloudDownload}
              disabled={downloadingCloud}
              className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
            >
              {downloadingCloud ? 'Descargando...' : 'Descargar de la nube'}
            </button>
          </div>
        </div>
      </div>
    )
  ) : null"""

if target_modal in content:
    content = content.replace(target_modal, replacement_modal)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
