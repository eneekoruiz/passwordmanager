import re

with open('src/components/SettingsModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useToast import if not present
if "import { useToast }" not in content:
    content = content.replace("import { useVault } from '../context/VaultContext'", "import { useVault } from '../context/VaultContext'\nimport { useToast } from './ui/ToastProvider'")

# Add const { showToast } = useToast() inside SettingsModal component
if "const { showToast } = useToast()" not in content:
    content = re.sub(r'(export function SettingsModal\(\{.*?\}\) \{)', r'\1\n  const { showToast } = useToast()', content, flags=re.DOTALL)

# Replace setXError with showToast
# First we find all setXError('...') and setXMessage('...') calls.
def replace_set_message(match):
    func = match.group(1)
    arg = match.group(2)
    if arg == 'null':
        return ''
    if 'Error' in func:
        return f"showToast({arg}, 'error')"
    else:
        return f"showToast({arg}, 'success')"

content = re.sub(r'(set(?:Biometric|Travel|Credentials|HardwareKey)(?:Error|Message))\((.*?)\)', replace_set_message, content)

# Also remove the inline rendering of these errors/messages
# Examples:
# {biometricError && <p className="rounded-xl bg-red-50 ...>{biometricError}</p>}
# {biometricMessage && <p ...>{biometricMessage}</p>}
content = re.sub(r'\{[a-zA-Z]+(?:Error|Message)\s*&&\s*<[a-z]+\s+className="[^"]*"\s*>\{[a-zA-Z]+(?:Error|Message)\}</[a-z]+>\}', '', content)
# Sometimes it's a div with an svg inside...
# Let's remove any `{errorVar && <div ...>{errorVar}</div>}` 
content = re.sub(r'\{[a-zA-Z]+(?:Error|Message)\s*&&\s*<div[^>]*>\{[a-zA-Z]+(?:Error|Message)\}</div>\}', '', content)

# Let's just remove the state variables entirely to clean up
content = re.sub(r'const\s+\[[a-zA-Z]+(?:Error|Message),\s*set[a-zA-Z]+(?:Error|Message)\]\s*=\s*useState<string\s*\|\s*null>\(null\)\n', '', content)

with open('src/components/SettingsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
