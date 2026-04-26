const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log('--- STORE SETTINGS ---');
    const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
    console.log(settings);

    console.log('--- BRANCHES ---');
    const { data: branches } = await supabase.from('branches').select('*');
    console.log(branches);

    console.log('--- RECENT SALES ---');
    const { data: sales } = await supabase.from('sales').select('id, order_no, branch_id, date').order('created_at', { ascending: false }).limit(5);
    console.log(sales);
}

check();
