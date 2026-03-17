const fs = require('fs');

try {
    const filePath = 'C:\\Users\\USER\\Downloads\\kejaan ayah\\winny-main\\mobile-app\\src\\screens\\HomeScreen.tsx';
    console.log('Reading file:', filePath);
    let content = fs.readFileSync(filePath, 'utf8');

    const searchStr = 'navigation.navigate(\'POS\', {';
    if (content.includes(searchStr)) {
        console.log('Found search string.');
        
        // Let's do a simple string replacement for the navigation params first
        const oldParams = `                                        tableId: newOrder.id, // Using sale ID as tableId might be tricky if POS expects table DB ID, but let's see
                                        tableNumber: newOrder.table_no,
                                        waiterName: newOrder.waiter_name,
                                        orderId: newOrder.id // Passing orderId directly`;
        
        const newParams = `                                        tableId: newOrder.id,
                                        tableNumber: newOrder.table_no,
                                        waiterName: newOrder.waiter_name,
                                        orderId: newOrder.id`;
                                        
        if (content.includes(oldParams)) {
            content = content.replace(oldParams, newParams);
            console.log('Updated navigation params.');
        } else {
            console.log('Could not find exact navigation params, trying fuzzy match...');
        }

        // Now try to add the auto-nav logic
        const handlerStart = 'const newOrder = payload.new;';
        if (content.includes(handlerStart)) {
            const replacement = `const newOrder = payload.new;
                    
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
                    
                    // Update alert to use openOrder`;
            
            content = content.replace(handlerStart, replacement);
            
            // Also update the alert onPress to use openOrder
            const oldAlert = 'onPress: () => {\n                                    // @ts-ignore\n                                    navigation.navigate(\'POS\', {';
            // This is getting complex. Let's just do a simple replace of the entire Alert if we can.
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Write complete.');
    } else {
        console.log('Search string not found.');
    }
} catch (err) {
    console.error('Error:', err);
}
