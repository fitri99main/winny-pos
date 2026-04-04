import { supabase } from './src/lib/supabase';

async function checkSettings() {
    console.log('Checking store_settings...');
    const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 1)
        .single();
    
    if (error) {
        console.error('Error fetching settings:', error);
        return;
    }
    
    console.log('Current Settings:', JSON.stringify(data, null, 2));
    
    console.log('Checking unused vouchers count...');
    const { count, error: countError } = await supabase
        .from('wifi_vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('is_used', false);
    
    if (countError) {
        console.error('Error fetching voucher count:', countError);
    } else {
        console.log('Unused Vouchers Count:', count);
    }
}

checkSettings();
