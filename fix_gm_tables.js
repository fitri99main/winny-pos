import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log("Finding Gajah Mada branch...");
    const { data: branches, error: branchError } = await supabase
        .from('branches')
        .select('id, name');

    if (branchError) {
        console.error("Error fetching branches:", branchError);
        return;
    }

    const gmBranch = branches.find(b => b.name.toLowerCase().includes('gajah mada'));

    if (!gmBranch) {
        console.error("❌ Gajah Mada branch not found! Cannot insert tables.");
        return;
    }

    console.log(`✅ Targeted Branch: ${gmBranch.name} (ID: ${gmBranch.id})`);

    // Check if tables already exist (double check)
    const { count, error: countError } = await supabase
        .from('tables')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', gmBranch.id);

    if (countError) {
        console.error("Error checking count:", countError);
        return;
    }

    if (count > 0) {
        console.log(`⚠️ Branch already has ${count} tables. Skipping insert.`);
        return;
    }

    console.log("Inserting tables...");
    const { data, error: insertError } = await supabase
        .from('tables')
        .insert([
            { number: 'GM-01', capacity: 4, branch_id: gmBranch.id, status: 'Empty' },
            { number: 'GM-02', capacity: 2, branch_id: gmBranch.id, status: 'Empty' },
            { number: 'GM-03', capacity: 4, branch_id: gmBranch.id, status: 'Empty' },
            { number: 'GM-04', capacity: 6, branch_id: gmBranch.id, status: 'Empty' },
            { number: 'GM-05', capacity: 4, branch_id: gmBranch.id, status: 'Empty' }
        ])
        .select();

    if (insertError) {
        console.error("❌ Error inserting tables:", insertError);
    } else {
        console.log("✅ Successfully inserted tables:", data);
    }
}

fix();
