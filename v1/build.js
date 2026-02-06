#!/usr/bin/env node
// Build: inlines CSS + JS modules into a single HTML file
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'build');
const outFile = path.join(outDir, 'serpens-infernalis.html');

fs.mkdirSync(outDir, { recursive: true });

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const style = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const audio = fs.readFileSync(path.join(src, 'audio.js'), 'utf8');
const church = fs.readFileSync(path.join(src, 'church.js'), 'utf8');
const game = fs.readFileSync(path.join(src, 'game.js'), 'utf8');

html = html.replace('/* __STYLE__ */', style);
html = html.replace('/* __AUDIO__ */', audio);
html = html.replace('/* __CHURCH__ */', church);
html = html.replace('/* __GAME__ */', game);

fs.writeFileSync(outFile, html);
console.log(`Built: ${outFile} (${fs.statSync(outFile).size} bytes)`);
