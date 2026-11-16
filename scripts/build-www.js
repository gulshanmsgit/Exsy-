// Copies the web app's own files into www/ – the folder Capacitor packs into the Android app.
// The list comes from index.html (every <script src> and stylesheet) plus the manifest, service worker and icons.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|data:|#)/.test(u));
const files = [...new Set(['index.html', 'sw.js', 'manifest.webmanifest', ...local])];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const f of fs.readdirSync(path.join(root, 'icons')).filter(f => f.endsWith('.png'))) fs.copyFileSync(path.join(root, 'icons', f), path.join(out, 'icons', f));
console.log(`www/ ready: ${files.length} files + icons`);
