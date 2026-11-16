const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building project assets and verifying files...');

const requiredFiles = [
  'src/server.js',
  'src/devices.js',
  'src/workflowEngine.js',
  'src/mcp/server.js',
  'src/public/index.html',
  'src/public/app.js'
];

let hasErrors = false;

// Check file existence
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`- ${file} [OK]`);
  } else {
    console.error(`- Missing: ${file}`);
    hasErrors = true;
  }
}

// Check JavaScript syntax
const jsFiles = [
  'src/server.js',
  'src/devices.js',
  'src/workflowEngine.js',
  'src/mcp/server.js'
];

for (const jsFile of jsFiles) {
  try {
    const fullPath = path.join(__dirname, '..', jsFile);
    execSync(`node --check "${fullPath}"`);
    console.log(`- Syntax check: ${jsFile} [OK]`);
  } catch (err) {
    console.error(`- Syntax error in ${jsFile}:`, err.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\nBuild failed with errors.');
  process.exit(1);
} else {
  console.log('\nBuild finished successfully.');
  process.exit(0);
}
