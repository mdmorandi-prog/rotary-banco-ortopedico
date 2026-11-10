/**
 * Rotary Banco Ortopédico — Opaque-box E2E Test Runner
 * 
 * Pure Node.js test runner with zero external dependencies.
 * Compatible with Windows (cmd/PowerShell) and POSIX environments.
 * 
 * Supported CLI Options:
 *   --tier=1       Run Tier 1: Core Feature Coverage
 *   --tier=2       Run Tier 2: Boundary & Corner Cases
 *   --tier=3       Run Tier 3: Cross-Feature Pairwise Interactions
 *   --tier=4       Run Tier 4: Real-World Operational Scenarios
 *   --tier=all     Run all tiers sequentially (Default)
 *   --filter=<pat> Run only tests matching regex or substring pattern
 *   --verbose      Display detailed test timings and individual passed test names
 *   --bail         Halt execution immediately on first failure
 *   --help         Display help text
 */

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { pathToFileURL } = require('node:url');

// --- ANSI Terminal Styling ---
const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.CI || process.env.FORCE_COLOR);
const style = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  rotaryBlue: isColorSupported ? '\x1b[38;2;23;69;143m' : '',   // #17458f
  rotaryGold: isColorSupported ? '\x1b[38;2;247;168;27m' : '',  // #f7a81b
  green: isColorSupported ? '\x1b[32m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',
};

// --- Test Registry & Suite Model ---
class TestRegistry {
  constructor() {
    this.reset();
  }

  reset() {
    this.suites = [];
    this.currentSuite = null;
    this.beforeAllHooks = [];
    this.afterAllHooks = [];
  }

  createSuite(title, fn) {
    const parentSuite = this.currentSuite;
    const suite = {
      title,
      parent: parentSuite,
      tests: [],
      suites: [],
      beforeAllHooks: [],
      afterAllHooks: [],
      beforeEachHooks: [],
      afterEachHooks: []
    };

    if (parentSuite) {
      parentSuite.suites.push(suite);
    } else {
      this.suites.push(suite);
    }

    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parentSuite;
    }
  }

  addTest(title, fn, options = {}) {
    const suite = this.currentSuite || this.getOrCreateRootSuite();
    suite.tests.push({
      title,
      fn,
      skip: options.skip || false,
      only: options.only || false,
      suite
    });
  }

  getOrCreateRootSuite() {
    if (this.suites.length === 0) {
      this.suites.push({
        title: 'Root Suite',
        parent: null,
        tests: [],
        suites: [],
        beforeAllHooks: [],
        afterAllHooks: [],
        beforeEachHooks: [],
        afterEachHooks: []
      });
    }
    return this.suites[0];
  }

  addHook(type, fn) {
    const suite = this.currentSuite;
    if (suite) {
      if (type === 'beforeAll') suite.beforeAllHooks.push(fn);
      else if (type === 'afterAll') suite.afterAllHooks.push(fn);
      else if (type === 'beforeEach') suite.beforeEachHooks.push(fn);
      else if (type === 'afterEach') suite.afterEachHooks.push(fn);
    } else {
      if (type === 'beforeAll') this.beforeAllHooks.push(fn);
      else if (type === 'afterAll') this.afterAllHooks.push(fn);
    }
  }
}

const registry = new TestRegistry();

// Global DSL Export for tests
global.describe = (title, fn) => registry.createSuite(title, fn);
global.test = (title, fn) => registry.addTest(title, fn);
global.it = global.test;
global.test.skip = (title, fn) => registry.addTest(title, fn, { skip: true });
global.it.skip = global.test.skip;
global.test.only = (title, fn) => registry.addTest(title, fn, { only: true });
global.it.only = global.test.only;
global.beforeAll = (fn) => registry.addHook('beforeAll', fn);
global.afterAll = (fn) => registry.addHook('afterAll', fn);
global.beforeEach = (fn) => registry.addHook('beforeEach', fn);
global.afterEach = (fn) => registry.addHook('afterEach', fn);

