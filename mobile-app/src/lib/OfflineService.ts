import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const OFFLINE_QUEUE_KEY = 'pos_offline_sales_queue';
const FORCED_OFFLINE_KEY = 'pos_forced_offline_mode';

export interface OfflineSale {
    id: string; // Temporary local ID
    order_no: string;
    branch_id: number;
    customer_name: string;
    customer_id: number | null;
    table_no: string;
    waiter_name: string;
    total_amount: number;
    discount: number;
    tax: number;
    service_charge: number;
    payment_method: string;
    status: string;
    date: string;
    items: any[];
    is_offline: boolean;
    paid_amount?: number;
    change?: number;
}

export const OfflineService = {
    /**
     * Get all queued offline sales
     */
    getOfflineQueue: async (): Promise<OfflineSale[]> => {
        try {
            const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
            return queueStr ? JSON.parse(queueStr) : [];
        } catch (e) {
            console.error('[OfflineService] Error getting queue:', e);
            return [];
        }
    },

    /**
     * Get a specific offline sale by order_no
     */
    getSaleByOrderNo: async (orderNo: string): Promise<OfflineSale | null> => {
        try {
            const queue = await OfflineService.getOfflineQueue();
            return queue.find(s => s.order_no === orderNo) || null;
        } catch (e) {
            console.error('[OfflineService] Error finding sale in queue:', e);
            return null;
        }
    },

    /**
     * Add a sale to the offline queue
     */
    queueOfflineSale: async (saleData: any, items: any[]): Promise<boolean> => {
        try {
            const queue = await OfflineService.getOfflineQueue();
            const newOfflineSale: OfflineSale = {
                ...saleData,
                id: `off-${Date.now()}`,
                items,
                is_offline: true,
                date: new Date().toISOString()
            };
            
            queue.push(newOfflineSale);
            await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
            console.log('[OfflineService] Sale queued successfully:', newOfflineSale.order_no);
            return true;
        } catch (e) {
            console.error('[OfflineService] Error queuing sale:', e);
            return false;
        }
    },

    /**
     * Remove a sale from the queue by its temporary local ID
     */
    removeSaleFromQueue: async (offlineId: string): Promise<void> => {
        try {
            const queue = await OfflineService.getOfflineQueue();
            const filtered = queue.filter(s => s.id !== offlineId);
            await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
        } catch (e) {
            console.error('[OfflineService] Error removing from queue:', e);
        }
    },

    /**
     * Clear the entire offline queue
     */
    clearQueue: async (): Promise<void> => {
        try {
            await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
        } catch (e) {
            console.error('[OfflineService] Error clearing queue:', e);
        }
    },

    /**
     * Sync the entire queue to Supabase
     */
    syncQueue: async (): Promise<{ success: number; failed: number }> => {
        const queue = await OfflineService.getOfflineQueue();
        let successCount = 0;
        let failedCount = 0;

        for (const sale of queue) {
            try {
                // [IDEMPOTENCY CHECK] Check if Order No already exists
                const { data: existingSale } = await supabase
                    .from('sales')
                    .select('id')
                    .eq('order_no', sale.order_no)
                    .maybeSingle();

                let newSale;
                if (existingSale) {
                    console.log('[OfflineService] Order already exists, skipping insert:', sale.order_no);
                    newSale = existingSale;
                } else {
                    // 1. Insert Sale
                    const { data: insertedSale, error: saleError } = await supabase
                        .from('sales')
                        .insert([{
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
                            change: sale.change
                        }])
                        .select()
                        .single();

                    if (saleError) throw saleError;
                    newSale = insertedSale;
                }

                // 2. Insert Items - Map to correct schema columns
                const cleanedItems = sale.items.map(item => ({
                    sale_id: newSale.id,
                    product_id: typeof item.id === 'string' && item.id.startsWith('manual') ? null : item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    cost: 0,
                    target: item.target || 'Waitress',
                    status: 'Pending',
                    is_taxed: item.is_taxed || false
                }));

                const { error: itemsError } = await supabase.from('sale_items').insert(cleanedItems);
                if (itemsError) throw itemsError;

                // 3. Remove from local queue if successful
                await OfflineService.removeSaleFromQueue(sale.id);
                successCount++;
            } catch (e) {
                console.error(`[OfflineService] Sync failed for ${sale.order_no}:`, e);
                failedCount++;
            }
        }

        return { success: successCount, failed: failedCount };
    },

    /**
     * Check if the device has internet access
     */
    checkConnectivity: async (): Promise<boolean> => {
        try {
            // Simple fetch to a reliable endpoint
            const response = await fetch('https://www.google.com', { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    },

    /**
     * Get the current "Forced Offline" mode setting
     */
    getForcedOfflineMode: async (): Promise<boolean> => {
        try {
            const val = await AsyncStorage.getItem(FORCED_OFFLINE_KEY);
            return val === 'true';
        } catch (e) {
            return false;
        }
    },

    /**
     * Set the "Forced Offline" mode setting
     */
    setForcedOfflineMode: async (enabled: boolean): Promise<void> => {
        try {
            await AsyncStorage.setItem(FORCED_OFFLINE_KEY, enabled ? 'true' : 'false');
        } catch (e) {
            console.error('[OfflineService] Error setting forced offline mode:', e);
        }
    }
};
