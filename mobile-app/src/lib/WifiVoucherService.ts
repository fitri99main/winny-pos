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
        var strBranchId = String(branchId || 'default');
        var targetCount = Math.max(1, Math.floor(Number(count) || 1));
        var existingVouchers = [];
        var vouchers = [];

        // 1. Check if this sale already has vouchers assigned
        return supabase
            .from('wifi_vouchers')
            .select('code')
            .eq('sale_id', numericSaleId)
            .then(function(existingRes) {
                existingVouchers = existingRes.data || [];
                
                if (existingVouchers.length >= targetCount) {
                    var codes = [];
                    for (var i = 0; i < existingVouchers.length; i++) {
                        codes.push(existingVouchers[i].code);
                    }
                    return codes.join(', ');
                }

                var currentExistingCount = existingVouchers.length;
                var neededCount = targetCount - currentExistingCount;

                // 2. Fetch unused vouchers for specific branch
                return supabase
                    .from('wifi_vouchers')
                    .select('id, code')
                    .eq('is_used', false)
                    .eq('branch_id', strBranchId)
                    .order('created_at', { ascending: true })
                    .limit(neededCount)
                    .then(function(res) {
                        vouchers = res.data || [];

                        // 3. Fallback to 'default' branch if not enough found
                        if (vouchers.length < neededCount && strBranchId !== 'default') {
                            var remainingNeeded = neededCount - vouchers.length;
                            return supabase
                                .from('wifi_vouchers')
                                .select('id, code')
                                .eq('is_used', false)
                                .eq('branch_id', 'default')
                                .order('created_at', { ascending: true })
                                .limit(remainingNeeded)
                                .then(function(defRes) {
                                    if (defRes.data) {
                                        for (var j = 0; j < defRes.data.length; j++) {
                                            vouchers.push(defRes.data[j]);
                                        }
                                    }
                                    return vouchers;
                                });
                        }
                        return vouchers;
                    });
            })
            .then(function(finalVouchers) {
                if (!finalVouchers || finalVouchers.length === 0) {
                    if (existingVouchers.length > 0) {
                        var codesFallback = [];
                        for (var k = 0; k < existingVouchers.length; k++) {
                            codesFallback.push(existingVouchers[k].code);
                        }
                        return codesFallback.join(', ');
                    }
                    return null;
                }

                // 4. Mark as used
                var ids = [];
                for (var m = 0; m < finalVouchers.length; m++) {
                    ids.push(finalVouchers[m].id);
                }

                return supabase
                    .from('wifi_vouchers')
                    .update({
                        is_used: true,
                        used_at: new Date().toISOString(),
                        sale_id: numericSaleId
                    })
                    .in('id', ids)
                    .then(function(updateRes) {
                        if (updateRes.error) {
                            if (existingVouchers.length > 0) {
                                var codesError = [];
                                for (var n = 0; n < existingVouchers.length; n++) {
                                    codesError.push(existingVouchers[n].code);
                                }
                                return codesError.join(', ');
                            }
                            return null;
                        }

                        var allCodes = [];
                        for (var p = 0; p < existingVouchers.length; p++) {
                            allCodes.push(existingVouchers[p].code);
                        }
                        for (var q = 0; q < finalVouchers.length; q++) {
                            allCodes.push(finalVouchers[q].code);
                        }

                        return allCodes.join(', ');
                    });
            })['catch'](function(error) {
                console.error('[WifiVoucherService] Unexpected error:', error);
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
