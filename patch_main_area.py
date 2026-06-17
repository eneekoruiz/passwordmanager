with open('src/components/MainArea.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      {groupMode === 'platform' ? 'Vista por plataforma' : 'Centro de bóveda'}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                      {groupMode === 'platform' ? 'Explora tus accesos con una vista visual' : 'Organiza cada secreto con una estructura clara'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                      {groupMode === 'platform'
                        ? 'Selecciona una plataforma para ver todas las cuentas relacionadas, comparar accesos y entrar a editar sin perder contexto.'
                        : 'Tus cuentas online viven por identidad y tus secretos locales en espacios privados pensados para notas, documentos y datos sensibles.'}
                    </p>
                  </div>

                  {groupMode === 'platform' && featuredPlatforms.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {featuredPlatforms.map((platform, index) => (
                        <button
                          key={platform.name}
                          type="button"
                          onClick={() => onRequestNavigation(() => onSelectPlatformName(platform.name))}
                          className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <PlatformLogo name={platform.name} className="h-11 w-11 rounded-2xl border border-black/[0.05] bg-white p-1 shadow-sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text-primary">{platform.name}</span>
                            <span className="mt-1 block text-xs text-text-secondary">
                              {platform.count} cuenta{platform.count !== 1 ? 's' : ''} registradas
                            </span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary">
                            Abrir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(Object.keys(LOCAL_ITEM_LABELS) as LocalVaultItemType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => onSelectLocalCategory({ id: type, label: LOCAL_ITEM_LABELS[type], type, custom: false })}
                          className="rounded-2xl border border-black/[0.06] bg-white/80 p-5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
                        >
                          <span className="block text-sm font-bold text-text-primary">{LOCAL_ITEM_LABELS[type]}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
                            Espacio privado con una estructura optimizada para ese tipo de contenido.
                          </span>
                        </button>
                      ))}
                    </div>
                  )}"""

replacement = """                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      {groupMode === 'platform' ? 'Vista por plataforma' : 'Tus Identidades'}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                      {groupMode === 'platform' ? 'Explora tus accesos con una vista visual' : 'Gestiona tus cuentas por identidad'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                      {groupMode === 'platform'
                        ? 'Selecciona una plataforma para ver todas las cuentas relacionadas, comparar accesos y entrar a editar sin perder contexto.'
                        : 'Selecciona una identidad para ver todas las plataformas y cuentas vinculadas a ese correo o perfil.'}
                    </p>
                  </div>

                  {groupMode === 'platform' ? (
                    featuredPlatforms.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {featuredPlatforms.map((platform, index) => (
                          <button
                            key={platform.name}
                            type="button"
                            onClick={() => onRequestNavigation(() => onSelectPlatformName(platform.name))}
                            className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
                            style={{ animationDelay: `${index * 40}ms` }}
                          >
                            <PlatformLogo name={platform.name} className="h-11 w-11 rounded-2xl border border-black/[0.05] bg-white p-1 shadow-sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-text-primary">{platform.name}</span>
                              <span className="mt-1 block text-xs text-text-secondary">
                                {platform.count} cuenta{platform.count !== 1 ? 's' : ''} registradas
                              </span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary">
                              Abrir
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-subtle py-12 text-center">
                        <h3 className="text-base font-bold text-text-primary">No hay plataformas</h3>
                        <p className="mt-1 max-w-sm text-sm text-text-secondary">Crea cuentas en tus identidades y aparecerán aquí agrupadas por plataforma.</p>
                      </div>
                    )
                  ) : identities.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {identities.map((idItem, index) => (
                        <button
                          key={idItem.id}
                          type="button"
                          onClick={() => onRequestNavigation(() => onSelectIdentity(idItem))}
                          className="animate-vault-slide-up flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:border-black/10 hover:bg-white"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-text-primary ring-1 ring-black/5">
                            {idItem.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text-primary">{idItem.email}</span>
                            <span className="mt-1 block text-xs text-text-secondary">
                              {idItem.platforms.length} plataforma{idItem.platforms.length !== 1 ? 's' : ''} vinculada{idItem.platforms.length !== 1 ? 's' : ''}
                            </span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-text-secondary">
                            Abrir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-subtle py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                        <svg className="h-6 w-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-text-primary">No tienes identidades creadas</h3>
                      <p className="mt-1 max-w-sm text-sm text-text-secondary">Utiliza el botón en la barra lateral para crear tu primera identidad (ej. tu email personal o de trabajo).</p>
                    </div>
                  )}"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/components/MainArea.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched MainArea.tsx successfully.")
else:
    print("Target string not found in MainArea.tsx.")
