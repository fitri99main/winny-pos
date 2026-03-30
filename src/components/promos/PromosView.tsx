import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Percent, Plus, Search, Edit2, Trash2, 
  CheckCircle2, XCircle, Calendar, Tag, ChevronRight,
  Package, ShoppingBag
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Promo {
  id: number;
  name: string;
  description: string;
  type: 'manual' | 'automatic';
  discount_type: 'percentage' | 'fixed';
  value: number;
  min_spend: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface PromoProduct {
  promo_id: number;
  product_id: number;
}

export function PromosView({ currentBranchId, products }: { currentBranchId: string, products: any[] }) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promoProducts, setPromoProducts] = useState<PromoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const [formData, setFormData] = useState<Partial<Promo>>({
    name: '',
    description: '',
    type: 'automatic',
    discount_type: 'percentage',
    value: 0,
    min_spend: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchPromos();
  }, [currentBranchId]);

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const { data: promosData, error: promosError } = await supabase
        .from('promos')
        .select('*')
        .eq('branch_id', currentBranchId)
        .order('created_at', { ascending: false });

      if (promosError) throw promosError;

      const { data: ppData, error: ppError } = await supabase
        .from('promo_products')
        .select('*');

      if (ppError) throw ppError;

      setPromos(promosData || []);
      setPromoProducts(ppData || []);
    } catch (error: any) {
      toast.error('Gagal memuat promo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (promo: Promo | null = null) => {
    if (promo) {
      setEditingPromo(promo);
      setFormData(promo);
      const linkedProductIds = promoProducts
        .filter(pp => pp.promo_id === promo.id)
        .map(pp => pp.product_id);
      setSelectedProductIds(linkedProductIds);
    } else {
      setEditingPromo(null);
      setFormData({
        name: '',
        description: '',
        type: 'automatic',
        discount_type: 'percentage',
        value: 0,
        min_spend: 0,
        is_active: true,
      });
      setSelectedProductIds([]);
    }
    setIsModalOpen(true);
  };

  const handleSavePromo = async () => {
    try {
      if (!formData.name || !formData.value) {
        toast.error('Nama dan nilai diskon wajib diisi');
        return;
      }

      const payload = {
        ...formData,
        branch_id: currentBranchId,
      };

      let promoId: number;

      if (editingPromo) {
        const { error } = await supabase
          .from('promos')
          .update(payload)
          .eq('id', editingPromo.id);
        if (error) throw error;
        promoId = editingPromo.id;
        toast.success('Promo berhasil diperbarui');
      } else {
        const { data, error } = await supabase
          .from('promos')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        promoId = data.id;
        toast.success('Promo berhasil dibuat');
      }

      // Sync products
      await supabase.from('promo_products').delete().eq('promo_id', promoId);
      if (selectedProductIds.length > 0) {
        const productPayload = selectedProductIds.map(pid => ({
          promo_id: promoId,
          product_id: pid
        }));
        const { error: ppError } = await supabase.from('promo_products').insert(productPayload);
        if (ppError) throw ppError;
      }

      setIsModalOpen(false);
      fetchPromos();
    } catch (error: any) {
      toast.error('Gagal menyimpan promo: ' + error.message);
    }
  };

  const handleDeletePromo = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus promo ini?')) return;
    try {
      const { error } = await supabase.from('promos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Promo dihapus');
      fetchPromos();
    } catch (error: any) {
      toast.error('Gagal menghapus promo: ' + error.message);
    }
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };

  const filteredPromos = promos.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Percent className="w-6 h-6 text-orange-500" />
              Manajemen Promo
            </h1>
            <p className="text-gray-500 text-sm mt-1">Kelola diskon manual dan otomatis untuk pelanggan Anda.</p>
          </div>
          <Button 
            onClick={() => handleOpenModal()}
            className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-100 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Promo Baru
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              placeholder="Cari nama promo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-xl focus:ring-2 focus:ring-orange-500 transition-all text-sm"
            />
          </div>
        </div>

        {/* Promo Grid */}
        {loading ? (
          <div className="flex items-center justify-center p-20 text-gray-500">Memuat data promo...</div>
        ) : filteredPromos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Percent className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Belum ada promo</h3>
            <p className="text-gray-500 max-w-xs mx-auto mb-6 text-sm">Buat promo pertama Anda untuk meningkatkan penjualan.</p>
            <Button onClick={() => handleOpenModal()} variant="outline">Buat Promo Sekarang</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPromos.map((promo) => (
              <div key={promo.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group relative overflow-hidden">
                {/* Status Badge */}
                <div className="absolute top-0 right-0 p-4">
                  {promo.is_active ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" /> Aktif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-gray-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      <XCircle className="w-3 h-3" /> Nonaktif
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-2xl ${promo.type === 'automatic' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/30'}`}>
                    {promo.type === 'automatic' ? <Tag className="w-6 h-6" /> : <Edit2 className="w-6 h-6" />}
                  </div>
                  <div className="pr-12">
                    <h3 className="font-bold text-gray-800 dark:text-white leading-tight">{promo.name}</h3>
                    <p className="text-xs text-gray-400 mt-1 uppercase font-semibold tracking-wider">
                      {promo.type === 'automatic' ? 'Otomatis' : 'Manual'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4 flex items-center justify-between border border-gray-100 dark:border-gray-600">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Potongan</p>
                      <p className="text-xl font-black text-orange-600">
                        {promo.discount_type === 'percentage' ? `${promo.value}%` : `IDR ${Number(promo.value).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Min. Belanja</p>
                      <p className="font-bold text-gray-700 dark:text-gray-200">IDR {Number(promo.min_spend || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {promo.start_date ? format(new Date(promo.start_date), 'dd MMM yyyy') : 'No Start Date'} 
                      {' - '}
                      {promo.end_date ? format(new Date(promo.end_date), 'dd MMM yyyy') : 'No End Date'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50 dark:border-gray-700 mt-4">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleOpenModal(promo)}
                      className="flex-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <button 
                      onClick={() => handleDeletePromo(promo.id)}
                      className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Promo */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-8 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-800 dark:text-white leading-none">
                    {editingPromo ? 'Edit Promo' : 'Buat Promo Baru'}
                  </h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">WinPOS Promotional System</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-gray-400 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nama Promo</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-gray-800 dark:text-white"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Contoh: Diskon Kopi Akhir Pekan"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tipe Promo</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-gray-800 dark:text-white"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as 'manual' | 'automatic'})}
                    >
                      <option value="automatic">Otomatis (Terapkan otomatis)</option>
                      <option value="manual">Manual (Pilih saat transaksi)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Status Keaktifan</label>
                    <div className="flex items-center gap-4 py-2">
                      <button 
                        onClick={() => setFormData({...formData, is_active: true})}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${formData.is_active ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-500'}`}
                      >
                        Aktif
                      </button>
                      <button 
                        onClick={() => setFormData({...formData, is_active: false})}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${!formData.is_active ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'bg-gray-50 text-gray-500'}`}
                      >
                        Nonaktif
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Jenis Diskon</label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setFormData({...formData, discount_type: 'percentage'})}
                        className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold transition-all ${formData.discount_type === 'percentage' ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-400'}`}
                      >
                        Persentase (%)
                      </button>
                      <button 
                        onClick={() => setFormData({...formData, discount_type: 'fixed'})}
                        className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold transition-all ${formData.discount_type === 'fixed' ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-400'}`}
                      >
                        Jumlah Tunai (IDR)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nilai Diskon</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-gray-800 dark:text-white"
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: Number(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Minimal Belanja (IDR)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-gray-800 dark:text-white"
                      value={formData.min_spend}
                      onChange={(e) => setFormData({...formData, min_spend: Number(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mulai Tanggal</label>
                     <input
                       type="datetime-local"
                       className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-gray-800 dark:text-white"
                       value={formData.start_date ? formData.start_date.slice(0, 16) : ''}
                       onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Sampai Tanggal</label>
                     <input
                       type="datetime-local"
                       className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-gray-800 dark:text-white"
                       value={formData.end_date ? formData.end_date.slice(0, 16) : ''}
                       onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                     />
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk yang Terkena Promo</label>
                      <button 
                        onClick={() => setIsProductPickerOpen(true)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Pilih Produk
                      </button>
                    </div>
                    
                    {selectedProductIds.length === 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" onClick={() => setIsProductPickerOpen(true)}>
                        <p className="text-xs text-gray-400 font-medium">Promo ini akan berlaku untuk <span className="text-orange-600 font-bold">Semua Produk</span> jika tidak ada yang dipilih.</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                        {selectedProductIds.map(pid => {
                          const product = products.find(p => p.id === pid);
                          return (
                            <div key={pid} className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-full text-[10px] font-bold border border-orange-100 dark:border-orange-800 flex items-center gap-1.5 animate-in zoom-in-90 duration-150">
                              {product?.name || 'Unknown'}
                              <XCircle className="w-3.5 h-3.5 cursor-pointer hover:text-red-500" onClick={() => toggleProductSelection(pid)} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Button 
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </Button>
                <Button 
                  className="flex-1 h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-orange-100"
                  onClick={handleSavePromo}
                >
                  {editingPromo ? 'Update Promo' : 'Buat Promo'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Product Picker Dialog */}
        {isProductPickerOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Pilih Produk</h3>
                  <button onClick={() => setIsProductPickerOpen(false)} className="text-gray-400 hover:text-gray-500"><XCircle className="w-5 h-5" /></button>
                </div>
                
                <div className="relative mb-4">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                   <input 
                    type="text" 
                    placeholder="Cari produk..." 
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-none rounded-xl text-sm"
                   />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-1 px-1 scrollbar-thin">
                   {products.map(p => (
                     <div 
                      key={p.id} 
                      onClick={() => toggleProductSelection(p.id)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${selectedProductIds.includes(p.id) ? 'bg-orange-50 dark:bg-orange-900/20 order-first' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                     >
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-600 overflow-hidden flex-shrink-0">
                              {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-2 text-gray-400" />}
                           </div>
                           <div>
                              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{p.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium">IDR {Number(p.price).toLocaleString()}</p>
                           </div>
                        </div>
                        {selectedProductIds.includes(p.id) && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                     </div>
                   ))}
                </div>

                <Button 
                  className="w-full mt-6 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  onClick={() => setIsProductPickerOpen(false)}
                >
                  Selesai ({selectedProductIds.length} terpilih)
                </Button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
