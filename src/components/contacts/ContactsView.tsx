import { useState } from 'react';
import { Contact, Users, Truck, Plus, Search, Phone, Mail, MapPin, Edit, Trash2, CreditCard, Cake, Star, Printer } from 'lucide-react';
import { QRCard } from '../ui/QRCard';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type ContactType = 'Customer' | 'Supplier';

export interface ContactData {
    id: number;
    name: string;
    type: ContactType;
    email: string;
    phone: string;
    address: string;
    company?: string;
    status: 'Active' | 'Inactive';
    memberId?: string;
    tier?: 'Regular' | 'Silver' | 'Gold' | 'Platinum';
    points?: number;
    birthday?: string; // YYYY-MM-DD
}

const MEMBERSHIP_TIERS = {
    'Regular': 0,
    'Silver': 5,
    'Gold': 10,
    'Platinum': 15
};

export const INITIAL_CONTACTS: ContactData[] = [
    { id: 1, name: 'Bapak Ahmad', type: 'Customer', email: 'ahmad@gmail.com', phone: '08123456789', address: 'Jl. Merdeka No. 1', status: 'Active', memberId: 'MC-001', tier: 'Gold', points: 1250, birthday: '1985-01-24' },
    { id: 2, name: 'PT. Kopi Nusantara', type: 'Supplier', email: 'sales@kopinusantara.com', phone: '021-5556667', address: 'Jl. Industri Kopi Blok A', company: 'PT. Kopi Nusantara', status: 'Active' },
    { id: 3, name: 'Ibu Susi', type: 'Customer', email: 'susi@yahoo.com', phone: '08198765432', address: 'Komp. Melati Indah', status: 'Active', memberId: 'MC-002', tier: 'Silver', points: 450, birthday: '1990-05-12' },
    { id: 4, name: 'CV. Susu Murni Jaya', type: 'Supplier', email: 'order@susumurni.co.id', phone: '022-7778889', address: 'Lembang, Bandung', company: 'CV. Susu Murni Jaya', status: 'Active' },
];

interface ContactsViewProps {
    contacts: ContactData[];
    setContacts: React.Dispatch<React.SetStateAction<ContactData[]>>;
    onAdd: (contact: Partial<ContactData>) => void;
    onUpdate: (contact: Partial<ContactData>) => void;
    onDelete: (id: number) => void;
}

