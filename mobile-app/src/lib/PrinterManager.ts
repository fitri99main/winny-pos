import { BleManager, Device } from 'react-native-ble-plx';
import { BLEPrinter } from '@haroldtran/react-native-thermal-printer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

const PRINTER_STORAGE_KEY = '@selected_printer_address';
const isExpoGo = Constants.appOwnership === 'expo';

export class PrinterManager {
    private static bleManager = (isExpoGo || Platform.OS === 'web') ? null : new BleManager();
    private static isScanning = false;

    static async requestPermissions() {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]);
            return (
                granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
                granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
            );
        }
        return true;
    }

    static async scanPrinters(onDeviceFound: (device: Device) => void) {
        if (isExpoGo) {
            throw new Error('Bluetooth scan tidak tersedia di Expo Go. Silakan gunakan Development Build (APK/IPA).');
        }

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
        this.bleManager.startDeviceScan(null, null, (error, device) => {
            if (error) {
                console.error('Scan Error:', error);
                // Don't throw inside callback, but log it
                return;
            }
            if (device && (device.name || device.localName)) {
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

    static async saveSelectedPrinter(macAddress: string) {
        await AsyncStorage.setItem(PRINTER_STORAGE_KEY, macAddress);
    }

    static async forgetSelectedPrinter() {
        await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
    }

    static async getSelectedPrinter() {
        return await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
    }

    static formatReceipt(orderData: any) {
        const { 
            orderNo, tableNo, customerName, waiterName, total, items, payment_method, 
            date: orderDate, shopName, shopAddress, shopPhone,
            receipt_header, receipt_footer, show_logo, show_date, show_waiter, show_table, show_customer_name,
            customer_level, wifi_voucher, wifi_notice
        } = orderData;
        
        const date = orderDate ? new Date(orderDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
        
        // Priority: receipt_header (from template) > shopName (from branch) > 'WINNY POS'
        const displayShopName = (receipt_header || shopName || 'WINNY POS').toUpperCase();
        const displayAddress = orderData.address || shopAddress || '';
        const displayPhone = shopPhone || '';
        
        let receiptText = `[C]<b>${displayShopName}</b>\n`;
        
        if (displayAddress) {
            receiptText += `[C]${displayAddress}\n`;
        }
        
        if (displayPhone) {
            receiptText += `[C]Telp: ${displayPhone}\n`;
        }
 
        receiptText += '[C]--------------------------------\n';

        if (show_date !== false) {
            receiptText += `[L]Tgl: ${date}\n`;
        }
        
        receiptText += `[L]No: ${orderNo}\n`;

        if (show_waiter !== false && waiterName) {
            receiptText += `[L]Kasir: ${waiterName}\n`;
        }
        
        if (show_table !== false && tableNo && tableNo !== 'Tanpa Meja') {
            receiptText += `[L]Meja: ${tableNo}\n`;
        }
        
        if (show_customer_name !== false && customerName && customerName !== 'Guest') {
            receiptText += `[L]Plgn: ${customerName}\n`;
            if (customer_level) {
                receiptText += `[L]Status: ${customer_level}\n`;
            }
        }
        
        receiptText += '[C]--------------------------------\n';
 
        items.forEach((item: any) => {
            const qtyStr = `${item.quantity}x `;
            const nameStr = item.name;
            const price = ((item.price || 0) * (item.quantity || 1)).toLocaleString('id-ID');
            
            // Format single line like web: "1x Product Name       Price"
            // We use [L] and [R] to ensure alignment even with different font widths
            receiptText += `[L]${qtyStr}${nameStr.slice(0, 18)}[R]${price}\n`;
        });
  
        const subtotal = items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
        const subtotalStr = subtotal.toLocaleString('id-ID');
        const taxStr = (orderData.tax || 0).toLocaleString('id-ID');
        const serviceStr = (orderData.service_charge || 0).toLocaleString('id-ID');
        const discountStr = (orderData.discount || 0).toLocaleString('id-ID');
        const totalStr = (total || 0).toLocaleString('id-ID');

        receiptText += '[C]--------------------------------\n';
        receiptText += `[L]Subtotal[R]${subtotalStr}\n`;

        if (orderData.discount > 0) {
            receiptText += `[L]Diskon[R]-${discountStr}\n`;
        }
        if (orderData.service_charge > 0) {
            const sRate = orderData.service_rate ? ` (${orderData.service_rate}%)` : '';
            receiptText += `[L]Layanan${sRate}[R]${serviceStr}\n`;
        }
        if (orderData.tax > 0) {
            const tRate = orderData.tax_rate ? ` (${orderData.tax_rate}%)` : '';
            receiptText += `[L]Pajak${tRate}[R]${taxStr}\n`;
        }

        receiptText += '[C]--------------------------------\n';
        receiptText += `[L]<b>TOTAL</b>[R]<b>${totalStr}</b>\n`;
        receiptText += `[L]Metode[R]${payment_method || 'Tunai'}\n`;
        
        receiptText += '[C]--------------------------------\n';
        
        // WiFi Voucher (Matched from Web PrinterService)
        if (wifi_voucher) {
            if (wifi_notice) {
                receiptText += `[C]${wifi_notice}\n`;
            }
            receiptText += `[C]<b>${wifi_voucher}</b>\n`;
            receiptText += '[C]--------------------------------\n';
        }

        if (receipt_footer) {
            receiptText += `[C]${receipt_footer}\n`;
        } else {
            receiptText += 
                '[C]Terima Kasih Atas\n' +
                '[C]Kunjungan Anda\n';
        }
        
        receiptText += `[C]${displayShopName}\n` +
            '[C]\n\n\n';
        
        return receiptText;
    }

    static async printOrderReceipt(orderData: any) {
        const macAddress = await this.getSelectedPrinter();
        if (!macAddress) {
            console.warn('Printer not selected. Skipping print.');
            return false;
        }

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

            // @ts-ignore
            await BLEPrinter.printBluetooth({
                payload: receiptText,
                macAddress: macAddress,
                printerWidthMM: 58,
            });
            return true;
        } catch (error) {
            console.error('Print Error:', error);
            return false;
        }
    }

    static async testPrint() {
        const macAddress = await this.getSelectedPrinter();
        if (!macAddress) throw new Error('Pilih printer terlebih dahulu.');

        const testText = 
            '[C]<b>TEST PRINT</b>\n' +
            '[C]Pencetakan Berhasil\n' +
            '[C]--------------------------------\n' +
            '[L]Status: [R]Berhasil!\n' +
            '[L]Printer: [R]Connected\n' +
            '[C]--------------------------------\n' +
            '[C]' + new Date().toLocaleString('id-ID') + '\n' +
            '[C]\n\n\n';

        try {
            if (isExpoGo) {
                Alert.alert('Info', 'Test Print di Expo Go (Simulasi)');
                return true;
            }
            // @ts-ignore
            await BLEPrinter.printBluetooth({
                payload: testText,
                macAddress: macAddress,
                printerWidthMM: 58,
            });
            return true;
        } catch (error) {
            console.error('Test Print Error:', error);
            throw error;
        }
    }
}
