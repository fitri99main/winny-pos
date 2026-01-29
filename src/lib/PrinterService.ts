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

class PrinterService {
    private kitchenPrinter: PrinterDevice | null = null;
    private barPrinter: PrinterDevice | null = null;
    private cashierPrinter: PrinterDevice | null = null;
    private template: any = {
        header: 'WINNY CAFE',
        address: 'Jl. Contoh No. 123, Kota',
        footer: 'Terima Kasih Atas Kunjungan Anda',
        paperWidth: '58mm',
        showDate: true,
        showWaiter: true,
        showTable: true,
        showCustomerName: true,
        showCustomerStatus: true,
        showLogo: true,
        logoUrl: ''
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

    async printTicket(type: 'Kitchen' | 'Bar', data: {
        orderNo: string;
        tableNo: string;
        waiterName: string;
        time: string;
        items: { name: string; quantity: number }[];
    }) {
        const printer = type === 'Kitchen' ? this.kitchenPrinter : this.barPrinter;
        if (!printer || !printer.characteristic) {
            console.warn(`${type} Printer not connected. Skipping print.`);
            return;
        }

        const encoder = new TextEncoder();
        let commands: Uint8Array[] = [];

        // Initialize
        commands.push(new Uint8Array([this.ESC, 0x40]));

        // Header (Double Size)
        commands.push(new Uint8Array([this.GS, 0x21, 0x11])); // Double width & height
        commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center align
        commands.push(encoder.encode(`${(this.template.header || 'PESANAN').toUpperCase()}\n`));

        // Reset size
        commands.push(new Uint8Array([this.GS, 0x21, 0x00]));
        if (this.template.address && type !== 'Kitchen' && type !== 'Bar') {
            commands.push(encoder.encode(`${this.template.address}\n`));
        }

        commands.push(encoder.encode(`--- PESANAN ${type.toUpperCase()} ---\n`));
        commands.push(encoder.encode(`No: ${data.orderNo}\n`));
        if (this.template.showTable) commands.push(encoder.encode(`Meja: ${data.tableNo}\n`));
        if (this.template.showWaiter) commands.push(encoder.encode(`Pelayan: ${data.waiterName}\n`));
        if (this.template.showDate) commands.push(encoder.encode(`Waktu: ${data.time}\n`));
        const line = '-'.repeat(this.getLineWidth()) + '\n';
        commands.push(encoder.encode(line));

        // Items
        commands.push(new Uint8Array([this.ESC, 0x61, 0x00])); // Left align
        data.items.forEach(item => {
            commands.push(encoder.encode(`${item.quantity}x ${item.name}\n`));
        });

        commands.push(encoder.encode(line));

        if (this.template.footer && type !== 'Kitchen' && type !== 'Bar') {
            commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center align
            commands.push(encoder.encode(`\n${this.template.footer}\n`));
        }

        commands.push(new Uint8Array([this.LF, this.LF, this.LF]));

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
        items: { name: string; quantity: number; price: number }[];
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
        paymentType: string;
        amountPaid: number;
        change: number;
        customerName?: string;
        customerLevel?: string;
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
        commands.push(encoder.encode(`${(this.template.header || 'WINNY CAFE').toUpperCase()}\n`));

        // Reset size & Address
        commands.push(new Uint8Array([this.GS, 0x21, 0x00]));
        if (this.template.address) {
            commands.push(encoder.encode(`${this.template.address}\n`));
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
        if (this.template.showWaiter) commands.push(encoder.encode(`Pelayan: ${data.waiterName}\n`));
        commands.push(encoder.encode(line));

        // Items
        data.items.forEach(item => {
            const itemLine = `${item.quantity}x ${item.name}`;
            const priceLine = (item.quantity * item.price).toLocaleString('id-ID');
            // Reserve space for price
            const valWidth = 12;
            const labelWidth = lineWidth - valWidth;
            commands.push(encoder.encode(`${itemLine.slice(0, labelWidth).padEnd(labelWidth)}${priceLine.padStart(valWidth)}\n`));
        });
        commands.push(encoder.encode(line));

        // Summary
        const valWidth = 12;
        const labelWidth = lineWidth - valWidth;
        commands.push(encoder.encode(`${'Subtotal'.padEnd(labelWidth)}${data.subtotal.toLocaleString('id-ID').padStart(valWidth)}\n`));
        if (data.discount > 0) {
            commands.push(encoder.encode(`${'Diskon'.padEnd(labelWidth)}${data.discount.toLocaleString('id-ID').padStart(valWidth)}\n`));
        }
        if (data.tax > 0) {
            commands.push(encoder.encode(`${'Pajak'.padEnd(labelWidth)}${data.tax.toLocaleString('id-ID').padStart(valWidth)}\n`));
        }
        commands.push(new Uint8Array([this.GS, 0x21, 0x01])); // Bold-ish (emphasized)
        commands.push(encoder.encode(`${'TOTAL'.padEnd(labelWidth)}${data.total.toLocaleString('id-ID').padStart(valWidth)}\n`));
        commands.push(new Uint8Array([this.GS, 0x21, 0x00])); // Reset

        commands.push(encoder.encode(line));
        commands.push(encoder.encode(`${data.paymentType.padEnd(labelWidth)}${data.amountPaid.toLocaleString('id-ID').padStart(valWidth)}\n`));
        commands.push(encoder.encode(`${'Kembali'.padEnd(labelWidth)}${data.change.toLocaleString('id-ID').padStart(valWidth)}\n`));
        commands.push(encoder.encode(line));

        // Footer
        if (this.template.footer) {
            commands.push(new Uint8Array([this.ESC, 0x61, 0x01])); // Center align
            commands.push(encoder.encode(`\n${this.template.footer}\n`));
        }

        commands.push(new Uint8Array([this.LF, this.LF, this.LF]));
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
}

export const printerService = new PrinterService();
