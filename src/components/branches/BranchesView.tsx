import { useState } from 'react';
import { Store, Plus, Search, MapPin, Phone, X, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from 'sonner';

interface Branch {
    id: string;
    name: string;
    address: string;
    phone: string;
    status: 'Active' | 'Inactive';
}

export function BranchesView({
    branches = [],
    onBranchAction = async () => { }
}: {
    branches?: any[],
    onBranchAction?: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>
}) {

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingBranch, setEditingBranch] = useState<any>(null);
    const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' });
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleSaveBranch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBranch.name || !newBranch.address) {
            toast.error('Silakan isi nama dan alamat cabang');
            return;
        }

        const payload = {
            name: newBranch.name,
            address: newBranch.address,
            phone: newBranch.phone,
            status: 'Active'
        };

        if (editingBranch) {
            onBranchAction('update', { ...payload, id: editingBranch.id });
        } else {
            onBranchAction('create', payload);
        }

        setNewBranch({ name: '', address: '', phone: '' });
        setEditingBranch(null);
        setIsAddModalOpen(false);
    };

    const handleEditClick = (branch: any) => {
        setEditingBranch(branch);
        setNewBranch({
            name: branch.name,
            address: branch.address,
            phone: branch.phone || ''
        });
        setIsAddModalOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (deleteId) {
            onBranchAction('delete', { id: deleteId });
            setDeleteId(null);
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-full bg-gray-50/50">
            {/* Sidebar Manajemen Cabang */}
            <div className="w-56 bg-white border-r border-gray-200 p-6 flex flex-col gap-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Manajemen Cabang</h2>

                <Button
                    onClick={() => {
                        setEditingBranch(null);
                        setNewBranch({ name: '', address: '', phone: '' });
                        setIsAddModalOpen(true);
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-100 rounded-xl mb-6 h-12"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Tambah Cabang
                </Button>

                <div className="space-y-1">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100">
                        <Store className="w-5 h-5 text-blue-600" />
                        <span>Daftar Outlet</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800">Semua Outlet</h3>
                            <p className="text-gray-500 text-sm mt-1">Kelola seluruh lokasi operasional Anda.</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari cabang atau alamat..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                            {filteredBranches.map((branch) => (
                                <div key={branch.id} className="p-6 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-white hover:shadow-md transition-all group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                                            <Store className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleEditClick(branch)}
                                                className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-blue-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(branch.id)}
                                                className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-red-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-gray-800 text-lg mb-2">{branch.name}</h4>

                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2 text-sm text-gray-500">
                                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>{branch.address}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Phone className="w-4 h-4 flex-shrink-0" />
                                            <span>{branch.phone}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${branch.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {branch.status === 'Active' ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-mono">{branch.id}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Tambah Cabang */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="font-bold text-xl text-gray-800">{editingBranch ? 'Edit Cabang' : 'Tambah Cabang'}</h3>
                                <p className="text-xs text-gray-500 mt-1">{editingBranch ? 'Perbarui informasi lokasi outlet.' : 'Masukkan informasi lokasi outlet baru.'}</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBranch} className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nama Cabang</label>
                                <input
                                    type="text"
                                    required
                                    value={newBranch.name}
                                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                                    placeholder="contoh: Winny Pangeran Natakusuma Cabang Bogor"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Alamat Lengkap</label>
                                <textarea
                                    required
                                    value={newBranch.address}
                                    onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                                    placeholder="Alamat lengkap outlet..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Nomor Telepon</label>
                                <input
                                    type="text"
                                    value={newBranch.phone}
                                    onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                                    placeholder="e.g. 021-xxxxxxx"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsAddModalOpen(false)}>Batal</Button>
                                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white h-12 rounded-xl shadow-lg shadow-blue-100">Simpan Cabang</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Hapus Cabang?"
                message="Tindakan ini tidak dapat dibatalkan. Semua data terkait cabang ini mungkin akan terpengaruh."
                confirmText="Ya, Hapus"
                variant="danger"
            />
        </div>
    );
}
