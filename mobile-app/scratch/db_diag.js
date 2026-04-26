const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- DATABASE DIAGNOSIS ---');
    
    // 1. Check store_settings
    const { data: settings, error: sError } = await supabase.from('store_settings').select('*');
    if (sError) console.error('Error store_settings:', sError.message);
    else console.log('Store Settings Count:', settings.length, 'Records:', settings.map(s => ({ id: s.id, name: s.store_name, logo: !!s.receipt_logo_url })));

    // 2. Check branches
    const { data: branches, error: bError } = await supabase.from('branches').select('id, name, address, phone');
    if (bError) console.error('Error branches:', bError.message);
    else console.log('Branches Count:', branches.length, 'Data:', branches);

    process.exit(0);
}

diagnose();
