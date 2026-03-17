import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    try {
        console.log('--- LISTING TABLES ---');
        // We can use a trick to list tables by querying information_schema if we have enough permissions,
        // but normally anon key can't do that.
        // Let's try to query some likely table names.
        const likelyTables = ['sales', 'sale_items', 'transactions', 'orders', 'order_items', 'products', 'categories', 'branches'];
        for (const table of likelyTables) {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.log(`Table ${table}: ERROR (${error.message})`);
            } else {
                console.log(`Table ${table}: FOUND (Count: ${count})`);
            }
        }
        console.log('--- END LIST ---');
    } catch (e) {
        console.log('UNCAUGHT ERROR:', e.message);
    }
}

listTables();