export function ContactsView({ contacts, setContacts, onAdd, onUpdate, onDelete }: ContactsViewProps) {
    const [activeTab, setActiveTab] = useState<ContactType>('Customer');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ContactData>>({});
    const [selectedCard, setSelectedCard] = useState<ContactData | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [emailError, setEmailError] = useState('');

    const validateEmail = (email: string) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value;
        setFormData({ ...formData, email });
        if (email && !validateEmail(email)) {
            setEmailError('Format email tidak valid');
        } else {
            setEmailError('');
        }
    };

    const filteredContacts = (contacts || []).filter(c => c.type === activeTab);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            toast.error('Nama dan No. Telepon wajib diisi');
            return;
        }

        if (formData.id) {
            onUpdate(formData);
        } else {
            const newContact: any = {
                ...formData,
                type: activeTab,
                status: 'Active'
            };
            onAdd(newContact);
        }
        setIsFormOpen(false);
        setFormData({});
        setEmailError('');
    };

    const handleDeleteClick = (id: number) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (deleteId) {
            onDelete(deleteId);
            setDeleteId(null);
        }
    };

    return (
        <div className="flex h-full bg-gray-50/50 relative">
            {/* Sidebar Sub-menu */}
            <div className="w-56 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Kontak</h2>

                <Button
                    onClick={() => { setFormData({ type: activeTab }); setIsFormOpen(true); }}
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100 rounded-xl mb-6 h-12"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Tambah {activeTab === 'Customer' ? 'Pelanggan' : 'Pemasok'}
                </Button>

                <div className="space-y-1">
                    <button
                        onClick={() => setActiveTab('Customer')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'Customer'
                            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <Users className={`w-5 h-5 ${activeTab === 'Customer' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span>Pelanggan</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('Supplier')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'Supplier'
                            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <Truck className={`w-5 h-5 ${activeTab === 'Supplier' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span>Pemasok</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800">
                                {activeTab === 'Customer' ? 'Daftar Pelanggan' : 'Daftar Pemasok'}
                            </h3>
                            <p className="text-gray-500 text-sm mt-1">
                                {activeTab === 'Customer' ? 'Kelola data pelanggan setia Anda.' : 'Kelola data supplier dan vendor.'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={`Cari ${activeTab === 'Customer' ? 'pelanggan' : 'pemasok'}...`}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Nama & Keanggotaan</th>
                                        <th className="px-6 py-4 font-semibold">Kontak & Ultah</th>
                                        <th className="px-6 py-4 font-semibold">Alamat</th>
                                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                                        <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredContacts.map(contact => {
                                        const isBirthday = contact.birthday && new Date(contact.birthday).getMonth() === new Date().getMonth() && new Date(contact.birthday).getDate() === new Date().getDate();

                                        return (
                                            <tr key={contact.id} className="hover:bg-gray-50 group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                                        {contact.name}
                                                        {isBirthday && (
                                                            <div className="animate-bounce">
                                                                <Cake className="w-4 h-4 text-pink-500" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {contact.memberId && (
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">{contact.tier}</span>
                                                            <span className="text-[10px] font-mono text-gray-400">#{contact.memberId}</span>
                                                        </div>
                                                    )}
                                                    {contact.company && <div className="text-xs text-gray-500 mt-0.5">{contact.company}</div>}
                                                </td>
                                                <td className="px-6 py-4 space-y-1">
                                                    <div className="flex items-center gap-2 text-gray-500 text-xs"><Phone className="w-3 h-3" /> {contact.phone}</div>
                                                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                                                        {contact.type === 'Customer' && contact.birthday ? (
                                                            <span className={`flex items-center gap-2 ${isBirthday ? 'text-pink-600 font-bold' : 'text-gray-400'}`}>
                                                                <Cake className="w-3 h-3" /> {new Date(contact.birthday).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-2"><Mail className="w-3 h-3" /> {contact.email}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                                                    <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-gray-400" /> {contact.address}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${contact.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                                                        }`}>
                                                        {contact.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 flex justify-center gap-2">
                                                    {contact.type === 'Customer' && (
                                                        <button onClick={() => setSelectedCard(contact)} className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg" title="Cetak Kartu Member"><CreditCard className="w-4 h-4" /></button>
                                                    )}
                                                    <button onClick={() => { setFormData(contact); setIsFormOpen(true); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"><Edit className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteClick(contact.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredContacts.length === 0 && (
                                        <tr>
                                            <td colSpan={5}>
                                                <EmptyState
                                                    icon={Users}
                                                    title={`Belum ada ${activeTab === 'Customer' ? 'Pelanggan' : 'Pemasok'}`}
                                                    description={`Mulai tambahkan data ${activeTab === 'Customer' ? 'pelanggan' : 'pemasok'} Anda di sini.`}
                                                    actionLabel={`Tambah ${activeTab === 'Customer' ? 'Pelanggan' : 'Pemasok'}`}
                                                    onAction={() => { setFormData({ type: activeTab }); setIsFormOpen(true); }}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">{formData.id ? 'Edit Kontak' : `Tambah ${activeTab === 'Customer' ? 'Pelanggan' : 'Pemasok'}`}</h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama {activeTab === 'Customer' ? 'Pelanggan' : 'Pemasok'}</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={activeTab === 'Customer' ? "Contoh: Budi Santoso" : "Contoh: PT. Supplier Jaya"}
                                    required
                                />
                            </div>
                            {activeTab === 'Supplier' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan</label>
                                    <input className="w-full p-2 border rounded-lg" value={formData.company || ''} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="Opsional" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">No. Member (Kartu)</label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input className="w-full pl-9 p-2 border rounded-lg text-sm font-mono" value={formData.memberId || ''} onChange={e => setFormData({ ...formData, memberId: e.target.value.toUpperCase() })} placeholder="MC-XXXX" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Level Member</label>
                                        <select className="w-full p-2 border rounded-lg text-sm" value={formData.tier || 'Regular'} onChange={e => setFormData({ ...formData, tier: e.target.value as any })}>
                                            <option value="Regular">Regular (0%)</option>
                                            <option value="Silver">Silver (5%)</option>
                                            <option value="Gold">Gold (10%)</option>
                                            <option value="Platinum">Platinum (15%)</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            className={`w-full p-2 border rounded-lg pr-10 ${emailError ? 'border-red-500 focus:ring-red-200' : formData.email ? 'border-green-500 focus:ring-green-200' : ''}`}
                                            value={formData.email || ''}
                                            onChange={handleEmailChange}
                                            placeholder="nama@email.com"
                                        />
                                        {formData.email && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {emailError ? (
                                                    <XCircle className="w-5 h-5 text-red-500" />
                                                ) : (
                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {emailError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {emailError}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                                    <input className="w-full p-2 border rounded-lg" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                                <textarea className="w-full p-2 border rounded-lg resize-none text-sm" rows={2} value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                            </div>
                            {activeTab === 'Customer' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                                    <div className="relative">
                                        <Cake className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input type="date" className="w-full pl-9 p-2 border rounded-lg text-sm" value={formData.birthday || ''} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                <Button type="submit">Simpan</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Card Preview Modal */}
            {selectedCard && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-left">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-5 border-b flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-gray-800">Preview Kartu Member</h3>
                            <button onClick={() => setSelectedCard(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Plus className="w-5 h-5 rotate-45 text-gray-400" /></button>
                        </div>
                        <div className="p-10 flex flex-col items-center gap-8">
                            <QRCard
                                type="Customer"
                                name={selectedCard.name}
                                id={selectedCard.memberId || `CUST-${selectedCard.id}`}
                                roleOrTier={selectedCard.tier}
                                joinDateOrBirthday={selectedCard.birthday}
                            />
                            <div className="flex gap-4 w-full">
                                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setSelectedCard(null)}>Tutup</Button>
                                <Button className="flex-1 h-12 rounded-xl gap-2 shadow-lg shadow-primary/20" onClick={() => window.print()}>
                                    <Printer className="w-4 h-4" /> Cetak Kartu
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Hapus Kontak?"
                message="Data kontak yang dihapus tidak dapat dikembalikan lagi."
                confirmText="Hapus"
                variant="danger"
            />
        </div>
    );
}
