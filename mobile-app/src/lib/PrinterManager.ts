import { BleManager, Device } from 'react-native-ble-plx';
import { BLEPrinter, IBLEPrinter, COMMANDS } from '@haroldtran/react-native-thermal-printer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { Buffer } from 'buffer';
import Constants from 'expo-constants';
import { resolveOrderTypeDisplay } from './orderTypeUtils';
import { supabase } from './supabase';

const PRINTER_STORAGE_KEY = '@selected_printer_address';
const KITCHEN_PRINTER_KEY = '@kitchen_printer_address';
const BAR_PRINTER_KEY = '@bar_printer_address';
const REPORT_PRINTER_KEY = '@report_printer_address';

export type PrinterType = 'receipt' | 'kitchen' | 'bar' | 'report';

const isExpoGo = Constants.appOwnership === 'expo';

export class PrinterManager {
    private static bleManager = (isExpoGo || Platform.OS === 'web') ? null : new BleManager();
    private static isScanning = false;
    private static isInitialized = false;
    private static connectionStatus: Record<string, 'connected' | 'disconnected' | 'connecting'> = {};
    private static logoCache: Record<string, string> = {};
    private static currentActiveMac: string | null = null;
    
    static getConnectionStatus(mac: string): 'connected' | 'disconnected' | 'connecting' {
        if (!mac) return 'disconnected';
        const cleanMac = mac.toUpperCase();
        return this.connectionStatus[cleanMac] || 'disconnected';
    }

