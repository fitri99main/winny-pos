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
                // If we need more, we continue to fetch additional vouchers (handle below)
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

    /**
     * Bulk import voucher codes into the pool.
     */
    static async importVouchers(codes: string[], branchId: string = 'default'): Promise<number> {
        const vouchers = codes.map(code => ({
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
        const { count: total, error: totalError } = await supabase
            .from('wifi_vouchers')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId);

        const { count: used, error: usedError } = await supabase
            .from('wifi_vouchers')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .eq('is_used', true);

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
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (isUsed !== undefined) {
            query = query.eq('is_used', isUsed);
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
     */
    static async deleteUnusedVouchers(branchId: string = 'default'): Promise<void> {
        const { error } = await supabase
            .from('wifi_vouchers')
            .delete()
            .eq('branch_id', branchId)
            .eq('is_used', false);

        if (error) {
            console.error('Error deleting unused vouchers:', error);
            throw error;
        }
    }
}
