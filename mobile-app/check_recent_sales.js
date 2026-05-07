
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentSales() {
    console.log('Checking recent sales...');
    const { data, error } = await supabase
        .from('sales')
        .select('id, order_no, total_amount, status, payment_method, date, created_at, customer_name, table_no')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching sales:', error);
        return;
    }

    console.log('Recent Sales:');
    data.forEach(sale => {
        console.log(`[${sale.created_at}] Order: ${sale.order_no} | Total: ${sale.total_amount} | Status: ${sale.status} | Method: ${sale.payment_method} | Customer: ${sale.customer_name} | Table: ${sale.table_no}`);
    });
}

checkRecentSales();
