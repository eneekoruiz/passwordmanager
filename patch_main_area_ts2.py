with open('src/components/MainArea.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = re.sub(r',\s*LocalVaultItemType', '', content)
content = re.sub(r'LocalVaultItemType,\s*', '', content)

with open('src/components/MainArea.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
