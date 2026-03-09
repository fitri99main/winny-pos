const fs = require('fs');
const content = fs.readFileSync('node_modules/@digitalpersona/websdk/dist/websdk.client.ui.js', 'utf8');
const rx = /async\./g;
let match;
while ((match = rx.exec(content)) !== null) {
    console.log('Match @', match.index, '=>', content.substring(match.index - 50, match.index + 50).replace(/\n/g, '\\n'));
}
