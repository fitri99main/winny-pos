import { useState, useEffect } from 'react';
import { History, Calendar, User, Search, Download, Eye, TrendingUp, DollarSign, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface SessionHistory {
    id: string;
    user_id: string;
    starting_cash: number;
    ending_cash: number | null;
    total_sales: number;
    expected_cash: number;
    variance: number;
    opened_at: string;
    closed_at: string | null;
    status: 'Open' | 'Closed';
    user_name?: string;
}

export function SessionHistoryView() {
    const [sessions, setSessions] = useState<SessionHistory[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<SessionHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Closed'>('All');
    const [selectedSession, setSelectedSession] = useState<SessionHistory | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<SessionHistory | null>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [sessions, searchQuery, dateFrom, dateTo, statusFilter]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cashier_sessions')
                .select('*')
                .order('opened_at', { ascending: false });

            if (error) throw error;

            const sessionsWithNames = data?.map(s => ({
                ...s,
                user_name: s.employee_name || 'Unknown'
            })) || [];

            setSessions(sessionsWithNames);
        } catch (error: any) {
            console.error('Error fetching sessions:', error);
            toast.error('Gagal memuat riwayat session');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...sessions];

        // Filter by search query (user name or ID)
        if (searchQuery) {
            filtered = filtered.filter(s =>
                s.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.id.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Filter by date range
        if (dateFrom) {
            filtered = filtered.filter(s => new Date(s.opened_at) >= new Date(dateFrom));
        }
        if (dateTo) {
            filtered = filtered.filter(s => new Date(s.opened_at) <= new Date(dateTo + 'T23:59:59'));
        }

        // Filter by status
        if (statusFilter !== 'All') {
            filtered = filtered.filter(s => s.status === statusFilter);
        }

        setFilteredSessions(filtered);
    };

    const exportToCSV = () => {
        const headers = ['Kasir', 'Dibuka', 'Ditutup', 'Modal Awal', 'Total Sales', 'Uang Akhir', 'Variance', 'Status'];
        const rows = filteredSessions.map(s => [
            s.user_name,
            new Date(s.opened_at).toLocaleString('id-ID'),
            s.closed_at ? new Date(s.closed_at).toLocaleString('id-ID') : '-',
            s.starting_cash,
            s.total_sales,
            s.ending_cash || 0,
            s.variance,
            s.status
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-history-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Export berhasil!');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calculate summary stats
    const totalSessions = filteredSessions.length;
    const totalSales = filteredSessions.reduce((sum, s) => sum + s.total_sales, 0);
    const totalVariance = filteredSessions.filter(s => s.status === 'Closed').reduce((sum, s) => sum + s.variance, 0);
    const avgVariance = totalSessions > 0 ? totalVariance / filteredSessions.filter(s => s.status === 'Closed').length : 0;

    const confirmDelete = (session: SessionHistory) => {
        setSessionToDelete(session);
        setDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!sessionToDelete) return;

        try {
            const { error } = await supabase
                .from('cashier_sessions')
                .delete()
                .eq('id', sessionToDelete.id);

            if (error) throw error;

            toast.success('Session berhasil dihapus');
            setDeleteConfirmOpen(false);
            setSessionToDelete(null);
            if (selectedSession?.id === sessionToDelete.id) {
                setDetailModalOpen(false);
            }
            fetchSessions();
        } catch (error: any) {
            console.error('Error deleting session:', error);
            toast.error('Gagal menghapus session: ' + error.message);
        }
    };

    return (
        <div className="p-8 space-y-6 bg-gray-50/50 dark:bg-gray-900/50 h-full overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Riwayat Session Kasir</h1>
                    <p className="text-sm text-gray-500">Pantau semua aktivitas buka/tutup shift kasir</p>
                </div>
                <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            <History className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Sessions</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalSessions}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Penjualan</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(totalSales)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${avgVariance >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'} flex items-center justify-center`}>
                            <TrendingUp className={`w-6 h-6 ${avgVariance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Variance</p>
                            <p className={`text-2xl font-bold ${avgVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(avgVariance)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 space-y-4">
                <h3 className="font-bold text-gray-800 dark:text-white">Filter</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Dari Tanggal</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Sampai Tanggal</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="All">Semua</option>
                            <option value="Open">Buka</option>
                            <option value="Closed">Tutup</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Cari</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari kasir..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sessions Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Kasir</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Dibuka</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Ditutup</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Modal</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Sales</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Variance</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center gap-2 text-gray-500">
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            Memuat data...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                        <p className="text-gray-500">Tidak ada riwayat session</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className="font-medium text-gray-800 dark:text-white">{session.user_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDateTime(session.opened_at)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDateTime(session.closed_at)}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-800 dark:text-white">{formatCurrency(session.starting_cash)}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-800 dark:text-white">{formatCurrency(session.total_sales)}</td>
                                        <td className={`px-6 py-4 text-right text-sm font-bold ${session.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(session.variance)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${session.status === 'Open'
                                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                }`}>
                                                {session.status === 'Open' ? 'Buka' : 'Tutup'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedSession(session);
                                                        setDetailModalOpen(true);
                                                    }}
                                                    className="text-primary hover:bg-primary/10"
                                                >
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    Detail
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => confirmDelete(session)}
                                                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {detailModalOpen && selectedSession && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detail Session</h2>
                            <button
                                onClick={() => setDetailModalOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Kasir</label>
                                <p className="text-lg font-medium text-gray-800 dark:text-white">{selectedSession.user_name}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Status</label>
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${selectedSession.status === 'Open'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                    }`}>
                                    {selectedSession.status === 'Open' ? 'Buka' : 'Tutup'}
                                </span>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Dibuka</label>
                                <p className="text-lg font-medium text-gray-800 dark:text-white">{formatDateTime(selectedSession.opened_at)}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Ditutup</label>
                                <p className="text-lg font-medium text-gray-800 dark:text-white">{formatDateTime(selectedSession.closed_at)}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Modal Awal</label>
                                <p className="text-lg font-bold text-gray-800 dark:text-white">{formatCurrency(selectedSession.starting_cash)}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total Penjualan</label>
                                <p className="text-lg font-bold text-green-600">{formatCurrency(selectedSession.total_sales)}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Uang Akhir</label>
                                <p className="text-lg font-bold text-gray-800 dark:text-white">{formatCurrency(selectedSession.ending_cash || 0)}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Selisih (Variance)</label>
                                <p className={`text-lg font-bold ${selectedSession.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(selectedSession.variance)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    confirmDelete(selectedSession);
                                }}
                                className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Hapus Session
                            </Button>
                            <Button onClick={() => setDetailModalOpen(false)} variant="outline">
                                Tutup
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmOpen && sessionToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Hapus Session?</h3>
                                <p className="text-sm text-gray-500 mt-2">
                                    Anda yakin akan menghapus session kasir <strong>{sessionToDelete.user_name}</strong> tanggal {new Date(sessionToDelete.opened_at).toLocaleDateString()}?
                                    <br />
                                    Data yang dihapus tidak dapat dikembalikan.
                                </p>
                            </div>
                            <div className="flex w-full gap-3 mt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setDeleteConfirmOpen(false)}
                                >
                                    Batal
                                </Button>
                                <Button
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    onClick={handleDelete}
                                >
                                    Hapus
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
