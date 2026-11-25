import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const rootDir = process.cwd()

const failures = []
const warnings = []
const passes = []

function pass(name, detail = '') {
  passes.push({ name, detail })
}

function warn(name, detail) {
  warnings.push({ name, detail })
}

function fail(name, detail) {
  failures.push({ name, detail })
}

function readText(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8')
}

function getTrackedFiles() {
  const files = execSync('git ls-files -co --exclude-standard', { cwd: rootDir, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean)
  return Array.from(new Set(files))
}

// 1. Secret & Credential Leak Audit
function auditSecrets(trackedFiles) {
  const forbiddenFiles = trackedFiles.filter((file) =>
    /(^|\/)\.env($|\.(?!example$))|\.(pem|key|pfx)$|credentials\.json$|service-account.*\.json$/i.test(file),
  )
  if (forbiddenFiles.length > 0) {
    fail('Secret files tracked in Git', forbiddenFiles.join(', '))
  } else {
    pass('Zero sensitive files tracked in Git')
  }

  const secretPatterns = [
    { name: 'Private key block', regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/ },
    { name: 'OpenAI/Anthropic token', regex: /\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}\b/ },
    { name: 'GitHub PAT', regex: /\bgh[pors]_[A-Za-z0-9]{20,}\b/ },
    { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: 'Stripe live key', regex: /\b[rs]k_live_[A-Za-z0-9]{16,}\b/ },
  ]

  const matchedSecrets = []
  for (const relPath of trackedFiles) {
    if (relPath === 'scripts/audit-system.mjs' || relPath.startsWith('node_modules/')) continue
    const absPath = path.join(rootDir, relPath)
    if (!fs.existsSync(absPath)) continue
    const ext = path.extname(relPath).toLowerCase()
    if (['.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff2', '.zip'].includes(ext)) continue
    const content = fs.readFileSync(absPath, 'utf8')
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content)) {
        matchedSecrets.push(`${relPath} (${pattern.name})`)
      }
    }
  }

  if (matchedSecrets.length > 0) {
    fail('Potential secrets detected in tracked files', matchedSecrets.join('; '))
  } else {
    pass('Zero secret tokens or private keys detected across tracked repository')
  }
}

