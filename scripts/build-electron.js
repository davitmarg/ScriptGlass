import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function build() {
  console.log('Building Electron main process...');
  
  try {
    await esbuild.build({
      entryPoints: ['main.js'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: 'dist/main.cjs',
      external: ['electron'], 
      logOverride: { 'empty-import-meta': 'silent' },
      define: {
        'process.env.GITHUB_CLIENT_ID': JSON.stringify(process.env.GITHUB_CLIENT_ID || ''),
        'process.env.GITHUB_CLIENT_SECRET': JSON.stringify(process.env.GITHUB_CLIENT_SECRET || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
      }
    });
    console.log('Successfully built dist/main.cjs');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