// CLI Argument Parsing
function parseArgs(argv) {
  const options = {
    tier: 'all',
    filter: null,
    verbose: false,
    bail: false,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tier=')) {
      options.tier = arg.split('=')[1].trim().toLowerCase();
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1].trim();
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--bail') {
      options.bail = true;
    }
  }

  return options;
}

// Show Help Text
function showHelp() {
  console.log(`
${style.bold}${style.rotaryBlue}Rotary Banco Ortopédico — Opaque-box E2E Test Runner${style.reset}
Usage: node tests/e2e/runner.js [options]

Options:
  --tier=1       Run Tier 1: Core Feature Coverage (tests/e2e/tier1-features/)
  --tier=2       Run Tier 2: Boundary & Corner Cases (tests/e2e/tier2-boundaries/)
  --tier=3       Run Tier 3: Cross-Feature Interactions (tests/e2e/tier3-interactions/)
  --tier=4       Run Tier 4: Real-World Operational Scenarios (tests/e2e/tier4-scenarios/)
  --tier=all     Run all tiers sequentially (Default)
  --filter=<pat> Regex or substring filter on test and suite titles
  --verbose, -v  Detailed per-test output including duration
  --bail         Abort immediately upon the first failed test
  --help, -h     Show this help guide

Examples:
  npm.cmd test
  node tests/e2e/runner.js --tier=1
  node tests/e2e/runner.js --filter="Comodato" --verbose
`);
}

// Discover Test Files for Tier
function discoverFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = [];

  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        if (
          (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js') || entry.name.endsWith('.js')) &&
          entry.name !== 'runner.js' &&
          entry.name !== 'test-harness.js'
        ) {
          files.push(fullPath);
        }
      }
    }
  }

  scan(dirPath);
  return files.sort();
}

// Hierarchy helper for hooks
function getBeforeEachHooks(suite) {
  const hooks = [];
  let current = suite;
  while (current) {
    if (current.beforeEachHooks.length) {
      hooks.unshift(...current.beforeEachHooks);
    }
    current = current.parent;
  }
  return hooks;
}

function getAfterEachHooks(suite) {
  const hooks = [];
  let current = suite;
  while (current) {
    if (current.afterEachHooks.length) {
      hooks.push(...current.afterEachHooks);
    }
    current = current.parent;
  }
  return hooks;
}

// Suite Execution Engine
async function executeSuite(suite, options, filterRegex, stats) {
  let anyOnly = false;
  function checkForOnly(s) {
    for (const t of s.tests) if (t.only) anyOnly = true;
    for (const child of s.suites) checkForOnly(child);
  }
  checkForOnly(suite);

  // Run beforeAll hooks
  for (const hook of suite.beforeAllHooks) {
    await hook();
  }

  // Execute Tests
  for (const testItem of suite.tests) {
    const fullTitle = `${suite.title} > ${testItem.title}`;

    if (filterRegex && !filterRegex.test(fullTitle)) {
      continue;
    }

    if (testItem.skip || (anyOnly && !testItem.only)) {
      stats.skipped++;
      if (options.verbose) {
        console.log(`  ${style.yellow}⚠ SKIP${style.reset} ${style.dim}${fullTitle}${style.reset}`);
      }
      continue;
    }

    stats.total++;
    const testStart = performance.now();
    let passed = false;
    let failureError = null;

    try {
      const beHooks = getBeforeEachHooks(suite);
      for (const hook of beHooks) await hook();

      // Execute Test Function
      const result = testItem.fn();
      if (result && typeof result.then === 'function') {
        await Promise.race([
          result,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout exceeded (10000ms)')), 10000)
          )
        ]);
      }

      const aeHooks = getAfterEachHooks(suite);
      for (const hook of aeHooks) await hook();

      passed = true;
    } catch (err) {
      failureError = err;
    }

    const testDuration = performance.now() - testStart;

    if (passed) {
      stats.passed++;
      if (options.verbose) {
        console.log(`  ${style.green}✔ PASS${style.reset} ${fullTitle} ${style.gray}(${testDuration.toFixed(1)}ms)${style.reset}`);
      } else {
        process.stdout.write(`${style.green}.${style.reset}`);
      }
    } else {
      stats.failed++;
      stats.failures.push({
        title: fullTitle,
        error: failureError,
        duration: testDuration
      });
      if (options.verbose) {
        console.log(`  ${style.red}✖ FAIL${style.reset} ${fullTitle} ${style.gray}(${testDuration.toFixed(1)}ms)${style.reset}`);
      } else {
        process.stdout.write(`${style.red}F${style.reset}`);
      }

      if (options.bail) {
        console.log(`\n${style.red}[BAIL] Execution aborted due to test failure.${style.reset}`);
        return;
      }
    }
  }

  // Recursively execute sub-suites
  for (const childSuite of suite.suites) {
    await executeSuite(childSuite, options, filterRegex, stats);
    if (options.bail && stats.failed > 0) return;
  }

  // Run afterAll hooks
  for (const hook of suite.afterAllHooks) {
    await hook();
  }
}

