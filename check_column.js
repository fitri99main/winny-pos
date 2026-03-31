import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('employees').select('system_role').limit(1);
    if (error) {
        console.error('Column system_role might be missing:', error.message);
        process.exit(1);
    } else {
        console.log('Column system_role exists!');
        process.exit(0);
    }
}
check();
