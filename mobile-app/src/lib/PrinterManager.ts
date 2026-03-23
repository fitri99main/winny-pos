import { BleManager, Device } from 'react-native-ble-plx';
import { BLEPrinter, IBLEPrinter, COMMANDS } from '@haroldtran/react-native-thermal-printer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

const PRINTER_STORAGE_KEY = '@selected_printer_address';
const KITCHEN_PRINTER_KEY = '@kitchen_printer_address';
const BAR_PRINTER_KEY = '@bar_printer_address';

export type PrinterType = 'receipt' | 'kitchen' | 'bar';

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
        const key = type === 'kitchen' ? KITCHEN_PRINTER_KEY : (type === 'bar' ? BAR_PRINTER_KEY : PRINTER_STORAGE_KEY);
        await AsyncStorage.setItem(key, macAddress);
    }

    static async forgetSelectedPrinter(type: PrinterType = 'receipt') {
        const key = type === 'kitchen' ? KITCHEN_PRINTER_KEY : (type === 'bar' ? BAR_PRINTER_KEY : PRINTER_STORAGE_KEY);
        await AsyncStorage.removeItem(key);
    }

    static async getSelectedPrinter(type: PrinterType = 'receipt') {
        const key = type === 'kitchen' ? KITCHEN_PRINTER_KEY : (type === 'bar' ? BAR_PRINTER_KEY : PRINTER_STORAGE_KEY);
        return await AsyncStorage.getItem(key);
    }

    static getConnectionStatus(macAddress: string) {
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

    static padColumns(left: string, right: string, width: number = 32): string {
        const spaceCount = width - (left.length + right.length);
        if (spaceCount <= 0) return left + ' ' + right;
        return left + ' '.repeat(spaceCount) + right;
    }

    static formatReceipt(orderData: any, isPreview: boolean = false): string {
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

        const displayShopName = receipt_header || receiptHeader || shop_name || shopName || 'WINNY POS';
        const displayAddress = shop_address || shopAddress || '';
        const displayPhone = shop_phone || shopPhone || '';
        const displayDate = show_date !== false ? (created_at || orderDate ? new Date(created_at || orderDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')) : '';
        const displayOrderNo = order_no || orderNo || '-';
        const displayWaiterName = waiter_name || waiterName || '';
        const displayTableNo = table_no || tableNo || '';
        const displayCustomerName = customer_name || customerName || '';
        
        const isWifiEnabled = orderData.enable_wifi_vouchers || false;
        const minAmount = orderData.wifi_voucher_min_amount || 0;
        const saleTotal = total || orderData.total_amount || 0;
        
        let displayWifiVoucher = wifi_voucher || wifiVoucher || '';
        
        // [NEW] Placeholder logic for Preview
        if (!displayWifiVoucher && isPreview && isWifiEnabled && saleTotal >= minAmount) {
            displayWifiVoucher = 'XXXX-XXXX';
        }

        const displayWifiNotice = wifi_voucher_notice || wifiNotice || wifi_notice || 'Gunakan kode ini untuk akses WiFi';
        const displayReceiptFooter = receipt_footer || receiptFooter || 'Terima Kasih Atas\nKunjungan Anda';

        const CENTER = isPreview ? '[C]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = isPreview ? '[L]' : COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = isPreview ? '<b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = isPreview ? '</b>' : COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const DOUBLE_ON = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_2HEIGHT; // Use 2nd height instead of 4SQUARE for better width safety
        const DOUBLE_OFF = isPreview ? '' : COMMANDS.TEXT_FORMAT.TXT_NORMAL;
        const LINE = '-'.repeat(paperWidth) + '\n';
        
        let receiptText = isPreview ? '' : COMMANDS.HARDWARE.HW_INIT;

        // Logo Placeholder for Preview
        if (show_logo && isPreview) {
            receiptText += '[LOGO]\n';
        }
        
        // Header
        // Use only BOLD if paper is 58mm to prevent cutting off Shop Name
        const shopNameDouble = paperWidth >= 42 ? DOUBLE_ON : '';
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
 
        items.forEach((item: any) => {
            const qtyStr = `${item.quantity}x `;
            const nameStr = item.name;
            const price = ((item.price || 0) * (item.quantity || 1)).toLocaleString('id-ID');
            
            if (isPreview) {
                // For preview, use the [R] tag that the Modal expects
                receiptText += `[L]${qtyStr}${nameStr}[R]${price}\n`;
            } else {
                // Layout alignment: Label + Value = paperWidth
                const valWidth = 12;
                const labelWidth = paperWidth - valWidth;
                const itemLine = qtyStr + nameStr;

                if (itemLine.length > labelWidth) {
                    receiptText += itemLine + '\n';
                    receiptText += ' '.repeat(labelWidth) + price.padStart(valWidth) + '\n';
                } else {
                    receiptText += itemLine.padEnd(labelWidth) + price.padStart(valWidth) + '\n';
                }
            }
        });
  
        const subtotal = items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
        const subtotalStr = subtotal.toLocaleString('id-ID');
        const taxStr = (orderData.tax || 0).toLocaleString('id-ID');
        const serviceStr = (orderData.service_charge || 0).toLocaleString('id-ID');
        const discountStr = (orderData.discount || 0).toLocaleString('id-ID');
        const totalStr = (total || 0).toLocaleString('id-ID');

        receiptText += CENTER + LINE;
        receiptText += LEFT;

        if (isPreview) {
            receiptText += `[L]Subtotal[R]${subtotalStr}\n`;
            if (orderData.discount > 0) {
                receiptText += `[L]Diskon[R]-${discountStr}\n`;
                receiptText += LINE;
                const afterDiscount = subtotal - (orderData.discount || 0);
                receiptText += `[L]Total Stlh Diskon[R]${afterDiscount.toLocaleString('id-ID')}\n`;
                receiptText += LINE;
            }
            
            if (orderData.service_charge > 0) {
                const sRate = orderData.service_rate ? ` (${orderData.service_rate}%)` : '';
                receiptText += `[L]Layanan${sRate}[R]${serviceStr}\n`;
            }
            if (orderData.tax > 0) {
                const tRate = orderData.tax_rate ? ` (${orderData.tax_rate}%)` : '';
                receiptText += `[L]Pajak${tRate}[R]${taxStr}\n`;
            }
            receiptText += `[L]<b>TOTAL</b>[R]<b>${totalStr}</b>\n`;
            receiptText += LINE;
            receiptText += `[L]${payment_method || 'Tunai'}[R]${totalStr}\n`;
            receiptText += `[L]Kembali[R]0\n`;
        } else {
            const summaryValWidth = 12;
            const summaryLabelWidth = paperWidth - summaryValWidth;

            receiptText += 'Subtotal'.padEnd(summaryLabelWidth) + subtotalStr.padStart(summaryValWidth) + '\n';

            if (orderData.discount > 0) {
                receiptText += 'Diskon'.padEnd(summaryLabelWidth) + ('-' + discountStr).padStart(summaryValWidth) + '\n';
                receiptText += LINE;
                const afterDiscount = subtotal - (orderData.discount || 0);
                receiptText += 'Tot Stlh Diskon'.padEnd(summaryLabelWidth) + afterDiscount.toLocaleString('id-ID').padStart(summaryValWidth) + '\n';
                receiptText += LINE;
            }
            
            if (orderData.service_charge > 0) {
                const sRate = orderData.service_rate ? ` (${orderData.service_rate}%)` : '';
                receiptText += ('Layanan' + sRate).padEnd(summaryLabelWidth) + serviceStr.padStart(summaryValWidth) + '\n';
            }
            if (orderData.tax > 0) {
                const tRate = orderData.tax_rate ? ` (${orderData.tax_rate}%)` : '';
                receiptText += ('Pajak' + tRate).padEnd(summaryLabelWidth) + taxStr.padStart(summaryValWidth) + '\n';
            }

            receiptText += BOLD_ON + 'TOTAL'.padEnd(summaryLabelWidth) + totalStr.padStart(summaryValWidth) + BOLD_OFF + '\n';
            receiptText += LINE;
            
            receiptText += (payment_method || 'Tunai').padEnd(summaryLabelWidth) + totalStr.padStart(summaryValWidth) + '\n';
            receiptText += 'Kembali'.padEnd(summaryLabelWidth) + '0'.padStart(summaryValWidth) + '\n';
            receiptText += CENTER + '-- v1.1 --\n';
        }
        
        receiptText += LINE;
        
        // WiFi Voucher
        if (displayWifiVoucher) {
            receiptText += CENTER;
            receiptText += displayWifiNotice + '\n';
            // Use only BOLD for voucher code to ensure it fits on all paper widths
            receiptText += BOLD_ON + displayWifiVoucher + BOLD_OFF + '\n';
            receiptText += LINE;
        }

        receiptText += CENTER;
        receiptText += displayReceiptFooter + '\n';
        
        if (!isPreview) {
            // Feed more lines (dynamic) and partial cut if supported
            // This ensures the bottom of the receipt is fully pushed out of the printer
            const feedLines = orderData.receipt_footer_feed !== undefined ? Number(orderData.receipt_footer_feed) : 4;
            receiptText += '\n'.repeat(feedLines) + COMMANDS.PAPER.PAPER_FULL_CUT;
        }
        
        return receiptText;
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
            'espresso', 'latte', 'cappuccino', 'frappe', 'yakult', 'mojito', 'cincau', 'selasih'
        ];

        const targetItems = items.filter(item => {
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

        let ticketText = COMMANDS.HARDWARE.HW_INIT;
        ticketText += CENTER + BOLD_ON + DOUBLE_ON + `PESANAN ${targetName.toUpperCase()}` + DOUBLE_OFF + BOLD_OFF + '\n';
        ticketText += CENTER + `No: ${displayOrderNo}\n`;

        if (displayTableNo && displayTableNo !== 'Tanpa Meja') {
            if (showTableLarge) {
                ticketText += CENTER + BOLD_ON + DOUBLE_ON + `MEJA: ${displayTableNo}` + DOUBLE_OFF + BOLD_OFF + '\n';
            } else {
                ticketText += CENTER + BOLD_ON + `Meja: ${displayTableNo}` + BOLD_OFF + '\n';
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

        ticketText += LINE;
        if (showTime) ticketText += LEFT + `Waktu  : ${displayDate}\n`;
        if (showWaiter && displayWaiter) ticketText += `Pelayan: ${displayWaiter}\n`;
        if (showCashier && orderData?.cashier_name && orderData.cashier_name !== '-') ticketText += `Kasir  : ${orderData.cashier_name}\n`;
        if (notes) ticketText += `Catatan Pesanan: ${notes}\n`;

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

        let macAddress = await this.getSelectedPrinter(type);
        const settings = await this.getProductionSettings();
        const targetName = type === 'kitchen' ? 'Dapur' : (type === 'bar' ? 'Bar' : 'Kasir');
        const ticketText = this.formatKitchenTicket(items, orderData, targetName, settings);
        
        if (!ticketText) return true; // No items for this target, skip silently

        if (!macAddress) {
            console.warn(`Printer ${type} not configured.`);
            // Return false to indicate "skipping because not configured" but only if items were actually found
            return false; 
        }

        try {
            if (isExpoGo || Platform.OS === 'web') {
                console.log(`[Sim] Printing to ${targetName}:`, ticketText);
                return true;
            }
            
            await this.initPrinter();
            const mac = macAddress.toUpperCase();
            
            // Forced reconnect to ensure switching works between Kitchen/Bar/Cashier printers
            this.connectionStatus[mac] = 'connecting';
            await BLEPrinter.connectPrinter(mac);
            this.connectionStatus[mac] = 'connected';
            
            await BLEPrinter.printBill(ticketText);
            return true;
        } catch (error) {
            console.error(`Print ${type} Error:`, error);
            this.connectionStatus[macAddress.toUpperCase()] = 'disconnected';
            return false;
        }
    }
    
    static async printOrderReceipt(orderData: any) {
        let macAddress = await this.getSelectedPrinter();
        if (!macAddress) {
            console.warn('Printer not selected. Skipping print.');
            return false;
        }

        macAddress = macAddress.toUpperCase();
        const receiptText = this.formatReceipt(orderData);

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

            // 2. Then print
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
        
        const targetLabel = type === 'kitchen' ? 'DAPUR' : (type === 'bar' ? 'BAR' : 'KASIR');
        
        const CENTER = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        const LEFT = COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        const BOLD_ON = COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        const BOLD_OFF = COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        const LINE = '--------------------------------\n';

        const testText = 
            COMMANDS.HARDWARE.HW_INIT +
            CENTER + BOLD_ON + `TEST PRINT ${targetLabel}` + BOLD_OFF + '\n' +
            CENTER + 'Pencetakan Berhasil\n' +
            CENTER + LINE +
            LEFT + this.padColumns('Status:', 'Berhasil!') + '\n' +
            LEFT + this.padColumns('Printer:', 'Connected') + '\n' +
            CENTER + LINE +
            CENTER + new Date().toLocaleString('id-ID') + '\n' +
            '\n\n\n\n' + COMMANDS.PAPER.PAPER_FULL_CUT;

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
}
