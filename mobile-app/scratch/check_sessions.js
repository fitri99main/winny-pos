const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log('--- ALL OPEN SESSIONS ---');
    const { data: sessions, error } = await supabase
        .from('cashier_sessions')
        .select('id, user_id, branch_id, status, opened_at')
        .eq('status', 'Open');
    
    if (error) console.error(error);
    console.log(sessions);
}

check();
