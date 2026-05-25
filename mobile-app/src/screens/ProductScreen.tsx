import * as React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var TouchableOpacity = RN.TouchableOpacity;
var StyleSheet = RN.StyleSheet;
var FlatList = RN.FlatList;
var TextInput = RN.TextInput;
var ActivityIndicator = RN.ActivityIndicator;
var Modal = RN.Modal;
var Image = RN.Image;
var Alert = RN.Alert;
var ScrollView = RN.ScrollView;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaView = RNSAC.SafeAreaView;
import * as NavNative from '@react-navigation/native';
var useNavigation = NavNative.useNavigation;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import * as ImagePicker from 'expo-image-picker';
import * as ImageStorageLib from '../lib/ImageStorageService';
var ImageStorageService = ImageStorageLib.ImageStorageService;
import * as Lucide from 'lucide-react-native';
var ChevronLeft = Lucide.ChevronLeft;

export default function ProductScreen() {
    var navigation = useNavigation();
    var session = useSession();
    var currentBranchId = session.currentBranchId;
    var canManageProducts = !!session.isAdmin;
    var canSeeHpp = canManageProducts;
    
    var stateProducts = React.useState([]);
    var products = stateProducts[0];
    var setProducts = stateProducts[1];

    var stateFilteredProducts = React.useState([]);
    var filteredProducts = stateFilteredProducts[0];
    var setFilteredProducts = stateFilteredProducts[1];

    var stateSearch = React.useState('');
    var search = stateSearch[0];
    var setSearch = stateSearch[1];

    var stateLoading = React.useState(true);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateModalVisible = React.useState(false);
    var modalVisible = stateModalVisible[0];
    var setModalVisible = stateModalVisible[1];

    var stateEditingProduct = React.useState(null);
    var editingProduct = stateEditingProduct[0];
    var setEditingProduct = stateEditingProduct[1];

    var stateUploading = React.useState(false);
    var uploading = stateUploading[0];
    var setUploading = stateUploading[1];

    var stateCategories = React.useState([] as any[]);
    var categories = stateCategories[0];
    var setCategories = stateCategories[1];

    var stateUnits = React.useState([] as any[]);
    var units = stateUnits[0];
    var setUnits = stateUnits[1];

    var stateBrands = React.useState([] as any[]);
    var brands = stateBrands[0];
    var setBrands = stateBrands[1];

    var stateActiveTab = React.useState('produk');
    var activeTab = stateActiveTab[0];
    var setActiveTab = stateActiveTab[1];

    var stateIngredients = React.useState([] as any[]);
    var ingredients = stateIngredients[0];
    var setIngredients = stateIngredients[1];

    var stateFilteredIngredients = React.useState([] as any[]);
    var filteredIngredients = stateFilteredIngredients[0];
    var setFilteredIngredients = stateFilteredIngredients[1];

    var stateActiveRecipeSelectIdx = React.useState(null as number | null);
    var activeRecipeSelectIdx = stateActiveRecipeSelectIdx[0];
    var setActiveRecipeSelectIdx = stateActiveRecipeSelectIdx[1];

    var stateIngredientSearch = React.useState('');
    var ingredientSearch = stateIngredientSearch[0];
    var setIngredientSearch = stateIngredientSearch[1];

    var normalizeRecipe = function(recipe) {
        if (!Array.isArray(recipe)) return [];
        return recipe
            .map(function(item) {
                var ingredientId = Number(item && item.ingredientId);
                var amount = Number(item && item.amount);
                return {
                    ingredientId: isNaN(ingredientId) ? null : ingredientId,
                    amount: isNaN(amount) ? 0 : amount
                };
            })
            .filter(function(item) {
                return item.ingredientId !== null && item.amount > 0;
            });
    };

    var calculateHppFromRecipe = function(recipe) {
        var normalizedRecipe = normalizeRecipe(recipe);
        if (normalizedRecipe.length === 0) return 0;
        return normalizedRecipe.reduce(function(total, item) {
            var ingredient = ingredients.find(function(i) {
                return Number(i.id) === Number(item.ingredientId);
            });
            return total + ((ingredient && Number(ingredient.cost_per_unit)) || 0) * Number(item.amount || 0);
        }, 0);
    };

    var normalizeProductForEdit = function(product) {
        return Object.assign({}, product, {
            price: product && product.price != null ? product.price : 0,
            cost: product && product.cost != null ? product.cost : 0,
            addons: Array.isArray(product && product.addons) ? product.addons : [],
            recipe: normalizeRecipe(product && product.recipe)
        });
    };

    var formatCurrency = function(value) {
        return "Rp " + Number(value || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var fetchProducts = function() {
        if (!canManageProducts) {
            setLoading(false);
            return Promise.resolve();
        }
        if (!currentBranchId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        
        // Fetch products and master data in parallel
        return Promise.all([
            supabase.from('products').select('*, recipe:product_recipes(ingredientId:ingredient_id, amount), addons:product_addons(*)').or('branch_id.eq.' + currentBranchId + ',branch_id.is.null').order('name', { ascending: true }),
            supabase.from('ingredients').select('*').or('branch_id.eq.' + currentBranchId + ',branch_id.is.null').order('name', { ascending: true }),
            supabase.from('categories').select('*').order('name', { ascending: true }),
            supabase.from('units').select('*').order('name', { ascending: true }),
            supabase.from('brands').select('*').order('name', { ascending: true })
        ]).then(function(results) {
            var resP = results[0];
            var resI = results[1];
            var resC = results[2];
            var resU = results[3];
            var resB = results[4];

            if (resP.error) throw resP.error;
            var normalizedProducts = (resP.data || []).map(function(product) {
                return normalizeProductForEdit(product);
            });
            setProducts(normalizedProducts);
            setFilteredProducts(normalizedProducts);
            
            if (resI.data) {
                setIngredients(resI.data);
                setFilteredIngredients(resI.data);
            }
            
            if (resC.data) setCategories(resC.data);
            if (resU.data) setUnits(resU.data);
            if (resB.data) setBrands(resB.data);
        })['catch'](function(error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Gagal mengambil data produk/master');
        }).finally(function() {
            setLoading(false);
        });
    };

    React.useEffect(function() {
        if (currentBranchId) {
            fetchProducts();
        } else {
            // Ensure loading stops even if branch ID is not yet available
            setLoading(false);
        }
    }, [currentBranchId]);

    React.useEffect(function() {
        var searchLower = search.toLowerCase();
        if (activeTab === 'produk') {
            if (search.trim() === '') {
                setFilteredProducts(products);
            } else {
                setFilteredProducts(products.filter(function(p) {
                    return (p.name && p.name.toLowerCase().includes(searchLower)) || (p.code && p.code.toLowerCase().includes(searchLower));
                }));
            }
        } else {
            if (search.trim() === '') {
                setFilteredIngredients(ingredients);
            } else {
                setFilteredIngredients(ingredients.filter(function(i) {
                    return (i.name && i.name.toLowerCase().includes(searchLower)) || (i.code && i.code.toLowerCase().includes(searchLower));
                }));
            }
        }
    }, [search, products, ingredients, activeTab]);

    React.useEffect(function() {
        if (!canManageProducts && activeTab !== 'produk') {
            setActiveTab('produk');
        }
    }, [canManageProducts, activeTab]);

    React.useEffect(function() {
        if (!canManageProducts) {
            Alert.alert('Akses Ditolak', 'Menu produk hanya untuk administrator.', [
                { text: 'OK', onPress: function() { navigation.goBack(); } }
            ]);
        }
    }, [canManageProducts, navigation]);

    var uploadImage = function(uri) {
        setUploading(true);
        var oldUrl = editingProduct ? editingProduct.image_url : null;
        return ImageStorageService.replaceImage(oldUrl, uri).then(function(publicUrl) {
            setEditingProduct(Object.assign({}, editingProduct, { image_url: publicUrl }));
            Alert.alert('Sukses', 'Gambar berhasil diperbarui');
        })['catch'](function(error) {
            console.error('Upload error:', error);
            Alert.alert('Error', 'Gagal mengunggah gambar: ' + ((error && error.message) || 'Error tidak dikenal'));
        }).finally(function() {
            setUploading(false);
        });
    };

    var handlePickImage = function() {
        return ImagePicker.requestMediaLibraryPermissionsAsync().then(function(res) {
            if (res.status !== 'granted') {
                Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan akses galeri untuk mengunggah gambar.');
                return;
            }

            return ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });
        }).then(function(result) {
            if (result && !result.canceled && result.assets && result.assets[0].uri) {
                uploadImage(result.assets[0].uri);
            }
        });
    };

    var handleSave = function() {
        if (!canManageProducts) {
            Alert.alert('Akses Ditolak', 'Hanya administrator yang dapat mengubah produk.');
            return;
        }
        if (!editingProduct.name || !editingProduct.code) {
            Alert.alert('Info', 'Nama dan Kode Produk wajib diisi');
            return;
        }

        setLoading(true);
        var isNew = !editingProduct.id;
        var normalizedRecipe = normalizeRecipe(editingProduct.recipe);
        var manualCost = parseFloat(editingProduct.cost) || 0;
        var calculatedCost = calculateHppFromRecipe(normalizedRecipe);
        var finalCost = normalizedRecipe.length > 0 ? calculatedCost : manualCost;
        var payload = {
            name: editingProduct.name,
            code: editingProduct.code,
            price: parseFloat(editingProduct.price) || 0,
            cost: finalCost,
            category: editingProduct.category,
            brand: editingProduct.brand,
            unit: editingProduct.unit,
            image_url: editingProduct.image_url,
            is_sellable: editingProduct.is_sellable !== false,
            target: editingProduct.target || 'Kitchen',
            recipe_date: normalizedRecipe.length > 0
                ? (editingProduct.recipe_date || new Date().toISOString().split('T')[0])
                : (editingProduct.recipe_date || null),
            branch_id: editingProduct.branch_id || currentBranchId
        };

        var query = isNew 
            ? supabase.from('products').insert([payload]).select().single() 
            : supabase.from('products').update(payload).eq('id', editingProduct.id).select().single();

        return query.then(function(res) {
            if (res.error) throw res.error;
            var savedProduct = res.data;
            var productId = (editingProduct && editingProduct.id) || (savedProduct && savedProduct.id);
            if (!productId) throw new Error("Product ID not found after save");

            // Perform separate writes for recipe and addons
            var recipePromise = supabase.from('product_recipes').delete().eq('product_id', productId).then(function() {
                if (normalizedRecipe.length > 0) {
                    var recipeItems = normalizedRecipe.map(function(r) {
                        return {
                            product_id: productId,
                            ingredient_id: r.ingredientId,
                            amount: r.amount
                        };
                    });
                    return supabase.from('product_recipes').insert(recipeItems);
                }
            });

            var addonsPromise = supabase.from('product_addons').delete().eq('product_id', productId).then(function() {
                var currentAddons = editingProduct.addons || [];
                if (currentAddons.length > 0) {
                    var addonItems = currentAddons.map(function(a) {
                        return {
                            product_id: productId,
                            name: a.name,
                            price: a.price
                        };
                    });
                    return supabase.from('product_addons').insert(addonItems);
                }
            });

            return Promise.all([recipePromise, addonsPromise]);
        }).then(function() {
            Alert.alert('Sukses', 'Produk berhasil ' + (isNew ? 'ditambahkan' : 'diperbarui'));
            setModalVisible(false);
            return fetchProducts();
        })['catch'](function(error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Gagal menyimpan produk: ' + ((error && error.message) || 'Error tidak dikenal'));
        }).finally(function() {
            setLoading(false);
        });
    };

    var handleAddNew = function() {
        if (!canManageProducts) {
            Alert.alert('Akses Ditolak', 'Hanya administrator yang dapat menambah produk.');
            return;
        }
        setEditingProduct({
            name: '',
            code: 'P' + Date.now().toString().slice(-4),
            price: 0,
            cost: 0,
            category: '',
            brand: '',
            unit: 'pcs',
            is_sellable: true,
            target: 'Kitchen',
            addons: [],
            recipe: [],
            branch_id: currentBranchId
        });
        setModalVisible(true);
    };

    var handleAddAddon = function() {
        var currentAddons = editingProduct.addons || [];
        setEditingProduct(Object.assign({}, editingProduct, { 
            addons: currentAddons.concat([{ id: Date.now(), name: '', price: 0 }])
        }));
    };

    var handleRemoveAddon = function(addonId) {
        var currentAddons = editingProduct.addons || [];
        setEditingProduct(Object.assign({}, editingProduct, { 
            addons: currentAddons.filter(function(a) { return a.id !== addonId; })
        }));
    };

    var handleUpdateAddon = function(addonId, field, value) {
        var currentAddons = editingProduct.addons || [];
        setEditingProduct(Object.assign({}, editingProduct, { 
            addons: currentAddons.map(function(a) { 
                if (a.id === addonId) {
                    var na = Object.assign({}, a);
                    na[field] = field === 'price' ? parseFloat(value) || 0 : value;
                    return na;
                }
                return a;
            })
        }));
    };

    var handleAddRecipe = function() {
        var currentRecipe = editingProduct.recipe || [];
        setEditingProduct(Object.assign({}, editingProduct, { 
            recipe: currentRecipe.concat([{ ingredientId: '', amount: 0 }])
        }));
    };

    var handleRemoveRecipe = function(idx) {
        var currentRecipe = editingProduct.recipe || [];
        setEditingProduct(Object.assign({}, editingProduct, { 
            recipe: currentRecipe.filter(function(_, i) { return i !== idx; })
        }));
    };

    var handleUpdateRecipe = function(idx, field, value) {
        var currentRecipe = editingProduct.recipe || [];
        setEditingProduct(Object.assign({}, editingProduct, { 
            recipe: currentRecipe.map(function(r, i) { 
                if (i === idx) {
                    var nr = Object.assign({}, r);
                    nr[field] = field === 'amount' ? parseFloat(value) || 0 : value;
                    return nr;
                }
                return r;
            })
        }));
    };

    var handleDelete = function() {
        if (!canManageProducts) {
            Alert.alert('Akses Ditolak', 'Hanya administrator yang dapat menghapus produk.');
            return;
        }
        if (!editingProduct || !editingProduct.id) return;
        
        Alert.alert(
            'Konfirmasi Arsip',
            'Yakin ingin menghapus/mengarsipkan produk ini? Produk tidak akan muncul di kasir tetapi tetap tersimpan di riwayat.',
            [
                { text: 'Batal', style: 'cancel' },
                { 
                    text: 'Arsipkan', 
                    style: 'destructive',
                    onPress: function() {
                        setLoading(true);
                        return supabase
                            .from('products')
                            .delete()
                            .eq('id', editingProduct.id)
                            .then(function(delRes) {
                                if (delRes.error) {
                                    if (delRes.error.code === '23503') {
                                        return supabase
                                            .from('products')
                                            .update({ is_sellable: false })
                                            .eq('id', editingProduct.id)
                                            .then(function(arcRes) {
                                                if (arcRes.error) throw arcRes.error;
                                                Alert.alert('Arsip Berhasil', 'Produk memiliki riwayat transaksi, sehingga diarsipkan secara otomatis.');
                                            });
                                    } else {
                                        throw delRes.error;
                                    }
                                } else {
                                    Alert.alert('Sukses', 'Produk berhasil dihapus');
                                }
                            })
                            .then(function() {
                                setModalVisible(false);
                                return fetchProducts();
                            })['catch'](function(error) {
                                Alert.alert('Error', 'Gagal menghapus: ' + ((error && error.message) || 'Error tidak dikenal'));
                            })
                            .finally(function() {
                                setLoading(false);
                            });
                    }
                }
            ]
        );
    };

    var renderIngredientItem = function(data) {
        var item = data.item;
        var isLow = (item.current_stock || 0) <= (item.min_stock || 0);
        
        // Find products using this ingredient
        var usedBy = products.filter(function(p) {
            return p.recipe && p.recipe.some(function(r) { return String(r.ingredientId) === String(item.id); });
        }).map(function(p) { return p.name; });

        return React.createElement(View, { style: styles.productCard },
            React.createElement(View, { style: [styles.productImageContainer, { backgroundColor: '#f0f9ff' }] },
                React.createElement(Lucide.Package, { size: 24, color: "#0ea5e9" })
            ),
            React.createElement(View, { style: styles.productInfo },
                React.createElement(Text, { style: styles.productName, numberOfLines: 1 }, item.name),
                React.createElement(Text, { style: styles.productCode }, item.code || '-'),
                usedBy.length > 0 && React.createElement(Text, { style: { fontSize: 8, color: '#64748b', fontStyle: 'italic', marginTop: 2 } }, 
                    "Digunakan di: " + usedBy.join(', ')
                ),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginTop: 4 } },
                    React.createElement(Text, { style: [styles.productPrice, { color: isLow ? '#ef4444' : '#10b981' }] }, (item.current_stock || 0) + " " + (item.unit || '')),
                    React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginHorizontal: 6 } }, "•"),
                    React.createElement(Text, { style: { fontSize: 10, color: '#64748b' } }, "Min: " + (item.min_stock || 0))
                )
            ),
            isLow && React.createElement(View, { style: [styles.categoryBadge, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }] },
                React.createElement(Text, { style: [styles.categoryBadgeText, { color: '#ef4444' }] }, "LOW")
            )
        );
    };

    var renderProductItem = function(data) {
        var item = data.item;
        return React.createElement(TouchableOpacity, {
            style: styles.productCard,
            onPress: function() {
                if (!canManageProducts) return;
                setEditingProduct(normalizeProductForEdit(item));
                setModalVisible(true);
            }
        },
            React.createElement(View, { style: styles.productImageContainer },
                item.image_url ? React.createElement(Image, { source: { uri: item.image_url }, style: styles.productImage }) : React.createElement(Text, { style: styles.imagePlaceholderText }, "\uD83D\uDCE6")
            ),
            React.createElement(View, { style: styles.productInfo },
                React.createElement(Text, { style: styles.productName, numberOfLines: 1 }, item.name),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginTop: 2 } },
                    React.createElement(Text, { style: styles.productCode }, item.code),
                    React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginHorizontal: 4 } }, "•"),
                    React.createElement(Text, { style: { fontSize: 10, color: '#64748b' } }, (item.addons ? item.addons.length : 0) + " Topping"),
                    React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginHorizontal: 4 } }, "•"),
                    React.createElement(Text, { style: { fontSize: 10, color: '#64748b' } }, (item.recipe ? item.recipe.length : 0) + " Bahan")
                ),
                (item.recipe && item.recipe.length > 0) && React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 } },
                    item.recipe.slice(0, 3).map(function(r, idx) {
                        var ing = ingredients.find(function(i) { return String(i.id) === String(r.ingredientId); });
                        return React.createElement(View, { key: idx, style: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 } },
                            React.createElement(Text, { style: { fontSize: 8, color: '#475569' } }, (ing ? ing.name : '???') + " " + (r.amount || 0))
                        );
                    }),
                    item.recipe.length > 3 ? React.createElement(Text, { style: { fontSize: 8, color: '#94a3b8' } }, "+" + (item.recipe.length - 3)) : null
                ),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginTop: 4 } },
                    React.createElement(Text, { style: styles.productPrice }, "Rp " + (item.price ? item.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0")),
                    React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginHorizontal: 6 } }, "/"),
                    React.createElement(Text, { style: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' } }, "Modal: Rp " + (item.cost ? item.cost.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0"))
                )
            ),
            React.createElement(View, { style: { flexDirection: 'row', position: 'absolute', top: 8, right: 8, gap: 4 } },
                React.createElement(View, { style: styles.categoryBadge },
                    React.createElement(Text, { style: styles.categoryBadgeText }, item.category || '-')
                ),
                item.target && React.createElement(View, { style: [styles.categoryBadge, { backgroundColor: item.target === 'Bar' ? '#f0f9ff' : '#f0fdf4', borderColor: item.target === 'Bar' ? '#bae6fd' : '#bbf7d0' }] },
                    React.createElement(Text, { style: [styles.categoryBadgeText, { color: item.target === 'Bar' ? '#0ea5e9' : '#10b981' }] }, item.target === 'Kitchen' ? 'DAPUR' : item.target.toUpperCase())
                )
            )
        );
    };

    var renderProductItemSynced = function(data) {
        var item = data.item;
        var normalizedRecipe = normalizeRecipe(item.recipe);
        var hasRecipe = normalizedRecipe.length > 0;
        var finalHpp = hasRecipe ? calculateHppFromRecipe(normalizedRecipe) : (Number(item.cost) || 0);

        return React.createElement(TouchableOpacity, {
            style: styles.productCard,
            onPress: function() {
                if (!canManageProducts) return;
                setEditingProduct(normalizeProductForEdit(item));
                setModalVisible(true);
            }
        },
            React.createElement(View, { style: styles.productImageContainer },
                item.image_url ? React.createElement(Image, { source: { uri: item.image_url }, style: styles.productImage }) : React.createElement(Text, { style: styles.imagePlaceholderText }, "\uD83D\uDCE6")
            ),
            React.createElement(View, { style: styles.productInfo },
                React.createElement(Text, { style: styles.productName, numberOfLines: 1 }, item.name),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginTop: 2 } },
                    React.createElement(Text, { style: styles.productCode }, item.code),
                    React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginHorizontal: 4 } }, "•"),
                    React.createElement(Text, { style: { fontSize: 10, color: '#64748b' } }, (item.addons ? item.addons.length : 0) + " Topping"),
                    canSeeHpp && React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginHorizontal: 4 } }, "•"),
                    canSeeHpp && React.createElement(Text, { style: { fontSize: 10, color: '#64748b' } }, normalizedRecipe.length + " Bahan")
                ),
                (canSeeHpp && hasRecipe) ? React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 } },
                    normalizedRecipe.slice(0, 4).map(function(r, idx) {
                        var ing = ingredients.find(function(i) { return String(i.id) === String(r.ingredientId); });
                        return React.createElement(View, { key: idx, style: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 } },
                            React.createElement(Text, { style: { fontSize: 8, color: '#475569', fontWeight: '600' } }, (ing ? ing.name : '???') + ": " + (r.amount || 0) + " " + ((ing && ing.unit) || ''))
                        );
                    }),
                    normalizedRecipe.length > 4 ? React.createElement(Text, { style: { fontSize: 8, color: '#94a3b8', alignSelf: 'center' } }, "+" + (normalizedRecipe.length - 4) + " bahan") : null
                ) : (canSeeHpp ? React.createElement(Text, { style: { fontSize: 9, color: '#94a3b8', fontStyle: 'italic', marginTop: 6 } }, "Komposisi bahan baku belum diatur") : null),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginTop: 6 } },
                    React.createElement(Text, { style: styles.productPrice }, formatCurrency(item.price)),
                    canSeeHpp && React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginHorizontal: 6 } }, "/"),
                    canSeeHpp && React.createElement(Text, { style: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' } }, "HPP: " + formatCurrency(finalHpp))
                ),
                canSeeHpp && React.createElement(Text, { style: { fontSize: 9, color: hasRecipe ? '#0f766e' : '#94a3b8', marginTop: 4, fontWeight: '600' } },
                    hasRecipe ? "HPP sinkron dari resep bahan baku" : "Menggunakan HPP manual"
                )
            ),
            React.createElement(View, { style: { flexDirection: 'row', position: 'absolute', top: 8, right: 8, gap: 4 } },
                React.createElement(View, { style: styles.categoryBadge },
                    React.createElement(Text, { style: styles.categoryBadgeText }, item.category || '-')
                ),
                item.target && React.createElement(View, { style: [styles.categoryBadge, { backgroundColor: item.target === 'Bar' ? '#f0f9ff' : '#f0fdf4', borderColor: item.target === 'Bar' ? '#bae6fd' : '#bbf7d0' }] },
                    React.createElement(Text, { style: [styles.categoryBadgeText, { color: item.target === 'Bar' ? '#0ea5e9' : '#10b981' }] }, item.target === 'Kitchen' ? 'DAPUR' : item.target.toUpperCase())
                )
            )
        );
    };

    return React.createElement(SafeAreaView, { style: styles.container },
        React.createElement(View, { style: styles.header },
            React.createElement(TouchableOpacity, { onPress: function() { navigation.goBack(); }, style: styles.backButton },
                React.createElement(ChevronLeft, { size: 32, color: "#1f2937" })
            ),
            React.createElement(View, { style: { flex: 1 } },
                React.createElement(Text, { style: styles.headerTitle }, canManageProducts ? "Manajemen Produk" : "Daftar Produk")
            ),
            canManageProducts ? React.createElement(TouchableOpacity, { onPress: handleAddNew, style: styles.addButton },
                React.createElement(Lucide.Plus, { size: 24, color: "white" })
            ) : React.createElement(View, { style: { width: 48, height: 48 } })
        ),

        React.createElement(View, { style: styles.tabContainer },
            [
                { id: 'produk', label: 'Produk', icon: Lucide.LayoutGrid }
            ].concat(canManageProducts ? [{ id: 'bahan_baku', label: 'Bahan Baku', icon: Lucide.FlaskConical }] : []).map(function(t) {
                var isActive = activeTab === t.id;
                return React.createElement(TouchableOpacity, { 
                    key: t.id,
                    onPress: function() { setActiveTab(t.id); setSearch(''); },
                    style: [styles.tabButton, isActive && styles.tabButtonActive]
                },
                    React.createElement(t.icon, { size: 16, color: isActive ? '#ea580c' : '#64748b', style: { marginRight: 6 } }),
                    React.createElement(Text, { style: [styles.tabButtonText, isActive && styles.tabButtonTextActive] }, t.label)
                );
            })
        ),

        React.createElement(View, { style: styles.searchContainer },
            React.createElement(TextInput, {
                style: styles.searchInput,
                placeholder: "Cari nama atau kode produk...",
                value: search,
                onChangeText: setSearch
            })
        ),

        loading && !modalVisible ? React.createElement(View, { style: styles.center },
            React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })
        ) : React.createElement(FlatList, {
            data: activeTab === 'produk' ? filteredProducts : filteredIngredients,
            keyExtractor: function(item, index) { return (item && item.id ? item.id : index).toString(); },
            renderItem: activeTab === 'produk' ? renderProductItemSynced : renderIngredientItem,
            contentContainerStyle: styles.listContent,
            ListEmptyComponent: React.createElement(View, { style: styles.emptyState },
                React.createElement(Text, { style: styles.emptyIcon }, "\uD83D\uDD0D"),
                React.createElement(Text, { style: styles.emptyTitle }, (activeTab === 'produk' ? "Produk" : "Bahan Baku") + " tidak ditemukan")
            )
        }),

        React.createElement(Modal, {
            visible: modalVisible,
            animationType: "slide",
            transparent: true,
            onRequestClose: function() { setModalVisible(false); }
        },
            React.createElement(View, { style: styles.modalOverlay },
                React.createElement(View, { style: styles.modalContent },
                    React.createElement(View, { style: styles.modalHeader },
                        React.createElement(Text, { style: styles.modalHeaderTitle }, (editingProduct && editingProduct.id) ? "Edit Produk" : "Tambah Produk"),
                        React.createElement(TouchableOpacity, { onPress: function() { setModalVisible(false); }, style: styles.closeModalBtn },
                            React.createElement(Lucide.X, { size: 20, color: '#64748b' })
                        )
                    ),

                    React.createElement(ScrollView, { style: styles.modalBody },
                        React.createElement(View, { style: styles.imageUploadSection },
                            React.createElement(View, { style: { position: 'relative' } },
                                React.createElement(TouchableOpacity, {
                                    style: styles.imagePicker,
                                    onPress: handlePickImage,
                                    disabled: uploading || !canManageProducts
                                },
                                    editingProduct && editingProduct.image_url ? React.createElement(Image, { source: { uri: editingProduct.image_url }, style: styles.uploadPreview }) : React.createElement(View, { style: styles.uploadPlaceholder },
                                        React.createElement(Text, { style: styles.uploadIcon }, "\uD83D\uDCF7"),
                                        React.createElement(Text, { style: styles.uploadText }, "Ketuk untuk Upload")
                                    ),
                                    uploading ? React.createElement(View, { style: styles.uploadingOverlay },
                                        React.createElement(ActivityIndicator, { color: "white" })
                                    ) : null
                                ),
                                
                                editingProduct && editingProduct.image_url ? React.createElement(TouchableOpacity, {
                                    style: styles.removeImageOverlay,
                                    disabled: !canManageProducts,
                                    onPress: function() {
                                        Alert.alert(
                                            'Hapus Gambar',
                                            'Yakin ingin menghapus gambar ini dari penyimpanan?',
                                            [
                                                { text: 'Batal', style: 'cancel' },
                                                { 
                                                    text: 'Hapus', 
                                                    style: 'destructive',
                                                    onPress: function() {
                                                        return ImageStorageService.deleteImage(editingProduct.image_url).then(function() {
                                                            setEditingProduct(Object.assign({}, editingProduct, { image_url: null }));
                                                        });
                                                    }
                                                }
                                            ]
                                        );
                                    }
                                },
                                    React.createElement(Text, { style: styles.removeImageIcon }, "\u2715")
                                ) : null
                            ),
                            editingProduct && editingProduct.image_url ? React.createElement(Text, { style: styles.imageStatusText }, "Gambar aktif tersimpan di cloud") : null
                        ),

                        React.createElement(View, { style: { flexDirection: 'row', gap: 10, marginBottom: 12 } },
                            React.createElement(View, { style: { flex: 0.4 } },
                                React.createElement(Text, { style: styles.labelCompact }, "SKU"),
                                React.createElement(TextInput, {
                                    style: styles.inputCompact,
                                    value: editingProduct ? editingProduct.code : '',
                                    onChangeText: function(text) { setEditingProduct(Object.assign({}, editingProduct, { code: text })); }
                                })
                            ),
                            React.createElement(View, { style: { flex: 0.6 } },
                                React.createElement(Text, { style: styles.labelCompact }, "Nama Produk"),
                                React.createElement(TextInput, {
                                    style: styles.inputCompact,
                                    value: editingProduct ? editingProduct.name : '',
                                    onChangeText: function(text) { setEditingProduct(Object.assign({}, editingProduct, { name: text })); }
                                })
                            )
                        ),

                        React.createElement(View, { style: { flexDirection: 'row', gap: 10, marginBottom: 12 } },
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.labelCompact }, "Harga Jual"),
                                React.createElement(TextInput, {
                                    style: styles.inputCompact,
                                    value: editingProduct && editingProduct.price != null ? editingProduct.price.toString() : '',
                                    keyboardType: "numeric",
                                    onChangeText: function(text) { setEditingProduct(Object.assign({}, editingProduct, { price: text })); }
                                })
                            ),
                            canSeeHpp ? React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.labelCompact }, "HPP (Modal)"),
                                React.createElement(TextInput, {
                                    style: styles.inputCompact,
                                    value: editingProduct && editingProduct.cost != null ? editingProduct.cost.toString() : '',
                                    keyboardType: "numeric",
                                    onChangeText: function(text) { setEditingProduct(Object.assign({}, editingProduct, { cost: text })); }
                                }),
                                (editingProduct && editingProduct.recipe && normalizeRecipe(editingProduct.recipe).length > 0) ? React.createElement(Text, { style: { fontSize: 10, color: '#0f766e', marginTop: 6, fontWeight: '600' } },
                                    "Dipakai dari resep: Rp " + calculateHppFromRecipe(editingProduct.recipe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                                ) : React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginTop: 6 } },
                                    "Dipakai sebagai HPP manual jika resep kosong"
                                )
                            ) : React.createElement(View, { style: { flex: 1 } })
                        ),

                        React.createElement(View, { style: { flexDirection: 'row', gap: 10, marginBottom: 12 } },
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.labelCompact }, "Kategori"),
                                React.createElement(TextInput, {
                                    style: styles.inputCompact,
                                    value: editingProduct ? editingProduct.category : '',
                                    onChangeText: function(text) { setEditingProduct(Object.assign({}, editingProduct, { category: text })); }
                                })
                            ),
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.labelCompact }, "Target Print"),
                                React.createElement(TouchableOpacity, { 
                                    style: [styles.inputCompact, { justifyContent: 'center' }],
                                    onPress: function() {
                                        Alert.alert("Pilih Target Print", "Tentukan printer tujuan untuk produk ini:", [
                                            { text: "Dapur (Kitchen)", onPress: function() { setEditingProduct(Object.assign({}, editingProduct, { target: 'Kitchen' })); } },
                                            { text: "Bar", onPress: function() { setEditingProduct(Object.assign({}, editingProduct, { target: 'Bar' })); } },
                                            { text: "Batal", style: 'cancel' }
                                        ]);
                                    }
                                },
                                    React.createElement(Text, { style: { fontSize: 14, color: (editingProduct && editingProduct.target) ? '#0f172a' : '#94a3b8' } }, 
                                        (editingProduct && editingProduct.target) ? (editingProduct.target === 'Kitchen' ? 'Dapur' : editingProduct.target) : 'Dapur'
                                    )
                                )
                            )
                        ),

                        React.createElement(View, { style: { flexDirection: 'row', gap: 10, marginBottom: 12 } },
                            React.createElement(View, { style: { flex: 1 } },
                                React.createElement(Text, { style: styles.labelCompact }, "Satuan"),
                                React.createElement(TextInput, {
                                    style: styles.inputCompact,
                                    value: editingProduct ? editingProduct.unit : '',
                                    onChangeText: function(text) { setEditingProduct(Object.assign({}, editingProduct, { unit: text })); }
                                })
                            ),
                            React.createElement(View, { style: { flex: 1 } })
                        ),

                        // Recipe / Komposisi Section
                        canSeeHpp ? React.createElement(View, { style: { marginBottom: 16 } },
                            React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                                React.createElement(Text, { style: styles.labelCompact }, "Komposisi Bahan Baku"),
                                React.createElement(TouchableOpacity, { onPress: handleAddRecipe, style: { padding: 4 } },
                                    React.createElement(Lucide.PlusCircle, { size: 18, color: "#0ea5e9" })
                                )
                            ),
                            (editingProduct && editingProduct.recipe && editingProduct.recipe.length > 0) ? editingProduct.recipe.map(function(rec, idx) {
                                var ing = ingredients.find(function(i) { return String(i.id) === String(rec.ingredientId); });
                                return React.createElement(View, { key: idx, style: { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' } },
                                    React.createElement(TouchableOpacity, { 
                                        style: { flex: 2, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9', height: 40, justifyContent: 'center', paddingHorizontal: 10 },
                                        onPress: function() {
                                            setActiveRecipeSelectIdx(idx);
                                            setIngredientSearch('');
                                        }
                                    },
                                        React.createElement(Text, { style: { fontSize: 12, color: ing ? '#0f172a' : '#94a3b8' } }, ing ? ing.name : "Pilih Bahan...")
                                    ),
                                    React.createElement(TextInput, {
                                        style: [styles.inputCompact, { flex: 1 }],
                                        placeholder: "Porsi",
                                        keyboardType: "numeric",
                                        value: (rec.amount || 0).toString(),
                                        onChangeText: function(t) { handleUpdateRecipe(idx, 'amount', t); }
                                    }),
                                    React.createElement(TouchableOpacity, { onPress: function() { handleRemoveRecipe(idx); } },
                                        React.createElement(Lucide.Trash2, { size: 18, color: "#ef4444" })
                                    )
                                );
                            }) : React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginBottom: 8 } }, "Belum ada resep")
                        ) : null,

                        // Addons / Topping Section
                        React.createElement(View, { style: { marginBottom: 24 } },
                            React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
                                React.createElement(Text, { style: styles.labelCompact }, "Topping / Add-ons"),
                                React.createElement(TouchableOpacity, { onPress: handleAddAddon, style: { padding: 4 } },
                                    React.createElement(Lucide.PlusCircle, { size: 20, color: "#ea580c" })
                                )
                            ),
                            (editingProduct && editingProduct.addons && editingProduct.addons.length > 0) ? editingProduct.addons.map(function(addon, idx) {
                                return React.createElement(View, { key: addon.id || idx, style: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' } },
                                    React.createElement(TextInput, {
                                        style: [styles.inputCompact, { flex: 2, padding: 8 }],
                                        placeholder: "Nama Topping",
                                        value: addon.name,
                                        onChangeText: function(t) { handleUpdateAddon(addon.id, 'name', t); }
                                    }),
                                    React.createElement(TextInput, {
                                        style: [styles.inputCompact, { flex: 1.5, padding: 8 }],
                                        placeholder: "Harga",
                                        keyboardType: "numeric",
                                        value: addon.price.toString(),
                                        onChangeText: function(t) { handleUpdateAddon(addon.id, 'price', t); }
                                    }),
                                    React.createElement(TouchableOpacity, { onPress: function() { handleRemoveAddon(addon.id); } },
                                        React.createElement(Lucide.Trash2, { size: 20, color: "#ef4444" })
                                    )
                                );
                            }) : React.createElement(Text, { style: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginBottom: 12 } }, "Belum ada topping")
                        ),

                        React.createElement(View, { style: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 100 } },
                            React.createElement(TouchableOpacity, {
                                style: [styles.saveBtnCompact, { flex: 2 }],
                                onPress: handleSave,
                                disabled: loading || !canManageProducts
                            },
                                loading ? React.createElement(ActivityIndicator, { color: "white" }) : React.createElement(Text, { style: styles.saveBtnTextCompact }, canManageProducts ? "Simpan" : "Lihat")
                            ),
                            (editingProduct && editingProduct.id && canManageProducts) ? React.createElement(TouchableOpacity, {
                                style: [styles.saveBtnCompact, { flex: 1, backgroundColor: '#fee2e2' }],
                                onPress: handleDelete,
                                disabled: loading
                            },
                                React.createElement(Lucide.Trash2, { size: 18, color: "#ef4444" })
                            ) : null
                        )
                    )
                )
            ),

            React.createElement(Modal, {
                visible: activeRecipeSelectIdx !== null,
                animationType: "fade",
                transparent: true,
                onRequestClose: function() { setActiveRecipeSelectIdx(null); }
            },
                React.createElement(View, { style: styles.modalOverlay },
                    React.createElement(View, { style: [styles.modalContent, { height: '80%' }] },
                        React.createElement(View, { style: styles.modalHeader },
                            React.createElement(Text, { style: styles.modalHeaderTitle }, "Pilih Bahan Baku"),
                            React.createElement(TouchableOpacity, { 
                                onPress: function() { setActiveRecipeSelectIdx(null); }, 
                                style: styles.closeModalBtn 
                            },
                                React.createElement(Lucide.X, { size: 20, color: '#64748b' })
                            )
                        ),
                        React.createElement(View, { style: { padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' } },
                            React.createElement(TextInput, {
                                style: styles.searchInput,
                                placeholder: "Cari bahan baku...",
                                value: ingredientSearch,
                                onChangeText: setIngredientSearch
                            })
                        ),
                        React.createElement(FlatList, {
                            data: ingredients.filter(function(ig) {
                                var q = ingredientSearch.toLowerCase();
                                return (ig.name && ig.name.toLowerCase().includes(q)) || 
                                       (ig.code && ig.code.toLowerCase().includes(q));
                            }),
                            keyExtractor: function(item, index) { return (item && item.id ? item.id : index).toString(); },
                            contentContainerStyle: { paddingBottom: 40 },
                            renderItem: function(row) {
                                var item = row.item;
                                return React.createElement(TouchableOpacity, {
                                    style: { 
                                        paddingVertical: 14, 
                                        paddingHorizontal: 16, 
                                        borderBottomWidth: 1, 
                                        borderBottomColor: '#f1f5f9',
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    },
                                    onPress: function() {
                                        handleUpdateRecipe(activeRecipeSelectIdx, 'ingredientId', item.id);
                                        setActiveRecipeSelectIdx(null);
                                        setIngredientSearch('');
                                    }
                                },
                                    React.createElement(View, { style: { flex: 1 } },
                                        React.createElement(Text, { style: { fontSize: 14, fontWeight: '600', color: '#1e293b' } }, item.name),
                                        React.createElement(Text, { style: { fontSize: 11, color: '#64748b', marginTop: 2 } }, item.code || '-')
                                    ),
                                    React.createElement(View, { style: { alignItems: 'flex-end' } },
                                        React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold', color: '#0ea5e9' } }, 
                                            (item.current_stock || 0) + " " + (item.unit || '')
                                        ),
                                        React.createElement(Text, { style: { fontSize: 10, color: '#94a3b8', marginTop: 2 } }, 
                                            "Min: " + (item.min_stock || 0)
                                        )
                                    )
                                );
                            },
                            ListEmptyComponent: React.createElement(View, { style: { alignItems: 'center', marginTop: 40 } },
                                React.createElement(Text, { style: { fontSize: 14, color: '#64748b' } }, "Bahan baku tidak ditemukan")
                            )
                        })
                    )
                )
            )
        )
    );
}

var styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    backButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    addButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ea580c', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    searchContainer: { padding: 16, backgroundColor: 'white' },
    searchInput: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 12, fontSize: 16 },
    listContent: { padding: 16 },
    productCard: { backgroundColor: 'white', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6', elevation: 1 },
    productImageContainer: { width: 60, height: 60, backgroundColor: '#f3f4f6', borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    productImage: { width: '100%', height: '100%' },
    imagePlaceholderText: { fontSize: 24 },
    productInfo: { flex: 1, marginLeft: 12 },
    productName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    productCode: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    productPrice: { fontSize: 14, fontWeight: 'bold', color: '#ea580c', marginTop: 4 },
    categoryBadge: { backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#ffedd5' },
    categoryBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#ea580c', textTransform: 'uppercase' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyIcon: { fontSize: 48, color: '#d1d5db', marginBottom: 16 },
    emptyTitle: { fontSize: 18, color: '#6b7280', fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '75%' },
    modalHeader: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
    closeModalBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
    modalBody: { padding: 20 },
    imageUploadSection: { alignItems: 'center', marginBottom: 16 },
    imagePicker: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#f3f4f6', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    uploadPreview: { width: '100%', height: '100%' },
    uploadPlaceholder: { alignItems: 'center' },
    uploadIcon: { fontSize: 24, marginBottom: 4 },
    uploadText: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
    uploadingOverlay: Object.assign({}, StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }),
    removeImageOverlay: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(239, 68, 68, 0.9)', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'white' },
    removeImageIcon: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    imageStatusText: { fontSize: 9, color: '#9ca3af', marginTop: 4, fontWeight: 'bold', textAlign: 'center' },
    labelCompact: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' },
    inputCompact: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
    saveBtnCompact: { backgroundColor: '#ea580c', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    saveBtnTextCompact: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    tabContainer: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 16, paddingBottom: 12 },
    tabButton: { flex: 1, flexDirection: 'row', paddingVertical: 10, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    tabButtonActive: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#ffedd5' },
    tabButtonText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    tabButtonTextActive: { color: '#ea580c' },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
