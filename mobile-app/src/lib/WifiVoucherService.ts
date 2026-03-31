import { supabase } from './supabase';

export interface WifiVoucher {
    id: number;
    code: string;
    is_used: boolean;
    used_at: string | null;
    sale_id: number | null;
    branch_id: string;
}

export class WifiVoucherService {
    /**
     * Fetches one or more unused WiFi vouchers from the pool and marks them as used for the given sale.
     * Returns a comma-separated string of codes.
     */
    static async getVoucherForSale(saleId: number, branchId: string = 'default', count: number = 1): Promise<string | null> {
        try {
            // 1. Check if this sale already has vouchers assigned
            const { data: existingVouchers } = await supabase
                .from('wifi_vouchers')
                .select('code')
                .eq('sale_id', saleId);

            if (existingVouchers && existingVouchers.length > 0) {
                // If the count matches or exceeds what we need, return existing
                if (existingVouchers.length >= count) {
                    return existingVouchers.map(v => v.code).join(', ');
                }
                // If we need more, we continue to fetch additional vouchers
            }

            const neededCount = count - (existingVouchers?.length || 0);
            if (neededCount <= 0) return existingVouchers?.map(v => v.code).join(', ') || null;

            // 2. Fetch unused vouchers for specific branch
            let { data: vouchers, error } = await supabase
                .from('wifi_vouchers')
                .select('id, code')
                .eq('is_used', false)
                .eq('branch_id', branchId)
                .order('created_at', { ascending: true })
                .limit(neededCount);

            // 3. Fallback to 'default' branch if not enough found
            if ((!vouchers || vouchers.length < neededCount) && branchId !== 'default') {
                console.log(`[WifiVoucherService] Not enough vouchers for branch ${branchId}, trying 'default'...`);
                const remainingNeeded = neededCount - (vouchers?.length || 0);
                const { data: defaultVouchers } = await supabase
                    .from('wifi_vouchers')
                    .select('id, code')
                    .eq('is_used', false)
                    .eq('branch_id', 'default')
                    .order('created_at', { ascending: true })
                    .limit(remainingNeeded);
                
                if (defaultVouchers) {
                    vouchers = [...(vouchers || []), ...defaultVouchers];
                }
            }

            if (error) {
                console.error('Error fetching WiFi vouchers:', error);
                return existingVouchers?.map(v => v.code).join(', ') || null;
            }

            if (!vouchers || vouchers.length === 0) {
                console.warn(`No unused WiFi vouchers available in pool.`);
                return existingVouchers?.map(v => v.code).join(', ') || null;
            }

            // 4. Mark as used
            const ids = vouchers.map(v => v.id);
            const { error: updateError } = await supabase
                .from('wifi_vouchers')
                .update({
                    is_used: true,
                    used_at: new Date().toISOString(),
                    sale_id: saleId
                })
                .in('id', ids);

            if (updateError) {
                console.error('Error marking WiFi vouchers as used:', updateError);
                return existingVouchers?.map(v => v.code).join(', ') || null;
            }

            const allCodes = [...(existingVouchers?.map(v => v.code) || []), ...vouchers.map(v => v.code)];
            return allCodes.join(', ');
        } catch (error) {
            console.error('WifiVoucherService Error:', error);
            return null;
        }
    }
}
