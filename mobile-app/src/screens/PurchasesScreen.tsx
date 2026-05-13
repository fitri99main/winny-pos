import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var ScrollView = RN.ScrollView;
var StyleSheet = RN.StyleSheet;
var TextInput = RN.TextInput;
var ActivityIndicator = RN.ActivityIndicator;
var FlatList = RN.FlatList;
var Modal = RN.Modal;
var Alert = RN.Alert;
var useWindowDimensions = RN.useWindowDimensions;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import * as Lucide from 'lucide-react-native';
var ArrowLeft = Lucide.ArrowLeft;
var Plus = Lucide.Plus;
var History = Lucide.History;
var Search = Lucide.Search;
var Trash2 = Lucide.Trash2;
var Package = Lucide.Package;
var User = Lucide.User;
var Edit = Lucide.Edit;
import ModernToast from '../components/ModernToast';
import * as PettyCashLib from '../lib/PettyCashService';
var PettyCashService = PettyCashLib.PettyCashService;
var getPettyCashErrorMessage = PettyCashLib.getPettyCashErrorMessage;
var isPettyCashSchemaMissingError = PettyCashLib.isPettyCashSchemaMissingError;
import * as DateLib from '../lib/dateUtils';
var getLocalDateString = DateLib.getLocalDateString;

