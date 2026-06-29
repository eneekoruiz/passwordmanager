import re

with open('src/components/AccountForm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove useState for error
content = re.sub(r'\s*const \[error, setError\] = useState<string \| null>\(null\)\n', '\n', content)

# 2. Replace setError(null) with nothing
content = re.sub(r'\s*setError\(null\)', '', content)

# 3. Replace setError(msg) with showToast(msg, 'error')
def replace_set_error(match):
    arg = match.group(1)
    if arg == 'null':
        return ''
    return f"showToast({arg}, 'error')"

content = re.sub(r'setError\((.*?)\)', replace_set_error, content)

# 4. Remove the inline error rendering block
# The block is:
#       {error && (
#         <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 text-left font-medium leading-normal animate-shake">
#           ...
#         </div>
#       )}
error_block_regex = r'\{error && \(\s*<div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 text-left font-medium leading-normal animate-shake">.*?</div>\s*\)\}'
content = re.sub(error_block_regex, '', content, flags=re.DOTALL)

with open('src/components/AccountForm.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
