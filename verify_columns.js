import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verify() {
    console.log('Verifying sales table columns...');
    const { data, error } = await supabase.from('sales').select('paid_amount, change').limit(1);
    
    if (error) {
        console.error('VERIFICATION FAILED:', error.message);
        process.exit(1);
    } else {
        console.log('SUCCESS: paid_amount and change columns exist in sales table!');
        process.exit(0);
    }
}
verify();
