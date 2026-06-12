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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto animate-fade-in select-none">
      
      {/* Icono de llave/escudo minimalista */}
      <div className="h-16 w-16 rounded-2xl bg-surface flex items-center justify-center text-text-secondary border border-border-subtle shadow-sm mb-6">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      </div>

      <h3 className="text-base font-bold text-text-primary mb-2">Ninguna contraseña guardada</h3>
      
      <p className="text-xs text-text-secondary leading-relaxed mb-8">
        Esta bóveda está vacía y protegida de forma local. Comienza agregando una credencial o importa tus contraseñas pegando una tabla de Google Docs.
      </p>

      {/* Acciones de onboarding primarias */}
      <div className="w-full flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onAddPassword}
          className="w-full rounded-xl bg-text-primary hover:opacity-90 py-3 text-xs font-semibold text-white transition-opacity active:scale-[0.98] transition-transform shadow-sm"
        >
          Crear tu primera contraseña
        </button>
        <button
          type="button"
          onClick={onImportText}
          className="w-full rounded-xl border border-border bg-surface-elevated hover:bg-surface-hover py-3 text-xs font-semibold text-text-primary transition-colors active:scale-[0.98] transition-transform"
        >
          Importar desde Google Docs / TSV
        </button>
      </div>
      
    </div>
  )
}