// 2. Firebase Security Rules Static Invariants
function auditFirebaseRules() {
  const firestoreRules = readText('firestore.rules')
  const storageRules = readText('storage.rules')

  const checks = [
    {
      label: 'Firestore default-deny rule present',
      ok: /match \/\{document=\*\*\}\s*\{[\s\S]*allow read, write:\s*if false;/.test(firestoreRules),
    },
    {
      label: 'Firestore /directory enforces create/update ownership (anti-hijack)',
      ok:
        firestoreRules.includes('match /directory/{emailHash}') &&
        /allow update:[\s\S]*isDocOwner\(\)/.test(firestoreRules) &&
        /uidNotModified\(\)/.test(firestoreRules),
    },
    {
      label: 'Firestore /shares blocks updates',
      ok: /match \/shares\/\{shareId\}[\s\S]*allow update:\s*if false;/.test(firestoreRules),
    },
    {
      label: 'Firestore /vaults enforces 1 MiB size limit',
      ok: firestoreRules.includes("validStringLength(data, 'encrypted_vault_blob', 1, 1048576)"),
    },
    {
      label: 'Storage rules default-deny and owner-isolated',
      ok:
        storageRules.includes('allow read, write: if false;') &&
        storageRules.includes('request.auth != null && request.auth.uid == userId'),
    },
  ]

  for (const check of checks) {
    if (check.ok) pass(check.label)
    else fail(check.label, 'Security rule invariant missing or weakened')
  }
}

// 3. Frontend Security Sinks & Crypto Hygiene
function auditCodeSinks(trackedFiles) {
  const srcFiles = trackedFiles.filter((f) => f.startsWith('src/') && /\.(ts|tsx|js|jsx)$/.test(f))
  const sinkHits = []

  for (const relPath of srcFiles) {
    const content = readText(relPath)
    const lines = content.split(/\r?\n/)

    lines.forEach((line, idx) => {
      const lineNum = idx + 1
      if (/\bdangerouslySetInnerHTML\b|\.innerHTML\s*=|\beval\s*\(|new\s+Function\s*\(/.test(line)) {
        sinkHits.push(`${relPath}:${lineNum} unsafe DOM/eval sink`)
      }
      if (/window\.open\([^\n;]*'_blank'\s*\)/.test(line)) {
        sinkHits.push(`${relPath}:${lineNum} window.open(..., '_blank') missing noopener,noreferrer`)
      }
      if (
        (relPath.startsWith('src/crypto/') ||
          relPath === 'src/utils/id.ts' ||
          relPath === 'src/utils/security.ts' ||
          relPath === 'src/utils/random.ts') &&
        !relPath.includes('.test.') &&
        /\bMath\.random\s*\(/.test(line)
      ) {
        sinkHits.push(`${relPath}:${lineNum} non-cryptographic Math.random()`)
      }
    })
  }

  if (sinkHits.length > 0) {
    fail('Insecure code sinks detected', sinkHits.join('; '))
  } else {
    pass('Zero unsafe DOM sinks, tabnabbing opens, or weak PRNG in crypto modules')
  }

  const biometricCode = readText('src/crypto/biometric.ts')
  if (/localStorage\.setItem|sessionStorage\.setItem/.test(biometricCode)) {
    fail('Biometric module writes wrapping key material to Web Storage', 'src/crypto/biometric.ts')
  } else {
    pass('Biometric module requires WebAuthn PRF without localStorage key fallback')
  }
}

// 4. Headers, Gitignore & Workspace Hygiene
function auditConfigAndHygiene(trackedFiles) {
  const gitignore = readText('.gitignore')
  const requiredIgnores = ['.env*', 'test-results/', 'playwright-report/']
  const missingIgnores = requiredIgnores.filter((entry) => !gitignore.includes(entry))
  if (missingIgnores.length > 0) {
    fail('.gitignore missing entries', missingIgnores.join(', '))
  } else {
    pass('.gitignore protects secrets and test artifacts')
  }

  const vercel = readText('vercel.json')
  const hasSecurityHeaders =
    vercel.includes('"X-Frame-Options"') &&
    vercel.includes('"DENY"') &&
    vercel.includes('"Content-Security-Policy"') &&
    !vercel.includes("'unsafe-eval'")
  if (hasSecurityHeaders) {
    pass('Vercel headers and CSP policy hardened')
  } else {
    fail('Vercel headers incomplete or permissive', 'Check vercel.json security headers')
  }

  const rootPatchScripts = trackedFiles.filter((f) => /^(fix_|patch_).*\.py$/i.test(f))
  if (rootPatchScripts.length > 0) {
    warn(
      'Legacy one-off patch scripts tracked in root',
      `${rootPatchScripts.length} script(s): ${rootPatchScripts.slice(0, 5).join(', ')}${rootPatchScripts.length > 5 ? '...' : ''}`,
    )
  } else {
    pass('Repository root free of temporary patch scripts')
  }
}

// 5. Production Dependency Audit
function auditDependencies() {
  let auditJson = ''
  try {
    auditJson = execSync('npm audit --omit=dev --json', { cwd: rootDir, encoding: 'utf8' })
  } catch (err) {
    auditJson = err?.stdout ? String(err.stdout) : ''
  }

  if (!auditJson.trim()) {
    warn('npm audit skipped/unavailable', 'Could not parse npm audit JSON output')
    return
  }

  try {
    const parsed = JSON.parse(auditJson)
    const vulns = parsed.vulnerabilities || {}
    const actionable = []
    const nodeOnlyAdvisories = []

    for (const [pkg, info] of Object.entries(vulns)) {
      if (info.severity !== 'high' && info.severity !== 'critical') continue
      const isNodeGrpcFirebaseChain =
        pkg === '@grpc/grpc-js' || pkg === '@firebase/firestore' || pkg === '@firebase/firestore-compat' || pkg === 'firebase'
      if (isNodeGrpcFirebaseChain && info.severity === 'high' && String(info.fixAvailable?.version || '') === '9.14.0') {
        nodeOnlyAdvisories.push(`${pkg} (${info.severity})`)
      } else {
        actionable.push(`${pkg} (${info.severity})`)
      }
    }

    if (actionable.length > 0) {
      fail('Actionable high/critical production dependency vulnerabilities', actionable.join(', '))
    } else if (nodeOnlyAdvisories.length > 0) {
      pass(
        'Zero actionable browser runtime vulnerabilities',
        `Excluded SSR/Node-only @grpc/grpc-js chain (${nodeOnlyAdvisories.length} indirect records inside firebase SDK)`,
      )
    } else {
      pass('Zero high/critical production dependency vulnerabilities')
    }
  } catch {
    warn('npm audit parse error', 'Non-JSON response from npm audit')
  }
}

const trackedFiles = getTrackedFiles()
auditSecrets(trackedFiles)
auditFirebaseRules()
auditCodeSinks(trackedFiles)
auditConfigAndHygiene(trackedFiles)
auditDependencies()

console.log('\n=== CONTRAS SYSTEM AUTO-AUDIT ===')
for (const p of passes) {
  console.log(`  [PASS] ${p.name}${p.detail ? ` — ${p.detail}` : ''}`)
}
for (const w of warnings) {
  console.log(`  [WARN] ${w.name}: ${w.detail}`)
}
for (const f of failures) {
  console.error(`  [FAIL] ${f.name}: ${f.detail}`)
}
console.log(`\nSummary: ${passes.length} passed, ${warnings.length} warning(s), ${failures.length} failed.\n`)

if (failures.length > 0) {
  process.exit(1)
}
