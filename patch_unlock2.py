import re

with open('src/components/UnlockScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add useToast import
content = content.replace("import { useVault } from '../context/VaultContext'", "import { useVault } from '../context/VaultContext'\nimport { useToast } from './ui/ToastProvider'")

# 2. Remove ErrorMessage component
content = re.sub(r'function ErrorMessage\(\{ error \}: \{ error: string \}\) \{.*?\n\}\n\n', '', content, flags=re.DOTALL)

# 3. NativeIdentityStep: remove error prop, add useToast, replace setError equivalent (wait, NativeIdentityStep doesn't use setError, it takes error as prop. We can just remove the error prop)
content = re.sub(r'\s*error: string \| null\n', '\n', content)
content = re.sub(r'  error,\n', '', content)
content = re.sub(r'          \{error && <ErrorMessage error=\{error\} />\}\n', '', content)

# 4. In UnlockScreen:
# Add const { showToast } = useToast()
content = content.replace('  const [error, setError] = useState<string | null>(null)', '  const { showToast } = useToast()')

def replace_set_error(match):
    arg = match.group(1)
    if arg == 'null':
        return ''
    return f"showToast({arg}, 'error')"

content = re.sub(r'setError\((.*?)\)', replace_set_error, content)

# Remove `<ErrorMessage error={error} />` from UnlockScreen return
content = re.sub(r'\s*\{error && <ErrorMessage error=\{error\} />\}', '', content)
# Also in Nuke Modal: `{error && <div className="mt-4"><ErrorMessage error={error} /></div>}`
content = re.sub(r'\s*\{error && <div className="mt-4"><ErrorMessage error=\{error\} /></div>\}', '', content)

# Remove error prop from NativeIdentityStep call
content = re.sub(r'\s*error=\{error\}', '', content)

auto_bio = """
  useEffect(() => {
    if (cloudVaultExists !== false && biometricAvailable && biometricRegistered) {
      handleBiometricVaultUnlock()
    }
  }, [cloudVaultExists, biometricAvailable, biometricRegistered])
"""
content = content.replace("  const handleCopyRecoveryPhrase = async () => {", auto_bio + "\n  const handleCopyRecoveryPhrase = async () => {")

with open('src/components/UnlockScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
