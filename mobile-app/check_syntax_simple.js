var fs = require('fs');
var path = require('path');

var filePath = 'c:\\Users\\USER\\Downloads\\kejaan ayah\\winny-main\\mobile-app\\src\\screens\\POSScreen.tsx';
var content = fs.readFileSync(filePath, 'utf8');

// Strip JSX to check basic JS syntax (very crude)
var jsContent = content.replace(/<[\s\S]*?>/g, ' null ');

try {
    new Function(jsContent);
    console.log('Syntax OK (basic check)');
} catch (e) {
    console.log('Syntax Error detected:');
    console.log(e.message);
    // Find approximate line
    var lines = jsContent.split('\n');
    var current = '';
    for (var i = 0; i < lines.length; i++) {
        current += lines[i] + '\n';
        try {
            new Function(current + '}'); // try to close it
        } catch (err) {
            // still failing
        }
    }
}
