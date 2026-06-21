const fs = require('fs');
const lines = fs.readFileSync('game.js', 'utf8').split('\n');

const globals = lines.slice(0, 218).join('\n');
const unit = lines.slice(218, 597).join('\n');
const ai = lines.slice(666, 1016).concat(lines.slice(1082, 1414)).join('\n');
const main = lines.slice(597, 666).concat(lines.slice(1016, 1082), lines.slice(1414)).join('\n');

fs.mkdirSync('js', {recursive: true});
fs.writeFileSync('js/globals.js', globals);
fs.writeFileSync('js/Unit.js', unit);
fs.writeFileSync('js/AI.js', ai);
fs.writeFileSync('js/main.js', main);

console.log('Split complete. Files created in js/ directory.');
