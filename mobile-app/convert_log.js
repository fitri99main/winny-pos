const fs = require('fs');
try {
    const data = fs.readFileSync('typescript_errors_mobile.log', 'utf16le');
    fs.writeFileSync('typescript_errors_mobile_utf8.log', data, 'utf8');
    console.log('Conversion successful');
} catch (err) {
    console.error('Error during conversion:', err);
}
