import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    TextInput,
    ActivityIndicator,
    Modal,
    Image,
    Alert,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import * as ImagePicker from 'expo-image-picker';
import { ImageStorageService } from '../lib/ImageStorageService';
import { ChevronLeft } from 'lucide-react-native';

export default function ProductScreen() {
    const navigation = useNavigation();
    const { currentBranchId } = useSession();
    const [products, setProducts] = useState<any[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Edit Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (currentBranchId) {
            fetchProducts();
        }
    }, [currentBranchId]);

    useEffect(() => {
        if (search.trim() === '') {
            setFilteredProducts(products);
        } else {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.code.toLowerCase().includes(search.toLowerCase())
            );
            setFilteredProducts(filtered);
        }
    }, [search, products]);

    const fetchProducts = async () => {
        if (!currentBranchId || isNaN(Number(currentBranchId))) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .or(`branch_id.eq.${currentBranchId},branch_id.is.null`)
                .order('name', { ascending: true });

            if (error) throw error;
            setProducts(data || []);
            setFilteredProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
            Alert.alert('Error', 'Gagal mengambil data produk');
        } finally {
            setLoading(false);
        }
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan akses galeri untuk mengunggah gambar.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets[0].uri) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        try {
            setUploading(true);
            
            // Use ImageStorageService to handle replacement (deletes old image automatically)
            const publicUrl = await ImageStorageService.replaceImage(editingProduct?.image_url, uri);

            setEditingProduct({ ...editingProduct, image_url: publicUrl });
            Alert.alert('Sukses', 'Gambar berhasil diperbarui');
        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', 'Gagal mengunggah gambar: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!editingProduct.name || !editingProduct.code) {
            Alert.alert('Info', 'Nama dan Kode Produk wajib diisi');
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('products')
                .update({
                    name: editingProduct.name,
                    code: editingProduct.code,
                    price: parseFloat(editingProduct.price) || 0,
                    category: editingProduct.category,
                    image_url: editingProduct.image_url,
                    is_sellable: editingProduct.is_sellable !== false // Preserve or default to true
                })
                .eq('id', editingProduct.id);

            if (error) throw error;

            Alert.alert('Sukses', 'Produk berhasil diperbarui');
            setModalVisible(false);
            fetchProducts();
        } catch (error: any) {
            console.error('Update error:', error);
            Alert.alert('Error', 'Gagal memperbarui produk: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingProduct?.id) return;
        
        Alert.alert(
            'Konfirmasi Arsip',
            'Yakin ingin menghapus/mengarsipkan produk ini? Produk tidak akan muncul di kasir tetapi tetap tersimpan di riwayat.',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Arsipkan', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // Try delete first
                            const { error: deleteError } = await supabase
                                .from('products')
                                .delete()
                                .eq('id', editingProduct.id);
                            
                            if (deleteError) {
                                if (deleteError.code === '23503') {
                                    // Referenced, so archive
                                    const { error: archiveError } = await supabase
                                        .from('products')
                                        .update({ is_sellable: false })
                                        .eq('id', editingProduct.id);
                                    
                                    if (archiveError) throw archiveError;
                                    Alert.alert('Arsip Berhasil', 'Produk memiliki riwayat transaksi, sehingga diarsipkan secara otomatis.');
                                } else {
                                    throw deleteError;
                                }
                            } else {
                                Alert.alert('Sukses', 'Produk berhasil dihapus');
                            }
                            
                            setModalVisible(false);
                            fetchProducts();
                        } catch (error: any) {
                            Alert.alert('Error', 'Gagal menghapus: ' + error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderProductItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.productCard}
            onPress={() => {
                setEditingProduct(item);
                setModalVisible(true);
            }}
        >
            <View style={styles.productImageContainer}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productImage} />
                ) : (
                    <Text style={styles.imagePlaceholderText}>📦</Text>
                )}
            </View>
            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productCode}>{item.code}</Text>
                <Text style={styles.productPrice}>Rp {item.price?.toLocaleString()}</Text>
            </View>
            <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category || '-'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={32} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manajemen Produk</Text>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Cari nama atau kode produk..."
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading && !modalVisible ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#ea580c" />
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={(item, index) => (item?.id ?? index).toString()}
                    renderItem={renderProductItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>🔍</Text>
                            <Text style={styles.emptyTitle}>Produk tidak ditemukan</Text>
                        </View>
                    }
                />
            )}

            {/* Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Edit Produk</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeModalText}>Tutup</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.imageUploadSection}>
                                <View style={{ position: 'relative' }}>
                                    <TouchableOpacity
                                        style={styles.imagePicker}
                                        onPress={handlePickImage}
                                        disabled={uploading}
                                    >
                                        {editingProduct?.image_url ? (
                                            <Image source={{ uri: editingProduct.image_url }} style={styles.uploadPreview} />
                                        ) : (
                                            <View style={styles.uploadPlaceholder}>
                                                <Text style={styles.uploadIcon}>📷</Text>
                                                <Text style={styles.uploadText}>Ketuk untuk Upload</Text>
                                            </View>
                                        )}
                                        {uploading && (
                                            <View style={styles.uploadingOverlay}>
                                                <ActivityIndicator color="white" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    
                                    {editingProduct?.image_url && (
                                        <TouchableOpacity
                                            style={styles.removeImageOverlay}
                                            onPress={async () => {
                                                Alert.alert(
                                                    'Hapus Gambar',
                                                    'Yakin ingin menghapus gambar ini dari penyimpanan?',
                                                    [
                                                        { text: 'Batal', style: 'cancel' },
                                                        { 
                                                            text: 'Hapus', 
                                                            style: 'destructive',
                                                            onPress: async () => {
                                                                await ImageStorageService.deleteImage(editingProduct.image_url);
                                                                setEditingProduct({ ...editingProduct, image_url: null });
                                                            }
                                                        }
                                                    ]
                                                );
                                            }}
                                        >
                                            <Text style={styles.removeImageIcon}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {editingProduct?.image_url && (
                                    <Text style={styles.imageStatusText}>Gambar aktif tersimpan di cloud</Text>
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Kode Produk (SKU)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editingProduct?.code}
                                    onChangeText={(text) => setEditingProduct({ ...editingProduct, code: text })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Nama Produk</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editingProduct?.name}
                                    onChangeText={(text) => setEditingProduct({ ...editingProduct, name: text })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Harga Jual</Text>
                                <TextInput
                                    style={styles.input}
                                    value={(editingProduct?.price || '').toString()}
                                    keyboardType="numeric"
                                    onChangeText={(text) => setEditingProduct({ ...editingProduct, price: text })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Kategori</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editingProduct?.category}
                                    onChangeText={(text) => setEditingProduct({ ...editingProduct, category: text })}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleSave}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
                                )}
                            </TouchableOpacity>

                            {editingProduct?.id && (
                                <TouchableOpacity
                                    style={[styles.saveButton, { backgroundColor: '#fee2e2', shadowColor: '#ef4444', marginTop: 12 }]}
                                    onPress={handleDelete}
                                    disabled={loading}
                                >
                                    <Text style={[styles.saveButtonText, { color: '#ef4444' }]}>Hapus / Arsipkan Produk</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        // Add subtle shadow for visibility
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    backButtonText: {
        fontSize: 28,
        color: '#1f2937',
        fontWeight: 'bold',
        marginTop: -2, // Optical alignment for the arrow
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    searchContainer: {
        padding: 16,
        backgroundColor: 'white',
    },
    searchInput: {
        backgroundColor: '#f3f4f6',
        padding: 12,
        borderRadius: 12,
        fontSize: 16,
    },
    listContent: {
        padding: 16,
    },
    productCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    productImageContainer: {
        width: 60,
        height: 60,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholderText: {
        fontSize: 24,
    },
    productInfo: {
        flex: 1,
        marginLeft: 12,
    },
    productName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    productCode: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ea580c',
        marginTop: 4,
    },
    categoryBadge: {
        backgroundColor: '#fff7ed',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    categoryBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ea580c',
        textTransform: 'uppercase',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyIcon: {
        fontSize: 48,
        color: '#d1d5db',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        color: '#6b7280',
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '85%',
    },
    modalHeader: {
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalHeaderTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    closeModalText: {
        color: '#ea580c',
        fontWeight: 'bold',
    },
    modalBody: {
        padding: 24,
    },
    imageUploadSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    imagePicker: {
        width: 150,
        height: 150,
        borderRadius: 24,
        backgroundColor: '#f9fafb',
        borderWidth: 2,
        borderColor: '#f3f4f6',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    uploadPreview: {
        width: '100%',
        height: '100%',
    },
    uploadPlaceholder: {
        alignItems: 'center',
    },
    uploadIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    uploadText: {
        fontSize: 12,
        color: '#9ca3af',
        fontWeight: '500',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeImageText: {
        marginTop: 12,
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 12,
    },
    removeImageOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    removeImageIcon: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    imageStatusText: {
        fontSize: 10,
        color: '#9ca3af',
        marginTop: 8,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6b7280',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#f3f4f6',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#1f2937',
    },
    saveButton: {
        backgroundColor: '#ea580c',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 100,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
