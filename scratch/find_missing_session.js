const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findMissingSession() {
    console.log('Searching for sales by kasir2 in the last 24 hours...');
    
    // Get sales for kasir2 today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data: sales, error } = await supabase
        .from('sales')
        .select('*')
        .ilike('cashier_name', '%kasir2%')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching sales:', error);
        return;
    }

    if (!sales || sales.length === 0) {
        console.log('No sales found for kasir2 today.');
        return;
    }

    const firstSale = sales[0];
    const lastSale = sales[sales.length - 1];

    console.log(`Found ${sales.length} sales.`);
    console.log(`First Sale: ${firstSale.created_at} (${firstSale.order_no})`);
    console.log(`Last Sale: ${lastSale.created_at} (${lastSale.order_no})`);

    const totals = {
        total: 0,
        Cash: 0,
        QRIS: 0,
        Card: 0,
        Transfer: 0,
    };

    sales.forEach(s => {
        const amount = Number(s.total_amount || 0);
        totals.total += amount;
        const method = s.payment_method || 'Cash';
        totals[method] = (totals[method] || 0) + amount;
    });

    console.log('Totals Calculated:', totals);
    
    // Check if session_id is present in sales (unlikely but let's check keys)
    console.log('Sample sale keys:', Object.keys(firstSale));

    console.log('\n--- PROPOSED RECOVERY DATA ---');
    console.log(`Branch ID: ${firstSale.branch_id}`);
    console.log(`Opened At: ${firstSale.created_at} (Estimated)`);
    console.log(`Closed At: ${lastSale.created_at} (Estimated)`);
    console.log(`Total Sales: ${totals.total}`);
    console.log(`Cash Sales: ${totals.Cash}`);
}

findMissingSession();
