with open('src/components/VaultItemForm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

danger_zone = """      <section className="mt-6 mb-6">
        <Accordion title="Danger Zone (Sincronización Selectiva)" defaultOpen={Boolean(draft.isLocalOnly)}>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-900">Desactivar Sincronización en la Nube (Device-Only)</h3>
                <p className="mt-1 text-xs leading-relaxed text-red-800/80">
                  Si activas esta opción, este elemento <strong>nunca se subirá a la nube</strong> y solo existirá en este dispositivo.
                  Si desinstalas la aplicación o formateas el dispositivo, perderás este dato para siempre.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-red-100">
                  <span className="text-sm font-semibold text-red-900">Modo Solo-Dispositivo</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={Boolean(draft.isLocalOnly)}
                      onChange={(e) => setDraft((prev) => ({ ...prev, isLocalOnly: e.target.checked }))}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-red-300"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Accordion>
      </section>

      {error && ("""

if "{error && (" in content and "Danger Zone" not in content:
    new_content = content.replace("      {error && (", danger_zone)
    if "import { Accordion }" not in new_content:
        new_content = new_content.replace("import { SecretField } from './ui/SecretField'", "import { SecretField } from './ui/SecretField'\nimport { Accordion } from './ui/Accordion'")
    with open('src/components/VaultItemForm.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Patched successfully")
else:
    print("Already patched or target not found")
