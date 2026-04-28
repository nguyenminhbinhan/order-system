const fs = require('fs');
const data = fs.readFileSync('report.json', 'utf16le');
const cleanData = data.replace(/^\uFEFF/, '');
const report = JSON.parse(cleanData);
const test = report.suites[0].specs[0].tests[0].results[0];
console.log('STATUS:', test.status);
console.log('ERRORS:', JSON.stringify(test.errors, null, 2));
console.log('STDOUT:', test.stdout.map(x => x.text).join(''));
