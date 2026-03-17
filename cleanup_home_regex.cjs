const fs = require('fs');
const filePath = 'C:\\Users\\USER\\Downloads\\kejaan ayah\\winny-main\\mobile-app\\src\\screens\\HomeScreen.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Use a more flexible regex to find the Alert's onPress block for "Buka Pesanan"
const alertMatch = /"Buka Pesanan",\s*onPress: \(\) => \{[\s\S]*?navigation\.navigate\('POS', \{[\s\S]*?\}\);?\s*\}/g;

if (alertMatch.test(content)) {
    content = content.replace(alertMatch, '"Buka Pesanan", onPress: openOrder');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Regex cleanup of Alert complete.');
} else {
    console.log('Could not find the Alert block with regex.');
}
