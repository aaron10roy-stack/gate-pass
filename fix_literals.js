const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\\`/g, '`');
    content = content.replace(/\\\$/g, '$');
    fs.writeFileSync(filePath, content, 'utf8');
}

fixFile(path.join(__dirname, 'server.js'));
fixFile(path.join(__dirname, 'public', 'js', 'app.js'));
console.log('Fixed explicit escaped literals in JS files.');
