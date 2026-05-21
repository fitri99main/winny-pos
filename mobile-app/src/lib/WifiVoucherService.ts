import * as SupabaseLib from './supabase';
var supabase = SupabaseLib.supabase;

export var WifiVoucherService = {
    /**
     * Fetches one or more unused WiFi vouchers from the pool and marks them as used for the given sale.
     * Returns a comma-separated string of codes.
     */
    getVoucherForSale: function(saleId, branchId, count) {
        var isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(saleId));
        var numericSaleId = isUuid ? saleId : Number(saleId);

        // Hanya lakukan SELECT (karena Trigger Database di server sudah otomatis memasangkannya secara atomik)
        return supabase
            .from('wifi_vouchers')
            .select('code')
            .eq('sale_id', numericSaleId)
            .then(function(res) {
                var items = res.data || [];
                if (items.length > 0) {
                    var codes = [];
                    for (var i = 0; i < items.length; i++) {
                        codes.push(items[i].code);
                    }
                    return codes.join(', ');
                }
                return null;
            })['catch'](function(error) {
                console.error('[WifiVoucherService] Query error:', error);
                return null;
            });
    },
    getCounts: function(branchId) {
        var strBranchId = String(branchId || 'default');
        return supabase
            .from('wifi_vouchers')
            .select('is_used', { count: 'exact' })
            .or('branch_id.eq.' + strBranchId + ',branch_id.eq.default')
            .then(function(res) {
                var all = res.data || [];
                var total = all.length;
                var used = 0;
                for (var i = 0; i < all.length; i++) {
                    if (all[i].is_used) used++;
                }
                return {
                    total: total,
                    used: used,
                    available: total - used
                };
            })['catch'](function(e) {
                console.error('[WifiVoucherService] Error counting:', e);
                return { total: 0, used: 0, available: 0 };
            });
    }
};
