interface EmptyStateProps {
  onAddPassword: () => void
  onImportText: () => void
}

/**
 * Componente EmptyState estilo Apple para onboarding rápido sin curva de aprendizaje.
 * Evita la vista de una interfaz en blanco mediante una ilustración minimalista
 * y botones de llamada a la acción primarios claramente identificados.
 */
export function EmptyState({ onAddPassword, onImportText }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-lg select-none flex-col items-center justify-center px-6 py-20 text-center animate-fade-in">
      
      {/* Icono de llave/escudo minimalista */}
      <div className="vault-panel mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] text-teal-700 dark:text-teal-200">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      </div>

      <h3 className="mb-2 text-2xl font-black tracking-tight text-text-primary">Aún no tienes elementos aquí</h3>
      
      <p className="mb-8 text-sm leading-6 text-text-secondary">
        Crea uno nuevo aquí ➔ empieza con una credencial cifrada o importa tus contraseñas pegando una tabla de Google Docs.
      </p>

      {/* Acciones de onboarding primarias */}
      <div className="w-full flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onAddPassword}
          className="vault-button-primary w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        >
          Crear tu primera contraseña
        </button>
        <button
          type="button"
          onClick={onImportText}
          className="vault-control w-full rounded-2xl py-3.5 text-sm font-bold text-text-primary transition-all hover:-translate-y-0.5 hover:bg-surface-hover active:scale-[0.98]"
        >
          Importar desde Google Docs / TSV
        </button>
      </div>
      
    </div>
  )
}
