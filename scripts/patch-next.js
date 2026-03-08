#!/usr/bin/env node
/**
 * patch-next.js
 *
 * Applies 4 patches to Next.js 16.1.6 app-page.runtime.prod.js
 * to fix ARM64 (no SWC) compatibility issues:
 *
 * 1. useContext = use  — adds useContext alias for React.use (ARM64 compat)
 * 2. sx GlobalError null — prevents plain functions from being sent as RSC payload
 * 3. sk GlobalError null — same fix for the sk render path
 * 4. RSC encoder try-catch — catches "Cannot read a Client Context" from OuterLayoutRouter
 *
 * Idempotent: safe to run multiple times (checks before patching).
 * Run automatically via: "postinstall": "node scripts/patch-next.js"
 */

const fs = require('fs');
const path = require('path');

const TARGET = path.join(
  __dirname,
  '..',
  'node_modules',
  'next',
  'dist',
  'compiled',
  'next-server',
  'app-page.runtime.prod.js'
);

if (!fs.existsSync(TARGET)) {
  console.error('[patch-next] ERROR: Target file not found:', TARGET);
  process.exit(1);
}

let content = fs.readFileSync(TARGET, 'utf8');
let changed = false;

// ─── Patch 1: useContext = use ────────────────────────────────────────────────
// Adds React.useContext = React.use so older code using useContext() works on
// ARM64 where SWC is unavailable and the React build lacks useContext.
const P1_OLD = '})(),module.exports=i})()';
const P1_NEW =
  ';(function(){var u=t.React;if(u&&u.use&&!u.useContext){u.useContext=u.use;' +
  'if(u.default&&u.default.use&&!u.default.useContext)u.default.useContext=u.default.use;}' +
  '})()})(),module.exports=i})()';
const P1_CHECK = 'u.useContext=u.use';

if (!content.includes(P1_CHECK)) {
  if (!content.includes(P1_OLD)) {
    console.error('[patch-next] Patch1: anchor not found — Next.js version mismatch?');
    process.exit(1);
  }
  content = content.replace(P1_OLD, P1_NEW);
  changed = true;
  console.log('[patch-next] Patch1 applied: useContext=use');
} else {
  console.log('[patch-next] Patch1 already applied (skip)');
}

// ─── Patch 2: sx function — GlobalError null ─────────────────────────────────
// In the sx() prerender function, if the G (GlobalError) field is a plain
// function without $$typeof, replace it with null to prevent
// "Functions cannot be passed directly to Client Components" error.
const P2_OLD = 'G:[y,v],S:c.isStaticGeneration}}function sC';
const P2_NEW =
  "G:[(typeof y==='function'&&!(y['$'+'$typeof']))?null:y,v]," +
  'S:c.isStaticGeneration}}function sC';
const P2_CHECK = "G:[(typeof y==='function'";

if (!content.includes(P2_CHECK)) {
  if (!content.includes(P2_OLD)) {
    console.error('[patch-next] Patch2: anchor not found — Next.js version mismatch?');
    process.exit(1);
  }
  content = content.replace(P2_OLD, P2_NEW);
  changed = true;
  console.log('[patch-next] Patch2 applied: sx GlobalError null');
} else {
  console.log('[patch-next] Patch2 already applied (skip)');
}

// ─── Patch 3: sk function — GlobalError null ─────────────────────────────────
// Same fix for the sk() prerender path.
const P3_OLD = 'G:[x,C],S:p.isStaticGeneration}}function sR';
const P3_NEW =
  "G:[(typeof x==='function'&&!(x['$'+'$typeof']))?null:x,C]," +
  'S:p.isStaticGeneration}}function sR';
const P3_CHECK = "G:[(typeof x==='function'";

if (!content.includes(P3_CHECK)) {
  if (!content.includes(P3_OLD)) {
    console.error('[patch-next] Patch3: anchor not found — Next.js version mismatch?');
    process.exit(1);
  }
  content = content.replace(P3_OLD, P3_NEW);
  changed = true;
  console.log('[patch-next] Patch3 applied: sk GlobalError null');
} else {
  console.log('[patch-next] Patch3 already applied (skip)');
}

// ─── Patch 4: RSC encoder — try-catch for OuterLayoutRouter ─────────────────
// OuterLayoutRouter is a Client Component that lacks $$typeof, so the RSC
// encoder mistakenly calls it as a Server Component via eC(). Inside it calls
// useContext(LayoutRouterContext) which throws "Cannot read a Client Context
// from a Server Component." Catch that specific error and return null.
const P4_OLD =
  'if("function"==typeof n&&n.$$typeof!==O&&n.$$typeof!==G)return eC(t,r,a,n,o);';
const P4_NEW =
  'if("function"==typeof n&&n.$$typeof!==O&&n.$$typeof!==G){' +
  'try{return eC(t,r,a,n,o)}catch(_e){' +
  'if(_e instanceof Error&&_e.message==="Cannot read a Client Context from a Server Component.")' +
  'return null;throw _e}}';
const P4_CHECK = 'catch(_e){if(_e instanceof Error&&_e.message==="Cannot read a Client Context';

if (!content.includes(P4_CHECK)) {
  if (!content.includes(P4_OLD)) {
    console.error('[patch-next] Patch4: anchor not found — Next.js version mismatch?');
    process.exit(1);
  }
  content = content.replace(P4_OLD, P4_NEW);
  changed = true;
  console.log('[patch-next] Patch4 applied: RSC encoder try-catch');
} else {
  console.log('[patch-next] Patch4 already applied (skip)');
}

// ─── Write ─────────────────────────────────────────────────────────────────
if (changed) {
  fs.writeFileSync(TARGET, content, 'utf8');
  console.log('[patch-next] ✓ All patches written to', TARGET);
} else {
  console.log('[patch-next] ✓ All patches already in place — nothing to do.');
}
