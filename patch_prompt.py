import re

with open('src/components/MasterPasswordPromptModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useToast import
content = content.replace("import { useVault } from '../context/VaultContext'", "import { useVault } from '../context/VaultContext'\nimport { useToast } from './ui/ToastProvider'")

# Add const { showToast } = useToast()
content = content.replace("const [error, setError] = useState(false)", "const { showToast } = useToast()")

# Remove setError(false)
content = re.sub(r'\s*setError\(false\)', '', content)

# Replace setError(true) with showToast
content = content.replace("setError(true)", "showToast('Contraseña incorrecta.', 'error')")

# Remove error inline message
content = re.sub(r'\s*\{error && \(\s*<p[^>]*>.*?</p>\s*\)\}', '', content)

# Clean up className ternary based on error
content = re.sub(r'className=\{`w-full rounded-2xl border \$\{error \? \'border-red-300[^\']*\' : \'([^\']+)\'\} ([^`]+)`\}', r'className={`w-full rounded-2xl border \1 \2`}', content)
# wait, the class name looks like:
# className={`w-full rounded-2xl border ${error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 bg-white focus:border-indigo-500 focus:ring-indigo-500/20'} px-4 py-3 text-sm font-medium shadow-sm transition-all outline-none focus:ring-4`}
# Let's just do a simpler replace.
old_class = "className={`w-full rounded-2xl border ${error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 bg-white focus:border-indigo-500 focus:ring-indigo-500/20'} px-4 py-3 text-sm font-medium shadow-sm transition-all outline-none focus:ring-4`}"
new_class = "className=\"w-full rounded-2xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-indigo-500/20 px-4 py-3 text-sm font-medium shadow-sm transition-all outline-none focus:ring-4\""
content = content.replace(old_class, new_class)

with open('src/components/MasterPasswordPromptModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
