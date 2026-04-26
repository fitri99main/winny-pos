const fs = require('fs');
try {
    const data = fs.readFileSync('crash_log.txt', 'utf16le');
    fs.writeFileSync('crash_log_utf8.txt', data, 'utf8');
    console.log('Berhasil mengonversi file log!');
} catch (err) {
    console.error('Error:', err);
}
