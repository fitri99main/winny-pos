/**
 * PrinterService handles Bluetooth connection and ESC/POS command generation
 * for thermal printers.
 */

// Define interfaces for Web Bluetooth to fix TS errors if types are missing
interface BluetoothDevice {
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRemoteGATTServer {
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
    writeValue(value: BufferSource): Promise<void>;
}

export interface PrinterDevice {
    name: string;
    device: BluetoothDevice;
    server?: BluetoothRemoteGATTServer;
    characteristic?: BluetoothRemoteGATTCharacteristic;
}

export interface TicketData {
    orderNo: string;
    tableNo: string;
    waiterName: string;
    cashierName?: string;
    customerName?: string;
    time: string;
    items: { name: string; quantity: number; note?: string; notes?: string }[];
    notes?: string;
}

class PrinterService {
    private kitchenPrinter: PrinterDevice | null = null;
    private barPrinter: PrinterDevice | null = null;
    private cashierPrinter: PrinterDevice | null = null;
    private template: any = {
        store_name: 'WINNY COFFEE PNK',
        receipt_header: 'WINNY COFFEE PNK',
        address: 'Jl. Contoh No. 123, Kota',
        footer: 'Terima Kasih Atas Kunjungan Anda',
        paperWidth: '58mm',
        showDate: true,
        showWaiter: true,
        showTable: true,
        showCustomerName: true,
        showCustomerStatus: true,
        showCashierName: true,
        showLogo: true,
        logoUrl: '',
        receipt_footer_feed: 4,
        // Kitchen Specifics
        kitchen_header: 'DAPUR',
        kitchen_footer: '',
        kitchen_show_table: true,
        kitchen_show_waiter: true,
        kitchen_show_date: true,
        kitchen_show_cashier: true,
        // Bar Specifics
        bar_header: 'BAR',
        bar_footer: '',
        bar_show_table: true,
        bar_show_waiter: true,
        bar_show_date: true,
        bar_show_cashier: true
    };

    // ESC/POS Commands
    private readonly ESC = 0x1B;
    private readonly GS = 0x1D;
    private readonly LF = 0x0A;

    // UUIDs for common Bluetooth Thermal Printers
    private readonly SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'; // Generic SPP
    private readonly CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

    async connect(type: 'Kitchen' | 'Bar' | 'Cashier'): Promise<string> {
        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [
                    { services: [this.SERVICE_UUID] },
                    { namePrefix: 'TP' },
                    { namePrefix: 'Printer' },
                    { namePrefix: 'BT' }
                ],
                optionalServices: [this.SERVICE_UUID]
            });

            if (!device.gatt) throw new Error('GATT not supported');

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(this.SERVICE_UUID);
            const characteristic = await service.getCharacteristic(this.CHAR_UUID);

            const printer: PrinterDevice = {
                name: device.name || `${type} Printer`,
                device,
                server,
                characteristic
            };

            if (type === 'Kitchen') this.kitchenPrinter = printer;
            else if (type === 'Bar') this.barPrinter = printer;
            else this.cashierPrinter = printer;

