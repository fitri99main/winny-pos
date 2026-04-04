import { useState, useEffect } from 'react';
import { 
    Search, Plus, X, Edit2, Trash2, Save, Target, AlertCircle, Calendar, List, ClipboardCheck, History, Calculator, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface Indicator {
    id: number;
    label: string;
    weight: number;
}

interface EvaluationDetail {
    indicator_id: number;
    indicator_label: string;
    score: number;
    weight: number;
    total: number;
}

interface Evaluation {
    id: number;
    employee_id: number;
    employee_name: string;
    evaluation_date: string;
    total_score: number;
    base_salary?: number; // NEW: Base Salary (Gaji Pokok) at time of eval
    details?: EvaluationDetail[];
    created_at: string;
}

export function PerformanceIndicatorMasterView({
    indicators = [],
    evaluations = [],
    employees = [],
    user,
    onCRUD,
    onEvaluationCRUD
}: {
    indicators: Indicator[],
    evaluations: Evaluation[],
    employees: any[],
    user: any,
    onCRUD: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>,
    onEvaluationCRUD: (action: 'create' | 'update' | 'delete', data: any) => Promise<void>
}) {
    const [activeTab, setActiveTab] = useState<'master' | 'calc'>('master');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState<Indicator | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [formData, setFormData] = useState({
        label: '',
        weight: 20
    });

    // Evaluation Form State
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [isEditingEval, setIsEditingEval] = useState<Evaluation | null>(null);
    const [evalFormData, setEvalFormData] = useState({
        employeeId: '',
        base_salary: 0,
        evaluation_date: new Date().toISOString().split('T')[0],
        details: [] as EvaluationDetail[]
    });

    // Initialize scores when indicators change or modal opens
    useEffect(() => {
        if (isEvalModalOpen && !isEditingEval) {
            setEvalFormData(prev => ({
                ...prev,
                details: indicators.map(ind => ({
                    indicator_id: ind.id,
                    indicator_label: ind.label,
                    score: 0,
                    weight: ind.weight,
                    total: 0
                }))
            }));
        }
    }, [indicators, isEvalModalOpen, isEditingEval]);

    const handleIndicatorSubmit = async () => {
        if (!formData.label) return toast.error('Label indikator wajib diisi');
        try {
            await onCRUD(isEditing ? 'update' : 'create', isEditing ? { ...formData, id: isEditing.id } : formData);
            setIsModalOpen(false);
            setIsEditing(null);
            setFormData({ label: '', weight: 20 });
        } catch (err) {}
    };

    const handleEvalScoreChange = (index: number, score: number) => {
        const newDetails = [...evalFormData.details];
        newDetails[index].score = score;
        newDetails[index].total = score * (newDetails[index].weight / 100);
        setEvalFormData({ ...evalFormData, details: newDetails });
    };

    const handleEvalSubmit = async () => {
        if (!evalFormData.employeeId) return toast.error('Pilih karyawan');
        
        const selectedEmp = employees.find(e => e.id === Number(evalFormData.employeeId));
        const total = evalFormData.details.reduce((acc, curr) => acc + curr.total, 0);

        const payload = {
            ...evalFormData,
            employee_name: selectedEmp?.name || '',
            total_score: total,
            id: isEditingEval?.id
        };

        try {
            await onEvaluationCRUD(isEditingEval ? 'update' : 'create', payload);
            setIsEvalModalOpen(false);
            setIsEditingEval(null);
            setViewMode(false);
            setEvalFormData({
                employeeId: '',
                base_salary: 0,
                evaluation_date: new Date().toISOString().split('T')[0],
                details: []
            });
        } catch (err) {}
    };

    const handleViewEval = async (ev: Evaluation) => {
        setIsEditingEval(ev);
        setViewMode(true);
        setIsEvalModalOpen(true);
        
        // Fetch Details
        const { data, error } = await supabase.from('performance_evaluation_details').select('*').eq('evaluation_id', ev.id);
        if (data) {
            setEvalFormData({
                employeeId: String(ev.employee_id),
                base_salary: ev.base_salary || 0,
                evaluation_date: ev.evaluation_date,
                details: data
            });
        }
    };

    const handleEditEval = async (ev: Evaluation) => {
        setIsEditingEval(ev);
        setViewMode(false);
        setIsEvalModalOpen(true);

        // Fetch Details
        const { data } = await supabase.from('performance_evaluation_details').select('*').eq('evaluation_id', ev.id);
        if (data) {
            setEvalFormData({
                employeeId: String(ev.employee_id),
                base_salary: ev.base_salary || 0,
                evaluation_date: ev.evaluation_date,
                details: data
            });
        }
    };

    const handleEmployeeSelect = (empId: string) => {
        const emp = employees.find(e => String(e.id) === empId);
        setEvalFormData(prev => ({
            ...prev,
            employeeId: empId,
            base_salary: emp?.base_salary || 0
        }));
    };

    const handleEditIndicator = (ind: Indicator) => {
        setIsEditing(ind);
        setFormData({ label: ind.label, weight: ind.weight });
        setIsModalOpen(true);
    };

    const filteredIndicators = indicators.filter(ind => 
        ind.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalWeight = indicators.reduce((acc, curr) => acc + curr.weight, 0);

    return (
        <div className="p-6 sm:p-8 bg-gray-50/50 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="relative">
                    <div className="absolute -left-4 top-0 w-1 h-12 bg-primary rounded-full" />
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Target className="w-10 h-10 text-primary" />
                        Master Indikator Kinerja
                    </h1>
                    <p className="text-gray-500 font-medium mt-1 ml-1 text-sm">Kelola kriteria dan hitung nilai kerja karyawan.</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 font-sans">
                    <button 
                        onClick={() => setActiveTab('master')}
                        className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'master' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <List className="w-4 h-4" /> Data Master
                    </button>
                    <button 
                        onClick={() => setActiveTab('calc')}
                        className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'calc' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Calculator className="w-4 h-4" /> Perhitungan Nilai
                    </button>
                </div>
            </div>

            {activeTab === 'master' ? (
                <>
                    {/* Master Data View */}
                    <div className="flex justify-between items-center mb-8">
                        <div className="relative flex-1 group mr-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="text"
                                placeholder="Cari indikator..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-14 pl-12 pr-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-gray-700"
                            />
                        </div>
                        <Button 
                            onClick={() => {
                                setIsEditing(null);
                                setFormData({ label: '', weight: 0 });
                                setIsModalOpen(true);
                            }}
                            className="h-14 px-8 rounded-2xl bg-black hover:bg-gray-800 text-white font-black shadow-xl shadow-black/10 flex gap-2"
                        >
                            <Plus className="w-5 h-5" /> Tambah Indikator
                        </Button>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">No</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Indikator Kinerja</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-32">Bobot (%)</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-32">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredIndicators.map((ind, idx) => (
                                    <tr key={ind.id} className="hover:bg-gray-50 group transition-colors">
                                        <td className="px-8 py-6 text-center font-black text-gray-300">{idx + 1}</td>
                                        <td className="px-8 py-6">
                                            <div className="font-bold text-gray-900 text-lg">{ind.label}</div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 text-primary font-black text-sm">
                                                {ind.weight}%
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleEditIndicator(ind)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => onCRUD('delete', { id: ind.id })} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <>
                    {/* Calculation List View */}
                    <div className="flex justify-between items-center mb-8">
                        <div className="font-bold text-gray-400 uppercase tracking-widest text-xs">Riwayat Perhitungan</div>
                        <Button 
                            onClick={() => {
                                setIsEditingEval(null);
                                setViewMode(false);
                                setIsEvalModalOpen(true);
                            }}
                            className="h-14 px-8 rounded-2xl bg-primary text-white font-black shadow-xl shadow-primary/20 flex gap-2"
                        >
                            <Plus className="w-5 h-5" /> Tambah Perhitungan
                        </Button>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">No</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tanggal</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-32">Total Skor</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-32">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {evaluations.map((ev, idx) => (
                                    <tr key={ev.id} className="hover:bg-gray-50 group transition-colors">
                                        <td className="px-8 py-6 text-center font-black text-gray-300">{idx + 1}</td>
                                        <td className="px-8 py-6 font-bold text-gray-600">{new Date(ev.evaluation_date).toLocaleDateString()}</td>
                                        <td className="px-8 py-6 font-black text-gray-900">{ev.employee_name}</td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="text-lg font-black text-primary">{ev.total_score.toFixed(1)}</div>
                                        </td>
                                        <td className="px-8 py-6 flex justify-center gap-2">
                                            <button onClick={() => handleViewEval(ev)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all" title="Lihat Detail"><Eye className="w-4 h-4" /></button>
                                            <button onClick={() => handleEditEval(ev)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all" title="Edit Riwayat"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => onEvaluationCRUD('delete', { id: ev.id })} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Master Indicator Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative w-full max-lg bg-white rounded-[40px] shadow-2xl p-8 animate-in zoom-in-95 font-sans">
                        <h2 className="text-3xl font-black text-gray-900 mb-6">{isEditing ? 'Edit Indikator' : 'Tambah Indikator'}</h2>
                        <div className="space-y-4 mb-8">
                            <input 
                                placeholder="Label Indikator" value={formData.label}
                                onChange={e => setFormData({ ...formData, label: e.target.value })}
                                className="w-full h-14 px-4 bg-gray-50 border-none rounded-2xl outline-none font-bold"
                            />
                            <div className="flex items-center gap-4">
                                <label className="font-bold text-gray-400">Bobot (%):</label>
                                <input 
                                    type="number" value={formData.weight}
                                    onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                                    className="w-24 h-14 px-4 bg-gray-50 border-none rounded-2xl outline-none font-black text-primary text-center"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 font-sans">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-14 flex-1 rounded-2xl font-bold">Batal</Button>
                            <Button onClick={handleIndicatorSubmit} className="h-14 flex-1 rounded-2xl bg-black text-white font-black">Simpan</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Calculation Modal */}
            {isEvalModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 font-sans">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEvalModalOpen(false)} />
                    <div className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 leading-tight">{viewMode ? 'Detail Perhitungan Nilai' : (isEditingEval ? 'Ubah Perhitungan Nilai' : 'Perhitungan Nilai Kerja')}</h2>
                                <p className="text-sm font-medium text-gray-500 mt-1">{viewMode ? 'Menampilkan rincian skor indikator kinerja.' : (isEditingEval ? 'Lakukan perubahan skor indikator karyawan.' : 'Input skor untuk setiap indikator kinerja.')}</p>
                            </div>
                            <button onClick={() => setIsEvalModalOpen(false)} className="p-3 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-2xl"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="p-8 max-h-[70vh] overflow-y-auto scrollbar-thin">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Karyawan</label>
                                    <select 
                                        value={evalFormData.employeeId}
                                        onChange={(e) => handleEmployeeSelect(e.target.value)}
                                        disabled={viewMode}
                                        className="w-full h-14 px-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black text-gray-700 disabled:opacity-50"
                                    >
                                        <option value="">Pilih Karyawan</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tanggal</label>
                                    <input 
                                        type="date"
                                        value={evalFormData.evaluation_date}
                                        disabled={viewMode}
                                        onChange={(e) => setEvalFormData({ ...evalFormData, evaluation_date: e.target.value })}
                                        className="w-full h-14 px-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black text-gray-700 disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50">
                                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <th className="px-6 py-4 text-center w-12">No</th>
                                            <th className="px-6 py-4">Indikator</th>
                                            <th className="px-6 py-4 w-24 text-center">Nilai</th>
                                            <th className="px-6 py-4 w-24 text-center">Bobot (%)</th>
                                            <th className="px-6 py-4 w-24 text-center">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 font-sans">
                                        {(evalFormData.details || []).map((detail, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className="px-6 py-5 text-center text-gray-300 font-black">{idx + 1}</td>
                                                <td className="px-6 py-5 font-bold text-gray-800">{detail.indicator_label}</td>
                                                <td className="px-6 py-5">
                                                    <input 
                                                        type="number"
                                                        value={detail.score || ''}
                                                        disabled={viewMode}
                                                        onChange={(e) => handleEvalScoreChange(idx, Number(e.target.value))}
                                                        className="w-full h-12 bg-white border border-gray-100 rounded-xl text-center font-black text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-200 disabled:opacity-50"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-6 py-5 text-center font-bold text-gray-400 bg-gray-50/30">{detail.weight}%</td>
                                                <td className="px-6 py-5 text-center font-black text-primary bg-primary/5">{detail.total.toFixed(1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        {/* Total Score % */}
                                        <tr className="bg-emerald-50 text-emerald-700 font-bold text-xs uppercase border-t border-emerald-100">
                                            <td colSpan={4} className="px-6 py-4 text-right tracking-widest">Total Skor Penilaian (%)</td>
                                            <td className="px-6 py-4 text-center text-lg font-black">{evalFormData.details.reduce((acc, c) => acc + c.total, 0).toFixed(1)}%</td>
                                        </tr>
                                        {/* Gaji Pokok Dasar (Multiplier) */}
                                        <tr className="bg-emerald-50 text-emerald-700 font-bold text-xs uppercase border-t border-emerald-100">
                                            <td colSpan={4} className="px-6 py-4 text-right tracking-widest">Gaji Pokok Dasar (x)</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-emerald-700 font-bold">Rp</span>
                                                    <input 
                                                        type="number"
                                                        value={evalFormData.base_salary || ''}
                                                        disabled={viewMode}
                                                        onChange={(e) => setEvalFormData({ ...evalFormData, base_salary: Number(e.target.value) })}
                                                        className="w-40 h-10 bg-white border border-emerald-200 rounded-xl text-center font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Tunjangan Kinerja (Result) */}
                                        <tr className="bg-emerald-100 text-emerald-800 font-bold text-xs uppercase border-t border-emerald-200">
                                            <td colSpan={4} className="px-6 py-4 text-right tracking-widest text-emerald-900 text-sm">Nilai Tunjangan Kinerja (=)</td>
                                            <td className="px-6 py-4 text-center text-xl font-black">
                                                Rp {Math.round(evalFormData.base_salary * (evalFormData.details.reduce((acc, c) => acc + c.total, 0) / 100)).toLocaleString()}
                                            </td>
                                        </tr>
                                        {/* Total Payout */}
                                        <tr className="bg-primary text-white font-black text-sm uppercase">
                                            <td colSpan={4} className="px-6 py-5 text-right tracking-widest">Total Yang Diterima (Gaji + Tunjangan)</td>
                                            <td className="px-6 py-5 text-center text-xl font-black">
                                                Rp {(evalFormData.base_salary + Math.round(evalFormData.base_salary * (evalFormData.details.reduce((acc, c) => acc + c.total, 0) / 100))).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50/50 flex gap-4 sticky bottom-0 z-10 border-t border-gray-50">
                            <Button variant="outline" onClick={() => setIsEvalModalOpen(false)} className="h-16 flex-1 rounded-2xl bg-white border-none font-bold text-gray-500 hover:text-gray-900 shadow-sm transition-all">{viewMode ? 'Tutup' : 'Batal'}</Button>
                            {!viewMode && (
                                <Button onClick={handleEvalSubmit} className="h-16 flex-1 rounded-2xl bg-black hover:bg-gray-800 text-white font-black shadow-2xl shadow-black/20 flex gap-3"><Save className="w-6 h-6" /> {isEditingEval ? 'Perbarui Perhitungan' : 'Simpan Perhitungan'}</Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
