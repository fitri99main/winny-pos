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

            console.log(`[WifiVoucherService] Fetching vouchers: saleId=${numericSaleId}, branchId=${strBranchId}, count=${targetCount}`);

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
                // If we already have enough (or more), return them
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
                console.warn(`[WifiVoucherService] WARNING: Could only provide ${allCodes.length} out of ${targetCount} requested vouchers for Sale #${numericSaleId}.`);
            }

            return result;
        } catch (error) {
            console.error('[WifiVoucherService] Unexpected error while fetching vouchers:', error);
            return null;
        }
    }

    /**
     * Bulk import voucher codes into the pool.
     * Deduplicates codes before inserting.
     */
    static async importVouchers(codes: string[], branchId: string = 'default'): Promise<number> {
        // Essential: Deduplicate codes at the application level to avoid Postgres "ON CONFLICT" errors
        const uniqueCodes = Array.from(new Set(codes.map(c => c.trim()).filter(c => c.length > 0)));
        
        if (uniqueCodes.length === 0) return 0;

        const vouchers = uniqueCodes.map(code => ({
            code,
            branch_id: branchId,
            is_used: false
        }));

        const { data, error } = await supabase
            .from('wifi_vouchers')
            .upsert(vouchers, { onConflict: 'code' })
            .select();

        if (error) {
            console.error('Error importing WiFi vouchers:', error);
            throw error;
        }

        return data?.length || 0;
    }

    /**
     * Get statistics about vouchers
     */
    static async getCounts(branchId: string = 'default'): Promise<{ total: number; used: number; available: number }> {
        let totalQuery = supabase.from('wifi_vouchers').select('*', { count: 'exact', head: true });
        let usedQuery = supabase.from('wifi_vouchers').select('*', { count: 'exact', head: true }).eq('is_used', true);

        if (branchId !== 'default') {
            totalQuery = totalQuery.or(`branch_id.eq.${branchId},branch_id.eq.default`);
            usedQuery = usedQuery.or(`branch_id.eq.${branchId},branch_id.eq.default`);
        } else {
            totalQuery = totalQuery.eq('branch_id', 'default');
            usedQuery = usedQuery.eq('branch_id', 'default');
        }

        const [{ count: total, error: totalError }, { count: used, error: usedError }] = await Promise.all([
            totalQuery,
            usedQuery
        ]);

        if (totalError || usedError) {
            console.error('Error fetching voucher counts:', totalError || usedError);
            return { total: 0, used: 0, available: 0 };
        }

        return {
            total: total || 0,
            used: used || 0,
            available: (total || 0) - (used || 0)
        };
    }

    /**
     * List vouchers with pagination and filters
     */
    static async getVouchers(params: {
        page?: number;
        pageSize?: number;
        branchId?: string;
        isUsed?: boolean;
        search?: string;
    }): Promise<{ data: WifiVoucher[]; count: number }> {
        const { page = 1, pageSize = 10, branchId = 'default', isUsed, search } = params;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('wifi_vouchers')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (isUsed !== undefined) {
            query = query.eq('is_used', isUsed);
        }

        if (branchId && branchId !== 'default') {
            query = query.or(`branch_id.eq.${branchId},branch_id.eq.default`);
        } else if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        if (search) {
            query = query.ilike('code', `%${search}%`);
        }

        const { data, count, error } = await query;

        if (error) {
            console.error('Error listing vouchers:', error);
            throw error;
        }

        return {
            data: data || [],
            count: count || 0
        };
    }

    /**
     * Update a voucher
     */
    static async updateVoucher(id: number, updates: Partial<WifiVoucher>): Promise<void> {
        const { error } = await supabase
            .from('wifi_vouchers')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Error updating voucher:', error);
            throw error;
        }
    }

    /**
     * Delete a voucher
     */
    static async deleteVoucher(id: number): Promise<void> {
        const { error } = await supabase
            .from('wifi_vouchers')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting voucher:', error);
            throw error;
        }
    }

    /**
     * Delete all unused vouchers for a branch
     * Returns the number of deleted vouchers
     */
    static async deleteUnusedVouchers(branchId: string = 'default'): Promise<number> {
        const { data, error } = await supabase
            .from('wifi_vouchers')
            .delete()
            .eq('branch_id', branchId)
            .eq('is_used', false)
            .select();

        if (error) {
            console.error('Error deleting unused vouchers:', error);
            throw error;
        }

        return data?.length || 0;
    }

    /**
     * Delete all used vouchers for a branch
     * Returns the number of deleted vouchers
     */
    static async deleteUsedVouchers(branchId: string = 'default'): Promise<number> {
        const { data, error } = await supabase
            .from('wifi_vouchers')
            .delete()
            .eq('branch_id', branchId)
            .eq('is_used', true)
            .select();

        if (error) {
            console.error('Error deleting used vouchers:', error);
            throw error;
        }

        return data?.length || 0;
    }
}