// Clean error stack for formatted console report
function formatError(error) {
  if (!error) return 'Unknown error';
  const message = error.message || String(error);
  const stack = error.stack || '';
  const lines = stack.split('\n');
  const relevantLines = lines.filter(line => !line.includes('runner.js') && !line.includes('node:internal'));
  return relevantLines.length > 0 ? relevantLines.join('\n') : message;
}

// Main Runner Orchestration
async function run() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const projectTestsDir = path.resolve(process.cwd(), 'tests', 'e2e');
  const baseDir = fs.existsSync(projectTestsDir) ? projectTestsDir : path.resolve(__dirname);
  const filterRegex = options.filter ? new RegExp(options.filter, 'i') : null;

  const tiersConfig = [
    { id: '1', name: 'Tier 1: Core Feature Coverage', dir: path.join(baseDir, 'tier1-features') },
    { id: '2', name: 'Tier 2: Boundary & Corner Cases', dir: path.join(baseDir, 'tier2-boundaries') },
    { id: '3', name: 'Tier 3: Cross-Feature Interactions', dir: path.join(baseDir, 'tier3-interactions') },
    { id: '4', name: 'Tier 4: Real-World Operational Scenarios', dir: path.join(baseDir, 'tier4-scenarios') },
  ];

  const targetTiers = options.tier === 'all'
    ? tiersConfig
    : tiersConfig.filter(t => t.id === options.tier);

  if (targetTiers.length === 0) {
    console.error(`${style.red}Error: Unknown tier "${options.tier}". Allowed tiers: 1, 2, 3, 4, all.${style.reset}`);
    process.exit(1);
  }

  console.log(`\n${style.bold}${style.rotaryBlue}======================================================================${style.reset}`);
  console.log(`${style.bold}${style.rotaryBlue}  ROTARY BANCO ORTOPÉDICO — OPAQUE-BOX E2E TEST RUNNER${style.reset}`);
  console.log(`${style.bold}${style.rotaryGold}  Execution Mode: Tier ${options.tier.toUpperCase()} | Node ${process.version} | Windows/POSIX${style.reset}`);
  console.log(`${style.bold}${style.rotaryBlue}======================================================================${style.reset}\n`);

  const globalStats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tierBreakdown: {},
    failures: []
  };

  const suiteStartTime = performance.now();

  for (const tier of targetTiers) {
    console.log(`\n${style.bold}${style.cyan}▶ [TIER ${tier.id}] ${tier.name}${style.reset}`);
    const files = discoverFiles(tier.dir);

    const tierStats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: []
    };

    if (files.length === 0) {
      console.log(`  ${style.gray}(Directory empty or not yet created: ${path.relative(process.cwd(), tier.dir)})${style.reset}`);
      globalStats.tierBreakdown[tier.id] = tierStats;
      continue;
    }

    for (const file of files) {
      const relFile = path.relative(process.cwd(), file);
      if (options.verbose) {
        console.log(`\n  ${style.bold}📄 File: ${relFile}${style.reset}`);
      }

      registry.reset();

      try {
        const fileUrl = pathToFileURL(file).href;
        // Support both ESM and CJS test files
        await import(fileUrl);
      } catch (err) {
        tierStats.failed++;
        tierStats.total++;
        tierStats.failures.push({
          title: `File Load: ${relFile}`,
          error: err,
          duration: 0
        });
        console.log(`\n  ${style.red}✖ Failed to load test file ${relFile}:${style.reset}\n  ${formatError(err)}`);
        if (options.bail) break;
        continue;
      }

      for (const suite of registry.suites) {
        await executeSuite(suite, options, filterRegex, tierStats);
        if (options.bail && tierStats.failed > 0) break;
      }

      if (options.bail && tierStats.failed > 0) break;
    }

    if (!options.verbose && tierStats.total > 0) {
      console.log(); // newline after dots
    }

    globalStats.total += tierStats.total;
    globalStats.passed += tierStats.passed;
    globalStats.failed += tierStats.failed;
    globalStats.skipped += tierStats.skipped;
    globalStats.failures.push(...tierStats.failures);
    globalStats.tierBreakdown[tier.id] = tierStats;

    if (options.bail && globalStats.failed > 0) break;
  }

  const totalDuration = (performance.now() - suiteStartTime) / 1000;

  // Print Summary Table
  console.log(`\n${style.bold}${style.rotaryBlue}======================================================================${style.reset}`);
  console.log(`${style.bold}  E2E Test Execution Summary${style.reset}`);
  console.log(`${style.rotaryBlue}----------------------------------------------------------------------${style.reset}`);

  for (const tier of targetTiers) {
    const s = globalStats.tierBreakdown[tier.id] || { passed: 0, failed: 0, total: 0 };
    const color = s.failed > 0 ? style.red : (s.passed > 0 ? style.green : style.gray);
    console.log(
      `  Tier ${tier.id} (${tier.name.padEnd(36)}): ${color}${String(s.passed).padStart(4)} passed${style.reset}, ` +
      `${s.failed > 0 ? style.red : style.gray}${String(s.failed).padStart(3)} failed${style.reset} ` +
      `(${s.total} total)`
    );
  }

  console.log(`${style.rotaryBlue}----------------------------------------------------------------------${style.reset}`);
  console.log(
    `  ${style.bold}Total Tests Executed:${style.reset} ${globalStats.passed} passed, ` +
    `${globalStats.failed} failed, ${globalStats.skipped} skipped (${globalStats.total} total)`
  );
  console.log(`  ${style.bold}Total Duration:${style.reset}       ${totalDuration.toFixed(2)}s`);

  if (globalStats.failed > 0) {
    console.log(`  ${style.bold}Final Result:${style.reset}         ${style.bold}${style.red}FAILED (${globalStats.failed} test failures)${style.reset}`);
    console.log(`${style.bold}${style.red}======================================================================${style.reset}`);
    console.log(`\n${style.bold}${style.red}Failure Details:${style.reset}\n`);

    globalStats.failures.forEach((fail, idx) => {
      console.log(`${style.red}[${idx + 1}] ${fail.title}${style.reset}`);
      console.log(`    ${style.gray}Duration: ${fail.duration.toFixed(1)}ms${style.reset}`);
      console.log(`    ${formatError(fail.error).split('\n').join('\n    ')}\n`);
    });

    process.exit(1);
  } else {
    console.log(`  ${style.bold}Final Result:${style.reset}         ${style.bold}${style.green}SUCCESS (All tests passed)${style.reset}`);
    console.log(`${style.bold}${style.rotaryBlue}======================================================================${style.reset}\n`);
    process.exit(0);
  }
}

// Standalone execution trigger
if (require.main === module) {
  run().catch(err => {
    console.error(`${style.red}Fatal Runner Error:${style.reset}`, err);
    process.exit(1);
  });
}

module.exports = {
  registry,
  run,
  parseArgs,
  discoverFiles
};
