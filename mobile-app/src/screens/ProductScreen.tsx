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
import * as ImagePicker from 'expo-image-picker';

export default function ProductScreen() {
    const navigation = useNavigation();
    const [products, setProducts] = useState<any[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Edit Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

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
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
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
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
            const filePath = `${fileName}`;

            // Reliable way to upload in React Native: fetch the URI as a Blob
            const response = await fetch(uri);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, blob, {
                    contentType: 'image/jpeg'
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            setEditingProduct({ ...editingProduct, image_url: publicUrl });
            Alert.alert('Sukses', 'Gambar berhasil diunggah');
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
                    is_sellable: editingProduct.is_sellable
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
                    <Text style={styles.backButtonText}>←</Text>
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
                    keyExtractor={(item) => item.id.toString()}
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
                                        onPress={() => setEditingProduct({ ...editingProduct, image_url: null })}
                                    >
                                        <Text style={styles.removeImageText}>Hapus Gambar</Text>
                                    </TouchableOpacity>
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
                                    value={editingProduct?.price?.toString()}
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
        marginRight: 16,
    },
    backButtonText: {
        fontSize: 24,
        color: '#1f2937',
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
