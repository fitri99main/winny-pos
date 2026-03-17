const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\USER\\Downloads\\kejaan ayah\\winny-main\\mobile-app\\src\\screens\\HomeScreen.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `                    const newOrder = payload.new;
                    
                    Alert.alert(
                        "Pesanan Baru Masuk 🛒",
                        \`Ada pesanan baru di Meja \${newOrder.table_no || 'Tanpa Meja'} (#\${newOrder.order_no}).\\n\\nBuka sekarang untuk pembayaran?\`,
                        [
                            { text: "Nanti", style: "cancel" },
                            { 
                                text: "Buka Pesanan", 
                                onPress: () => {
                                    // @ts-ignore
                                    navigation.navigate('POS', {
                                        tableId: newOrder.id, // Using sale ID as tableId might be tricky if POS expects table DB ID, but let's see
                                        tableNumber: newOrder.table_no,
                                        waiterName: newOrder.waiter_name,
                                        orderId: newOrder.id // Passing orderId directly
                                    });
                                }
                            }
                        ]
                    );`;

const replacement = `                    const newOrder = payload.new;
                    
                    const openOrder = () => {
                        // @ts-ignore
                        navigation.navigate('POS', {
                            tableId: newOrder.id,
                            tableNumber: newOrder.table_no,
                            waiterName: newOrder.waiter_name,
                            orderId: newOrder.id
                        });
                    };

                    if (!isDisplayOnly) {
                        console.log('[HomeScreen] Auto-navigating to POS for new order:', newOrder.id);
                        openOrder();
                        return;
                    }
                    
                    Alert.alert(
                        "Pesanan Baru Masuk 🛒",
                        \`Ada pesanan baru di Meja \${newOrder.table_no || 'Tanpa Meja'} (#\${newOrder.order_no}).\\n\\nBuka sekarang untuk pembayaran?\`,
                        [
                            { text: "Nanti", style: "cancel" },
                            { 
                                text: "Buka Pesanan", 
                                onPress: openOrder
                            }
                        ]
                    );`;

// Simplified matching to handle indentation variations
const lines = content.split('\n');
let startIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const newOrder = payload.new;') && lines[i+2].includes('Alert.alert(')) {
        startIndex = i;
        break;
    }
}

if (startIndex !== -1) {
    console.log('Found match at line', startIndex + 1);
    // Find where the alert closes
    let endIndex = -1;
    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].includes(');') && i > startIndex + 10) {
            endIndex = i;
            break;
        }
    }
    
    if (endIndex !== -1) {
        console.log('Found end at line', endIndex + 1);
        lines.splice(startIndex, endIndex - startIndex + 1, replacement);
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log('File successfully updated.');
    } else {
        console.log('Could not find end of Alert block.');
    }
} else {
    console.log('Could not find start of order handler.');
}
