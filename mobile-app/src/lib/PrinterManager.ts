import { BleManager, Device } from 'react-native-ble-plx';
import { BLEPrinter, IBLEPrinter, COMMANDS } from '@haroldtran/react-native-thermal-printer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { Buffer } from 'buffer';
import Constants from 'expo-constants';

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

    static async requestPermissions() {
        if (Platform.OS === 'android') {
            const apiLevel = Number(Platform.Version);
            
            // For Android 12 (API 31) and above
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
            } 
            // For Android 11 and below
            else {
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
                if (!hasPermission) {
                    console.log('Printer init blocked: Missing Bluetooth permissions.');
                    return;
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
        if (isExpoGo) {
            throw new Error('Bluetooth scan tidak tersedia di Expo Go. Silakan gunakan Development Build (APK/IPA).');
        }

        await this.initPrinter();

        if (!this.bleManager) {
            throw new Error('Bluetooth Manager tidak terinisialisasi.');
        }

        const state = await this.bleManager.state();
        if (state !== 'PoweredOn') {
            throw new Error('Bluetooth Anda sedang mati. Silakan nyalakan Bluetooth terlebih dahulu.');
        }

        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
            throw new Error('Izin Bluetooth/Lokasi ditolak. Silakan berikan izin di pengaturan HP.');
        }

        if (this.isScanning) {
            this.bleManager.stopDeviceScan();
        }

        this.isScanning = true;
        console.log('Bluetooth: Starting scan...');
        this.bleManager.startDeviceScan(null, null, (error, device) => {
            if (error) {
                console.error('Scan Error:', error);
                return;
            }
            if (device && (device.name || device.localName)) {
                console.log(`Bluetooth: Found device ${device.name} (${device.id})`);
                onDeviceFound(device);
            }
        });

        // Auto stop scan after 15 seconds
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

    static async getBase64FromUrl(url: string): Promise<string | null> {
        try {
            const encodedUrl = encodeURI(url);
            console.log(`[PrinterManager] Fetching logo: ${url}`);
            const response = await fetch(encodedUrl);
            
            if (!response.ok) {
                console.error(`[PrinterManager] Fetch failed: ${response.status}`);
                return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            const rawBase64 = Buffer.from(arrayBuffer).toString('base64');
            
            // [CRITICAL] Remove ANY prefix like data:image/png;base64, or data:application/octet-stream;base64,
            // Native Android Base64.decode FAILS if these prefixes exist.
            const cleanedBase64 = rawBase64.replace(/^data:.*?;base64,/, '').replace(/\s/g, '');
            
            console.log(`[PrinterManager] Logo converted. Length: ${cleanedBase64.length}`);
            
            if (cleanedBase64.length < 50) {
                console.warn('[PrinterManager] Warning: Logo data too short.');
                return null;
            }

            return cleanedBase64;
        } catch (error) {
            console.error('[PrinterManager] Error in getBase64FromUrl:', error);
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
            // BLEPrinter.connectPrinter often returns fast if already connected
            await BLEPrinter.connectPrinter(mac);
            this.connectionStatus[mac] = 'connected';
            return true;
        } catch (e) {
            this.connectionStatus[macAddress.toUpperCase()] = 'disconnected';
            return false;
        }
    }

    static padColumns(left: string | null | undefined, right: string | null | undefined, width: number = 32): string {
        const leftStr = left || '';
        const rightStr = right || '';
        const spaceCount = width - (leftStr.length + rightStr.length);
        if (spaceCount <= 0) return left + ' ' + right;
        return left + ' '.repeat(spaceCount) + right;
    }

    static formatReceipt(orderData: any, isPreview: boolean = false, skipInit: boolean = false): string {
        if (!isPreview) {
            console.log('[PrinterManager] formatReceipt data summary:', {
                order_no: orderData.orderNo || orderData.order_no,
                items_count: orderData.items?.length,
                total: orderData.total || orderData.total_amount
            });
        }
        try {
            const { 
            shop_name, shopName,
            shop_address, shopAddress,
            shop_phone, shopPhone,
            items = [], 
            total, 
            service_charge, 
            tax, 
            discount,
            payment_method, 
            order_no, orderNo,
            created_at, date: orderDate,
            customer_name, customerName,
            customer_level,
            show_header,
            show_footer,
            show_waiter,
            show_date,
            show_table,
            show_customer_name,
            waiter_name, waiterName,
            table_no, tableNo,
            wifi_voucher, wifiVoucher,
            wifi_voucher_notice, wifiNotice, wifi_notice,
            receipt_header, receiptHeader,
            receipt_footer, receiptFooter,
            receipt_paper_width,
            show_logo
        } = orderData;

        // Determine width based on paper setting: 58mm = 32 chars, 80mm = 42 chars
        const paperWidth = receipt_paper_width === '80mm' ? 42 : 32;

        const displayShopName = receipt_header || receiptHeader || shop_name || shopName || 'WINNY COFFEE PNK';
        const displayAddress = shop_address || shopAddress || '';
        const displayPhone = shop_phone || shopPhone || '';
        const displayDate = show_date !== false ? (created_at || orderDate ? new Date(created_at || orderDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')) : '';
        const displayOrderNo = order_no || orderNo || '-';
        const displayWaiterName = waiter_name || waiterName || '';
        const displayTableNo = table_no || tableNo || '';
        const displayCustomerName = customer_name || customerName || '';
        
        const isWifiEnabled = orderData.enable_wifi_vouchers || false;
        const minAmount = Number(orderData.wifi_voucher_min_amount) || 0;
        const multiplier = Number(orderData.wifi_voucher_multiplier) || 0;
        const saleTotal = Number(total || orderData.total_amount) || 0;
        
        let displayWifiVoucher = wifi_voucher || wifiVoucher || '';
        
        // [NEW] Placeholder logic for Preview - Matches POSScreen logic for count
        if (!displayWifiVoucher && isPreview && isWifiEnabled && saleTotal >= minAmount) {
            const effectiveMultiplier = multiplier > 0 ? multiplier : minAmount;
            let count = 1;
            if (effectiveMultiplier > 0) {
                count = Math.floor(saleTotal / effectiveMultiplier);
            }
            // Generate multiple placeholders joined by comma
            displayWifiVoucher = Array(Math.max(1, count)).fill('XXXX-XXXX').join(', ');
        }

        const displayWifiNotice = (wifi_voucher_notice || wifiNotice || wifi_notice || 'Gunakan kode ini untuk akses WiFi').trim();
        const displayReceiptFooter = (receipt_footer || receiptFooter || 'Terima Kasih Atas\nKunjungan Anda').trim();

        const CENTER = isPreview ? '[C]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = isPreview ? '[L]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = isPreview ? '<b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = isPreview ? '</b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_2HEIGHT; // Use 2nd height instead of 4SQUARE for better width safety
        const DOUBLE_OFF = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        const LINE = '-'.repeat(paperWidth) + '\n';
        
        let receiptText = '';

        // Logo Placeholder for Preview
        if (show_logo && isPreview) {
            receiptText += '[LOGO]\n';
        }
        
        // Header
        // Use only BOLD if paper is 58mm to prevent cutting off Shop Name
        const shopNameDouble = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        receiptText += CENTER + BOLD_ON + shopNameDouble + displayShopName.toUpperCase() + (shopNameDouble ? DOUBLE_OFF : '') + BOLD_OFF + '\n';
        if (displayAddress) receiptText += displayAddress + '\n';
        if (displayPhone) receiptText += 'Telp: ' + displayPhone + '\n';
        receiptText += LINE;

        receiptText += LEFT;
        receiptText += `No: ${displayOrderNo}\n`;
        if (displayDate) receiptText += `Waktu: ${displayDate}\n`;
        
        if (show_table !== false && displayTableNo && displayTableNo !== 'Tanpa Meja') {
            receiptText += `Meja: ${displayTableNo}\n`;
        }
        
        if (show_customer_name !== false && displayCustomerName && displayCustomerName !== 'Guest') {
            receiptText += `Pelanggan: ${displayCustomerName}\n`;
            if (customer_level) {
                receiptText += `Status: ${customer_level}\n`;
            }
        }

        if (orderData.show_cashier_name !== false && orderData.cashier_name && orderData.cashier_name !== '-') {
            receiptText += `Kasir: ${orderData.cashier_name}\n`;
        }

        if (show_waiter !== false && displayWaiterName && displayWaiterName !== '-') {
            receiptText += `Pelayan: ${displayWaiterName}\n`;
        }
        
        receiptText += CENTER + LINE;
        receiptText += LEFT;
 
        const safeItems = items || [];
        console.log('[PrinterManager] Formatting items, count:', safeItems.length);
        safeItems.forEach((item: any) => {
            const qtyStr = `${item.quantity}x `;
            const nameStr = item.name;
            const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0;
            const itemQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || '1').replace(/[^0-9.]/g, '')) || 1;
            const price = (itemPrice * itemQty).toLocaleString('id-ID');
            
            const isTaxed = item.is_taxed || item.product?.is_taxed;
            const taxRate = Number(orderData.tax_rate || 10); // Default to 10 if not set
            const itemTaxTotal = isTaxed ? (itemPrice * itemQty * taxRate) / 100 : 0;
            const taxStr = itemTaxTotal > 0 ? ` (Pjk: Rp ${itemTaxTotal.toLocaleString('id-ID')})` : '';
            
            if (isPreview) {
                // For preview, use the [R] tag that the Modal expects
                receiptText += `[L]${qtyStr}${nameStr}${taxStr}[R]${price}\n`;
            } else {
                // Layout alignment: Label + Value = paperWidth
                const valWidth = 12;
                const labelWidth = paperWidth - valWidth;
                const itemLine = qtyStr + (nameStr || '') + taxStr;

                if (itemLine.length > labelWidth) {
                    receiptText += itemLine + '\n';
                    receiptText += ' '.repeat(labelWidth) + price.padStart(valWidth) + '\n';
                } else {
                    receiptText += itemLine.padEnd(labelWidth) + price.padStart(valWidth) + '\n';
                }
            }

            if (item.notes) {
                if (isPreview) {
                    receiptText += `[L]  (${item.notes})\n`;
                } else {
                    receiptText += `  (${item.notes})\n`;
                }
            }
        });
  
        const safeItemsForSummary = items || [];
        const subtotal = safeItemsForSummary.reduce((sum: number, item: any) => {
            const p = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0;
            const q = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || '1').replace(/[^0-9.]/g, '')) || 1;
            return sum + (p * q);
        }, 0);

        const subtotalStr = subtotal.toLocaleString('id-ID');
        
        const parseNum = (val: any) => typeof val === 'number' ? val : parseFloat(String(val || '0').replace(/[^0-9.]/g, '')) || 0;

        const taxVal = parseNum(orderData.tax || orderData.tax_amount);
        const serviceVal = parseNum(orderData.service_charge || orderData.service_amount);
        const discountVal = parseNum(orderData.discount);
        const totalVal = parseNum(total || orderData.total_amount);

        const taxStr = taxVal.toLocaleString('id-ID');
        const serviceStr = serviceVal.toLocaleString('id-ID');
        const discountStr = discountVal.toLocaleString('id-ID');
        const totalStr = totalVal.toLocaleString('id-ID');

        receiptText += CENTER + LINE;
        receiptText += LEFT;

        if (isPreview) {
            receiptText += `[L]Subtotal[R]${subtotalStr}\n`;
            if (discountVal > 0) {
                receiptText += `[L]Diskon[R]-${discountStr}\n`;
            }
            
            if (serviceVal > 0) {
                const sRate = orderData.service_rate ? ` (${orderData.service_rate}%)` : '';
                receiptText += `[L]Layanan${sRate}[R]${serviceStr}\n`;
            }
            if (taxVal > 0) {
                const tRate = orderData.tax_rate ? ` (${orderData.tax_rate}%)` : '';
                receiptText += `[L]Pajak${tRate}[R]${taxStr}\n`;
            }
            receiptText += `[L]<b>TOTAL</b>[R]<b>${totalStr}</b>\n`;
            receiptText += LINE;
            receiptText += `[L]${payment_method || 'Tunai'}[R]${Number(orderData.paid_amount || totalVal).toLocaleString('id-ID')}\n`;
            
            const changeVal = orderData.change !== undefined ? orderData.change : 0;
            receiptText += `[L]Kembali[R]${Number(changeVal).toLocaleString('id-ID')}\n`;
        } else {
            const summaryValWidth = 12;
            const summaryLabelWidth = paperWidth - summaryValWidth;

            receiptText += 'Subtotal'.padEnd(summaryLabelWidth) + subtotalStr.padStart(summaryValWidth) + '\n';

            if (discountVal > 0) {
                receiptText += 'Diskon'.padEnd(summaryLabelWidth) + ('-' + discountStr).padStart(summaryValWidth) + '\n';
            }
            
            if (serviceVal > 0) {
                const sRate = orderData.service_rate ? ` (${orderData.service_rate}%)` : '';
                receiptText += ('Layanan' + sRate).padEnd(summaryLabelWidth) + serviceStr.padStart(summaryValWidth) + '\n';
            }
            if (taxVal > 0) {
                const tRate = orderData.tax_rate ? ` (${orderData.tax_rate}%)` : '';
                receiptText += ('Pajak' + tRate).padEnd(summaryLabelWidth) + taxStr.padStart(summaryValWidth) + '\n';
            }

            // TOTAL: BOLD + Double Height (Taller font, sync with web 0x01)
            receiptText += BOLD_ON + DOUBLE_ON + 'TOTAL'.padEnd(summaryLabelWidth) + totalStr.padStart(summaryValWidth) + DOUBLE_OFF + BOLD_OFF + '\n';
            receiptText += LINE;
            
            const paidVal = orderData.paid_amount !== undefined ? Number(orderData.paid_amount) : totalVal;
            const changeVal = orderData.change !== undefined ? Number(orderData.change) : 0;

            receiptText += (payment_method || 'Tunai').padEnd(summaryLabelWidth) + paidVal.toLocaleString('id-ID').padStart(summaryValWidth) + '\n';
            receiptText += 'Kembali'.padEnd(summaryLabelWidth) + changeVal.toLocaleString('id-ID').padStart(summaryValWidth) + '\n';
        }
        
        receiptText += LINE;
        
        // WiFi Voucher
        if (displayWifiVoucher) {
            receiptText += CENTER;
            receiptText += displayWifiNotice + '\n';
            
            // [MODIFIED] Print vouchers horizontally to save paper
            const vouchers = displayWifiVoucher.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0);
            receiptText += BOLD_ON + DOUBLE_ON + vouchers.join('  ') + DOUBLE_OFF + BOLD_OFF + '\n';
            receiptText += LINE;
        }

        receiptText += CENTER;
        receiptText += displayReceiptFooter + '\n';
        
        if (!isPreview) {
            // Feed more lines (dynamic) and partial cut if supported
            // This ensures the bottom of the receipt is fully pushed out of the printer
            const feedLines = orderData.receipt_footer_feed !== undefined ? Number(orderData.receipt_footer_feed) : 3;
            receiptText += '\n'.repeat(feedLines) + COMMANDS.PAPER.PAPER_FULL_CUT;
        }
        
        return receiptText;
        } catch (e: any) {
            console.error('[PrinterManager] Error in formatReceipt:', e);
            if (e.stack) console.error('[PrinterManager] formatReceipt stack:', e.stack);
            throw e;
        }
    }

    static formatKitchenTicket(items: any[], orderData: any, targetName: string, settings: any = {}): string {
        const { order_no, orderNo, table_no, tableNo, created_at, date: orderDate, waiter_name, waiterName, notes, customer_name, customerName } = orderData;
        
        const displayOrderNo = order_no || orderNo || '-';
        const displayTableNo = table_no || tableNo || '';
        const displayDate = created_at || orderDate ? new Date(created_at || orderDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
        const displayWaiter = waiter_name || waiterName || '';
        const displayCustomer = customer_name || customerName || '';

        const { 
            showTableLarge = true, 
            showCustomer = true, 
            showWaiter = true, 
            showTime = true, 
            showCashier = true,
            doubleHeightItems = true 
        } = settings;

        const targetInnerName = targetName.toLowerCase().trim();
        const isKitchenTarget = targetInnerName === 'dapur' || targetInnerName === 'kitchen' || targetInnerName === 'kds';
        const isBarTarget = targetInnerName === 'bar';

        const drinkKeywords = [
            'minum', 'drink', 'beverage', 'juice', 'jus', 'tea', 'teh', 'coffee', 'kopi', 
            'susu', 'milk', 'water', 'air', 'mineral', 'soda', 'cola', 'coke', 'sprite', 'fanta',
            'beer', 'bir', 'wine', 'cocktail', 'mocktail', 'smoothie', 'shake', 'milo', 
            'boba', 'thai tea', 'green tea', 'lemongrass', 'jeruk', 'lemon', 'alpukat', 'mangga', 
            'strawberry', 'jahe', 'madu', 'sirup', 'cendol', 'dawet', 'wedang', 'gembira', 'arak',
            'espresso', 'latte', 'cappuccino', 'frappe', 'yakult', 'mojito', 'cincau', 'selasih',
            'melon', 'semangka', 'sirsak', 'kelapa', 'lemonade', 'soda gembira', 'teh botol',
            'teh pucuk', 'aqua', 'ades', 'le minerale', 'pucuk harum', 'pop ice', 'nutrisari'
        ];

        const targetItems = (items || []).filter(item => {
            const itemTarget = (item.target || '').toLowerCase().trim();
            const nameLow = (item.name || '').toLowerCase();
            const categoryLow = (item.category || '').toLowerCase();
            
            const isDrink = drinkKeywords.some(k => {
                const hasMatch = nameLow.includes(k) || categoryLow.includes(k);
                if (!hasMatch) return false;

                if (k === 'tea' && (nameLow.includes('steak') || nameLow.includes('steam'))) {
                    return /\btea\b/i.test(nameLow) || /\btea\b/i.test(categoryLow);
                }
                if (k === 'air' && (nameLow.includes('eclair') || nameLow.includes('clair'))) {
                    return /\bair\b/i.test(nameLow) || /\bair\b/i.test(categoryLow);
                }
                if (k === 'bir' && nameLow.includes('biryani')) {
                    return /\bbir\b/i.test(nameLow) || /\bbir\b/i.test(categoryLow);
                }
                return true;
            }) || 
            nameLow.startsWith('es ') || nameLow.startsWith('ice ') || 
            nameLow.includes(' es ') || nameLow.includes(' ice ') ||
            nameLow.includes(' panas') || nameLow.includes(' hot') || 
            nameLow.includes(' dingin') || nameLow.includes(' cold');

            if (isKitchenTarget) {
                if (itemTarget === 'bar') return false;
                if (itemTarget === 'kitchen' || itemTarget === 'dapur' || itemTarget === 'kds') return true;
                if (itemTarget === 'waitress' || itemTarget === '' || itemTarget === 'null' || !itemTarget) {
                    return !isDrink;
                }
                return false;
            }
            
            if (isBarTarget) {
                if (itemTarget === 'bar') return true;
                if (itemTarget === 'waitress' || itemTarget === '' || itemTarget === 'null' || !itemTarget) {
                    return isDrink;
                }
                return false;
            }
            
            return itemTarget === targetInnerName;
        });

        console.log(`[PrinterManager] Target ${targetName}: Found ${targetItems.length} items`);

        if (targetItems.length === 0) return '';

        const CENTER = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        const DOUBLE_OFF = COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        const LINE = '--------------------------------\n';

        let ticketText = '';
        ticketText += CENTER + BOLD_ON + DOUBLE_ON + `PESANAN ${targetName.toUpperCase()}` + DOUBLE_OFF + BOLD_OFF + '\n';
        ticketText += CENTER + `No: ${displayOrderNo}\n`;

        if (displayTableNo && displayTableNo !== 'Tanpa Meja') {
            if (showTableLarge) {
                ticketText += CENTER + BOLD_ON + DOUBLE_ON + `MEJA: ${displayTableNo}` + DOUBLE_OFF + BOLD_OFF + '\n';
            } else {
                ticketText += CENTER + BOLD_ON + `MEJA: ${displayTableNo}` + BOLD_OFF + '\n';
            }
        }

        if (showCustomer && displayCustomer && displayCustomer !== 'Guest') {
            ticketText += CENTER + `Pelanggan: ${displayCustomer}\n`;
        }
        ticketText += CENTER + LINE;

        ticketText += LEFT;
        targetItems.forEach((item: any) => {
            if (doubleHeightItems) {
                ticketText += BOLD_ON + DOUBLE_ON + `${item.quantity}x ${item.name}` + DOUBLE_OFF + BOLD_OFF + '\n';
            } else {
                ticketText += BOLD_ON + `${item.quantity}x ${item.name}` + BOLD_OFF + '\n';
            }
            if (item.note || item.notes) {
                ticketText += `   * Catatan: ${item.note || item.notes}\n`;
            }
            ticketText += '\n';
        });

        ticketText += CENTER + LINE;
        if (showTime) ticketText += CENTER + `Waktu: ${displayDate}\n`;
        if (showWaiter && displayWaiter) ticketText += CENTER + `Pelayan: ${displayWaiter}\n`;
        if (showCashier && orderData?.cashier_name && orderData.cashier_name !== '-') ticketText += CENTER + `Kasir: ${orderData.cashier_name}\n`;
        if (notes) ticketText += CENTER + `Catatan: ${notes}\n`;

        const feedLines = orderData.receipt_footer_feed !== undefined ? Number(orderData.receipt_footer_feed) : 4;
        ticketText += '\n'.repeat(feedLines) + COMMANDS.PAPER.PAPER_FULL_CUT;
        
        return ticketText;
    }

    static async getProductionSettings() {
        try {
            const saved = await AsyncStorage.getItem('production_settings');
            return saved ? JSON.parse(saved) : {
                showTableLarge: true,
                showCustomer: true,
                showWaiter: true,
                showTime: true,
                showCashier: true,
                doubleHeightItems: true
            };
        } catch (e) {
            return {
                showTableLarge: true,
                showCustomer: true,
                showWaiter: true,
                showTime: true,
                showCashier: true,
                doubleHeightItems: true
            };
        }
    }

    static async printToTarget(items: any[], type: PrinterType, orderData: any) {
        if (!items || items.length === 0) return true;

        // 1. Check LOCAL enabled status from this device (AsyncStorage)
        try {
            const localEnableKey = type === 'kitchen' ? 'enable_kitchen_printing' : 'enable_bar_printing';
            const localEnabled = await AsyncStorage.getItem(localEnableKey);
            if (localEnabled === 'false') {
                console.log(`[PrinterManager] Local ${type} printing is DISABLED on this device. Skipping.`);
                return true;
            }
        } catch (e) {
            console.warn('[PrinterManager] Error checking local printer enablement:', e);
        }

        let macAddress = await this.getSelectedPrinter(type);
        const settings = await this.getProductionSettings();
        const targetName = type === 'kitchen' ? 'Dapur' : (type === 'bar' ? 'Bar' : 'Kasir');
        const ticketText = this.formatKitchenTicket(items, orderData, targetName, settings);
        
        if (!ticketText) return true; // No items for this target, skip silently

        if (!macAddress) {
            console.warn(`Printer ${type} not configured.`);
            // Return false to indicate unconfigured status to UI
            return false; 
        }

        try {
            if (isExpoGo || Platform.OS === 'web') {
                console.log(`[Sim] Printing to ${targetName}:`, ticketText);
                return true;
            }
            
            await this.initPrinter();
            const mac = (macAddress || '').toUpperCase();
            if (!mac) throw new Error('Printer address missing');
             
            // [OPTIMIZED] Skip connection delay if already connected
            if (this.connectionStatus[mac] !== 'connected') {
                this.connectionStatus[mac] = 'connecting';
                await BLEPrinter.connectPrinter(mac);
                this.connectionStatus[mac] = 'connected';
                // Small delay (500ms) to ensure printer is ready
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                console.log(`Bluetooth (${targetName}): Already connected to ${mac}, skip waiting.`);
            }
            
            await BLEPrinter.printBill(ticketText);
            return true;
        } catch (error) {
            console.error(`Print ${type} Error:`, error);
            this.connectionStatus[macAddress.toUpperCase()] = 'disconnected';
            return false;
        }
    }
    
    static async printOrderReceipt(orderData: any) {
        if (!orderData) {
            console.error('[PrinterManager] printOrderReceipt: orderData is null/undefined');
            return false;
        }

        // 1. Check LOCAL enabled status
        try {
            const isEnabled = await AsyncStorage.getItem('enable_receipt_printing');
            if (isEnabled === 'false') {
                console.log('[PrinterManager] Receipt printing is locally disabled. Skipping.');
                return true;
            }
        } catch (e) {
            console.warn('[PrinterManager] Error checking local receipt enablement:', e);
        }
        let macAddress = await this.getSelectedPrinter();
        if (!macAddress) {
            console.warn('Printer not selected. Skipping print.');
            return true;
        }
        macAddress = macAddress.toUpperCase();
        console.log('[PrinterManager] printOrderReceipt: macAddress =', macAddress);
        const hasLogo = !!(orderData.show_logo && orderData.receipt_logo_url);
        const receiptText = this.formatReceipt(orderData, false, hasLogo);
        console.log('[PrinterManager] printOrderReceipt: receiptText length =', receiptText?.length);

        try {
            if (isExpoGo) {
                console.warn('Printing tidak tersedia di Expo Go.');
                return true;
            }

            if (Platform.OS === 'web') {
                console.warn('Printing Bluetooth tidak tersedia di Web.');
                return false;
            }

            await this.initPrinter();

            console.log(`Bluetooth: Attempting to connect to ${macAddress}...`);
            this.connectionStatus[macAddress] = 'connecting';
            await BLEPrinter.connectPrinter(macAddress);
            this.connectionStatus[macAddress] = 'connected';
            console.log('Bluetooth: Connected successfully!');
            
            // Wait for printer to be completely ready
            await new Promise(resolve => setTimeout(resolve, 500));

            if (orderData.show_logo && orderData.receipt_logo_url) {
                try {
                    const imageData = await this.getBase64FromUrl(orderData.receipt_logo_url);
                    
                    if (imageData && imageData.length > 50) {
                        await BLEPrinter.printImageBase64(imageData, {
                            align: 'center',
                            imageWidth: 200 
                        });
                        // Delay after image to allow processing
                        await new Promise(resolve => setTimeout(resolve, 400));
                    }
                } catch (imgError) {
                    console.error('[PrinterManager] Logo Print Error:', imgError);
                }
            }

            // 3. Then print text
            console.log('Bluetooth: Sending print job...');
            await BLEPrinter.printBill(receiptText);
            console.log('Bluetooth: Print job sent!');
            
            return true;
        } catch (error: any) {
            console.error('Print Error:', error);
            const errorMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            throw new Error(errorMsg);
        }
    }

    static async testPrint(type: PrinterType = 'receipt') {
        let macAddress = await this.getSelectedPrinter(type);
        if (!macAddress) throw new Error(`Pilih printer ${type} terlebih dahulu.`);

        macAddress = macAddress.toUpperCase();
        
        const targetLabel = type === 'kitchen' ? 'DAPUR' : (type === 'bar' ? 'BAR' : (type === 'report' ? 'LAPORAN' : 'KASIR'));
        
        const CENTER = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const LINE = '--------------------------------\n';

        const testText = 
            CENTER + BOLD_ON + `TEST PRINT ${targetLabel}` + BOLD_OFF + '\n' +
            CENTER + 'Pencetakan Berhasil\n' +
            CENTER + LINE +
            LEFT + this.padColumns('Status:', 'Berhasil!') + '\n' +
            LEFT + this.padColumns('Printer:', 'Connected') + '\n' +
            CENTER + LINE +
            CENTER + new Date().toLocaleString('id-ID') + '\n' +
            '\n\n\n' + COMMANDS.PAPER.PAPER_FULL_CUT;

        try {
            if (isExpoGo) {
                Alert.alert('Info', 'Test Print di Expo Go (Simulasi)');
                return true;
            }

            await this.initPrinter();

            // 1. Connect first
            await BLEPrinter.connectPrinter(macAddress);

            // 2. Then print
            await BLEPrinter.printBill(testText);

            return true;
        } catch (error) {
            console.error('Test Print Error:', error);
            throw error;
        }
    }

    static formatSalesReport(reportData: any, isPreview: boolean = false): string {
        const {
            shopName,
            address,
            phone,
            dateRange,
            totalSales,
            totalTax = 0,
            totalDiscount = 0,
            totalOrders,
            paymentSummary = [],
            categorySummary = [],
            generatedBy,
            receipt_paper_width,
            showTax = true,
            showDiscount = true,
            showLogo = true,
            showDate = true,
            showQRISDetails = true,
            receiptFooter
        } = reportData;

        // Determine width based on paper setting: 58mm = 32 chars, 80mm = 42 chars
        const paperWidth = receipt_paper_width === '80mm' ? 42 : 32;

        const CENTER = isPreview ? '[C]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = isPreview ? '[L]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = isPreview ? '<b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = isPreview ? '</b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_2HEIGHT;
        const DOUBLE_OFF = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        const LINE = '-'.repeat(paperWidth) + '\n';
        const DLINE = '='.repeat(paperWidth) + '\n';

        let text = '';
        
        // Logo Placeholder for Preview
        if (showLogo && isPreview) {
            text += '[LOGO]\n';
        }

        const displayShopName = reportData.receiptHeader || reportData.receipt_header || reportData.shopName || reportData.shop_name || 'WINNY POS';
        const displayAddress = reportData.address || reportData.shopAddress || reportData.shop_address || '';
        const displayPhone = reportData.phone || reportData.shopPhone || reportData.shop_phone || '';

        const shopNameDouble = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        text += CENTER + BOLD_ON + shopNameDouble + displayShopName.toUpperCase() + (shopNameDouble ? DOUBLE_OFF : '') + BOLD_OFF + '\n';
        
        if (displayAddress) text += CENTER + displayAddress + '\n';
        if (displayPhone) text += CENTER + (displayPhone.startsWith('Telp:') ? displayPhone : 'Telp: ' + displayPhone) + '\n';
        text += CENTER + LINE;
        
        text += CENTER + BOLD_ON + DOUBLE_ON + 'LAPORAN PENJUALAN' + DOUBLE_OFF + BOLD_OFF + '\n';
        if (showDate !== false) {
            text += CENTER + dateRange + '\n';
        }
        text += CENTER + DLINE;

        text += LEFT;
        text += this.padColumns('Transaksi:', String(totalOrders), paperWidth) + '\n';
        text += BOLD_ON + this.padColumns('TOTAL NET:', totalSales.toLocaleString('id-ID'), paperWidth) + BOLD_OFF + '\n';
        
        if (showTax && totalTax > 0) {
            text += this.padColumns('Total Pajak:', totalTax.toLocaleString('id-ID'), paperWidth) + '\n';
        }
        if (showDiscount && totalDiscount > 0) {
            text += this.padColumns('Total Diskon:', '-' + totalDiscount.toLocaleString('id-ID'), paperWidth) + '\n';
        }
        
        text += LINE;

        if (paymentSummary.length > 0) {
            text += BOLD_ON + 'METODE PEMBAYARAN' + BOLD_OFF + '\n';
            
            if (showQRISDetails === false) {
                // If QRIS details disabled, group all non-cash into "NON-TUNAI"
                const cashTotal = paymentSummary.find((p: any) => p.method.toUpperCase() === 'TUNAI' || p.method.toUpperCase() === 'CASH')?.amount || 0;
                const totalAmount = paymentSummary.reduce((sum: number, p: any) => sum + p.amount, 0);
                const nonCashTotal = totalAmount - cashTotal;
                
                text += this.padColumns('TUNAI', cashTotal.toLocaleString('id-ID'), paperWidth) + '\n';
                if (nonCashTotal > 0) {
                    text += this.padColumns('NON-TUNAI', nonCashTotal.toLocaleString('id-ID'), paperWidth) + '\n';
                }
            } else {
                paymentSummary.forEach((p: any) => {
                    text += this.padColumns(p.method, p.amount.toLocaleString('id-ID'), paperWidth) + '\n';
                });
            }
            text += LINE;
        }

        if (categorySummary.length > 0) {
            text += BOLD_ON + 'RINGKASAN KATEGORI' + BOLD_OFF + '\n';
            categorySummary.forEach((c: any) => {
                const catName = (c.name || c.category || 'LAINNYA').toUpperCase();
                text += this.padColumns(catName, c.amount.toLocaleString('id-ID'), paperWidth) + '\n';
            });
            text += LINE;
        }

        const prodSummary = reportData.productSummary || [];
        if (prodSummary.length > 0) {
            text += BOLD_ON + 'RINCIAN PENJUALAN PRODUK' + BOLD_OFF + '\n';
            prodSummary.forEach((p: any) => {
                const label = `${p.quantity}x ${p.name}`;
                const value = p.amount.toLocaleString('id-ID');
                const valWidth = 10;
                const labelWidth = paperWidth - valWidth;
                
                if (label.length > labelWidth) {
                    text += label + '\n';
                    text += ' '.repeat(labelWidth) + value.padStart(valWidth) + '\n';
                } else {
                    text += label.padEnd(labelWidth) + value.padStart(valWidth) + '\n';
                }
            });
            text += LINE;
        }

        // Add Financial Summary Section
        text += BOLD_ON + 'RINGKASAN KEUANGAN' + BOLD_OFF + '\n';
        text += this.padColumns('MODAL AWAL:', (reportData.openingBalance || 0).toLocaleString('id-ID'), paperWidth) + '\n';
        text += this.padColumns('PENERIMAAN TUNAI:', (reportData.cashTotal || 0).toLocaleString('id-ID'), paperWidth) + '\n';
        text += this.padColumns('PENERIMAAN NON-TUNAI:', (reportData.qrTotal || 0).toLocaleString('id-ID'), paperWidth) + '\n';
        text += DLINE;
        text += BOLD_ON + this.padColumns('TOTAL SEHARUSNYA:', (reportData.expectedCash || 0).toLocaleString('id-ID'), paperWidth) + BOLD_OFF + '\n';
        text += this.padColumns('FISIK (LACI):', (reportData.actualCash || 0).toLocaleString('id-ID'), paperWidth) + '\n';
        text += BOLD_ON + this.padColumns('SELISIH:', (reportData.variance || 0).toLocaleString('id-ID'), paperWidth) + BOLD_OFF + '\n';
        text += LINE;

        text += CENTER + '\n';
        text += CENTER + 'Waktu Cetak: ' + new Date().toLocaleString('id-ID') + '\n';
        if (generatedBy) text += CENTER + 'Kasir: ' + generatedBy + '\n';
        
        if (receiptFooter) {
            text += CENTER + LINE;
            text += CENTER + receiptFooter + '\n';
        }
        
        text += '\n\n\n' + (isPreview ? '' : COMMANDS.PAPER.PAPER_FULL_CUT);

        return text;
    }

    static async printSalesReport(reportData: any) {
        let macAddress = await this.getSelectedPrinter('report');
        // Fallback to receipt printer if report printer not set
        if (!macAddress) {
            macAddress = await this.getSelectedPrinter('receipt');
        }
        
        if (!macAddress) throw new Error('Printer belum diatur. Silakan atur printer di Pengaturan.');
        
        const reportText = this.formatSalesReport(reportData);
        const logoUrl = reportData.showLogo ? reportData.receiptLogoUrl : null;
        
        try {
            if (isExpoGo || Platform.OS === 'web') {
                console.log('[Sim] Printing Report:', reportText);
                return true;
            }
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            // [OPTIMIZED] Skip connection delay if already connected
            if (this.connectionStatus[mac] !== 'connected') {
                this.connectionStatus[mac] = 'connecting';
                await BLEPrinter.connectPrinter(mac);
                this.connectionStatus[mac] = 'connected';
                // Reduced delay from 1500ms to 500ms
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Print Logo if enabled
            if (logoUrl) {
                try {
                    const imageData = await this.getBase64FromUrl(logoUrl);
                    if (imageData && imageData.length > 50) {
                        await BLEPrinter.printImageBase64(imageData, {
                            align: 'center',
                            imageWidth: 200 
                        });
                        // Reduced delay from 1200ms to 400ms after logo
                        await new Promise(resolve => setTimeout(resolve, 400));
                    }
                } catch (imgError) {
                    console.error('[PrinterManager] Report Logo Print Error:', imgError);
                }
            }

            await BLEPrinter.printBill(reportText);
            return true;
        } catch (e: any) {
            console.error('Print Report Error:', e);
            throw e;
        }
    }
}