            return printer.name;
        } catch (error) {
            console.error('Bluetooth Connection Error:', error);
            throw error;
        }
    }

    setTemplate(newTemplate: any) {
        this.template = { ...this.template, ...newTemplate };
    }

    getTemplate() {
        return this.template;
    }

    private getLineWidth(): number {
        return this.template.paperWidth === '80mm' ? 42 : 32;
    }

    async printTicket(type: 'Kitchen' | 'Bar', data: TicketData) {
        const printer = type === 'Kitchen' ? this.kitchenPrinter : this.barPrinter;
        if (!printer || !printer.characteristic) {
            console.warn(`${type} Printer not connected. Skipping print.`);
            return;
        }

        const encoder = new TextEncoder();
        let commands: Uint8Array[] = [];

        // Specific settings based on type
        const isKitchen = type === 'Kitchen';
        const header = isKitchen ? (this.template.kitchen_header || this.template.receipt_header || 'PESANAN') : (this.template.bar_header || this.template.receipt_header || 'PESANAN');
        const footer = isKitchen ? (this.template.kitchen_footer || '') : (this.template.bar_footer || '');
        const showTable = isKitchen ? (this.template.kitchen_show_table ?? this.template.show_table ?? true) : (this.template.bar_show_table ?? this.template.show_table ?? true);
        const showWaiter = isKitchen ? (this.template.kitchen_show_waiter ?? this.template.show_waiter ?? true) : (this.template.bar_show_waiter ?? this.template.show_waiter ?? true);
        const showCashier = isKitchen ? (this.template.kitchen_show_cashier ?? this.template.show_cashier_name ?? true) : (this.template.bar_show_cashier ?? this.template.show_cashier_name ?? true);
        const showDate = isKitchen ? (this.template.kitchen_show_date ?? this.template.show_date ?? true) : (this.template.bar_show_date ?? this.template.show_date ?? true);
        const showCustomer = this.template.showCustomerName ?? true;
        const doubleHeightItems = true; // Match mobile's default

        // Initialize
        commands.push(new Uint8Array([this.ESC, 0x40]));

        // Header (Double Size + Bold)
        commands.push(new Uint8Array([this.GS, 0x21, 0x11])); // Double width & height
        commands.push(new Uint8Array([this.ESC, 0x45, 0x01])); // Bold ON
        commands.push(encoder.encode(`${header.toUpperCase()}\n`));
        commands.push(new Uint8Array([this.ESC, 0x45, 0x00])); // Bold OFF

        // Reset size
        commands.push(new Uint8Array([this.GS, 0x21, 0x00]));
        
        // Order No (Centered)
        commands.push(encoder.encode(`No: ${data.orderNo}\n`));
        
        // Table No (Centered, Bold, Double Size)
        if (showTable && data.tableNo) {
            commands.push(new Uint8Array([this.GS, 0x21, 0x11])); // Double size
            commands.push(new Uint8Array([this.ESC, 0x45, 0x01])); // Bold ON
            commands.push(encoder.encode(`MEJA: ${data.tableNo}\n`));
            commands.push(new Uint8Array([this.GS, 0x21, 0x00])); // Reset size
            commands.push(new Uint8Array([this.ESC, 0x45, 0x00])); // Bold OFF
        }

        // Other info (Centered)
        if (showCustomer && data.customerName && data.customerName !== 'Guest') commands.push(encoder.encode(`Pelanggan: ${data.customerName}\n`));
        if (showWaiter && data.waiterName && data.waiterName !== '-') commands.push(encoder.encode(`Pelayan: ${data.waiterName}\n`));
        if (showCashier && data.cashierName) commands.push(encoder.encode(`Kasir: ${data.cashierName}\n`));
        if (showDate) commands.push(encoder.encode(`Waktu: ${data.time}\n`));
        
        const lineWidth = this.getLineWidth();
        const line = '-'.repeat(lineWidth) + '\n';
        commands.push(encoder.encode(line));

        // Items (Left align for readability)
        commands.push(new Uint8Array([this.ESC, 0x61, 0x00])); 
        data.items.forEach(item => {
            // Match mobile's Double Width & Height + Bold for items
            if (doubleHeightItems) {
                commands.push(new Uint8Array([this.GS, 0x21, 0x11])); // Double width & height
            }
            commands.push(new Uint8Array([this.ESC, 0x45, 0x01])); // Bold ON
            commands.push(encoder.encode(`${item.quantity}x ${item.name}\n`));
            commands.push(new Uint8Array([this.ESC, 0x45, 0x00])); // Bold OFF
            if (doubleHeightItems) {
                commands.push(new Uint8Array([this.GS, 0x21, 0x00])); // Reset size
            }
            
            if (item.note || item.notes) {
                commands.push(encoder.encode(`   * Catatan: ${item.note || item.notes}\n`));
            }
            commands.push(encoder.encode('\n'));
        });

        commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center align for line
        commands.push(encoder.encode(line));
        
        if (data.notes) {
             commands.push(encoder.encode(`Catatan: ${data.notes}\n`));
        }

        if (footer) {
            commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center align
            commands.push(encoder.encode(`\n${footer}\n`));
        }

        const feedLines = this.template.receipt_footer_feed ?? 4;
        if (feedLines > 0) {
            commands.push(new Uint8Array(feedLines).fill(this.LF));
        }

        // Cut (if supported)
        commands.push(new Uint8Array([this.GS, 0x56, 0x41, 0x00]));

        // Send data in chunks (max 20 bytes usually for some BT stacks, but SPP can handle more)
        // We'll send the whole buffer and see
        const finalBuffer = this.concatenateTypedArrays(commands);
        await printer.characteristic.writeValue(finalBuffer as any);
    }

    async printReceipt(data: {
        orderNo: string;
        tableNo: string;
        waiterName: string;
        time: string;
        items: { name: string; quantity: number; price: number; note?: string; notes?: string }[];
        subtotal: number;
        discount: number;
        tax: number;
        serviceCharge?: number;
        total: number;
        paymentType: string;
        amountPaid: number;
        change: number;
        customerName?: string;
        customerLevel?: string;
        cashierName?: string;
        wifiVoucher?: string;
        wifi_voucher?: string;
        wifiNotice?: string;
        wifi_notice?: string;
    }) {
        const printer = this.cashierPrinter;
        if (!printer || !printer.characteristic) {
            console.warn(`Cashier Printer not connected. Skipping print.`);
            return;
        }

        const encoder = new TextEncoder();
        let commands: Uint8Array[] = [];

        // Initialize
        commands.push(new Uint8Array([this.ESC, 0x40]));

        // Header (Double Size)
        commands.push(new Uint8Array([this.GS, 0x21, 0x11])); // Double width & height
        commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center align
        commands.push(encoder.encode(`${(this.template.header || 'WINNY COFFEE PNK').toUpperCase()}\n`));

        // Reset size & Address
        commands.push(new Uint8Array([this.GS, 0x21, 0x00]));
        if (this.template.address) {
            commands.push(encoder.encode(`${this.template.address}\n`));
        }
        if (this.template.phone) {
            commands.push(encoder.encode(`Telp: ${this.template.phone}\n`));
        }
        const lineWidth = this.getLineWidth();
        const line = '-'.repeat(lineWidth) + '\n';
        commands.push(encoder.encode(line));

        // Basic Info
        commands.push(new Uint8Array([this.ESC, 0x61, 0x00])); // Left align
        commands.push(encoder.encode(`No: ${data.orderNo}\n`));
        if (this.template.showDate) commands.push(encoder.encode(`Waktu: ${data.time}\n`));
        if (this.template.showTable) commands.push(encoder.encode(`Meja: ${data.tableNo}\n`));
        if (this.template.showCustomerName && data.customerName) commands.push(encoder.encode(`Pelanggan: ${data.customerName}\n`));
        if (this.template.showCustomerStatus && data.customerLevel) commands.push(encoder.encode(`Status: ${data.customerLevel}\n`));
        if (this.template.showWaiter && data.waiterName && data.waiterName !== '-') commands.push(encoder.encode(`Pelayan: ${data.waiterName}\n`));
        if (this.template.showCashierName && data.cashierName) commands.push(encoder.encode(`Kasir: ${data.cashierName}\n`));
        commands.push(encoder.encode(line));

        // Items
        data.items.forEach(item => {
            const itemLine = `${item.quantity}x ${item.name}`;
            const priceLine = (item.quantity * item.price).toLocaleString('id-ID');
            // Reserve space for price
            const valWidth = 12;
            const labelWidth = lineWidth - valWidth;
            commands.push(encoder.encode(`${itemLine.slice(0, labelWidth).padEnd(labelWidth)}${priceLine.padStart(valWidth)}\n`));
            if (item.notes || (item as any).note) {
                commands.push(encoder.encode(`  (${item.notes || (item as any).note})\n`));
            }
        });
        commands.push(encoder.encode(line));

        // Summary
        const valWidth = 12;
        const labelWidth = lineWidth - valWidth;
        commands.push(encoder.encode(`${'Subtotal'.padEnd(labelWidth)}${data.subtotal.toLocaleString('id-ID').padStart(valWidth)}\n`));
        
        if (data.discount > 0) {
            commands.push(encoder.encode(`${'Diskon'.padEnd(labelWidth)}${('-' + data.discount.toLocaleString('id-ID')).padStart(valWidth)}\n`));
        }

        if ((data.serviceCharge || 0) > 0) {
            commands.push(encoder.encode(`${'Layanan'.padEnd(labelWidth)}${data.serviceCharge!.toLocaleString('id-ID').padStart(valWidth)}\n`));
        }

        if (data.tax > 0) {
            commands.push(encoder.encode(`${'Pajak'.padEnd(labelWidth)}${data.tax.toLocaleString('id-ID').padStart(valWidth)}\n`));
        }

        // GS, 0x21, 0x01 is Double Height (sync with Mobile DOUBLE_ON)
        commands.push(new Uint8Array([this.GS, 0x21, 0x01])); 
        commands.push(encoder.encode(`${'TOTAL'.padEnd(labelWidth)}${data.total.toLocaleString('id-ID').padStart(valWidth)}\n`));
        commands.push(new Uint8Array([this.GS, 0x21, 0x00])); // Reset

        commands.push(encoder.encode(line));
        commands.push(encoder.encode(`${data.paymentType.padEnd(labelWidth)}${data.amountPaid.toLocaleString('id-ID').padStart(valWidth)}\n`));
        commands.push(encoder.encode(`${'Kembali'.padEnd(labelWidth)}${data.change.toLocaleString('id-ID').padStart(valWidth)}\n`));
        commands.push(encoder.encode(line));

        // WiFi Voucher
        const displayVoucher = data.wifiVoucher || data.wifi_voucher;
        const displayNotice = data.wifiNotice || data.wifi_notice;

        if (displayVoucher) {
            commands.push(encoder.encode(line));
            commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center
            if (displayNotice) {
                commands.push(encoder.encode(`${displayNotice}\n`));
            }
            
            // [MODIFIED] Print vouchers horizontally to save paper
            const vouchers = displayVoucher.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0);
            commands.push(new Uint8Array([this.GS, 0x21, 0x11])); // Double Size
            commands.push(encoder.encode(`\n${vouchers.join('  ')}\n`));
            commands.push(new Uint8Array([this.GS, 0x21, 0x00])); // Reset
        }

        // Footer
        if (this.template.footer) {
            commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center align
            commands.push(encoder.encode(`\n${this.template.footer}\n`));
        }

        const feedLines = this.template.receipt_footer_feed ?? 4;
        if (feedLines > 0) {
            commands.push(new Uint8Array(feedLines).fill(this.LF));
        }
        commands.push(new Uint8Array([this.GS, 0x56, 0x41, 0x00])); // Cut

        const finalBuffer = this.concatenateTypedArrays(commands);
        await printer.characteristic.writeValue(finalBuffer as any);
    }

    private concatenateTypedArrays(arrays: Uint8Array[]): Uint8Array {
        const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
        const result = new Uint8Array(totalLength);
        let length = 0;
        for (const array of arrays) {
            result.set(array, length);
            length += array.length;
        }
        return result;
    }

    getConnectedPrinter(type: 'Kitchen' | 'Bar' | 'Cashier'): string | null {
        const printer = type === 'Kitchen' ? this.kitchenPrinter : (type === 'Bar' ? this.barPrinter : this.cashierPrinter);
        return printer?.name || null;
    }

    async disconnect(type: 'Kitchen' | 'Bar' | 'Cashier') {
        const printer = type === 'Kitchen' ? this.kitchenPrinter : (type === 'Bar' ? this.barPrinter : this.cashierPrinter);
        if (printer && printer.server) {
            try {
                await printer.server.disconnect();
            } catch (e) {
                console.warn('Printer disconnect error:', e);
            }
        }
        if (type === 'Kitchen') this.kitchenPrinter = null;
        else if (type === 'Bar') this.barPrinter = null;
        else this.cashierPrinter = null;
    }

    async printBarcode(code: string, options?: {
        width?: number;
        height?: number;
        showText?: boolean;
    }) {
        const printer = this.cashierPrinter;
        if (!printer || !printer.characteristic) {
            console.warn('Cashier Printer not connected. Cannot print barcode.');
            return;
        }

        const encoder = new TextEncoder();
        let commands: Uint8Array[] = [];

        // 1. Initialize
        commands.push(new Uint8Array([this.ESC, 0x40]));

        // 2. Center Align
        commands.push(new Uint8Array([this.ESC, 0x61, 0x01]));

        // 3. Barcode Settings
        const width = options?.width || this.template.barcodeWidth || 2; // 2-6
        const height = options?.height || this.template.barcodeHeight || 80; // 1-255
        const showText = options?.showText !== undefined ? options.showText : (this.template.showBarcodeText ?? true);

        commands.push(new Uint8Array([this.GS, 0x77, width])); // GS w
        commands.push(new Uint8Array([this.GS, 0x68, height])); // GS h
        commands.push(new Uint8Array([this.GS, 0x48, showText ? 0x02 : 0x00])); // GS H (2: below)

        // 4. Print Barcode (CODE128 - Type B)
        // Format: GS k m n d1...dn
        // m = 73 (CODE128), n = data length
        // For CODE128, data must start with subset selector, e.g., {B (sub-code B)
        const data = encoder.encode(code);
        const code128Data = new Uint8Array(data.length + 2);
        code128Data[0] = 123; // '{'
        code128Data[1] = 66;  // 'B'
        code128Data.set(data, 2);

        commands.push(new Uint8Array([this.GS, 0x6B, 73, code128Data.length]));
        commands.push(code128Data);

        // 5. Feed & Cut
        const feedLines = this.template.receipt_footer_feed ?? 4;
        if (feedLines > 0) {
            commands.push(new Uint8Array(feedLines).fill(this.LF));
        }
        commands.push(new Uint8Array([this.GS, 0x56, 0x41, 0x00]));

        const finalBuffer = this.concatenateTypedArrays(commands);
        await printer.characteristic.writeValue(finalBuffer as any);
    }

    async openDrawer() {
        if (!this.cashierPrinter || !this.cashierPrinter.characteristic) {
            console.warn('Cashier Printer not connected. Cannot open drawer.');
            return;
        }
        try {
            // ESC p m t1 t2 - Pulse to open drawer
            // m=0 (pin 2), t1=60 (on time), t2=120 (off time)
            const command = new Uint8Array([0x1B, 0x70, 0x00, 0x3C, 0x78]);
            await this.cashierPrinter.characteristic.writeValue(command);
        } catch (e) {
            console.error('Failed to open drawer:', e);
        }
    }
}

export const printerService = new PrinterService();