    static async getBase64Image(url: string): Promise<string | null> {
        if (this.logoCache[url]) return this.logoCache[url];
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    const base64 = base64data.split(',')[1];
                    this.logoCache[url] = base64;
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error('[PrinterManager] getBase64Image error for URL:', url, e);
            return null;
        }
    }

    static async requestPermissions() {
        if (Platform.OS === 'android') {
            const apiLevel = Number(Platform.Version);
            if (apiLevel >= 31) {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);
                return (
                    granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                    granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
                    granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
                );
            } else {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }
        }
        return true;
    }

    static async initPrinter() {
        if (!isExpoGo && Platform.OS !== 'web') {
            if (this.isInitialized) return;
            try {
                const hasPermission = await this.requestPermissions();
                if (!hasPermission) return;
                await BLEPrinter.init();
                this.isInitialized = true;
            } catch (e) {
                console.error('Printer init error:', e);
            }
        }
    }

    static async getPairedPrinters(): Promise<IBLEPrinter[]> {
        if (isExpoGo || Platform.OS === 'web') return [];
        await this.initPrinter();
        try {
            return await BLEPrinter.getDeviceList();
        } catch (e) {
            console.error('Error fetching paired devices:', e);
            return [];
        }
    }

    static async scanPrinters(onDeviceFound: (device: Device) => void) {
        if (isExpoGo) throw new Error('Bluetooth scan tidak tersedia di Expo Go.');
        await this.initPrinter();
        if (!this.bleManager) throw new Error('Bluetooth Manager tidak terinisialisasi.');
        const state = await this.bleManager.state();
        if (state !== 'PoweredOn') throw new Error('Bluetooth Anda sedang mati.');
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) throw new Error('Izin Bluetooth ditolak.');

        if (this.isScanning) this.bleManager.stopDeviceScan();
        this.isScanning = true;
        this.bleManager.startDeviceScan(null, null, (error, device) => {
            if (error) return;
            if (device && (device.name || device.localName)) onDeviceFound(device);
        });
        setTimeout(() => {
            if (this.isScanning) {
                this.bleManager?.stopDeviceScan();
                this.isScanning = false;
            }
        }, 15000);
    }

    static async saveSelectedPrinter(macAddress: string, type: PrinterType = 'receipt') {
        const key = type === 'kitchen' ? KITCHEN_PRINTER_KEY : 
                    (type === 'bar' ? BAR_PRINTER_KEY : 
                    (type === 'report' ? REPORT_PRINTER_KEY : PRINTER_STORAGE_KEY));
        await AsyncStorage.setItem(key, macAddress);
    }

    static async forgetSelectedPrinter(type: PrinterType = 'receipt') {
        const key = type === 'kitchen' ? KITCHEN_PRINTER_KEY : 
                    (type === 'bar' ? BAR_PRINTER_KEY : 
                    (type === 'report' ? REPORT_PRINTER_KEY : PRINTER_STORAGE_KEY));
        await AsyncStorage.removeItem(key);
    }

    static async getSelectedPrinter(type: PrinterType = 'receipt') {
        const key = type === 'kitchen' ? KITCHEN_PRINTER_KEY : 
                    (type === 'bar' ? BAR_PRINTER_KEY : 
                    (type === 'report' ? REPORT_PRINTER_KEY : PRINTER_STORAGE_KEY));
        return await AsyncStorage.getItem(key);
    }

    static async ensureConnection(macAddress: string): Promise<boolean> {
        if (isExpoGo || Platform.OS === 'web') return true;
        const mac = macAddress.toUpperCase();
        
        if (this.currentActiveMac === mac) {
            console.log(`[PrinterManager] Already connected to ${mac}`);
            // Small safety delay for existing connection
            await new Promise(r => setTimeout(r, 200));
            return true;
        }

        try {
            await this.initPrinter();
            console.log(`[PrinterManager] Connecting to ${mac}...`);
            this.connectionStatus[mac] = 'connecting';
            await BLEPrinter.connectPrinter(mac);
            this.connectionStatus[mac] = 'connected';
            this.currentActiveMac = mac;
            // Robust delay after new connection
            await new Promise(r => setTimeout(r, 1500));
            return true;
        } catch (e) {
            console.error(`[PrinterManager] Connection failed to ${mac}:`, e);
            this.connectionStatus[mac] = 'disconnected';
            this.currentActiveMac = null;
            return false;
        }
    }

    static async checkConnection(macAddress: string): Promise<boolean> {
        return this.ensureConnection(macAddress);
    }

    static padColumns(left: string, right: string, width: number = 32, isPreview: boolean = false): string {
        const leftStr = left || '';
        const rightStr = right || '';
        
        if (isPreview) {
            return `${leftStr}[R]${rightStr}`;
        }

        const spaceCount = width - (leftStr.length + rightStr.length);
        if (spaceCount <= 0) return leftStr + ' ' + rightStr;
        return leftStr + ' '.repeat(spaceCount) + rightStr;
    }

    static formatReceipt(orderData: any, isPreview: boolean = false): string {
        const paperWidth = orderData.receipt_paper_width === '80mm' ? 42 : 32;
        const CENTER = isPreview ? '[C]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = isPreview ? '[L]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = isPreview ? '<b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = isPreview ? '</b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = isPreview ? '[BIG]' : COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        const DOUBLE_OFF = isPreview ? '[/BIG]' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        const LINE = '-'.repeat(paperWidth) + '\n';
        
        // Reset removed from here as it's now sent prior to strings in the main print functions
        let text = isPreview ? '' : ''; 
        if (orderData.show_logo) text += CENTER + '[LOGO]\n';

        const shopName = orderData.receipt_header || orderData.shop_name || 'WINNY COFFEE PNK';
        // Using TXT_4SQUARE (Double Width + Double Height) to match the "Old Account" large font look
        text += CENTER + BOLD_ON + (isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_4SQUARE) + shopName.toUpperCase() + DOUBLE_OFF + BOLD_OFF + '\n';
        if (orderData.shop_address) text += CENTER + orderData.shop_address + '\n';
        if (orderData.shop_phone) text += CENTER + `Telp: ${orderData.shop_phone}` + '\n';
        text += LINE;
        text += LEFT + `No: ${orderData.order_no || orderData.orderNo || '-'}\n`;
        if (orderData.show_date !== false) {
            const date = new Date(orderData.created_at || orderData.date || Date.now());
            const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '.');
            text += `Waktu: ${dateStr}, ${timeStr}\n`;
        }
        
        // Resolve Order Type & Table
        const tableRef = orderData.table_no || orderData.tableNo || orderData.table || '-';
        const info = resolveOrderTypeDisplay(tableRef, orderData);
        
        // Match Photo Label: "Order: "
        const orderLabel = info.orderTypeLabel || (info.orderType === 'take_away' ? 'TAKE AWAY' : 'DINE IN');
        text += `Order: ${orderLabel}\n`;
        
        // Force Table Number display for customer receipt if it exists and not take away
        if (tableRef && tableRef !== '-' && info.orderType !== 'take_away') {
            text += BOLD_ON + `Meja: ${tableRef}` + BOLD_OFF + '\n';
        } else if (info.tableValue && info.tableValue !== '-') {
            text += BOLD_ON + `Meja: ${info.tableValue}` + BOLD_OFF + '\n';
        }

        if (orderData.show_cashier_name !== false && (orderData.cashier_name || orderData.waiter_name)) {
            text += `Kasir: ${orderData.cashier_name || orderData.waiter_name}\n`;
        }
        text += LINE;

        let hasTaxedItems = false;
        (orderData.items || []).forEach((item: any) => {
            const isTaxed = item.is_taxed !== false;
            if (isTaxed) hasTaxedItems = true;
            const label = `${item.quantity}x ${item.product_name || item.name}${isTaxed ? '*' : ''}`;
            const price = (item.price * item.quantity).toLocaleString('id-ID');
            text += this.padColumns(label, price, paperWidth, isPreview) + '\n';
            if (item.notes) text += `  (${item.notes})\n`;
        });
        if (hasTaxedItems) {
            text += LEFT + '  (*) = Produk Kena Pajak\n';
        }
        text += LINE;

        const total = Number(orderData.total_amount || orderData.total || 0);
        const discount = Number(orderData.discount || 0);
        const tax = Number(orderData.tax || 0);
        const service = Number(orderData.service_charge || 0);
        const subtotal = total + discount - tax - service;

        text += this.padColumns('Subtotal', subtotal.toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        if (discount > 0) {
            text += this.padColumns('Diskon', '-' + discount.toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        }
        if (service > 0) {
            text += this.padColumns('Layanan', service.toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        }
        if (tax > 0) {
            text += this.padColumns('Pajak', tax.toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        }

        // Secure TOTAL formatting for 58mm
        if (paperWidth <= 32) {
            text += BOLD_ON + this.padColumns('TOTAL', total.toLocaleString('id-ID'), paperWidth, isPreview) + BOLD_OFF + '\n';
        } else {
            text += BOLD_ON + DOUBLE_ON + this.padColumns('TOTAL', total.toLocaleString('id-ID'), paperWidth, isPreview) + DOUBLE_OFF + BOLD_OFF + '\n';
        }
        text += LINE;

        let paidAmount = Number(orderData.paid_amount != null ? orderData.paid_amount : total);
        let change = Number(orderData.change != null ? orderData.change : 0);
        
        if (isNaN(paidAmount)) paidAmount = 0;
        if (isNaN(change)) change = 0;
        
        text += this.padColumns('Bayar', paidAmount.toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        text += this.padColumns('Kembali', change.toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        text += this.padColumns('Metode Bayar', orderData.payment_method || 'Tunai', paperWidth, isPreview) + '\n';
        text += LINE;

        // [WIFI VOUCHER LOGIC - Physical Photo Mirror]
        if (orderData.enable_wifi_vouchers && orderData.wifi_voucher) {
            text += CENTER + "Gunakan Kode dibawah, atau ketik\n";
            text += CENTER + "kan WINNY.NET dibrowser Anda\n";
            text += BOLD_ON + DOUBLE_ON + orderData.wifi_voucher + DOUBLE_OFF + BOLD_OFF + '\n';
            text += LINE;
        }

        // [FOOTER - Mirroring Web Settings]
        const footer = orderData.receipt_footer || "Terima Kasih Atas Kunjungannya..";
        text += CENTER + footer + '\n';
        text += CENTER + shopName.toUpperCase() + '\n';
        
        text += '\n';
        return text;
    }

    static formatKitchenTicket(items: any[], orderData: any, targetName: string): string {
        const CENTER = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        const DOUBLE_OFF = COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        const LINE = '--------------------------------\n';

        const orderNo = orderData.order_no || orderData.orderNo || '-';
        const tableNo = orderData.table_no || orderData.tableNo || '';
        const customer = orderData.customer_name || orderData.customerName || '';

        // Kitchen header using DOUBLE_ON (Double Height + Double Width) for maximum visibility
        let text = CENTER + BOLD_ON + DOUBLE_ON + `PESANAN ${targetName.toUpperCase()}` + DOUBLE_OFF + BOLD_OFF + '\n';
        text += `No: ${orderNo}\n`;
        if (tableNo && tableNo !== '-') text += BOLD_ON + DOUBLE_ON + `MEJA: ${tableNo}` + DOUBLE_OFF + BOLD_OFF + '\n';
        if (customer && customer !== 'Guest') text += `Pelanggan: ${customer}\n`;
        text += LINE + LEFT;

        items.forEach((item: any) => {
            const name = item.product_name || item.name || 'Produk';
            // Using BOLD instead of DOUBLE_ON (4SQUARE) to prevent overflow
            text += BOLD_ON + `${item.quantity}x ${name}` + BOLD_OFF + '\n';
            if (item.notes) text += `  * CATATAN: ${item.notes}\n`;
        });

        text += LINE + CENTER + `Waktu: ${new Date().toLocaleString('id-ID')}\n`;
        text += '\n';
        return text;
    }

    static async printOrderReceipt(orderData: any) {
        let macAddress = await this.getSelectedPrinter('receipt');
        if (!macAddress) {
            console.warn('[PrinterManager] Receipt printer mac is null');
            return false;
        }
        
        try {
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            
            // [SAFETY HARVEST] if data is missing, fetch directly from SQL
            if (!orderData.receipt_logo_url || !orderData.receipt_header) {
                try {
                    const { data: safetyData } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
                    if (safetyData) {
                        orderData.receipt_logo_url = orderData.receipt_logo_url || safetyData.receipt_logo_url;
                        orderData.receipt_header = orderData.receipt_header || safetyData.receipt_header || safetyData.store_name;
                        orderData.receipt_paper_width = orderData.receipt_paper_width || safetyData.receipt_paper_width;
                        orderData.show_logo = orderData.show_logo ?? safetyData.show_logo;
                        orderData.enable_auto_cut = orderData.enable_auto_cut ?? safetyData.enable_auto_cut;
                    }
                } catch (err) {
                    console.warn('[PrinterManager] Safety harvest failed', err);
                }
            }

            // Force a fresh connection/reset for every print to prevent "reverting" issues
            console.log(`[PrinterManager] Ensuring connection to ${mac}...`);
            const connected = await this.ensureConnection(mac);
            if (!connected) return false;
            
            // 1. Handle Logo if present
            if (orderData.show_logo && orderData.receipt_logo_url) {
                const base64 = await this.getBase64Image(orderData.receipt_logo_url);
                if (base64) {
                    console.log('[PrinterManager] Logo loaded, attempting printImageBase64...');
                    try {
                        const paperWidth = orderData.receipt_paper_width === '80mm' ? 48 : 32;
                        await BLEPrinter.printImageBase64(base64, {
                            imageWidth: paperWidth <= 32 ? 80 : 120,
                            imageHeight: paperWidth <= 32 ? 40 : 60,
                        });
                        await new Promise(r => setTimeout(r, 200));
                    } catch (picErr) {
                        console.warn('[PrinterManager] printImageBase64 failed, skipping logo:', picErr);
                    }
                }
            }

            // 2. Print the text receipt (Strip the [LOGO] tag after printing the picture)
            const text = '\x1b\x40' + this.formatReceipt(orderData).replace(/\[LOGO\]\n?/, ''); // Prepend ESC @ (Reset)
            
            let success = false;
            try {
                await BLEPrinter.printBill(text);
                success = true;
            } catch (printErr) {
                console.warn('[PrinterManager] First print attempt failed. Retrying connection...', printErr);
                this.currentActiveMac = null;
                const reconnected = await this.ensureConnection(mac);
                if (reconnected) {
                    try {
                        await BLEPrinter.printBill(text);
                        success = true;
                    } catch (secondErr) {
                        console.error('[PrinterManager] Second print attempt failed:', secondErr);
                    }
                }
            }
            
            console.log('[PrinterManager] Receipt printed:', success);
            return success;
        } catch (e) {
            console.error('[PrinterManager] Print Receipt Error:', e);
            this.currentActiveMac = null;
            return false;
        }
    }

    static async printToTarget(items: any[], type: PrinterType, orderData: any) {
        const targetName = type === 'kitchen' ? 'Dapur' : 'Bar';
        const filtered = items.filter(i => {
            const itarget = (i.target || '').toLowerCase().trim();
            if (type === 'kitchen') {
                // Kitchen takes explicitly 'kitchen', 'dapur', 'kds'
                // It also takes empty/waitress ONLY if it's NOT a bar-related target
                const isBarTarget = itarget === 'bar' || itarget === 'minuman' || itarget === 'minum' || itarget === 'drink' || itarget === 'coffee';
                return (itarget === 'kitchen' || itarget === 'dapur' || itarget === 'kds' || !itarget || itarget === 'waitress') && !isBarTarget;
            }
            // Bar takes 'bar', 'minuman', 'minum', 'drink', or 'coffee'
            if (type === 'bar') {
                return itarget === 'bar' || itarget === 'minuman' || itarget === 'minum' || itarget === 'drink' || itarget === 'coffee';
            }
            return itarget === type;
        });
        if (filtered.length === 0) {
            console.log(`[PrinterManager] No items for ${targetName}`);
            return true;
        }

        let macAddress = await this.getSelectedPrinter(type);
        if (!macAddress) {
            console.warn(`[PrinterManager] ${targetName} printer not configured`);
            return false;
        }

        const text = this.formatKitchenTicket(filtered, orderData, targetName);
        try {
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            console.log(`[PrinterManager] Target ${targetName}: ${mac} (Current: ${this.currentActiveMac})`);

            const connected = await this.ensureConnection(mac);
            if (!connected) return false;

            const printData = '\x1b\x40' + text;
            let success = false;
            try {
                await BLEPrinter.printBill(printData);
                success = true;
            } catch (printErr) {
                console.warn(`[PrinterManager] First target print attempt failed for ${targetName}. Retrying connection...`, printErr);
                this.currentActiveMac = null;
                const reconnected = await this.ensureConnection(mac);
                if (reconnected) {
                    try {
                        await BLEPrinter.printBill(printData);
                        success = true;
                    } catch (secondErr) {
                        console.error(`[PrinterManager] Second target print attempt for ${targetName} failed:`, secondErr);
                    }
                }
            }
            return success;
        } catch (e) {
            console.error(`[PrinterManager] Print to ${targetName} Error:`, e);
            this.currentActiveMac = null;
            return false;
        }
    }

    static async testPrint(type: PrinterType = 'receipt') {
        const mac = await this.getSelectedPrinter(type);
        if (!mac) throw new Error('Printer belum diatur');
        const text = '\x1b\x40' + `\nTEST PRINT ${type.toUpperCase()}\nStatus: Berhasil\n\n\n\n\n\n\n${COMMANDS.PAPER.PAPER_FULL_CUT}`;
        const connected = await this.ensureConnection(mac);
        if (!connected) return;
        await BLEPrinter.printBill(text);
    }

    static formatSalesReport(data: any, isPreview: boolean = false): string {
        const paperWidth = data.paperWidth || 32; 
        const DASH = '-'.repeat(paperWidth) + '\n';
        const DOUBLE = '='.repeat(paperWidth) + '\n';
        const CENTER = isPreview ? '[C]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = isPreview ? '[L]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = isPreview ? '<b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = isPreview ? '</b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = isPreview ? '[BIG]' : COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        const DOUBLE_OFF = isPreview ? '[/BIG]' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;

        // [HARD RESET]
        let text = isPreview ? '' : '\x1b\x40\x1b\x4d\x00';
        
        // HEADER matching modal UI - Logo and Address hidden as requested
        text += CENTER + BOLD_ON + DOUBLE_ON + (data.shopName || 'WINNY COFFEE PNK').toUpperCase() + DOUBLE_OFF + BOLD_OFF + '\n';
        text += CENTER + DASH;
        
        text += CENTER + BOLD_ON + 'RINGKASAN SELESAI SHIFT' + BOLD_OFF + '\n';
        text += CENTER + (data.dateRange || '') + '\n';
        text += CENTER + `Kasir: ${data.generatedBy || 'Kasir'}\n`;
        text += CENTER + `Status: TUTUP\n`;
        text += CENTER + DOUBLE + LEFT;

        // SECTION: RINGKASAN
        text += BOLD_ON + 'RINGKASAN' + BOLD_OFF + '\n';
        text += this.padColumns('Total Transaksi:', (data.totalOrders || 0).toString(), paperWidth, isPreview) + '\n';
        text += this.padColumns('Tunai:', (data.cashTotal || 0).toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        text += this.padColumns('QRIS:', (data.qrTotal || 0).toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        text += BOLD_ON + this.padColumns('TOTAL BERSIH (NET):', (data.totalSales || 0).toLocaleString('id-ID'), paperWidth, isPreview) + BOLD_OFF + '\n';
        const avgOrder = data.totalOrders > 0 ? Math.round(data.totalSales / data.totalOrders) : 0;
        text += this.padColumns('Rata-rata/Order:', avgOrder.toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        text += CENTER + DASH + LEFT;

        // SECTION: BUKTI FISIK KAS
        text += BOLD_ON + 'BUKTI FISIK KAS' + BOLD_OFF + '\n';
        text += this.padColumns('Total Penjualan Tunai:', (data.cashTotal || 0).toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        text += this.padColumns('Modal Awal:', (data.openingBalance || 0).toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
        text += BOLD_ON + this.padColumns('Total (Uang Laci+Modal):', (data.expectedCash || 0).toLocaleString('id-ID'), paperWidth, isPreview) + BOLD_OFF + '\n';
        
        if (data.actualCash !== undefined) {
            text += this.padColumns('Kas Fisik Kasir:', (data.actualCash || 0).toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
            text += BOLD_ON + this.padColumns('Selisih:', (data.variance || 0).toLocaleString('id-ID'), paperWidth, isPreview) + BOLD_OFF + '\n';
        }
        text += CENTER + DASH + LEFT;

        // SECTION: KATEGORI PRODUK
        if (data.showCategoryOnSummary !== false && data.categorySummary && data.categorySummary.length > 0) {
            text += BOLD_ON + 'KATEGORI PRODUK' + BOLD_OFF + '\n';
            data.categorySummary.forEach((c: any) => {
                text += this.padColumns(c.name || c.category || 'Lainnya', (c.amount || 0).toLocaleString('id-ID'), paperWidth, isPreview) + '\n';
            });
            text += CENTER + DASH;
        }

        text += '\n' + CENTER + `Dicetak pada: ${new Date().toLocaleString('id-ID')}\n`;
        text += CENTER + BOLD_ON + '[ BUKTI FISIK SAH ]' + BOLD_OFF + '\n';
        if (data.receiptFooter) text += CENTER + data.receiptFooter + '\n';

        text += '\n'.repeat(7) + (isPreview ? '' : (data.enableAutoCut !== false ? COMMANDS.PAPER.PAPER_FULL_CUT : ''));
        return text;
    }

    static async printSalesReport(data: any) {
        console.log('[PrinterManager] printSalesReport started');
        
        let macAddress: string | null = null;
        try {
            macAddress = await this.getSelectedPrinter('report') || await this.getSelectedPrinter('receipt');
        } catch (e) {
            console.error('[PrinterManager] Error getting printer address:', e);
        }
        
        if (!macAddress) {
            Alert.alert('Kesalahan Printer', 'Alamat printer tidak ditemukan. Mohon atur di menu Pengaturan.');
            return false;
        }

        try {
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            
            // [SAFETY HARVEST]
            if (!data.receiptLogoUrl || !data.shopName) {
                try {
                    const { data: safetyData } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
                    if (safetyData) {
                        data.receiptLogoUrl = data.receiptLogoUrl || safetyData.receipt_logo_url;
                        data.shopName = data.shopName || safetyData.receipt_header || safetyData.store_name;
                        data.paperWidth = data.paperWidth || (safetyData.receipt_paper_width === '80mm' ? 48 : 32);
                        data.enableAutoCut = data.enableAutoCut ?? safetyData.enable_auto_cut;
                    }
                } catch (err) {
                    console.warn('[PrinterManager] Safety harvest (report) failed', err);
                }
            }

            // Force fresh connection/reset for every report to ensure consistency
            console.log(`[PrinterManager] Ensuring connection for report: ${mac}`);
            const connected = await this.ensureConnection(mac);
            if (!connected) return false;
            
            const text = '\x1b\x40' + this.formatSalesReport(data);
            await BLEPrinter.printBill(text);
            return true;
        } catch (e: any) {
            console.error('[PrinterManager] printSalesReport error:', e);
            Alert.alert('Gagal Cetak', 'Gagal mengirim data ke printer. Detail: ' + e.message);
            this.currentActiveMac = null;
            return false;
        }
    }
}
