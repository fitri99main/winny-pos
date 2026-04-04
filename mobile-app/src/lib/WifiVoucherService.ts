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
    static async getVoucherForSale(saleId: number | string, branchId: string = 'default', count: number = 1): Promise<string | null> {
        try {
            const numericSaleId = Number(saleId);
            const strBranchId = String(branchId || 'default');
            const targetCount = Math.max(1, Math.floor(Number(count) || 1));

            console.log(`[WifiVoucherService] Fetching vouchers (Mobile): saleId=${numericSaleId}, branchId=${strBranchId}, count=${targetCount}`);

            // 1. Check if this sale already has vouchers assigned
            const { data: existingVouchers, error: fetchError } = await supabase
                .from('wifi_vouchers')
                .select('code')
                .eq('sale_id', numericSaleId);

            if (fetchError) {
                console.error('[WifiVoucherService] Error checking existing vouchers:', fetchError);
            }

            if (existingVouchers && existingVouchers.length > 0) {
                console.log(`[WifiVoucherService] Found ${existingVouchers.length} existing vouchers for sale ${numericSaleId}`);
                // If the count matches or exceeds what we need, return existing
                if (existingVouchers.length >= targetCount) {
                    return existingVouchers.map(v => v.code).join(', ');
                }
            }

            const neededCount = targetCount - (existingVouchers?.length || 0);
            console.log(`[WifiVoucherService] Need ${neededCount} more vouchers.`);

            // 2. Fetch unused vouchers for specific branch
            let { data: vouchers, error } = await supabase
                .from('wifi_vouchers')
                .select('id, code')
                .eq('is_used', false)
                .eq('branch_id', strBranchId)
                .order('created_at', { ascending: true })
                .limit(neededCount);

            // 3. Fallback to 'default' branch if not enough found
            if ((!vouchers || vouchers.length < neededCount) && strBranchId !== 'default') {
                console.log(`[WifiVoucherService] Not enough in branch ${strBranchId}, trying 'default'...`);
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
                console.error('[WifiVoucherService] Error fetching unused vouchers:', error);
                return existingVouchers?.map(v => v.code).join(', ') || null;
            }

            if (!vouchers || vouchers.length === 0) {
                console.warn(`[WifiVoucherService] No unused WiFi vouchers available in pool.`);
                return existingVouchers?.map(v => v.code).join(', ') || null;
            }

            console.log(`[WifiVoucherService] Assigning ${vouchers.length} new vouchers to sale ${numericSaleId}`);

            // 4. Mark as used
            const ids = vouchers.map(v => v.id);
            const { error: updateError } = await supabase
                .from('wifi_vouchers')
                .update({
                    is_used: true,
                    used_at: new Date().toISOString(),
                    sale_id: numericSaleId
                })
                .in('id', ids);

            if (updateError) {
                console.error('[WifiVoucherService] Error marking vouchers as used:', updateError);
                return existingVouchers?.map(v => v.code).join(', ') || null;
            }

            const allCodes = [...(existingVouchers?.map(v => v.code) || []), ...vouchers.map(v => v.code)];
            const result = allCodes.join(', ');
            console.log(`[WifiVoucherService] SUCCESS. Final Total Vouchers: ${allCodes.length}. Codes: ${result}`);
            
            if (allCodes.length < targetCount) {
                console.warn(`[WifiVoucherService] WARNING: Could only provide ${allCodes.length} out of ${targetCount} requested vouchers.`);
            }

            return result;
        } catch (error) {
            console.error('[WifiVoucherService] Unexpected error:', error);
            return null;
        }
    }
}
