import esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');
const bundlePath = 'main.js';

function sanitizeBundle() {
  const bundle = readFileSync(bundlePath, 'utf8');
  const sanitized = bundle
    .replace(/CLIENT_ID3 = decode3\(".*?"\);/, 'CLIENT_ID3 = decode3("REDACTED_GOOGLE_ANTIGRAVITY_CLIENT_ID");')
    .replace(/CLIENT_SECRET = decode3\(".*?"\);/, 'CLIENT_SECRET = decode3("REDACTED_GOOGLE_ANTIGRAVITY_CLIENT_SECRET");')
    .replace(/CLIENT_ID4 = decode4\(".*?"\);/, 'CLIENT_ID4 = decode4("REDACTED_GOOGLE_GEMINI_CLIENT_ID");')
    .replace(/CLIENT_SECRET2 = decode4\(".*?"\);/, 'CLIENT_SECRET2 = decode4("REDACTED_GOOGLE_GEMINI_CLIENT_SECRET");');

  if (sanitized !== bundle) {
    writeFileSync(bundlePath, sanitized);
  }
}

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    '@sinclair/typebox',
    'child_process',
    'fs',
    'path',
    'os',
    'url',
    'crypto',
    'stream',
    'util',
    'events',
    'assert',
    'buffer',
    'net',
    'tls',
    'querystring',
    'string_decoder',
    'http',
    'https',
    'zlib',
    'readline'
  ],
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  treeShaking: true,
  minify: isProduction,
  sourcemap: !isProduction,
  outfile: 'main.js',
  logLevel: 'info'
});

if (isWatch) {
  await context.watch();
  sanitizeBundle();
  console.log('Watching for changes...');
} else {
  await context.rebuild();
  await context.dispose();
  sanitizeBundle();
  console.log('Build complete.');
}
