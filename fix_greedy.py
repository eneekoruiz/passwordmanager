import re
import glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    content = re.sub(r'(getFriendlyErrorMessage\([^,]+,\s*(?:\'[^\']*\'|`[^`]*`|"[^"]*")),\s*\'error\'\)', r'\1)', content)
    content = re.sub(r'(showToast\(getFriendlyErrorMessage\([^,]+,\s*(?:\'[^\']*\'|`[^`]*`|"[^"]*")),\s*\'error\'\)\)', r"\1), 'error')", content)

    content = re.sub(r"(showToast\(.*?),\s*'error',\s*'error'\)", r"\1, 'error')", content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for filepath in glob.glob('src/components/**/*.tsx', recursive=True):
    fix_file(filepath)
