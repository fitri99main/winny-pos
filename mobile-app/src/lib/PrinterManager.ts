import { BleManager, Device } from 'react-native-ble-plx';
import { BLEPrinter, IBLEPrinter, COMMANDS } from '@haroldtran/react-native-thermal-printer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { Buffer } from 'buffer';
import Constants from 'expo-constants';
import { resolveOrderTypeDisplay } from './orderTypeUtils';

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
    private static currentConnectedMac: string | null = null;
    private static connectionStatus: Record<string, 'connected' | 'disconnected' | 'connecting'> = {};
    private static logoCache: Record<string, string> = {};
    private static printQueue: Promise<any> = Promise.resolve();
    private static permissionsGranted = false;

    static async requestPermissions() {
        if (this.permissionsGranted) return { bluetooth: true, location: true, all: true };
        if (Platform.OS === 'android') {
            const apiLevel = Number(Platform.Version);
            if (apiLevel >= 31) {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);
                const bluetoothOk = granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                                   granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED;
                const locationOk = granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
                if (bluetoothOk && locationOk) this.permissionsGranted = true;
                return { bluetooth: bluetoothOk, location: locationOk, all: bluetoothOk && locationOk };
            } else {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
                if (ok) this.permissionsGranted = true;
                return { bluetooth: true, location: ok, all: ok };
            }
        }
        this.permissionsGranted = true;
        return { bluetooth: true, location: true, all: true };
    }

    static async initPrinter() {
        if (!isExpoGo && Platform.OS !== 'web') {
            if (this.isInitialized) return;
            try {
                const perms = await this.requestPermissions() as any;
                if (!perms.bluetooth) {
                    console.warn('Bluetooth permissions missing, but attempting init anyway...');
                }
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
        const perms = await this.requestPermissions() as any;
        if (!perms.bluetooth) throw new Error('Izin Bluetooth ditolak.');
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
        const t = (type || 'receipt').toLowerCase();
        const key = t === 'kitchen' ? KITCHEN_PRINTER_KEY : 
                    (t === 'bar' ? BAR_PRINTER_KEY : 
                    (t === 'report' ? REPORT_PRINTER_KEY : PRINTER_STORAGE_KEY));
        return await AsyncStorage.getItem(key);
    }

    static async getBase64FromUrl(url: string, paperWidth: string = '58mm'): Promise<string | null> {
        if (!url || url.length < 5) return null;
        
        // Force clear cache for logo debugging
        this.logoCache = {};

        try {
            let cleanUrl = url.trim();
            
            // Determine canvas width based on paper type
            const is80mm = paperWidth.toLowerCase() === '80mm';
            const canvasWidth = is80mm ? 576 : 384;

            // Use Weserv (wsrv.nl) to create a canvas that matches the printer width
            const encodedUrl = encodeURIComponent(cleanUrl);
            cleanUrl = `https://wsrv.nl/?url=${encodedUrl}&w=${canvasWidth}&h=50&fit=contain&bg=white&output=png&filt=greyscale&trim=10`;

            const response = await fetch(cleanUrl);
            if (!response.ok) {
                console.warn('Failed to fetch logo from URL:', cleanUrl);
                return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            const rawBase64 = Buffer.from(arrayBuffer).toString('base64');
            const cleanedBase64 = rawBase64.replace(/^data:.*?;base64,/, '').replace(/[\r\n]/g, '');
            if (cleanedBase64.length < 100) return null;
            return cleanedBase64;
        } catch (error) { 
            console.error('Error converting logo to base64:', error);
            return null; 
        }
    }

    static getConnectionStatus(macAddress: string | null | undefined) {
        if (!macAddress) return 'disconnected';
        return this.connectionStatus[macAddress.toUpperCase()] || 'disconnected';
    }

    static async checkConnection(macAddress: string): Promise<boolean> {
        if (isExpoGo || Platform.OS === 'web') return true;
        try {
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            this.connectionStatus[mac] = 'connecting';
            await BLEPrinter.connectPrinter(mac);
            this.connectionStatus[mac] = 'connected';
            return true;
        } catch (e) {
            if (macAddress) this.connectionStatus[macAddress.toUpperCase()] = 'disconnected';
            return false;
        }
    }

    static async reconnectAllConfiguredPrinters() {
        const types: {key: PrinterType, label: string}[] = [
            {key: 'receipt', label: 'Kasir'},
            {key: 'kitchen', label: 'Dapur'},
            {key: 'bar', label: 'Bar'},
            {key: 'report', label: 'Laporan'}
        ];
        const results: Record<string, boolean> = {};
        let success = true;

        for (const item of types) {
            const mac = await this.getSelectedPrinter(item.key);
            if (mac) {
                const ok = await this.checkConnection(mac);
                results[item.label] = ok;
                if (!ok) success = false;
            }
        }
        return { results, success };
    }

    static padColumns(left: string | null | undefined, right: string | null | undefined, width: number = 32): string {
        const leftStr = left || '';
        const rightStr = right || '';
        const spaceCount = width - (leftStr.length + rightStr.length);
        if (spaceCount <= 0) return leftStr + ' ' + rightStr;
        return leftStr + ' '.repeat(spaceCount) + rightStr;
    }

    static formatReceipt(orderData: any, isPreview: boolean = false, skipInit: boolean = false): string {
        try {
            const { 
                shop_name, shopName, shop_address, shopAddress, shop_phone, shopPhone,
                items = [], total, service_charge, tax, discount, payment_method, paymentType, payment_type,
                order_no, orderNo, created_at, date: orderDate,
                customer_name, customerName, customer_level, customerLevel,
                show_waiter, show_date, show_table, show_customer_name, show_cashier_name, show_customer_status,
                waiter_name, waiterName, table_no, tableNo, cashier_name, cashierName,
                wifi_voucher, wifiVoucher, wifi_voucher_notice, wifiNotice, wifi_notice,
                receipt_header, receiptHeader, receipt_footer, receiptFooter,
                receipt_paper_width, receiptPaperWidth, show_logo, receipt_footer_feed
            } = orderData;

            const paperWidthStr = (receipt_paper_width || receiptPaperWidth || '58mm').toLowerCase();
            const is80mm = paperWidthStr === '80mm';
            const width = is80mm ? 48 : 32;
            const line = '-'.repeat(width);

            const displayShopName = (shop_name || shopName || 'WINNY COFFEE PNK').trim();
            const displayHeader = (receipt_header || receiptHeader || '').trim();
            const displayFooter = (receipt_footer || receiptFooter || '').trim();
            const displayAddress = (shop_address || shopAddress || '').trim();
            const displayPhone = (shop_phone || shopPhone || '').trim();
            
            const CENTER = isPreview ? '[C]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
            const LEFT = isPreview ? '[L]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
            const BOLD_ON = isPreview ? '<b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
            const BOLD_OFF = isPreview ? '</b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
            const DOUBLE_ON = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_2HEIGHT;
            const DOUBLE_OFF = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;
            const BIG_ON = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
            const BIG_OFF = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;

            let receiptText = '';
            
            if (isPreview && show_logo !== false) {
                receiptText += '[LOGO]\n';
            }
            
            // 1. Header (Primary Shop Name)
            if (displayHeader) {
                receiptText += CENTER + BOLD_ON + DOUBLE_ON + displayHeader.toUpperCase() + DOUBLE_OFF + BOLD_OFF + '\n';
            } else if (displayShopName) {
                receiptText += CENTER + BOLD_ON + DOUBLE_ON + displayShopName.toUpperCase() + DOUBLE_OFF + BOLD_OFF + '\n';
            }

            // 2. Address & Phone
            if (displayAddress) {
                receiptText += CENTER + displayAddress + '\n';
            }
            if (displayPhone) {
                receiptText += CENTER + 'Telp: ' + displayPhone + '\n';
            }
            
            receiptText += CENTER + line + '\n';
            receiptText += LEFT;
            
            // 3. Info Section
            receiptText += `No: ${order_no || orderNo || '-'}\n`;
            
            if (show_date !== false) {
                const rawDate = created_at || orderDate || new Date();
                const displayDate = new Date(rawDate).toLocaleString('id-ID', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
                receiptText += `Waktu: ${displayDate}\n`;
            }
            
            if (show_table !== false && (table_no || tableNo)) {
                receiptText += `Meja: ${table_no || tableNo}\n`;
            }
            
            if (show_customer_name !== false && (customer_name || customerName)) {
                receiptText += `Pelanggan: ${customer_name || customerName}\n`;
            }
            
            if (show_customer_status !== false && (customer_level || customerLevel)) {
                receiptText += `Status: ${customer_level || customerLevel}\n`;
            }

            if (show_cashier_name !== false && (cashier_name || cashierName)) {
                receiptText += `Kasir: ${cashier_name || cashierName}\n`;
            }
            
            if (show_waiter !== false && (waiter_name || waiterName)) {
                receiptText += `Pelayan: ${waiter_name || waiterName}\n`;
            }
            
            receiptText += CENTER + line + '\n';
            receiptText += LEFT;
      
            // 4. Items
            items.forEach((item: any) => {
                const qty = item.quantity || 1;
                const name = (item.name || 'Produk').toUpperCase();
                const price = Number(item.price || 0);
                const sub = qty * price;

                // Line 1: NAME
                receiptText += LEFT + name + '\n';
                
                // Line 2: Qty x Price [Right] Subtotal
                const qtyPricePart = `  ${qty}x ${price.toLocaleString('id-ID')}`;
                const subStr = sub.toLocaleString('id-ID');
                
                if (isPreview) {
                    receiptText += LEFT + qtyPricePart + '[R]' + subStr + '\n';
                } else {
                    const spaceCount = width - qtyPricePart.length - subStr.length;
                    receiptText += LEFT + qtyPricePart + ' '.repeat(Math.max(0, spaceCount)) + subStr + '\n';
                }

                if (item.notes) {
                    receiptText += LEFT + '  (' + item.notes + ')\n';
                }
            });
            
            receiptText += CENTER + line + '\n';
            receiptText += LEFT;

            // 5. Totals
            const formatRow = (label: string, val: number | string) => {
                const labelStr = label.toString();
                const valStr = typeof val === 'number' ? Math.floor(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : val;
                return labelStr + ' '.repeat(Math.max(1, width - labelStr.length - valStr.length)) + valStr + '\n';
            };

            const subtotalVal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
            receiptText += formatRow('Subtotal', subtotalVal);
            
            if (discount > 0) {
                receiptText += formatRow('Diskon', '-' + Math.floor(discount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
            }
            
            if (service_charge > 0) {
                receiptText += formatRow('Layanan', Math.floor(service_charge).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
            }
            
            if (tax > 0) {
                receiptText += formatRow('Pajak', Math.floor(tax).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
            }
            
            receiptText += BOLD_ON + formatRow('TOTAL', total || 0) + BOLD_OFF;
            receiptText += CENTER + line + '\n';
            receiptText += LEFT;
            
            // 6. Payment
            const mMethod = (payment_method || paymentType || payment_type || 'Tunai').toUpperCase();
            const mPaid = orderData.paid_amount || orderData.amount_paid || total || 0;
            receiptText += formatRow(mMethod, mPaid);
            
            if (mPaid > (total || 0)) {
                receiptText += formatRow('Kembali', (orderData.change || 0));
            }
            
            receiptText += CENTER + line + '\n';

            // 7. Voucher Section
            const voucherObj = typeof wifi_voucher === 'object' ? wifi_voucher : null;
            const displayWifiVoucher = (voucherObj?.code || wifi_voucher || (orderData && orderData.wifi_voucher_code) || wifiVoucher || '').toString();
            if (displayWifiVoucher && displayWifiVoucher.length > 1) {
                const displayWifiNotice = (wifi_voucher_notice || wifi_notice || wifiNotice || voucherObj?.notice || 'Gunakan kode ini untuk akses WiFi').trim();
                receiptText += CENTER + displayWifiNotice + '\n';
                receiptText += CENTER + BOLD_ON + BIG_ON + displayWifiVoucher + BIG_OFF + BOLD_OFF + '\n';
                receiptText += CENTER + line + '\n';
            }

            // 8. Footer Section
            if (displayFooter) {
                receiptText += CENTER + displayFooter + '\n';
            }
            
            // Bottom Name (as per web preview)
            if (displayHeader) {
                receiptText += CENTER + displayHeader.toUpperCase() + '\n';
            }

            // 9. Feed & Cut
            // Total minimal feed (no explicit cut command to avoid double cuts)
            if (!isPreview) {
                receiptText += '\n'.repeat(3);
            }
            return receiptText;
        } catch (error) {
            console.error('Error formatting receipt:', error);
            return 'ERROR FORMATTING RECEIPT';
        }
    }

    static formatKitchenTicket(items: any[], orderData: any, targetName: string): string {
        const { order_no, table_no, created_at, waiter_name, notes } = orderData;
        const displayOrderNo = order_no || '-';
        const displayDate = created_at ? new Date(created_at).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
        const CENTER = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        const DOUBLE_OFF = COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        const LINE = '--------------------------------\n';
        let ticketText = CENTER + BOLD_ON + DOUBLE_ON + `PESANAN ${targetName.toUpperCase()}` + DOUBLE_OFF + BOLD_OFF + '\n';
        ticketText += CENTER + `No: ${displayOrderNo}\n`;
        if (table_no) ticketText += CENTER + BOLD_ON + DOUBLE_ON + `MEJA: ${table_no}` + DOUBLE_OFF + BOLD_OFF + '\n';
        ticketText += CENTER + LINE + LEFT;
        (items || []).forEach((item: any) => {
            ticketText += BOLD_ON + DOUBLE_ON + `${item.quantity}x ${item.name}` + DOUBLE_OFF + BOLD_OFF + '\n';
            if (item.notes) ticketText += `   * Catatan: ${item.notes}\n`;
            ticketText += '\n';
        });
        ticketText += CENTER + LINE + `Waktu: ${displayDate}\n`;
        if (waiter_name) ticketText += `Pelayan: ${waiter_name}\n`;
        ticketText += '\n'.repeat(3);
        return ticketText;
    }

    private static async wrapWithTimeout(promise: Promise<any>, timeoutMs: number, fallbackValue: any): Promise<any> {
        let timeoutHandle: any;
        const timeoutPromise = new Promise((resolve) => {
            timeoutHandle = setTimeout(() => resolve(fallbackValue), timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]).then(function(result) {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            return result;
        }).catch(function(err) {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            throw err;
        });
    }

    static async printToTarget(items: any[], type: PrinterType, orderData: any, silent: boolean = false) {
        return new Promise<{success: boolean, count: number}>((resolve) => {
            this.printQueue = this.printQueue.then(async () => {
                try {
                    // Penambahan timeout internal per koneksi agar queue tidak macet total
                    const opResult = await this.wrapWithTimeout(
                        this.executePrintToTarget(items, type, orderData, silent),
                        15000,
                        { success: false, count: 0 }
                    );
                    resolve(opResult);
                } catch (err) {
                    resolve({ success: false, count: 0 });
                }
            });
        });
    }

    private static async executePrintToTarget(items: any[], type: PrinterType, orderData: any, silent: boolean = false) {
        if (!items || items.length === 0) return { success: true, count: 0 };
        
        // Filter items based on target
        const filteredItems = items.filter(it => {
            const t = (it.target || '').toUpperCase();
            if (type === 'kitchen') {
                return t === 'KITCHEN' || t === 'DAPUR' || !t; // Default to kitchen if no target
            }
            if (type === 'bar') {
                return t === 'BAR';
            }
            return true;
        });

        if (filteredItems.length === 0) {
            console.log(`[PrinterManager] No items found for ${type} after filtering.`);
            return { success: true, count: 0 };
        }

        let macAddress = await this.getSelectedPrinter(type);
        let isFallback = false;
        if (!macAddress) {
            macAddress = await this.getSelectedPrinter('receipt');
            isFallback = !!macAddress;
        }

        if (!macAddress) {
            console.warn(`[PrinterManager] No printer configured for ${type} or fallback receipt`);
            return { success: false, count: filteredItems.length };
        }
        
        console.log(`[PrinterManager] Target: ${type}, MAC: ${macAddress}${isFallback ? ' (FALLBACK)' : ''}, Items: ${filteredItems.length}`);
        const ticketText = this.formatKitchenTicket(filteredItems, orderData, type === 'kitchen' ? 'Dapur' : 'Bar');
        
        try {
            if (isExpoGo) return { success: true, count: filteredItems.length };
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            
            // Coba hubungkan jika belum terhubung ATAU jika printer aktif saat ini berbeda
            if (this.connectionStatus[mac] !== 'connected' || this.currentConnectedMac !== mac) {
                console.log(`[PrinterManager] SWITCHING PRINTER to ${type.toUpperCase()}: ${mac} (Previous: ${this.currentConnectedMac})`);
                await BLEPrinter.connectPrinter(mac);
                this.connectionStatus[mac] = 'connected';
                this.currentConnectedMac = mac;
                // Jeda lebih lama setelah ganti printer fisik agar buffer siap
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            console.log(`[PrinterManager] Sending ticket to ${type} printer (${mac})...`);
            await BLEPrinter.printBill(ticketText);
            console.log(`[PrinterManager] ${type} print successful.`);
            // Cooling Down Delay: Beri jeda agar buffer bluetooth selesai ditransfer secara fisik sebelum koneksi diputus/dipindah
            await new Promise(resolve => setTimeout(resolve, 2000));
            return { success: true, count: filteredItems.length };
        } catch (error) { 
            console.error(`[PrinterManager] ${type} print failed:`, error);
            if (!silent) {
                const typeLabel = type === 'kitchen' ? 'Dapur' : (type === 'bar' ? 'Bar' : 'Kasir');
                Alert.alert('Gagal Cetak', `Gagal mengirim data ke printer ${typeLabel}. Pastikan Bluetooth aktif dan printer dalam jangkauan.`);
            }
            return { success: false, count: filteredItems.length }; 
        }
    }
    
    static async printOrderReceipt(orderData: any, silent: boolean = false) {
        return new Promise<boolean>((resolve) => {
            this.printQueue = this.printQueue.then(async () => {
                try {
                    const opResult = await this.wrapWithTimeout(
                        this.executePrintOrderReceipt(orderData, silent),
                        15000,
                        false
                    );
                    resolve(opResult);
                } catch (err) {
                    resolve(false);
                }
            });
        });
    }

    private static async executePrintOrderReceipt(orderData: any, silent: boolean = false) {
        if (!orderData) return false;
        
        // Priority Fallback: Coba ambil printer kasir, jika tidak ada pakai bar, jika tidak ada pakai kitchen
        let macAddress = await this.getSelectedPrinter('receipt') || 
                         await this.getSelectedPrinter('bar') || 
                         await this.getSelectedPrinter('kitchen');
                         
        if (!macAddress) {
            console.warn('[PrinterManager] No printer configured anywhere for receipt');
            if (!silent) Alert.alert('Printer Belum Diatur', 'Harap atur alamat printer di menu Pengaturan.');
            return false;
        }
        
        try {
            const receiptText = this.formatReceipt(orderData);
            if (isExpoGo) return true;
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            
            // Koneksi
            if (this.connectionStatus[mac] !== 'connected' || this.currentConnectedMac !== mac) {
                console.log(`[PrinterManager] Connecting to printer for receipt at ${mac}...`);
                await BLEPrinter.connectPrinter(mac);
                this.connectionStatus[mac] = 'connected';
                this.currentConnectedMac = mac;
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Logo (Opsional, jangan biarkan logo menggagalkan struk)
            if (orderData.show_logo && orderData.receipt_logo_url) {
                try {
                    const encodedUrl = encodeURIComponent(orderData.receipt_logo_url.trim());
                    const logoUrl = `https://wsrv.nl/?url=${encodedUrl}&w=140&fit=contain&filt=greyscale&trim=10`;
                    await BLEPrinter.printImage(logoUrl, { imageWidth: 140, imageAlignment: 'center' });
                } catch (e) {
                    console.warn("Logo print skipped:", e);
                }
            }

            console.log("[PrinterManager] Sending final bill text...");
            await BLEPrinter.printBill(receiptText);
            // Cooling Down Delay: Beri jeda agar buffer bluetooth selesai ditransfer secara fisik sebelum koneksi diputus/dipindah
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        } catch (error) { 
            console.error('Print Receipt Error:', error);
            if (!silent) Alert.alert('Gagal Cetak Struk', 'Pastikan Bluetooth aktif dan printer dalam jangkauan.');
            return false;
        }
    }

    static formatSalesReport(reportData: any, isPreview: boolean = false): string {
        const width = reportData.paperWidth || 32;
        const line = '-'.repeat(width);
        const CENTER = isPreview ? '[C]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = isPreview ? '[L]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = isPreview ? '<b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = isPreview ? '</b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const BIG_ON = isPreview ? '[BIG]' : COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        const BIG_OFF = isPreview ? '[/BIG]' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;

        const formatCurrency = (val: any) => {
            const v = Math.floor(Number(val || 0));
            return v.toLocaleString('id-ID');
        };

        const formatRow = (label: string, val: string | number) => {
            const valStr = typeof val === 'number' ? formatCurrency(val) : val.toString();
            const labelStr = label.substring(0, width - valStr.length - 1);
            const spaceCount = width - labelStr.length - valStr.length;
            return labelStr + (spaceCount > 0 ? ' '.repeat(spaceCount) : ' ') + valStr;
        };

        let report = '';
        report += CENTER + BOLD_ON + BIG_ON + (reportData.shopName || 'WINNY COFFEE').toUpperCase() + BIG_OFF + BOLD_OFF + '\n';
        if (reportData.address) report += CENTER + reportData.address + '\n';
        if (reportData.phone) report += CENTER + 'Telp: ' + reportData.phone + '\n';
        report += CENTER + line + '\n';
        
        report += CENTER + BOLD_ON + 'RINGKASAN SHIFT' + BOLD_OFF + '\n';
        report += CENTER + (reportData.dateRange || '') + '\n';
        report += CENTER + line + '\n';

        report += LEFT + formatRow('Kasir:', reportData.generatedBy || '-') + '\n';
        report += LEFT + formatRow('Total Order:', reportData.totalOrders || 0) + '\n';
        report += LEFT + BOLD_ON + formatRow('TOTAL SALES:', reportData.totalSales || 0) + BOLD_OFF + '\n';
        report += CENTER + line + '\n';

        report += LEFT + BOLD_ON + 'RINCIAN PEMBAYARAN' + BOLD_OFF + '\n';
        if (reportData.paymentSummary && reportData.paymentSummary.length > 0) {
            reportData.paymentSummary.forEach((p: any) => {
                report += LEFT + formatRow((p.method || 'Tunai').toUpperCase(), p.amount) + '\n';
            });
        } else {
            const cashTotal = Number(reportData.cashTotal || 0);
            const nonCashTotal = Number(reportData.qrTotal || reportData.nonCashTotal || 0);
            if (cashTotal > 0) {
                report += LEFT + formatRow('TUNAI', cashTotal) + '\n';
            }
            if (nonCashTotal > 0) {
                report += LEFT + formatRow('QRIS / NON TUNAI', nonCashTotal) + '\n';
            }
        }
        if (reportData.totalTax > 0) report += LEFT + formatRow('PAJAK', reportData.totalTax) + '\n';
        if (reportData.totalDiscount > 0) report += LEFT + formatRow('DISKON', '-' + formatCurrency(reportData.totalDiscount)) + '\n';
        report += CENTER + line + '\n';

        report += LEFT + BOLD_ON + 'REKONSILIASI KAS' + BOLD_OFF + '\n';
        report += LEFT + formatRow('Modal Awal:', reportData.openingBalance || 0) + '\n';
        report += LEFT + formatRow('Penjualan Tunai:', reportData.cashTotal || 0) + '\n';
        report += LEFT + BOLD_ON + formatRow('Total Seharusnya:', reportData.expectedCash || 0) + BOLD_OFF + '\n';
        report += LEFT + formatRow('Kas Fisik:', reportData.actualCash || 0) + '\n';
        
        const variance = reportData.variance || 0;
        report += LEFT + BOLD_ON + formatRow('SELISIH:', variance) + BOLD_OFF + '\n';
        report += CENTER + line + '\n';

        if (reportData.showCategoryOnSummary !== false && reportData.categorySummary && reportData.categorySummary.length > 0) {
            report += LEFT + BOLD_ON + 'PENJUALAN PER KATEGORI' + BOLD_OFF + '\n';
            reportData.categorySummary.forEach((c: any) => {
                report += LEFT + formatRow(c.category || c.name || 'Lainnya', c.amount) + '\n';
            });
            report += CENTER + line + '\n';
        }

        report += CENTER + '\n' + BOLD_ON + 'Dicetak pada:' + BOLD_OFF + '\n';
        report += CENTER + new Date().toLocaleString('id-ID') + '\n\n\n\n';
        
        if (!isPreview) {
            report += '\n'.repeat(3);
        }

        return report;
    }

    static async printSalesReport(reportData: any) {
        const result = await new Promise<boolean>((resolve) => {
            const taskTimeout = setTimeout(() => {
                console.warn('[PrinterManager] printSalesReport timed out');
                resolve(false);
            }, 25000);

            this.printQueue = this.printQueue.then(async () => {
                try {
                    const opResult = await this.executePrintSalesReport(reportData);
                    clearTimeout(taskTimeout);
                    resolve(opResult);
                } catch (err) {
                    clearTimeout(taskTimeout);
                    resolve(false);
                }
            }).catch(err => {
                console.error('[PrinterManager] printSalesReport Queue Error:', err);
                clearTimeout(taskTimeout);
                resolve(false);
            });
        });
        return result;
    }

    private static async executePrintSalesReport(reportData: any) {
        let macAddress = await this.getSelectedPrinter('report') || await this.getSelectedPrinter('receipt');
        if (!macAddress) return false;
        const reportText = this.formatSalesReport(reportData);
        try {
            if (isExpoGo) return true;
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            if (this.connectionStatus[mac] !== 'connected' || this.currentConnectedMac !== mac) {
                console.log(`[PrinterManager] Switching/Connecting to report printer at ${mac}...`);
                await BLEPrinter.connectPrinter(mac);
                this.connectionStatus[mac] = 'connected';
                this.currentConnectedMac = mac;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Cetak Logo di laporan jika diinginkan
            if (reportData.receipt_logo_url) {
                const encodedUrl = encodeURIComponent(reportData.receipt_logo_url.trim());
                const logoUrl = `https://wsrv.nl/?url=${encodedUrl}&w=140&fit=contain&filt=greyscale&trim=10`;
                
                // No delay needed here
                await BLEPrinter.printImage(logoUrl, { 
                    imageWidth: 140, 
                    imageAlignment: 'center' 
                });
                // No delay needed here
            }

            await BLEPrinter.printBill(reportText);
            // Cooling Down Delay: Beri jeda agar buffer bluetooth selesai ditransfer secara fisik sebelum koneksi diputus/dipindah
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        } catch (error) { return false; }
    }

    static async testPrint(type: PrinterType = 'receipt') {
        const result = await new Promise<boolean>((resolve, reject) => {
            this.printQueue = this.printQueue.then(async () => {
                const opResult = await this.executeTestPrint(type);
                resolve(opResult);
            }).catch(err => {
                console.error('[PrinterManager] TestPrint Queue Error:', err);
                reject(err);
            });
        });
        return result;
    }

    private static async executeTestPrint(type: PrinterType = 'receipt') {
        let macAddress = await this.getSelectedPrinter(type);
        if (!macAddress) {
            throw new Error(`Printer ${type} belum dikonfigurasi`);
        }

        const label = type === 'receipt' ? 'KASIR' : (type === 'report' ? 'LAPORAN' : (type === 'kitchen' ? 'DAPUR' : 'BAR'));
        const CENTER = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = COMMANDS.TEXT_FORMAT.TXT_2HEIGHT;
        const DOUBLE_OFF = COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        
        let testText = CENTER + BOLD_ON + DOUBLE_ON + "TEST PRINT " + label + DOUBLE_OFF + BOLD_OFF + "\n\n";
        testText += CENTER + "Koneksi Berhasil!\n";
        testText += CENTER + "MAC: " + macAddress.toUpperCase() + "\n";
        testText += CENTER + "Waktu: " + new Date().toLocaleString('id-ID') + "\n\n";
        testText += "--------------------------------\n";
        testText += CENTER + "Printer thermal Anda siap digunakan\n";
        testText += CENTER + "Terima Kasih\n\n\n";

        try {
            if (isExpoGo) return true;
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            
            if (this.connectionStatus[mac] !== 'connected' || this.currentConnectedMac !== mac) {
                console.log(`[PrinterManager] Switching/Connecting for test print at ${mac}...`);
                await BLEPrinter.connectPrinter(mac);
                this.connectionStatus[mac] = 'connected';
                this.currentConnectedMac = mac;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Short delay after connection
            await new Promise(resolve => setTimeout(resolve, 200));
            
            await BLEPrinter.printBill(testText);
            // Cooling Down Delay: Beri jeda agar buffer bluetooth selesai ditransfer secara fisik sebelum koneksi diputus/dipindah
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        } catch (error: any) {
            console.error(`[PrinterManager] Test print failed:`, error);
            throw error;
        }
    }
}
