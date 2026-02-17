import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Image, Modal, Alert, StyleSheet, useWindowDimensions, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import PaymentModal from '../components/PaymentModal';



export default function POSScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { tableNumber, waiterName: initialWaiter } = route.params || {};
    const { width, height } = useWindowDimensions();

    const isLandscape = width > height;
    const isTablet = width >= 768 || height >= 768;
    const isLargeTablet = width >= 1000 || height >= 1000;

    const getAcronym = (name: string) => {
        return name?.substring(0, 2).toUpperCase() || '??';
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [categories, setCategories] = useState<string[]>(['Semua']);

    // Master Data
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [tables, setTables] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [waiters, setWaiters] = useState<any[]>([]);

    // UI State
    const [showTableModal, setShowTableModal] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showWaiterModal, setShowWaiterModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastOrderNo, setLastOrderNo] = useState('');
    const [showCartModal, setShowCartModal] = useState(false);
    // const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [currentSaleId, setCurrentSaleId] = useState<number | null>(null);
    const [showMemberLoginModal, setShowMemberLoginModal] = useState(false);

    const [memberPhone, setMemberPhone] = useState('');

    // Transaction Data
    const [cart, setCart] = useState<any[]>([]);
    const [selectedTable, setSelectedTable] = useState(tableNumber || '');
    const [customerName, setCustomerName] = useState('Guest');
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [selectedWaiter, setSelectedWaiter] = useState(initialWaiter || '');
    const [currentBranchId] = useState('7'); // Pangeran Natakusuma

    // Fetch Initial Data
    useEffect(() => {
        fetchProducts();
        fetchCategories();
        fetchMasterData();
    }, [currentBranchId]);

    // DEBUG LOG
    // DEBUG LOG
    useEffect(() => {
        console.log('=== DEBUG CATEGORIES STATE ===', JSON.stringify(categories));
    }, [categories]);


    const fetchMasterData = async () => {
        try {
            // 1. Fetch Active Session
            const { data: sessionData } = await supabase
                .from('cashier_sessions')
                .select('id')
                .eq('status', 'Open')
                .eq('branch_id', parseInt(currentBranchId))
                .maybeSingle();

            if (sessionData) {
                setActiveSessionId(sessionData.id.toString());
            }



            // 3. Fetch Customers (Try fallback if table fails)
            const { data: customerData, error: custError } = await supabase
                .from('customers')
                .select('id, name, phone')
                .limit(50);

            if (!custError && customerData) {
                setCustomers(customerData);
            } else {
                // Fallback Mock Customers if table doesn't exist
                setCustomers([
                    { id: '1', name: 'Guest', phone: '-' },
                    { id: '2', name: 'Member A', phone: '08123' },
                ]);
            }

            // 4. Fetch Tables
            const { data: tableData } = await supabase
                .from('tables')
                .select('*')
                .order('number');

            if (tableData) {
                setTables(tableData);
            }

            // 5. Fetch Waiters
            const { data: waiterData } = await supabase
                .from('employees')
                .select('id, name')
                .eq('status', 'Active');

            if (waiterData) {
                setWaiters(waiterData);
            }

        } catch (error) {
            console.error('Error fetching master data:', error);
        }
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('name')
                .order('name');

            if (error) throw error;

            if (data) {
                // Use Set to remove duplicates from DB with strict cleaning
                const uniqueSet = new Set<string>();

                // Add existing hardcoded if needed, but better to rely on DB
                // uniqueSet.add('Makanan'); 

                data.forEach(c => {
                    if (c && c.name) {
                        const cleanName = c.name.toString().trim();
                        // Filter out empty and 'Semua' (case insensitive)
                        if (cleanName.length > 0 && cleanName.toLowerCase() !== 'semua') {
                            uniqueSet.add(cleanName);
                        }
                    }
                });

                const uniqueCategories = Array.from(uniqueSet);
                console.log('Unique Categories:', uniqueCategories);
                setCategories(['Semua', ...uniqueCategories]);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            // Fallback: only show 'Semua' to avoid confusion/duplication
            setCategories(['Semua']);
        }
    };

    const fetchProducts = async () => {
        try {
            setLoadingProducts(true);
            const { data, error } = await supabase
                .from('products')
                .select('*') // Select all columns including stock and category
                .eq('branch_id', parseInt(currentBranchId));

            if (error) throw error;

            console.log('Products fetched:', data?.length);
            // Explicitly remove image_url to prevent using it
            const productsNoImages = data?.map((p: any) => ({ ...p, image_url: undefined })) || [];
            setProducts(productsNoImages);
        } catch (error) {
            console.error('Error fetching products:', error);
            Alert.alert('Error', 'Gagal memuat produk data');
        } finally {
            setLoadingProducts(false);
        }
    };

    // Filter Logic
    const filteredProducts = useMemo(() => {
        let result = products;
        if (selectedCategory !== 'Semua') {
            result = result.filter(p => p.category === selectedCategory || (p.category_name && p.category_name === selectedCategory));
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lowerQuery));
        }
        return result;
    }, [products, searchQuery, selectedCategory]);

    // Cart Total used in Apply Discount


    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    const checkMember = async () => {
        if (!memberPhone.trim()) {
            Alert.alert('Info', 'Masukkan nomor HP');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .ilike('phone', `%${memberPhone}%`) // Allow partial match or exact? Using ilike for flexibility or eq for strict. strict for now.
                .maybeSingle();

            // Re-query with eq if strictly needed, but let's try strict first
            const { data: exactData, error: exactError } = await supabase
                .from('customers')
                .select('*')
                .eq('phone', memberPhone)
                .maybeSingle();

            const member = exactData || data;

            if (!member) {
                Alert.alert('Gagal', 'Member tidak ditemukan. Lanjut sebagai tamu?', [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Ya, Tamu', onPress: skipMemberLogin }
                ]);
            } else {
                setCustomerName(member.name);
                setSelectedCustomerId(member.id);
                setShowMemberLoginModal(false);
                setMemberPhone('');
                Alert.alert('Sukses', `Selamat datang, ${member.name}!`);
            }
        } catch (e) {
            Alert.alert('Error', 'Terjadi kesalahan saat mengecek member');
        }
    };

    const skipMemberLogin = () => {
        setCustomerName('Guest');
        setSelectedCustomerId(null);
        setShowMemberLoginModal(false);
        setMemberPhone('');
    };

    const addToCart = (product: any) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === productId);
            if (existingItem && existingItem.quantity > 1) {
                return prevCart.map(item =>
                    item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
                );
            }
            return prevCart.filter(item => item.id !== productId);
        });
    };

    const clearCart = () => setCart([]);

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            Alert.alert('Info', 'Keranjang masih kosong');
            return;
        }

        if (!selectedTable) {
            Alert.alert('Info', 'Silakan pilih meja terlebih dahulu');
            setShowTableModal(true);
            return;
        }

        try {
            const totalAmount = calculateTotal();
            const orderNo = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

            // 1. Create Sale (Transactions are called 'sales' in this system)
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    order_no: orderNo,
                    branch_id: parseInt(currentBranchId),
                    customer_name: customerName,
                    customer_id: selectedCustomerId,
                    table_no: selectedTable,
                    waiter_name: selectedWaiter,
                    total_amount: totalAmount,
                    status: 'Pending', // Setting to 'Pending' triggers cashier notification
                    payment_method: 'Tunai', // Default
                    date: new Date().toISOString()
                }])
                .select()
                .single();

            if (saleError) throw saleError;

            // 2. Create Sale Items
            const itemsToInsert = cart.map(item => ({
                sale_id: sale.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                price: item.price,
                cost: 0 // Snapshot cost could be fetched if needed
            }));

            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            // 3. Mark Table as Occupied (Optional but consistent with system)
            await supabase
                .from('tables')
                .update({ status: 'Occupied' })
                .eq('number', selectedTable);

            setLastOrderNo(orderNo);
            setCurrentSaleId(sale.id);
            clearCart();
            setShowCartModal(false);

            // 4. Navigate back to Main (Table Selection)
            // Web app will auto-detect new order via realtime listener
            // @ts-ignore
            navigation.navigate('Main');
        } catch (error: any) {
            console.error('Checkout Error:', error);
            Alert.alert('Error', 'Gagal memproses pesanan: ' + error.message);
        }
    };



    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
            <View style={styles.flex1}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
                        <Text style={styles.backButtonText}>🔙</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitleText}>Winny Pangeran Natakusuma</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                {/* Info Bar (Meja, Pelanggan, Pelayan) */}
                <View style={styles.headerInfoBar}>
                    <TouchableOpacity style={styles.infoBarItem} onPress={() => setShowTableModal(true)}>
                        <Text style={styles.infoBarLabel}>Meja</Text>
                        <Text style={styles.infoBarValue}>{selectedTable || '-'}</Text>
                    </TouchableOpacity>
                    <View style={styles.infoBarDivider} />
                    <TouchableOpacity style={styles.infoBarItem} onPress={() => setShowMemberLoginModal(true)}>
                        <Text style={styles.infoBarLabel}>Pelanggan</Text>
                        <Text style={styles.infoBarValue} numberOfLines={1}>{customerName}</Text>
                    </TouchableOpacity>
                    <View style={styles.infoBarDivider} />
                    <TouchableOpacity style={styles.infoBarItem} onPress={() => setShowWaiterModal(true)}>
                        <Text style={styles.infoBarLabel}>Pelayan</Text>
                        <Text style={styles.infoBarValue} numberOfLines={1}>{selectedWaiter || '-'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={[styles.searchInput, isTablet && { width: 400, alignSelf: 'center' }]}
                        placeholder="Cari produk..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>




                {/* Main Content Area (Responsive Tablet Layout) */}
                <View style={[styles.flex1, isLargeTablet && isLandscape && { flexDirection: 'row' }]}>
                    {/* Category Tabs / Sidebar */}
                    <View style={[
                        styles.categoryContainer,
                        isLargeTablet && isLandscape && { width: 250, borderRightWidth: 1, borderRightColor: '#f3f4f6', borderBottomWidth: 0 }
                    ]}>
                        <ScrollView
                            horizontal={!(isLargeTablet && isLandscape)}
                            showsHorizontalScrollIndicator={false}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[
                                styles.categoryScroll,
                                isLargeTablet && isLandscape && { flexDirection: 'column', paddingVertical: 16 }
                            ]}
                        >
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryTab,
                                        selectedCategory === cat && styles.activeCategoryTab,
                                        isLargeTablet && isLandscape && { marginBottom: 10, marginHorizontal: 0, borderRadius: 12 }
                                    ]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Text style={[styles.categoryText, selectedCategory === cat && styles.activeCategoryText]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Product Grid */}
                    {loadingProducts ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#ea580c" />
                            <Text style={styles.loadingText}>Memuat produk...</Text>
                        </View>
                    ) : filteredProducts.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📦</Text>
                            <Text style={styles.emptyTitle}>Belum ada produk</Text>
                            <Text style={styles.emptySubtitle}>
                                {searchQuery ? 'Tidak ada produk yang cocok dengan pencarian' : 'Silakan tambahkan produk melalui aplikasi web'}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            key={isTablet ? (isLandscape ? 'landscape-grid' : 'portrait-grid') : 'mobile-grid'}
                            data={filteredProducts}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={isLargeTablet ? (isLandscape ? 6 : 4) : (isTablet ? 4 : 3)}
                            contentContainerStyle={[styles.productListContent, isLargeTablet && isLandscape && { padding: 16 }]}
                            keyboardShouldPersistTaps="handled"
                            style={styles.flex1}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.productCard,
                                        {
                                            flex: 1,
                                            margin: isTablet ? 10 : 6,
                                            height: isLargeTablet ? 220 : 180
                                        }
                                    ]}
                                    activeOpacity={0.7}
                                    onPress={() => addToCart(item)}
                                >
                                    <View
                                        style={[styles.productImageContainer, { backgroundColor: '#fff7ed' }]}
                                    >
                                        <Text style={styles.productAcronym}>
                                            {getAcronym(item.name)}
                                        </Text>
                                    </View>
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productNameText} numberOfLines={2}>{item.name}</Text>
                                        <Text style={styles.productPriceText}>{formatCurrency(item.price)}</Text>
                                        <View style={styles.productFooter}>
                                            <Text style={styles.productStockText}>Stok: {item.stock || '-'}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>







                {/* Success Modal */}
                <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { maxWidth: 400, alignItems: 'center', padding: 30 }]}>
                            <View style={styles.successIconCircle}>
                                <Text style={styles.successIconText}>✓</Text>
                            </View>
                            <Text style={styles.successTitleText}>Pesanan Berhasil!</Text>
                            <Text style={styles.successSubtitleText}>Pesanan sedang diproses oleh kasir</Text>

                            <View style={styles.orderNumberBadge}>
                                <Text style={styles.orderNumberLabel}>NOMOR INVOICE</Text>
                                <Text style={styles.orderNumberValue}>{lastOrderNo}</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton, { width: '100%', marginTop: 10 }]}
                                onPress={() => setShowSuccessModal(false)}
                            >
                                <Text style={styles.modalButtonText}>Kembali ke Menu</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
                {/* Member Login Modal */}
                <Modal visible={showMemberLoginModal} transparent animationType="fade" onRequestClose={skipMemberLogin}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { maxWidth: 500, width: '90%' }]}>
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                    <Text style={{ fontSize: 20 }}>👤</Text>
                                </View>
                                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1f2937' }}>Member Login</Text>
                                <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 4 }}>Dapatkan poin & diskon khusus member!</Text>
                            </View>

                            <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 20 }}>
                                {/* Left: QR Scan Placeholder */}
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        aspectRatio: 1,
                                        backgroundColor: '#1f2937',
                                        borderRadius: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 150
                                    }}
                                    onPress={() => Alert.alert('Info', 'Fitur Scan QR akan segera hadir!')}
                                >
                                    <View style={{ width: 40, height: 40, borderBlockColor: 'white', borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
                                        <Text style={{ color: 'white', fontSize: 20 }}>📷</Text>
                                    </View>
                                    <Text style={{ color: 'white', fontWeight: 'bold', marginTop: 10 }}>Scan QR Member</Text>
                                </TouchableOpacity>

                                {/* Right: Phone Input */}
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4b5563', marginBottom: 6 }}>Input Nomor HP</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12 }}>
                                            <Text style={{ color: '#9ca3af', marginRight: 8 }}>📞</Text>
                                            <TextInput
                                                style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: '#111827' }}
                                                placeholder="08xxx"
                                                keyboardType="phone-pad"
                                                value={memberPhone}
                                                onChangeText={setMemberPhone}
                                                onSubmitEditing={checkMember}
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: '#ea580c' }]}
                                        onPress={checkMember}
                                    >
                                        <Text style={styles.confirmButtonText}>Cek Member</Text>
                                    </TouchableOpacity>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 }}>
                                        <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
                                        <Text style={{ fontSize: 10, color: '#9ca3af' }}>ATAU</Text>
                                        <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
                                    </View>

                                    <TouchableOpacity onPress={skipMemberLogin} style={{ alignSelf: 'center' }}>
                                        <Text style={{ color: '#6b7280', fontSize: 12 }}>Lewati, Lanjut sebagai Tamu &rsaquo;</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Table Selection Modal */}
                <Modal visible={showTableModal} transparent animationType="fade" onRequestClose={() => setShowTableModal(false)}>
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowTableModal(false)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.modalContent}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Text style={styles.modalTitle}>Pilih Meja</Text>
                            <ScrollView style={{ maxHeight: 300 }}>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {tables.map((table) => (
                                        <TouchableOpacity
                                            key={table.id}
                                            style={[
                                                styles.tableOptionItem,
                                                selectedTable === table.number && styles.selectedTableOption,
                                                table.status === 'Occupied' && styles.occupiedTableOption
                                            ]}
                                            onPress={() => {
                                                setSelectedTable(table.number);
                                                setShowTableModal(false);
                                                // Delay to allow table modal to close completely
                                                setTimeout(() => {
                                                    setShowMemberLoginModal(true);
                                                }, 600);
                                            }}
                                        >
                                            <Text style={[styles.tableOptionText, selectedTable === table.number && styles.selectedTableText]}>
                                                {table.number}
                                            </Text>
                                            <Text style={{ fontSize: 10, color: '#6b7280' }}>
                                                {table.capacity} Org
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {tables.length === 0 && <Text style={{ textAlign: 'center', color: '#6b7280' }}>Tidak ada data meja</Text>}
                            </ScrollView>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]} onPress={() => setShowTableModal(false)}>
                                <Text style={styles.cancelButtonText}>Tutup</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>



                {/* Customer Selection Modal */}
                <Modal visible={showCustomerModal} transparent animationType="fade" onRequestClose={() => setShowCustomerModal(false)}>
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowCustomerModal(false)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.modalContent}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Text style={styles.modalTitle}>Pilih Pelanggan</Text>
                            {/* Simple Search for Customer could be added here later */}
                            <ScrollView style={{ maxHeight: 300 }}>
                                {customers.map((cust) => (
                                    <TouchableOpacity
                                        key={cust.id}
                                        style={styles.modalOptionItem}
                                        onPress={() => {
                                            setCustomerName(cust.name);
                                            setSelectedCustomerId(cust.id);
                                            setShowCustomerModal(false);
                                        }}
                                    >
                                        <Text style={styles.modalOptionText}>{cust.name} ({cust.phone || '-'})</Text>
                                    </TouchableOpacity>
                                ))}
                                {customers.length === 0 && <Text style={{ textAlign: 'center', color: '#6b7280' }}>Tidak ada data pelanggan</Text>}
                            </ScrollView>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]} onPress={() => setShowCustomerModal(false)}>
                                <Text style={styles.cancelButtonText}>Tutup</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>

                {/* Waiter Selection Modal */}
                <Modal visible={showWaiterModal} transparent animationType="fade" onRequestClose={() => setShowWaiterModal(false)}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowWaiterModal(false)}>
                        <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                            <Text style={styles.modalTitle}>Pilih Pelayan</Text>
                            <ScrollView style={{ maxHeight: 300 }}>
                                {waiters.map((waiter) => (
                                    <TouchableOpacity
                                        key={waiter.id}
                                        style={styles.modalOptionItem}
                                        onPress={() => {
                                            setSelectedWaiter(waiter.name);
                                            setShowWaiterModal(false);
                                        }}
                                    >
                                        <Text style={styles.modalOptionText}>{waiter.name}</Text>
                                    </TouchableOpacity>
                                ))}
                                {waiters.length === 0 && <Text style={{ textAlign: 'center', color: '#6b7280' }}>Tidak ada data pelayan</Text>}
                            </ScrollView>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]} onPress={() => setShowWaiterModal(false)}>
                                <Text style={styles.cancelButtonText}>Tutup</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>

                {/* Cart Summary Bar (Automatic Appearance) */}
                {cart.length > 0 && (
                    <View style={styles.cartSummaryBar}>
                        <View style={styles.cartSummaryInfo}>
                            <View style={styles.cartCountBadge}>
                                <Text style={styles.cartCountText}>{cart.reduce((a, b) => a + b.quantity, 0)}</Text>
                            </View>
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.cartTotalLabel}>Total Pesanan</Text>
                                <Text style={styles.cartTotalValue}>{formatCurrency(calculateTotal())}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.checkoutButton} onPress={() => setShowCartModal(true)}>
                            <Text style={styles.checkoutButtonText}>Lihat Keranjang &rsaquo;</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Cart Modal */}
                <Modal visible={showCartModal} transparent animationType="slide" onRequestClose={() => setShowCartModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Keranjang Pesanan</Text>
                                <TouchableOpacity onPress={() => setShowCartModal(false)}>
                                    <Text style={{ fontSize: 24, color: '#6b7280' }}>&times;</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.cartItemList}>
                                {cart.map((item) => (
                                    <View key={item.id} style={styles.cartItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cartItemName}>{item.name}</Text>
                                            <Text style={styles.cartItemPrice}>{formatCurrency(item.price)}</Text>
                                        </View>
                                        <View style={styles.quantityControls}>
                                            <TouchableOpacity style={styles.qtyButton} onPress={() => removeFromCart(item.id)}>
                                                <Text style={styles.qtyButtonText}>-</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.qtyText}>{item.quantity}</Text>
                                            <TouchableOpacity style={styles.qtyButton} onPress={() => addToCart(item)}>
                                                <Text style={styles.qtyButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={styles.cartFooter}>
                                <View style={styles.cartTotalRow}>
                                    <Text style={styles.cartTotalLabelLarge}>Total Pembayaran</Text>
                                    <Text style={styles.cartTotalValueLarge}>{formatCurrency(calculateTotal())}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { flex: 1 }]} onPress={clearCart}>
                                        <Text style={styles.cancelButtonText}>Kosongkan</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalButton, styles.confirmButton, { flex: 2 }]} onPress={() => { setShowCartModal(false); handleCheckout(); }}>
                                        <Text style={styles.confirmButtonText}>Konfirmasi Pesanan</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>

            </View>
        </SafeAreaView >

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    flex1: {
        flex: 1,
    },
    tabletMainRow: {
        flexDirection: 'row',
        flex: 1,
    },
    header: {
        backgroundColor: 'white',
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 10,
    },
    headerBackButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerInfoBar: {
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        alignItems: 'center',
    },
    infoBarItem: {
        flex: 1,
        alignItems: 'center',
    },
    infoBarLabel: {
        fontSize: 10,
        color: '#6b7280',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    infoBarValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginTop: 2,
    },
    infoBarDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#f3f4f6',
    },
    backButtonText: {
        fontSize: 22,
    },
    searchContainer: {
        padding: 12,
        backgroundColor: 'white',
    },
    searchInput: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        color: '#111827',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    categoryContainer: {
        backgroundColor: 'white',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    categoryScroll: {
        paddingHorizontal: 12,
        gap: 8,
    },
    categoryTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    activeCategoryTab: {
        backgroundColor: '#ea580c',
        borderColor: '#ea580c',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
    },
    activeCategoryText: {
        color: 'white',
    },
    productListContent: {
        padding: 8,
        paddingBottom: 200, // Extra space for cart bar
    },
    productCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    productImageContainer: {
        width: '100%',
        height: '50%',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    productAcronym: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0284c7',
    },
    productInfo: {
        padding: 10,
        flex: 1,
        justifyContent: 'space-between',
    },
    productNameText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1f2937',
        lineHeight: 18,
    },
    productPriceText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ea580c',
        marginTop: 4,
    },
    productFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    productStockText: {
        fontSize: 10,
        color: '#6b7280',
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
    },
    // Modals & Options
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1f2937',
    },
    modalButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4b5563',
    },
    modalOptionItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalOptionText: {
        fontSize: 16,
        color: '#111827',
    },
    tableOptionItem: {
        width: '30%',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
        marginBottom: 8,
    },
    selectedTableOption: {
        backgroundColor: '#ebf5ff',
        borderColor: '#2563eb',
    },
    occupiedTableOption: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
        opacity: 0.7,
    },
    tableOptionText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    selectedTableText: {
        color: '#2563eb',
    },
    modalInput: {
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        color: '#111827',
        fontSize: 16,
    },
    confirmButton: {
        backgroundColor: '#2563eb',
    },
    // New Cart Styles
    cartSummaryBar: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        backgroundColor: '#111827',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    cartSummaryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cartCountBadge: {
        backgroundColor: '#ea580c',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartCountText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cartTotalLabel: {
        color: '#9ca3af',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    cartTotalValue: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    checkoutButton: {
        backgroundColor: '#ea580c',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 14,
    },
    checkoutButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // Detailed Cart Modal Styles
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    cartItemList: {
        marginBottom: 20,
    },
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    cartItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    cartItemPrice: {
        fontSize: 14,
        color: '#ea580c',
        fontWeight: 'bold',
        marginTop: 2,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 4,
    },
    qtyButton: {
        width: 32,
        height: 32,
        backgroundColor: 'white',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    qtyButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    qtyText: {
        paddingHorizontal: 12,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    cartFooter: {
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 20,
    },
    cartTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cartTotalLabelLarge: {
        fontSize: 14,
        color: '#4b5563',
        fontWeight: '600',
    },
    cartTotalValueLarge: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    // Modern Success Modal Styles
    successIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    successIconText: {
        fontSize: 40,
        color: '#22c55e',
        fontWeight: 'bold',
    },
    successTitleText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
    },
    successSubtitleText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    orderNumberBadge: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 30,
        width: '100%',
    },
    orderNumberLabel: {
        fontSize: 10,
        color: '#9ca3af',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    orderNumberValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 4,
    },
});
