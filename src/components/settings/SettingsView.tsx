import { useState } from 'react';
import { Settings, User, Monitor, Globe, Bell, Shield, Save, Clock, Calendar, Printer, FileText } from 'lucide-react';
import { printerService } from '../../lib/PrinterService';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

interface SettingsViewProps {
    settings: any;
    onUpdateSettings: (settings: any) => void;
}

export function SettingsView({ settings, onUpdateSettings }: SettingsViewProps) {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Umum', icon: Globe },
        { id: 'account', label: 'Akun', icon: User },
        { id: 'hours', label: 'Jam Kerja', icon: Clock },
        { id: 'appearance', label: 'Tampilan', icon: Monitor },
        { id: 'notifications', label: 'Notifikasi', icon: Bell },
        { id: 'printer', label: 'Printer', icon: Printer },
        { id: 'receipt', label: 'Templat Struk', icon: FileText },
        { id: 'security', label: 'Keamanan', icon: Shield },
    ];

    const [companySettings, setCompanySettings] = useState({
        openingTime: '08:00',
        closingTime: '22:00',
        workingDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
        tolerance: 15
    });

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    const handleSave = () => {
        toast.success('Pengaturan berhasil disimpan!');
    };

    return (
        <div className="p-8 flex gap-8 h-full bg-gray-50/50">
            {/* Sidebar Settings */}
            <div className="w-56 flex flex-col gap-2">
                <div className="mb-6 px-2">
                    <h2 className="text-xl font-bold text-gray-800">Pengaturan</h2>
                    <p className="text-sm text-gray-500">Kelola preferensi Anda</p>
                </div>

                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-white shadow-sm ring-1 ring-gray-200 text-primary'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-primary' : 'text-gray-400'}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-content Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 overflow-y-auto">
                {activeTab === 'general' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Umum</h3>
                            <p className="text-sm text-gray-500">Konfigurasi informasi dasar aplikasi.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Nama Toko</label>
                                <input type="text" defaultValue="WinPOS Cabang 01" className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Mata Uang</label>
                                <select className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                                    <option>IDR (Rupiah)</option>
                                    <option>USD (Dollar)</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Bahasa</label>
                                <select className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                                    <option>Bahasa Indonesia</option>
                                    <option>English</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Profil Akun</h3>
                            <p className="text-sm text-gray-500">Kelola informasi pribadi Anda.</p>
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400">
                                A
                            </div>
                            <Button variant="outline">Ganti Avatar</Button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-gray-700">Nama Depan</label>
                                    <input type="text" defaultValue="Admin" className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-gray-700">Nama Belakang</label>
                                    <input type="text" defaultValue="Utama" className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-gray-700">Alamat Email</label>
                                <input type="email" defaultValue="admin@winpos.com" disabled className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500" />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'hours' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Jam Kerja</h3>
                            <p className="text-sm text-gray-500">Atur jam operasional dan kebijakan waktu perusahaan.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Jam Buka Toko</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        value={companySettings.openingTime}
                                        onChange={e => setCompanySettings({ ...companySettings, openingTime: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Jam Tutup Toko</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        value={companySettings.closingTime}
                                        onChange={e => setCompanySettings({ ...companySettings, closingTime: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-bold text-gray-700 block">Hari Kerja Operasional</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {days.map(day => (
                                    <button
                                        key={day}
                                        onClick={() => {
                                            const updated = companySettings.workingDays.includes(day)
                                                ? companySettings.workingDays.filter(d => d !== day)
                                                : [...companySettings.workingDays, day];
                                            setCompanySettings({ ...companySettings, workingDays: updated });
                                        }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${companySettings.workingDays.includes(day)
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 space-y-4">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-orange-600" />
                                <h4 className="font-bold text-orange-800">Kebijakan Toleransi</h4>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-orange-700">Toleransi Keterlambatan (Menit)</label>
                                <input
                                    type="number"
                                    value={companySettings.tolerance}
                                    onChange={e => setCompanySettings({ ...companySettings, tolerance: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none bg-white"
                                    placeholder="contoh: 15"
                                />
                                <p className="text-[10px] text-orange-600/70">Karyawan tidak akan dianggap terlambat jika absen dalam rentang waktu ini setelah shift dimulai.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Tampilan</h3>
                            <p className="text-sm text-gray-500">Sesuaikan tampilan dan nuansa.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="border border-primary bg-primary/5 p-4 rounded-xl flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <Monitor className="w-5 h-5 text-primary" />
                                    <span className="font-medium text-gray-900">Mode Terang</span>
                                </div>
                                <div className="w-4 h-4 rounded-full border border-primary bg-primary"></div>
                            </div>
                            <div className="border border-gray-200 p-4 rounded-xl flex items-center justify-between cursor-pointer opacity-50">
                                <div className="flex items-center gap-3">
                                    <Monitor className="w-5 h-5 text-gray-400" />
                                    <span className="font-medium text-gray-500">Mode Gelap</span>
                                </div>
                                <div className="w-4 h-4 rounded-full border border-gray-300"></div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'printer' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Printer Bluetooth</h3>
                            <p className="text-sm text-gray-500">Hubungkan printer thermal Bluetooth untuk mencetak tiket Dapur dan Bar.</p>
                        </div>

                        <div className="grid gap-6">
                            {/* Kitchen Printer */}
                            <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                            <Printer className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">Printer Dapur</h4>
                                            <p className="text-xs text-gray-500">Untuk mencetak pesanan makanan</p>
                                        </div>
                                    </div>
                                    {printerService.getConnectedPrinter('Kitchen') ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {printerService.getConnectedPrinter('Kitchen')}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Kitchen');
                                                toast.success('Printer Dapur terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer. Pastikan Bluetooth aktif.');
                                            }
                                        }}
                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                    >
                                        Pair Printer Dapur
                                    </Button>
                                    <Button
                                        disabled={!printerService.getConnectedPrinter('Kitchen')}
                                        onClick={async () => {
                                            await printerService.printTicket('Kitchen', {
                                                orderNo: 'TEST-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                time: new Date().toLocaleTimeString(),
                                                items: [{ name: 'Test Print (Dapur)', quantity: 1 }]
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print
                                    </Button>
                                </div>
                            </div>

                            {/* Bar Printer */}
                            <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                            <Printer className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">Printer Bar</h4>
                                            <p className="text-xs text-gray-500">Untuk mencetak pesanan minuman</p>
                                        </div>
                                    </div>
                                    {printerService.getConnectedPrinter('Bar') ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {printerService.getConnectedPrinter('Bar')}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Bar');
                                                toast.success('Printer Bar terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer.');
                                            }
                                        }}
                                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                    >
                                        Pair Printer Bar
                                    </Button>
                                    <Button
                                        disabled={!printerService.getConnectedPrinter('Bar')}
                                        onClick={async () => {
                                            await printerService.printTicket('Bar', {
                                                orderNo: 'TEST-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                time: new Date().toLocaleTimeString(),
                                                items: [{ name: 'Test Print (Bar)', quantity: 1 }]
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print
                                    </Button>
                                </div>
                            </div>

                            {/* Cashier Printer */}
                            <div className="p-6 rounded-2xl border border-primary/20 bg-primary/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <Printer className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">Printer Kasir</h4>
                                            <p className="text-xs text-gray-500">Untuk mencetak struk belanja pelanggan</p>
                                        </div>
                                    </div>
                                    {printerService.getConnectedPrinter('Cashier') ? (
                                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {printerService.getConnectedPrinter('Cashier')}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400">Belum Terhubung</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await printerService.connect('Cashier');
                                                toast.success('Printer Kasir terhubung!');
                                            } catch (e) {
                                                toast.error('Gagal menghubungkan printer.');
                                            }
                                        }}
                                        className="flex-1 bg-primary text-white hover:bg-primary/90 shadow-md"
                                    >
                                        Pair Printer Kasir
                                    </Button>
                                    <Button
                                        disabled={!printerService.getConnectedPrinter('Cashier')}
                                        onClick={async () => {
                                            await printerService.printReceipt({
                                                orderNo: 'POS-001',
                                                tableNo: 'T1',
                                                waiterName: 'Admin',
                                                time: new Date().toLocaleString(),
                                                items: [{ name: 'Test Product', quantity: 1, price: 15000 }],
                                                subtotal: 15000,
                                                discount: 0,
                                                total: 15000,
                                                paymentType: 'Tunai',
                                                amountPaid: 20000,
                                                change: 5000
                                            });
                                        }}
                                        variant="outline"
                                    >
                                        Test Print Struk
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-2">
                            <h4 className="font-bold text-blue-800 text-sm">Catatan Penting</h4>
                            <p className="text-xs text-blue-700/80 leading-relaxed">
                                Karena batasan keamanan browser, Anda perlu menghubungkan ulang printer setiap kali aplikasi dimuat ulang.
                                Pastikan printer thermal Anda dalam mode "Discoverable" sebelum menekan tombol Pair.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'receipt' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Pengaturan Templat Struk</h3>
                            <p className="text-sm text-gray-500">Sesuaikan tampilan struk yang dicetak ke pelanggan.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Nama Toko (Header)</Label>
                                    <input
                                        type="text"
                                        value={settings.header}
                                        onChange={e => onUpdateSettings({ ...settings, header: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Contoh: WINNY CAFE"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Alamat / Informasi Tambahan</Label>
                                    <textarea
                                        value={settings.address}
                                        onChange={e => onUpdateSettings({ ...settings, address: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none h-20 resize-none font-mono text-sm"
                                        placeholder="Alamat lengkap toko..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Pesan Penutup (Footer)</Label>
                                    <input
                                        type="text"
                                        value={settings.footer}
                                        onChange={e => onUpdateSettings({ ...settings, footer: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="Contoh: Terima Kasih, Datang Lagi ya!"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Ukuran Kertas Printer</Label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => onUpdateSettings({ ...settings, paperWidth: '58mm' })}
                                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-bold text-sm ${settings.paperWidth === '58mm'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                }`}
                                        >
                                            58mm (Kecil)
                                        </button>
                                        <button
                                            onClick={() => onUpdateSettings({ ...settings, paperWidth: '80mm' })}
                                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-bold text-sm ${settings.paperWidth === '80mm'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                }`}
                                        >
                                            80mm (Besar)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                <h4 className="font-bold text-gray-800 text-sm">Opsi Tampilan</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-date" className="cursor-pointer">Tampilkan Tanggal & Waktu</Label>
                                        <Switch
                                            id="show-date"
                                            checked={settings.showDate}
                                            onCheckedChange={checked => onUpdateSettings({ ...settings, showDate: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-waiter" className="cursor-pointer">Tampilkan Nama Pelayan</Label>
                                        <Switch
                                            id="show-waiter"
                                            checked={settings.showWaiter}
                                            onCheckedChange={checked => onUpdateSettings({ ...settings, showWaiter: checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="show-table" className="cursor-pointer">Tampilkan Nomor Meja</Label>
                                        <Switch
                                            id="show-table"
                                            checked={settings.showTable}
                                            onCheckedChange={checked => onUpdateSettings({ ...settings, showTable: checked })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">Pratinjau Struk ({settings.paperWidth})</h4>
                            <div className={`border border-dashed border-gray-300 p-6 bg-gray-50/50 text-center font-mono text-[10px] space-y-1 text-gray-600 mx-auto transition-all ${settings.paperWidth === '80mm' ? 'max-w-xs' : 'max-w-[200px]'
                                }`}>
                                <p className="font-bold text-xs uppercase text-gray-800">{settings.header || 'NAMA TOKO'}</p>
                                <p className="whitespace-pre-line">{settings.address || 'Alamat Toko'}</p>
                                <p>{settings.paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                <div className="text-left flex justify-between"><span>KOPI SUSU GULA AREN</span> <span>25.000</span></div>
                                <div className="text-left flex justify-between"><span>PISANG GORENG</span> <span>15.000</span></div>
                                <p>{settings.paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                <div className="font-bold flex justify-between text-xs text-gray-800"><span>TOTAL</span> <span>40.000</span></div>
                                <p>{settings.paperWidth === '80mm' ? '------------------------------------------' : '--------------------------------'}</p>
                                {settings.showDate && <p>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>}
                                {settings.showWaiter && <p>Pelayan: Budi R.</p>}
                                {settings.showTable && <p>Meja: T-05</p>}
                                <p className="italic mt-4 text-gray-500">{settings.footer || 'Terima Kasih'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fallback for other tabs */}
                {(activeTab === 'notifications' || activeTab === 'security') && (
                    <div className="flex flex-col items-center justify-center h-64 text-center animate-in fade-in zoom-in-95">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Settings className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-800">Segera Datang</h3>
                        <p className="text-sm text-gray-500 max-w-xs">Bagian pengaturan ini sedang dalam pengembangan.</p>
                    </div>
                )}

                {/* Action Footer */}
                <div className="mt-10 pt-6 border-t border-gray-100 flex justify-end">
                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100">
                        <Save className="w-4 h-4 mr-2" />
                        Simpan Perubahan
                    </Button>
                </div>
            </div>
        </div>
    );
}
