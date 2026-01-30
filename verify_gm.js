import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("Checking branches...");
    const { data: branches, error: branchError } = await supabase
        .from('branches')
        .select('id, name');

    if (branchError) {
        console.error("Error fetching branches:", branchError);
        return;
    }

    console.log("Branches found:", branches);

    const gmBranch = branches.find(b => b.name.toLowerCase().includes('gajah mada'));

    if (!gmBranch) {
        console.log("❌ Gajah Mada branch not found!");
        return;
    }

    console.log(`✅ Found Gajah Mada branch: ${gmBranch.name} (${gmBranch.id})`);

    console.log("Checking tables for this branch...");
    const { data: tables, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('branch_id', gmBranch.id);

    if (tableError) {
        console.error("Error fetching tables:", tableError);
        return;
    }

    console.log(`Tables found: ${tables.length}`);
    if (tables.length > 0) {
        console.log("✅ Tables exist:", tables.map(t => t.number).join(', '));
    } else {
        console.log("❌ No tables found for this branch.");
    }
}

verify();
