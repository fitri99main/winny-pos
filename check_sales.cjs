const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const { data: sales, error } = await supabase
        .from('sales')
        .select('total_amount, status, date')
        .gte('date', thirtyDaysAgo.toISOString())
        .lte('date', today.toISOString());
        
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    let total = 0;
    let completedCount = 0;
    
    for (const s of sales) {
        const st = s.status.toLowerCase();
        if (['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture', 'ready'].includes(st)) {
            total += Number(s.total_amount || 0);
            completedCount++;
        }
    }
    
    console.log(`Found ${sales.length} sales in the last 30 days.`);
    console.log(`Completed sales: ${completedCount}`);
    console.log(`Total Sales Amount: Rp ${total.toLocaleString('id-ID')}`);
}

run();
