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
     * Fetches an unused WiFi voucher from the pool and marks it as used for the given sale.
     */
    static async getVoucherForSale(saleId: number, branchId: string = 'default'): Promise<string | null> {
        try {
            // 1. Check if this sale already has a voucher
            const { data: existingVoucher } = await supabase
                .from('wifi_vouchers')
                .select('code')
                .eq('sale_id', saleId)
                .maybeSingle();

            if (existingVoucher) {
                return existingVoucher.code;
            }

            // 2. Fetch one unused voucher
            const { data: voucher, error } = await supabase
                .from('wifi_vouchers')
                .select('id, code')
                .eq('is_used', false)
                .eq('branch_id', branchId)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error fetching WiFi voucher:', error);
                return null;
            }

            if (!voucher) {
                console.warn('No unused WiFi vouchers available in the pool.');
                return null;
            }

            // 3. Mark as used
            const { error: updateError } = await supabase
                .from('wifi_vouchers')
                .update({
                    is_used: true,
                    used_at: new Date().toISOString(),
                    sale_id: saleId
                })
                .eq('id', voucher.id);

            if (updateError) {
                console.error('Error marking WiFi voucher as used:', updateError);
                return null;
            }

            return voucher.code;
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
}
