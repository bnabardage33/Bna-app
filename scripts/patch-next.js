const fs = require('fs');
const path = require('path');

const swcIndexPath = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'build', 'swc', 'index.js');

if (fs.existsSync(swcIndexPath)) {
  let content = fs.readFileSync(swcIndexPath, 'utf8');
  if (!content.includes("process.platform === 'android'")) {
    const target = 'let attempts = [];';
    const replacement = `let attempts = [];
        if (process.platform === 'android') {
            const fallbackBindings = await tryLoadWasmWithFallback(attempts);
            if (fallbackBindings) {
                return resolve(fallbackBindings);
            }
        }`;
    content = content.replace(target, replacement);
    fs.writeFileSync(swcIndexPath, content, 'utf8');
    console.log('[bna-app] Patched Next.js SWC for Android/Termux successfully.');
  }
}
