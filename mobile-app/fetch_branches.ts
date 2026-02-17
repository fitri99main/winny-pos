
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vgyfleusomimkivjrioy.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchBranches() {
    const { data, error } = await supabase
        .from('branches')
        .select('*');

    if (error) {
        console.error('Error fetching branches:', error);
        return;
    }

    if (data) {
        console.log('--- BRANCHES ---');
        data.forEach(b => console.log(`${b.id}: ${b.name}`));
    }

    console.log('\n--- TABLES ---');
    const { data: tables } = await supabase.from('tables').select('id, number, branch_id');

    if (tables) {
        // Count tables per branch
        const counts: Record<number, number> = {};
        tables.forEach(t => {
            const bId = t.branch_id;
            counts[bId] = (counts[bId] || 0) + 1;
        });

        console.log('--- SUMMARY ---');
        console.log('Branch ID Counts:', JSON.stringify(counts));

        // Check Branch 7 specifically
        const b7 = tables.filter(t => t.branch_id === 7);
        console.log(`Branch 7 Total: ${b7.length}`);
        if (b7.length > 0) console.log('B7 Sample:', b7[0].number);

        // Check Branch 3 (Gajah Mada?)
        const b3 = tables.filter(t => t.branch_id === 3);
        console.log(`Branch 3 Total: ${b3.length}`);
        if (b3.length > 0) console.log('B3 Sample:', b3[0].number);
    }
}

fetchBranches();
