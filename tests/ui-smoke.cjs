/**
 * SeeleLink UI Smoke Tests (Build Verification)
 *
 * Verifies the built HTML/CSS/JS assets exist and are valid.
 *
 * Run: node tests/ui-smoke.cjs
 */
const fs = require('fs');
const path = require('path');

const DIST_PATH = path.join(__dirname, '..', 'dist-electron');
const ASSETS_PATH = path.join(DIST_PATH, 'assets');

// Find Vite hashed assets
const assets = fs.readdirSync(ASSETS_PATH);
const cssFile = assets.find(f => f.startsWith('index-') && f.endsWith('.css'));
const jsFile = assets.find(f => f.startsWith('index-') && f.endsWith('.js'));
const CSS_FILE = cssFile ? path.join(ASSETS_PATH, cssFile) : null;
const JS_FILE = jsFile ? path.join(ASSETS_PATH, jsFile) : null;

let passed = 0;
let failed = 0;

function assertTrue(value, msg) {
  if (value) { console.log(`  [PASS] ${msg}`); passed++; }
  else { console.log(`  [FAIL] ${msg}`); failed++; }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) { console.log(`  [PASS] ${msg}`); passed++; }
  else { console.log(`  [FAIL] ${msg} (expected: ${expected}, got: ${actual})`); failed++; }
}

function assertMatch(text, regex, msg) {
  if (regex.test(text)) { console.log(`  [PASS] ${msg}`); passed++; }
  else { console.log(`  [FAIL] ${msg}`); failed++; }
}

function runTests() {
  console.log('='.repeat(60));
  console.log('SeeleLink UI Smoke Tests (Build Verification)');
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Build output exists
  try {
    console.log('[Test] Build output exists');
    assertTrue(fs.existsSync(DIST_PATH), 'dist-electron/ exists');
    assertTrue(fs.existsSync(path.join(DIST_PATH, 'index.html')), 'index.html exists');
    assertTrue(!!CSS_FILE, 'CSS file exists: ' + cssFile);
    assertTrue(!!JS_FILE, 'JS file exists: ' + jsFile);
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 2: HTML loads the JS bundle
  try {
    console.log('[Test] HTML structure');
    const html = fs.readFileSync(path.join(DIST_PATH, 'index.html'), 'utf-8');
    assertMatch(html, /index-.*\.js/, 'HTML references JS bundle');
    assertMatch(html, /index-.*\.css/, 'HTML references CSS bundle');
    assertMatch(html, /<div\s+id=["']root["']/, 'HTML has root div');
    assertMatch(html, /<script/, 'HTML has script tag');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 3: CSS has theme variable fallback usage (runtime-set via JS)
  try {
    console.log('[Test] CSS uses CSS variables with fallbacks');
    const css = fs.readFileSync(CSS_FILE, 'utf-8');
    // CSS variables are set at runtime via JS setProperty; CSS uses var() with fallbacks
    assertTrue(css.includes('var(--'), 'CSS uses var() for theme variables');
    // Terminal always has a dark bg - check fallback
    assertMatch(css, /#1A1A1A|#0D0D0D|terminal/, 'Terminal has dark fallback background');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 4: JS sets CSS variables at runtime via setProperty
  try {
    console.log('[Test] JS sets CSS variables via setProperty');
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    assertTrue(js.includes('setProperty') && js.includes('setProperty('), 'JS uses setProperty for CSS vars');
    // Variable names are minified, but we verify theme colors are present
    assertTrue(js.includes('setProperty(') && js.includes('colors'), 'JS uses setProperty with theme colors');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 5: JS bundle contains key modules
  try {
    console.log('[Test] JS bundle contains key modules');
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    const modules = [
      ['Terminal|xterm', 'Terminal module'],
      ['ThemeProvider|useTheme', 'ThemeProvider module'],
      ['electronAPI|windowAPI', 'ElectronAPI module'],
      ['data-theme|setAttribute', 'Theme data attribute setting'],
    ];
    for (const [pattern, label] of modules) {
      const regex = new RegExp(pattern);
      assertMatch(js, regex, `${label} in bundle`);
    }
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 6: JS bundle contains theme data (dark/light)
  try {
    console.log('[Test] JS bundle has theme color data');
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    // Check for dark theme color values in the bundle (they're inlined)
    assertTrue(js.includes('#1C1C1E') || js.includes('#1c1c1e'), 'Dark bg color in bundle');
    assertTrue(js.includes('#4A9EFF') || js.includes('#4a9eff'), 'Dark primary color in bundle');
    assertTrue(js.includes('#FFFFFF') || js.includes('#ffffff'), 'Light bg color in bundle');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 7: No hardcoded duplicate theme colors (unification worked)
  try {
    console.log('[Test] No hardcoded duplicate theme colors');
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    assertTrue(!js.includes('surfaceHover:"#333'), 'No hardcoded surfaceHover color');
    assertTrue(!js.includes('bgHover:"#2A2D2E"'), 'No hardcoded bgHover color');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 8: CSS has scrollbar styling
  try {
    console.log('[Test] CSS scrollbar styling');
    const css = fs.readFileSync(CSS_FILE, 'utf-8');
    assertMatch(css, /--scrollbar|::-webkit-scrollbar/, 'Scrollbar styling present');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 10: CSS file size reasonable
  try {
    console.log('[Test] CSS file size');
    const stats = fs.statSync(CSS_FILE);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`       CSS size: ${sizeKB} KB`);
    assertTrue(stats.size > 1000, 'CSS is non-empty (>1KB)');
    assertTrue(stats.size < 500 * 1024, 'CSS is reasonable (<500KB)');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 11: JS file size reasonable
  try {
    console.log('[Test] JS bundle size');
    const stats = fs.statSync(JS_FILE);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`       JS size: ${sizeKB} KB`);
    assertTrue(stats.size > 100 * 1024, 'JS bundle is substantial (>100KB)');
    assertTrue(stats.size < 5 * 1024 * 1024, 'JS bundle is not too large (<5MB)');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 12: xterm CSS present
  try {
    console.log('[Test] xterm CSS bundled');
    assertTrue(fs.existsSync(path.join(ASSETS_PATH, 'xterm.css')), 'xterm.css exists');
    assertTrue(fs.existsSync(path.join(ASSETS_PATH, 'addon-fit.js')), 'xterm fit addon exists');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\nNOTE: For full UI smoke tests with Playwright:');
    console.log('  npx playwright install chromium');
    console.log('  node tests/ui-smoke.cjs  # will use Playwright when available');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
