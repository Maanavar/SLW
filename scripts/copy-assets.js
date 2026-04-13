#!/usr/bin/env node

/**
 * Build script to copy static assets to dist folder
 * Copies: HTML and CSS files
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy HTML file
const htmlSrc = path.join(srcDir, 'index.html');
const htmlDest = path.join(distDir, 'index.html');
fs.copyFileSync(htmlSrc, htmlDest);
console.log('✓ Copied index.html');

// Copy CSS directory
const cssSrc = path.join(srcDir, 'css');
const cssDest = path.join(distDir, 'css');

// Remove existing css directory if it exists
if (fs.existsSync(cssDest)) {
  fs.rmSync(cssDest, { recursive: true });
}

// Create css directory and copy files
fs.mkdirSync(cssDest, { recursive: true });
const cssFiles = fs.readdirSync(cssSrc);

let fileCopiedCount = 0;
cssFiles.forEach(file => {
  const src = path.join(cssSrc, file);
  const dest = path.join(cssDest, file);
  const stat = fs.statSync(src);

  if (stat.isFile()) {
    fs.copyFileSync(src, dest);
    fileCopiedCount++;
  } else if (stat.isDirectory()) {
    // Skip directories
    console.log(`⊘ Skipping directory: ${file}`);
  }
});

console.log(`✓ Copied ${fileCopiedCount} CSS files`);
console.log('Build assets copied successfully!');
