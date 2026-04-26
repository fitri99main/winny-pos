import { useState, useEffect } from 'react';
import { Contact, Users, Truck, Plus, Search, Phone, Mail, MapPin, Edit, Trash2, CreditCard, Cake, Star, Printer } from 'lucide-react';
import { QRCard } from '../ui/QRCard';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
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

interface ContactsViewProps {
    contacts: ContactData[];
    setContacts: React.Dispatch<React.SetStateAction<ContactData[]>>;
    onAdd: (contact: Partial<ContactData>) => void;
    onUpdate: (contact: Partial<ContactData>) => void;
    onDelete: (id: number) => void;
}

export function ContactsView({ contacts, setContacts, onAdd, onUpdate, onDelete }: ContactsViewProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ContactData>>({});
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [emailError, setEmailError] = useState('');

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
        if (error) {
            toast.error('Gagal mengambil data kontak');
            console.error(error);
        } else {
            setContacts(data || []);
        }
    };

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

    const filteredContacts = (contacts || []).filter(c => c.type === 'Supplier');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            toast.error('Nama dan No. Telepon wajib diisi');
            return;
        }

        try {
            if (formData.id) {
                const { error } = await supabase.from('contacts').update(formData).eq('id', formData.id);
                if (error) throw error;
                toast.success('Kontak berhasil diperbarui');
            } else {
                const newContact = {
                    ...formData,
                    type: 'Supplier',
                    status: 'Active',
                };

                // Manual mapping for insert/update to match DB schema
                const dbPayload = {
                    name: formData.name,
                    type: 'Supplier',
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    company: formData.company,
                    status: 'Active',
                    member_id: formData.memberId,
                    tier: null,
                    points: 0,
                    birthday: null
                };

                if (formData.id) {
                    const { error } = await supabase.from('contacts').update(dbPayload).eq('id', formData.id);
                    if (error) throw error;
                    toast.success('Kontak berhasil diperbarui');
                } else {
                    const { error } = await supabase.from('contacts').insert([dbPayload]);
                    if (error) throw error;
                    toast.success('Kontak berhasil ditambahkan');
                }
            }
            fetchContacts();
            setIsFormOpen(false);
            setFormData({});
            setEmailError('');
        } catch (error: any) {
            toast.error('Gagal menyimpan kontak: ' + error.message);
        }
    };

    const handleDeleteClick = (id: number) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            try {
                const { error } = await supabase.from('contacts').delete().eq('id', deleteId);
                if (error) throw error;
                toast.success('Kontak berhasil dihapus');
                fetchContacts();
            } catch (error: any) {
                toast.error('Gagal menghapus kontak: ' + error.message);
            }
            setDeleteId(null);
        }
    };

    return (
        <div className="flex h-full bg-gray-50/50 relative">
            {/* Sidebar Sub-menu */}
            <div className="w-56 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Kontak</h2>

                <Button
                    onClick={() => { setFormData({ type: 'Supplier' }); setIsFormOpen(true); }}
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100 rounded-xl mb-6 h-12"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Tambah Pemasok
                </Button>

                <div className="space-y-1">
                    <button
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100"
                    >
                        <Truck className="w-5 h-5 text-blue-600" />
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
                                Daftar Pemasok (Supplier)
                            </h3>
                            <p className="text-gray-500 text-sm mt-1">
                                Kelola data supplier dan vendor untuk pembelian bahan baku.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari pemasok..."
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Nama Pemasok</th>
                                        <th className="px-6 py-4 font-semibold">Kontak & Perusahaan</th>
                                        <th className="px-6 py-4 font-semibold">Alamat</th>
                                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                                        <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredContacts.map(contact => (
                                        <tr key={contact.id} className="hover:bg-gray-50 group">
                                            <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-800">{contact.name}</div>
                                                    {contact.company && <div className="text-xs text-gray-500 mt-0.5">{contact.company}</div>}
                                                </td>
                                                <td className="px-6 py-4 space-y-1">
                                                    <div className="flex items-center gap-2 text-gray-500 text-xs"><Phone className="w-3 h-3" /> {contact.phone}</div>
                                                    <div className="flex items-center gap-2 text-gray-500 text-xs"><Mail className="w-3 h-3" /> {contact.email}</div>
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
                                                    <button onClick={() => { setFormData(contact); setIsFormOpen(true); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"><Edit className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteClick(contact.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredContacts.length === 0 && (
                                        <tr>
                                            <td colSpan={5}>
                                                <EmptyState
                                                    icon={Truck}
                                                    title="Belum ada Pemasok"
                                                    description="Mulai tambahkan data pemasok bahan baku Anda di sini."
                                                    actionLabel="Tambah Pemasok"
                                                    onAction={() => { setFormData({ type: 'Supplier' }); setIsFormOpen(true); }}
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
                            <h3 className="font-bold text-lg text-gray-800">{formData.id ? 'Edit Pemasok' : 'Tambah Pemasok'}</h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemasok</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: PT. Supplier Jaya"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan (Opsional)</label>
                                <input className="w-full p-2 border rounded-lg" value={formData.company || ''} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="Opsional" />
                            </div>
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
                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                                <Button type="submit">Simpan</Button>
                            </div>
                        </form>
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