export default function PurchasesScreen() {
    var navigation = useNavigation();
    var session = useSession();
    var currentBranchId = session.currentBranchId;
    
    var stateActiveTab = React.useState('history');
    var activeTab = stateActiveTab[0];
    var setActiveTab = stateActiveTab[1];

    var stateLoading = React.useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];
    
    var statePurchases = React.useState([]);
    var purchases = statePurchases[0];
    var setPurchases = statePurchases[1];

    var stateSupplier = React.useState('');
    var supplier = stateSupplier[0];
    var setSupplier = stateSupplier[1];

    var statePurchaseItems = React.useState([]);
    var purchaseItems = statePurchaseItems[0];
    var setPurchaseItems = statePurchaseItems[1];

    var statePaymentMethod = React.useState('Tunai');
    var paymentMethod = statePaymentMethod[0];
    var setPaymentMethod = statePaymentMethod[1];

    var paymentMethods = ['Tunai', 'Transfer', 'Kas Kecil', 'Hutang'];
    
    var stateContacts = React.useState([]);
    var contacts = stateContacts[0];
    var setContacts = stateContacts[1];

    var stateMasterItems = React.useState([]);
    var masterItems = stateMasterItems[0];
    var setMasterItems = stateMasterItems[1];

    var stateShowSearchModal = React.useState(false);
    var showSearchModal = stateShowSearchModal[0];
    var setShowSearchModal = stateShowSearchModal[1];

    var stateItemSearch = React.useState('');
    var itemSearch = stateItemSearch[0];
    var setItemSearch = stateItemSearch[1];
    
    var stateIsManualSupplier = React.useState(false);
    var isManualSupplier = stateIsManualSupplier[0];
    var setIsManualSupplier = stateIsManualSupplier[1];

    var stateManualSupplierName = React.useState('');
    var manualSupplierName = stateManualSupplierName[0];
    var setManualSupplierName = stateManualSupplierName[1];

    var stateShowManualItemModal = React.useState(false);
    var showManualItemModal = stateShowManualItemModal[0];
    var setShowManualItemModal = stateShowManualItemModal[1];

    var stateManualItemForm = React.useState({ name: '', price: '' });
    var manualItemForm = stateManualItemForm[0];
    var setManualItemForm = stateManualItemForm[1];

    var stateIsEditing = React.useState(false);
    var isEditing = stateIsEditing[0];
    var setIsEditing = stateIsEditing[1];

    var stateEditingId = React.useState(null);
    var editingId = stateEditingId[0];
    var setEditingId = stateEditingId[1];

    var statePurchaseNo = React.useState('');
    var purchaseNo = statePurchaseNo[0];
    var setPurchaseNo = statePurchaseNo[1];

    var stateToast = React.useState({ visible: false, message: '', type: 'success' });
    var toast = stateToast[0];
    var setToast = stateToast[1];

    var showToast = function(message, type) {
        if (!type) type = 'success';
        setToast({ visible: true, message: message, type: type });
        setTimeout(function() { setToast(function(prev) { return Object.assign({}, prev, { visible: false }); }); }, 3000);
    };

    var fetchData = function() {
        setLoading(true);
        var pResPromise = supabase
            .from('purchases')
            .select('*')
            .eq('branch_id', currentBranchId)
            .order('date', { ascending: false });
        
        var cResPromise = supabase
            .from('contacts')
            .select('*')
            .eq('type', 'Supplier');

        var ingResPromise = supabase.from('ingredients').select('id, name, code, cost_per_unit, unit').eq('branch_id', currentBranchId);
        var prodResPromise = supabase.from('products').select('id, name, code, price').eq('branch_id', currentBranchId);

        return Promise.all([pResPromise, cResPromise, ingResPromise, prodResPromise]).then(function(results) {
            var pRes = results[0];
            var cRes = results[1];
            var ingRes = results[2];
            var prodRes = results[3];

            if (pRes.data) setPurchases(pRes.data);
            if (cRes.data) setContacts(cRes.data);

            var mergedItems = [];
            var ingredients = ingRes.data || [];
            var products = prodRes.data || [];
            
            for (var i = 0; i < ingredients.length; i++) {
                mergedItems.push(Object.assign({}, ingredients[i], { type: 'Ingredient', cost: ingredients[i].cost_per_unit }));
            }
            for (var j = 0; j < products.length; j++) {
                mergedItems.push(Object.assign({}, products[j], { type: 'Product', cost: products[j].price }));
            }
            setMasterItems(mergedItems);
        })['catch'](function(err) {
            console.error('Fetch error:', err);
        }).finally(function() {
            setLoading(false);
        });
    };

    React.useEffect(function() {
        fetchData();
    }, []);

    var handleSavePurchase = function() {
        var finalSupplier = isManualSupplier ? manualSupplierName : supplier;
        
        if (!finalSupplier) {
            showToast('Pilih atau input supplier terlebih dahulu', 'error');
            return;
        }
        if (purchaseItems.length === 0) {
            showToast('Tambahkan item pembelian', 'error');
            return;
        }

        setLoading(true);
        var totalAmount = 0;
        var totalQty = 0;
        for (var k = 0; k < purchaseItems.length; k++) {
            totalAmount += (Number(purchaseItems[k].price || 0) * Number(purchaseItems[k].quantity || 0));
            totalQty += (Number(purchaseItems[k].quantity || 0));
        }

        var finalPO = purchaseNo || 'PO-MOB-' + Date.now().toString().slice(-6);

        var payload = {
            purchase_no: finalPO,
            supplier_name: finalSupplier,
            date: getLocalDateString(),
            items_count: totalQty,
            total_amount: totalAmount,
            status: isEditing ? 'Completed' : 'Pending',
            payment_method: paymentMethod,
            branch_id: currentBranchId,
            items_list: purchaseItems
        };

        var queryPromise;
        if (isEditing && editingId) {
            queryPromise = supabase.from('purchases').update(payload).eq('id', editingId);
        } else {
            queryPromise = supabase.from('purchases').insert([payload]);
        }

        return queryPromise.then(function(res) {
            if (res.error) throw res.error;
            showToast(isEditing ? 'Pembelian diupdate' : 'Pembelian disimpan');

            if (paymentMethod === 'Kas Kecil') {
                return PettyCashService.getActiveSession(currentBranchId).then(function(activeSession) {
                    if (activeSession) {
                        return PettyCashService.addTransaction({
                            session_id: activeSession.id,
                            type: 'SPEND',
                            amount: totalAmount,
                            description: 'Pembelian: ' + finalPO,
                            reference_type: 'purchase',
                            reference_id: finalPO
                        }).then(function() {
                            showToast('Saldo Kas Kecil terpotong');
                        });
                    }
                })['catch'](function(pcErr) {
                    console.error('Petty Cash Sync Error:', pcErr);
                });
            }
        }).then(function() {
            setPurchaseItems([]);
            setSupplier('');
            setManualSupplierName('');
            setIsManualSupplier(false);
            setIsEditing(false);
            setEditingId(null);
            setPurchaseNo('');
            setPaymentMethod('Tunai');
            setActiveTab('history');
            return fetchData();
        })['catch'](function(err) {
            console.error('Save error:', err);
            showToast('Gagal menyimpan pembelian', 'error');
        }).finally(function() {
            setLoading(false);
        });
    };

    var formatCurrency = function(val) {
        if (!val) val = 0;
        return 'Rp ' + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var filteredMasterItems = React.useMemo(function() {
        if (!itemSearch) return masterItems.slice(0, 50);
        var searchLower = itemSearch.toLowerCase();
        var filtered = [];
        for (var l = 0; l < masterItems.length; l++) {
            var item = masterItems[l];
            if ((item.name || '').toLowerCase().indexOf(searchLower) !== -1 || (item.code && (item.code || '').toLowerCase().indexOf(searchLower) !== -1)) {
                filtered.push(item);
            }
        }
        return filtered;
    }, [masterItems, itemSearch]);

    var stats = React.useMemo(function() {
        var nowStr = new Date().toISOString().slice(0, 7);
        var totalMonth = 0;
        var countMonth = 0;
        var overall = 0;
        for (var m = 0; m < purchases.length; m++) {
            var p = purchases[m];
            overall += (p.total_amount || 0);
            if (p.date && p.date.indexOf(nowStr) !== -1) {
                totalMonth += (p.total_amount || 0);
                countMonth++;
            }
        }
        return {
            totalThisMonth: totalMonth,
            countThisMonth: countMonth,
            overallTotal: overall
        };
    }, [purchases]);

    var handleAddItem = function(item) {
        var existingIdx = -1;
        for (var n = 0; n < purchaseItems.length; n++) {
            if (purchaseItems[n].name === item.name) {
                existingIdx = n;
                break;
            }
        }
        if (existingIdx >= 0) {
            var newItems = purchaseItems.slice();
            newItems[existingIdx] = Object.assign({}, newItems[existingIdx], { quantity: newItems[existingIdx].quantity + 1 });
            setPurchaseItems(newItems);
        } else {
            setPurchaseItems(purchaseItems.concat([{ name: item.name, price: item.cost || 0, quantity: 1, type: item.type }]));
        }
        showToast('Menambahkan ' + item.name);
    };

    var handleEditPurchase = function(item) {
        setIsEditing(true);
        setEditingId(item.id);
        setPurchaseNo(item.purchase_no);
        
        var isKnown = false;
        for (var o = 0; o < contacts.length; o++) {
            if (contacts[o].name === item.supplier_name) {
                isKnown = true;
                break;
            }
        }
        if (isKnown) {
            setSupplier(item.supplier_name);
            setIsManualSupplier(false);
        } else {
            setManualSupplierName(item.supplier_name);
            setIsManualSupplier(true);
        }

        setPurchaseItems(item.items_list || []);
        setPaymentMethod(item.payment_method || 'Tunai');
        setActiveTab('input');
    };

    var handleDeletePurchase = function(id, no) {
        Alert.alert(
            'Konfirmasi Hapus',
            'Apakah Anda yakin ingin menghapus PO ' + no + '?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: function() {
                        setLoading(true);
                        return supabase.from('purchases').delete().eq('id', id).then(function(res) {
                            if (res.error) throw res.error;
                            showToast('Pembelian dihapus');
                            return fetchData();
                        })['catch'](function(err) {
                            showToast('Gagal menghapus', 'error');
                        }).finally(function() {
                            setLoading(false);
                        });
                    }
                }
            ]
        );
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(ArrowLeft, { color: "#1e293b", size: 24 })
            ),
            React.createElement(Text, { style: styles.headerTitle }, "Pembelian (Keluar Uang)")
        ),

        React.createElement(View, { style: styles.tabContainer },
            React.createElement(TouchableOpacity, { 
                style: [styles.tab, activeTab === 'history' && styles.activeTab], 
                onPress: function() { setActiveTab('history'); }
            },
                React.createElement(History, { size: 18, color: activeTab === 'history' ? '#ea580c' : '#64748b' }),
                React.createElement(Text, { style: [styles.tabText, activeTab === 'history' && styles.activeTabText] }, "Riwayat")
            ),
            React.createElement(TouchableOpacity, { 
                style: [styles.tab, activeTab === 'input' && styles.activeTab], 
                onPress: function() { setActiveTab('input'); }
            },
                React.createElement(Plus, { size: 18, color: activeTab === 'input' ? '#ea580c' : '#64748b' }),
                React.createElement(Text, { style: [styles.tabText, activeTab === 'input' && styles.activeTabText] }, "Input Baru")
            )
        ),

        loading ? React.createElement(View, { style: styles.center },
            React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })
        ) : (activeTab === 'history' ? React.createElement(FlatList, {
            data: purchases,
            keyExtractor: function(item, index) { return (item.id || index).toString(); },
            contentContainerStyle: styles.listContainer,
            ListHeaderComponent: React.createElement(View, { style: styles.statsContainer },
                React.createElement(View, { style: styles.statBox },
                    React.createElement(Text, { style: styles.statLabel }, "Total Belanja (Bulan Ini)"),
                    React.createElement(Text, { style: styles.statValue }, formatCurrency(stats.totalThisMonth)),
                    React.createElement(Text, { style: styles.statSub }, stats.countThisMonth + " Transaksi")
                ),
                React.createElement(View, { style: styles.indicatorRow },
                    React.createElement(View, { style: styles.indicator },
                        React.createElement(Text, { style: styles.indicatorLabel }, "Total Keseluruhan"),
                        React.createElement(Text, { style: styles.indicatorValue }, formatCurrency(stats.overallTotal))
                    )
                ),
                React.createElement(Text, { style: styles.sectionTitle }, "Riwayat Transaksi")
            ),
            renderItem: function(data) {
                var item = data.item;
                return React.createElement(View, { style: styles.purchaseCard },
                    React.createElement(View, { style: styles.cardHeader },
                        React.createElement(Text, { style: styles.poNumber }, item.purchase_no),
                        React.createElement(View, { style: [styles.statusBadge, item.status === 'Completed' ? styles.statusSuccess : styles.statusPending] },
                            React.createElement(Text, { style: styles.statusText }, item.status)
                        )
                    ),
                    React.createElement(Text, { style: styles.supplierText }, item.supplier_name),
                    React.createElement(View, { style: styles.cardFooter },
                        React.createElement(View, null,
                            React.createElement(Text, { style: styles.dateText }, item.date),
                            React.createElement(Text, { style: styles.amountText }, formatCurrency(item.total_amount))
                        ),
                        React.createElement(View, { style: styles.actionRow },
                            React.createElement(TouchableOpacity, { onPress: function() { handleEditPurchase(item); }, style: [styles.actionBtn, { backgroundColor: '#eff6ff' }] },
                                React.createElement(Edit, { size: 16, color: "#2563eb" })
                            ),
                            React.createElement(TouchableOpacity, { onPress: function() { handleDeletePurchase(item.id, item.purchase_no); }, style: [styles.actionBtn, { backgroundColor: '#fef2f2' }] },
                                React.createElement(Trash2, { size: 16, color: "#dc2626" })
                            )
                        )
                    )
                );
            },
            ListEmptyComponent: React.createElement(Text, { style: styles.emptyText }, "Belum ada riwayat pembelian")
        }) : React.createElement(View, { style: { flex: 1 } },
            isEditing ? React.createElement(View, { style: styles.editingBanner },
                React.createElement(Text, { style: styles.editingBannerText }, "Sedang mengedit PO: " + purchaseNo),
                React.createElement(TouchableOpacity, { onPress: function() {
                    setIsEditing(false); setEditingId(null); setPurchaseNo(''); setPurchaseItems([]); setSupplier(''); setManualSupplierName('');
                } }, React.createElement(Text, { style: styles.cancelEditText }, "Batal"))
            ) : null,
            React.createElement(ScrollView, { contentContainerStyle: styles.scrollContent },
                React.createElement(View, { style: styles.formGroup },
                    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
                        React.createElement(Text, { style: styles.label }, "Pilih Supplier"),
                        React.createElement(TouchableOpacity, { onPress: function() { setIsManualSupplier(!isManualSupplier); } },
                            React.createElement(Text, { style: { fontSize: 12, color: '#ea580c', fontWeight: 'bold' } }, isManualSupplier ? 'Pilih dari Daftar' : 'Input Manual')
                        )
                    ),
                    isManualSupplier ? React.createElement(TextInput, {
                        style: styles.manualInput,
                        placeholder: "Ketik nama supplier manual...",
                        value: manualSupplierName,
                        onChangeText: setManualSupplierName
                    }) : React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: styles.supplierScroll },
                        contacts.map(function(c, idx) {
                            return React.createElement(TouchableOpacity, {
                                key: 'contact-' + (c.id || idx),
                                style: [styles.supplierTag, supplier === c.name && styles.activeSupplierTag],
                                onPress: function() { setSupplier(c.name); }
                            },
                                React.createElement(User, { size: 14, color: supplier === c.name ? 'white' : '#64748b' }),
                                React.createElement(Text, { style: [styles.supplierTagText, supplier === c.name && styles.activeSupplierTagText] }, c.name)
                            );
                        })
                    )
                ),
                React.createElement(View, { style: styles.formGroup },
                    React.createElement(Text, { style: styles.label }, "Metode Pembayaran"),
                    React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: styles.supplierScroll },
                        paymentMethods.map(function(m) {
                            return React.createElement(TouchableOpacity, {
                                key: 'pay-method-' + m,
                                style: [styles.paymentMethodTag, paymentMethod === m && styles.activePaymentTag],
                                onPress: function() { setPaymentMethod(m); }
                            }, React.createElement(Text, { style: [styles.paymentTagText, paymentMethod === m && styles.activePaymentTagText] }, m));
                        })
                    )
                ),
                React.createElement(View, { style: styles.formGroup },
                    React.createElement(Text, { style: styles.label }, "Daftar Item"),
                    purchaseItems.map(function(item, idx) {
                        return React.createElement(View, { key: 'purch-item-' + idx, style: styles.itemRow },
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.itemName }, item.name),
                                React.createElement(Text, { style: styles.itemSub }, formatCurrency(item.price))
                            ),
                            React.createElement(View, { style: styles.qtyContainer },
                                React.createElement(TouchableOpacity, { onPress: function() {
                                    var nextItems = purchaseItems.slice();
                                    if (nextItems[idx].quantity > 1) {
                                        nextItems[idx] = Object.assign({}, nextItems[idx], { quantity: nextItems[idx].quantity - 1 });
                                        setPurchaseItems(nextItems);
                                    } else {
                                        setPurchaseItems(purchaseItems.filter(function(_, i) { return i !== idx; }));
                                    }
                                }, style: styles.qtyBtn }, React.createElement(Text, null, "-")),
                                React.createElement(Text, { style: styles.qtyValue }, item.quantity),
                                React.createElement(TouchableOpacity, { onPress: function() {
                                    var nextItemsPlus = purchaseItems.slice();
                                    nextItemsPlus[idx] = Object.assign({}, nextItemsPlus[idx], { quantity: nextItemsPlus[idx].quantity + 1 });
                                    setPurchaseItems(nextItemsPlus);
                                }, style: styles.qtyBtn }, React.createElement(Text, null, "+"))
                            )
                        );
                    }),
                    React.createElement(View, { style: { flexDirection: 'row' } },
                        React.createElement(View, { style: { flex: 1, marginRight: 10 } },
                            React.createElement(TouchableOpacity, { style: styles.addItemBtn, onPress: function() { setShowSearchModal(true); } },
                                React.createElement(Search, { size: 20, color: "#ea580c" }), React.createElement(Text, { style: styles.addItemText }, "Cari Item")
                            )
                        ),
                        React.createElement(View, { style: { flex: 1 } },
                            React.createElement(TouchableOpacity, { style: [styles.addItemBtn, { borderColor: '#2563eb' }], onPress: function() { setShowManualItemModal(true); } },
                                React.createElement(Edit, { size: 20, color: "#2563eb" }), React.createElement(Text, { style: [styles.addItemText, { color: '#2563eb' }] }, "Item Manual")
                            )
                        )
                    )
                ),
                React.createElement(View, { style: styles.formGroup },
                    React.createElement(View, { style: styles.totalSummaryBox },
                        React.createElement(Text, { style: styles.totalSummaryLabel }, "Total Bayar"),
                        React.createElement(Text, { style: styles.totalSummaryValue }, formatCurrency(purchaseItems.reduce(function(sum, i) { return sum + (Number(i.price || 0) * Number(i.quantity || 0)); }, 0)))
                    )
                ),
                React.createElement(View, { style: { flexDirection: 'row', marginTop: 20 } },
                    React.createElement(TouchableOpacity, { style: [styles.saveButton, { flex: 1, backgroundColor: '#f1f5f9', marginTop: 0, marginRight: 10 }], onPress: function() {
                        setPurchaseItems([]); setSupplier(''); setManualSupplierName(''); setIsManualSupplier(false); setIsEditing(false); setEditingId(null); setPurchaseNo(''); setPaymentMethod('Tunai'); setActiveTab('history');
                    } }, React.createElement(Text, { style: { color: '#64748b', fontWeight: 'bold', fontSize: 16 } }, "Batal")),
                    React.createElement(TouchableOpacity, { style: [styles.saveButton, { flex: 2, marginTop: 0 }, isEditing && { backgroundColor: '#2563eb' }], onPress: handleSavePurchase },
                        React.createElement(Text, { style: styles.saveButtonText }, isEditing ? 'Update' : 'Simpan')
                    )
                )
            )
        )),

        React.createElement(ModernToast, { visible: toast.visible, message: toast.message, type: toast.type, onHide: function() { setToast(function(prev) { return Object.assign({}, prev, { visible: false }); }); } }),

        React.createElement(Modal, { visible: showSearchModal, animationType: "slide", transparent: true, onRequestClose: function() { setShowSearchModal(false); } },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(View, { style: styles.modalHeader },
                        React.createElement(Text, { style: styles.modalTitle }, "Pencarian Item"),
                        React.createElement(TouchableOpacity, { onPress: function() { setShowSearchModal(false); }, style: styles.closeBtn }, React.createElement(Text, { style: styles.closeBtnText }, "Tutup"))
                    ),
                    React.createElement(View, { style: styles.searchBarContainer },
                        React.createElement(Search, { size: 20, color: "#94a3b8" }),
                        React.createElement(TextInput, { style: styles.searchInput, placeholder: "Cari nama atau kode barang...", value: itemSearch, onChangeText: setItemSearch, autoFocus: true })
                    ),
                    React.createElement(FlatList, {
                        data: filteredMasterItems,
                        keyExtractor: function(item, index) { return (item.id || index).toString(); },
                        renderItem: function(data) {
                            var item = data.item;
                            return React.createElement(TouchableOpacity, { style: styles.searchResultItem, onPress: function() { handleAddItem(item); setShowSearchModal(false); } },
                                React.createElement(View, null, React.createElement(Text, { style: styles.resultName }, item.name), React.createElement(Text, { style: styles.resultSub }, (item.type || 'Item') + " \u2022 " + formatCurrency(item.cost || 0))),
                                React.createElement(Plus, { size: 20, color: "#ea580c" })
                            );
                        }
                    })
                )
            )
        ),

        React.createElement(Modal, { visible: showManualItemModal, animationType: "fade", transparent: true, onRequestClose: function() { setShowManualItemModal(false); } },
            React.createElement(View, { style: [styles.modalOverlay, { justifyContent: 'center', padding: 20 }] },
                React.createElement(View, { style: [styles.modalContent, { height: 'auto', borderRadius: 20 }] },
                    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
                        React.createElement(Text, { style: styles.modalTitle }, "Tambah Item Manual"),
                        React.createElement(TouchableOpacity, { onPress: function() { setShowManualItemModal(false); setManualItemForm({ name: '', price: '' }); } }, React.createElement(Text, { style: { color: '#ef4444', fontWeight: 'bold' } }, "Tutup"))
                    ),
                    React.createElement(View, { style: styles.formGroup },
                        React.createElement(Text, { style: styles.label }, "Nama Item"),
                        React.createElement(TextInput, { style: styles.manualInput, value: manualItemForm.name, onChangeText: function(text) { setManualItemForm(Object.assign({}, manualItemForm, { name: text })); } })
                    ),
                    React.createElement(View, { style: styles.formGroup },
                        React.createElement(Text, { style: styles.label }, "Harga / Biaya Total"),
                        React.createElement(TextInput, { style: styles.manualInput, keyboardType: "numeric", value: manualItemForm.price, onChangeText: function(text) { setManualItemForm(Object.assign({}, manualItemForm, { price: text })); } })
                    ),
                    React.createElement(View, { style: { flexDirection: 'row', marginTop: 15 } },
                        React.createElement(TouchableOpacity, { style: [styles.saveButton, { flex: 1, backgroundColor: '#f1f5f9', marginTop: 0, marginRight: 10 }], onPress: function() { setShowManualItemModal(false); setManualItemForm({ name: '', price: '' }); } }, React.createElement(Text, { style: { color: '#64748b', fontWeight: 'bold' } }, "Batal")),
                        React.createElement(TouchableOpacity, { style: [styles.saveButton, { flex: 2, marginTop: 0 }], onPress: function() {
                            if (!manualItemForm.name || !manualItemForm.price) {
                                showToast('Lengkapi nama dan harga', 'error');
                                return;
                            }
                            handleAddItem({ name: manualItemForm.name, cost: parseFloat(manualItemForm.price) || 0, type: 'Manual' });
                            setShowManualItemModal(false); setManualItemForm({ name: '', price: '' });
                        } }, React.createElement(Text, { style: styles.saveButtonText }, "Tambah Item"))
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white' },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    tabContainer: { flexDirection: 'row', padding: 15 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
    activeTab: { backgroundColor: '#ea580c10', borderColor: '#ea580c' },
    tabText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
    activeTabText: { color: '#ea580c' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { padding: 16 },
    statsContainer: { marginBottom: 20 },
    statBox: { backgroundColor: '#fff7ed', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#ffedd5', marginBottom: 12 },
    statLabel: { fontSize: 12, fontWeight: '700', color: '#9a3412', textTransform: 'uppercase', letterSpacing: 0.5 },
    statValue: { fontSize: 28, fontWeight: '800', color: '#ea580c', marginVertical: 4 },
    statSub: { fontSize: 12, color: '#c2410c', fontWeight: '600' },
    indicatorRow: { flexDirection: 'row', marginBottom: 20 },
    indicator: { flex: 1, backgroundColor: '#f8fafc', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#f1f5f9', marginRight: 10 },
    indicatorLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    indicatorValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
    purchaseCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    poNumber: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusPending: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
    statusSuccess: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bcf0da' },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    supplierText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
    dateText: { fontSize: 12, color: '#64748b' },
    amountText: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 2 },
    actionRow: { flexDirection: 'row' },
    actionBtn: { padding: 8, borderRadius: 10, marginLeft: 10 },
    editingBanner: { backgroundColor: '#dbeafe', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, marginTop: 10 },
    editingBannerText: { color: '#1e40af', fontSize: 13, fontWeight: '700' },
    cancelEditText: { color: '#2563eb', fontWeight: '800', fontSize: 13 },
    scrollContent: { padding: 20 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8' },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 },
    supplierScroll: { flexDirection: 'row' },
    supplierTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    activeSupplierTag: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
    supplierTagText: { fontSize: 13, color: '#64748b', marginLeft: 6 },
    activeSupplierTagText: { color: 'white' },
    itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 8 },
    itemName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    itemSub: { fontSize: 12, color: '#94a3b8' },
    qtyContainer: { flexDirection: 'row', alignItems: 'center' },
    qtyBtn: { width: 30, height: 30, backgroundColor: '#f1f5f9', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 },
    qtyValue: { fontWeight: 'bold' },
    addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ea580c', borderRadius: 12, marginTop: 10 },
    addItemText: { color: '#ea580c', fontWeight: 'bold', marginLeft: 8 },
    saveButton: { backgroundColor: '#ea580c', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    manualInput: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 14, color: '#1e293b' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '80%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    closeBtn: { padding: 10 },
    closeBtnText: { color: '#ef4444', fontWeight: 'bold' },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 15, borderRadius: 15, marginBottom: 20 },
    searchInput: { flex: 1, height: 50, fontSize: 16, marginLeft: 10 },
    searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    resultName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    resultSub: { fontSize: 12, color: '#94a3b8' },
    paymentMethodTag: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
    activePaymentTag: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
    paymentTagText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
    activePaymentTagText: { color: '#fff' },
    totalSummaryBox: { backgroundColor: '#1e293b', padding: 20, borderRadius: 15, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalSummaryLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    totalSummaryValue: { color: '#fff', fontSize: 24, fontWeight: '800' }
});
