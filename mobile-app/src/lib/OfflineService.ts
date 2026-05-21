import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SupabaseLib from './supabase';
var supabase = SupabaseLib.supabase;

var OFFLINE_QUEUE_KEY = 'pos_offline_sales_queue';
var FORCED_OFFLINE_KEY = 'pos_forced_offline_mode';

export var OfflineService = {
    getOfflineQueue: function() {
        return AsyncStorage.getItem(OFFLINE_QUEUE_KEY)
            .then(function(queueStr) {
                return queueStr ? JSON.parse(queueStr) : [];
            })['catch'](function(e) {
                console.error('[OfflineService] Error getting queue:', e);
                return [];
            });
    },

    getSaleByOrderNo: function(orderNo) {
        return OfflineService.getOfflineQueue()
            .then(function(queue) {
                var found = null;
                for (var i = 0; i < queue.length; i++) {
                    if (queue[i].order_no === orderNo) {
                        found = queue[i];
                        break;
                    }
                }
                return found;
            })['catch'](function(e) {
                console.error('[OfflineService] Error finding sale in queue:', e);
                return null;
            });
    },

    queueOfflineSale: function(saleData, items) {
        return OfflineService.getOfflineQueue()
            .then(function(queue) {
                var newOfflineSale = {};
                for (var key in saleData) { newOfflineSale[key] = saleData[key]; }
                newOfflineSale.id = 'off-' + Date.now();
                newOfflineSale.items = items;
                newOfflineSale.is_offline = true;
                newOfflineSale.date = new Date().toISOString();
                
                queue.push(newOfflineSale);
                return AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
            })
            .then(function() {
                return true;
            })['catch'](function(e) {
                console.error('[OfflineService] Error queuing sale:', e);
                return false;
            });
    },

    saveSale: function(saleData) {
        var queue;
        return OfflineService.getOfflineQueue()
            .then(function(q) {
                queue = q;
                return supabase.from('store_settings').select('offline_invoice_prefix, offline_invoice_last_number').eq('id', 1).single();
            })
            .then(function(settingsRes) {
                var prefix = (settingsRes.data && settingsRes.data.offline_invoice_prefix) || 'OFF-WIN-26';
                var lastNo = (settingsRes.data && settingsRes.data.offline_invoice_last_number) || 0;
                var nextNo = lastNo + (queue.length + 1);
                
                var nextNoStr = nextNo.toString();
                while (nextNoStr.length < 5) { nextNoStr = '0' + nextNoStr; }
                var order_no = prefix + '-' + nextNoStr;
                var id = 'off-' + Date.now();

                var newOfflineSale = {};
                for (var key in saleData) { newOfflineSale[key] = saleData[key]; }
                newOfflineSale.id = id;
                newOfflineSale.order_no = order_no;
                newOfflineSale.orderNo = order_no;
                newOfflineSale.is_offline = true;
                newOfflineSale.date = new Date().toISOString();
                
                queue.push(newOfflineSale);
                return AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)).then(function() {
                    return { id: id, order_no: order_no };
                });
            })['catch'](function(e) {
                console.error('[OfflineService] Error saving sale:', e);
                var fallbackNo = 'OFF-WIN-26-FALLBACK-' + Date.now();
                return { id: 'off-err-' + Date.now(), order_no: fallbackNo };
            });
    },

    removeSaleFromQueue: function(offlineId) {
        return OfflineService.getOfflineQueue()
            .then(function(queue) {
                var filtered = [];
                for (var i = 0; i < queue.length; i++) {
                    if (queue[i].id !== offlineId) {
                        filtered.push(queue[i]);
                    }
                }
                return AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
            })['catch'](function(e) {
                console.error('[OfflineService] Error removing from queue:', e);
            });
    },

    clearQueue: function() {
        return AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)['catch'](function(e) {
            console.error('[OfflineService] Error clearing queue:', e);
        });
    },

    syncQueue: function() {
        var self = this;
        var successCount = 0;
        var failedCount = 0;
        var errors = [];
        var queue = [];

        return OfflineService.getOfflineQueue()
            .then(function(q) {
                queue = q;
                var chain = Promise.resolve();
                
                var processItem = function(index) {
                    if (index >= queue.length) return;
                    var sale = queue[index];
                    
                    chain = chain.then(function() {
                        return self.checkConnectivity();
                    }).then(function(isConnected) {
                        if (!isConnected) throw new Error('Koneksi terputus saat sinkronisasi.');
                        if (sale.client_transaction_id) {
                            return supabase
                                .from('sales')
                                .select('id')
                                .eq('client_transaction_id', sale.client_transaction_id)
                                .maybeSingle()
                                .then(function(clientTxRes) {
                                    if (clientTxRes.error) throw clientTxRes.error;
                                    if (clientTxRes.data) return clientTxRes;
                                    return supabase.from('sales').select('id').eq('order_no', sale.order_no).maybeSingle();
                                });
                        }
                        return supabase.from('sales').select('id').eq('order_no', sale.order_no).maybeSingle();
                    }).then(function(existingRes) {
                        if (existingRes.error) throw new Error('Gagal verifikasi data di server: ' + existingRes.error.message);
                        
                        if (existingRes.data) return existingRes.data;
                        
                        var saleData = {
                            order_no: sale.order_no,
                            branch_id: sale.branch_id,
                            customer_name: sale.customer_name,
                            customer_id: sale.customer_id,
                            table_no: sale.table_no,
                            waiter_name: sale.waiter_name,
                            total_amount: sale.total_amount,
                            discount: sale.discount,
                            tax: sale.tax || 0,
                            service_charge: sale.service_charge || 0,
                            status: sale.status,
                            payment_method: sale.payment_method,
                            date: sale.date,
                            paid_amount: sale.paid_amount,
                            change: sale.change,
                            client_transaction_id: sale.client_transaction_id || null
                        };

                        var itemsData = (sale.items || []).map(function(item) {
                            return {
                                product_id: (typeof item.id === 'string' && item.id.indexOf('manual') === 0) ? null : item.id,
                                product_name: item.name,
                                quantity: item.quantity,
                                price: item.price,
                                cost: 0,
                                target: item.target || 'Waitress',
                                status: 'Pending',
                                is_taxed: item.is_taxed || false,
                                notes: item.notes || ''
                            };
                        });

                        return supabase.rpc('upsert_sale_with_items', {
                            p_sale_data: saleData,
                            p_items_data: itemsData,
                            p_target_sale_id: null
                        }).then(function(rpcRes) {
                            if (rpcRes.error) throw new Error('Server Error: ' + rpcRes.error.message);
                            return rpcRes.data;
                        });
                    }).then(function() {
                        return self.removeSaleFromQueue(sale.id);
                    }).then(function() {
                        successCount++;
                    })['catch'](function(err) {
                        var errMsg = err.message || 'Unknown error';
                        errors.push(sale.order_no + ': ' + errMsg);
                        failedCount++;
                        if (errMsg.indexOf('Koneksi') !== -1) return Promise.reject('STOP_SYNC');
                    });

                    return chain.then(function() {
                        return processItem(index + 1);
                    });
                };

                return processItem(0);
            })
            .then(function() {
                return { success: successCount, failed: failedCount, errors: errors };
            })['catch'](function(err) {
                if (err === 'STOP_SYNC') return { success: successCount, failed: failedCount, errors: errors };
                throw err;
            });
    },

    checkConnectivity: function() {
        return fetch('https://www.google.com', { 
            method: 'HEAD',
            cache: 'no-cache'
        }).then(function(response) {
            return response.ok;
        })['catch'](function() {
            return false;
        });
    },

    getForcedOfflineMode: function() {
        return AsyncStorage.getItem(FORCED_OFFLINE_KEY)
            .then(function(val) {
                return val === 'true';
            })['catch'](function() {
                return false;
            });
    },

    setForcedOfflineMode: function(enabled) {
        return AsyncStorage.setItem(FORCED_OFFLINE_KEY, enabled ? 'true' : 'false')['catch'](function(e) {
            console.error('[OfflineService] Error setting forced offline mode:', e);
        });
    }
};
