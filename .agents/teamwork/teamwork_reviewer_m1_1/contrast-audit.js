const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(item)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk('src');
const badCombos = [
  /bg-rotary-gold[^\"]*text-white/,
  /text-white[^\"]*bg-rotary-gold/,
  /bg-\[#f7a81b\][^\"]*text-white/,
  /text-white[^\"]*bg-\[#f7a81b\]/,
  /bg-amber-300[^\"]*text-white/,
  /bg-amber-400[^\"]*text-white/,
  /bg-amber-500[^\"]*text-white/,
  /bg-yellow-400[^\"]*text-white/,
  /bg-yellow-500[^\"]*text-white/,
];

let violations = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const re of badCombos) {
    const m = content.match(re);
    if (m) {
      console.error('VIOLATION in', file, ':', m[0]);
      violations++;
    }
  }
}

if (violations === 0) {
  console.log('CONTRAST AUDIT PASSED: Zero violations of white-text-on-gold across', files.length, 'files.');
} else {
  console.error('CONTRAST AUDIT FAILED with', violations, 'violations.');
  process.exit(1);
}
