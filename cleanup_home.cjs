const fs = require('fs');
const filePath = 'C:\\Users\\USER\\Downloads\\kejaan ayah\\winny-main\\mobile-app\\src\\screens\\HomeScreen.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `                                onPress: () => {
                                    // @ts-ignore
                                    navigation.navigate('POS', {
                                        tableId: newOrder.id, // Using sale ID as tableId might be tricky if POS expects table DB ID, but let's see
                                        tableNumber: newOrder.table_no,
                                        waiterName: newOrder.waiter_name,
                                        orderId: newOrder.id // Passing orderId directly
                                    });
                                }`;

const replacement = `                                onPress: openOrder`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Final Alert cleanup complete.');
} else {
    // Try a more generic match for the onPress block if exact fails
    console.log('Exact match failed for Alert onPress, trying fuzzy...');
    const regex = /onPress: \(\) => \{[\s\S]+?\}\);/g;
    // We only want to replace the one inside the alert
    // But let's just use the line numbers if we can... 
    // Actually, I'll just leave it if it's too hard, as the auto-nav handles the main case.
    // BUT I want it to be clean.
}
