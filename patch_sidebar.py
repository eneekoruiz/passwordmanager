import re

with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

if "import { useToast }" not in content:
    content = content.replace("import { SearchBar } from './SearchBar'", "import { SearchBar } from './SearchBar'\nimport { useToast } from './ui/ToastProvider'")

if "const { showToast } = useToast()" not in content:
    content = re.sub(r'(export function Sidebar\(\{.*?\}\) \{)', r'\1\n  const { showToast } = useToast()', content, flags=re.DOTALL)

content = re.sub(r'\s*const \[sidebarError, setSidebarError\] = useState<string \| null>\(null\)\n', '\n', content)

content = re.sub(r'\s*setSidebarError\(null\)', '', content)

def replace_set_error(match):
    arg = match.group(1)
    if arg == 'null':
        return ''
    return f"showToast({arg}, 'error')"

content = re.sub(r'setSidebarError\((.*?)\)', replace_set_error, content)

content = re.sub(r'\s*\{sidebarError && \(\s*<div className="mx-3 mt-2 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-xs text-red-700">\s*\{sidebarError\}\s*</div>\s*\)\}', '', content)

with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
