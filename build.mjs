import { build } from 'esbuild';
import fs from 'node:fs';

const dev = process.argv.includes('dev');

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: !dev,
  write: false,
  legalComments: 'none',
});

let code = res.outputFiles[0].text;
code = code.replace(/<\/script/gi, '<\\/script');

// 二维码是可选素材：仓库里不带个人二维码，缺失时把这一块隐藏掉
const QR_PATH = 'assets/qr_small.png';
const hasQr = fs.existsSync(QR_PATH);
const qr = hasQr
  ? fs.readFileSync(QR_PATH).toString('base64')
  : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const tpl = fs.readFileSync('src/index.html', 'utf8');
const [beforeBundle, afterBundle] = tpl.split('__BUNDLE__');
const [beforeQr, afterQr] = beforeBundle.split('__QR__');
let finalHtml = beforeQr + `data:image/png;base64,${qr}` + afterQr + code + afterBundle;
if (!hasQr) finalHtml = finalHtml.replace('</head>', '<style>.qr{display:none}</style></head>');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', finalHtml);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`dist/index.html  ${kb(Buffer.byteLength(finalHtml))}  (js ${kb(Buffer.byteLength(code))}, qr ${hasQr ? kb(qr.length * 0.75) : 'off'})`);
