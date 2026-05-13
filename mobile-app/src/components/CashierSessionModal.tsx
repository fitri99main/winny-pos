import React from 'react';
import * as RN from 'react-native';
var View = RN.View;
var Text = RN.Text;
var Modal = RN.Modal;
var TouchableOpacity = RN.TouchableOpacity;
var TextInput = RN.TextInput;
var StyleSheet = RN.StyleSheet;
var ActivityIndicator = RN.ActivityIndicator;
var ScrollView = RN.ScrollView;
var Alert = RN.Alert;
var Animated = RN.Animated;
var Platform = RN.Platform;
import * as SupabaseLib from '../lib/supabase';
var supabase = SupabaseLib.supabase;
import * as PrinterLib from '../lib/PrinterManager';
var PrinterManager = PrinterLib.PrinterManager;
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;

export default function CashierSessionModal(props) {
    var visible = props.visible;
    var onClose = props.onClose;
    var mode = props.mode;
    var session = props.session;
    var onComplete = props.onComplete;
    var currentBranchId = props.currentBranchId;

    var stateLoading = React.useState(false);
    var loading = stateLoading[0];
    var setLoading = stateLoading[1];

    var stateStartingCash = React.useState('');
    var startingCash = stateStartingCash[0];
    var setStartingCash = stateStartingCash[1];

    var stateActualCash = React.useState('');
    var actualCash = stateActualCash[0];
    var setActualCash = stateActualCash[1];

    var stateNotes = React.useState('');
    var notes = stateNotes[0];
    var setNotes = stateNotes[1];

    var stateClosingData = React.useState(null);
    var closingData = stateClosingData[0];
    var setClosingData = stateClosingData[1];

    var stateShowFullSummary = React.useState(false);
    var showFullSummary = stateShowFullSummary[0];
    var setShowFullSummary = stateShowFullSummary[1];
    
    var sessionInfo = useSession();
    var branchAddress = sessionInfo.branchAddress;
    var branchPhone = sessionInfo.branchPhone;
    var sessionSettings = sessionInfo.storeSettings;

    var stateStoreSettings = React.useState(null);
    var storeSettings = stateStoreSettings[0];
    var setStoreSettings = stateStoreSettings[1];

    var fadeAnim = React.useRef(new Animated.Value(0)).current;

    var calculateClosingData = function() {
        if (!session || !session.opened_at) {
            console.error('[Shift] No session opened_at found');
            return;
        }
        setLoading(true);
        
        var calcTimeout = setTimeout(function() {
            setLoading(false);
            Alert.alert('Perhatian', 'Proses menghitung ringkasan memakan waktu lebih lama. Anda tetap bisa mencoba menutup shift.');
        }, 15000);

        var openedAt = new Date(session.opened_at).toISOString();
        
        supabase.from('store_settings').select('*').eq('id', 1).maybeSingle()
            .then(function(settingsRes) {
                if (settingsRes.data) setStoreSettings(settingsRes.data);
                
                return supabase
                    .from('sales')
                    .select('*')
                    .eq('branch_id', currentBranchId || session.branch_id)
                    .gte('date', openedAt);
            })
            .then(function(salesRes) {
                var sales = salesRes.data;
                var salesError = salesRes.error;
                if (salesError) throw salesError;

                var cash = 0;
                var nonCash = 0;
                var total = 0;
                var totalTax = 0;
                var totalDiscount = 0;
                var completedCount = 0;
                var paySummary = {};

                if (sales) {
                    for (var i = 0; i < sales.length; i++) {
                        var sale = sales[i];
                        var status = (sale.status || '').toLowerCase();
                        var isPaid = ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture', 'ready'].indexOf(status) !== -1;
                        
                        if (isPaid) {
                            completedCount++;
                            var amount = (sale.total_amount || 0);
                            total += amount;
                            totalTax += Number(sale.tax || sale.tax_amount || 0);
                            totalDiscount += Number(sale.discount || sale.discount_amount || 0);
                            var method = (sale.payment_method || 'Tunai').trim();
                            paySummary[method] = (paySummary[method] || 0) + amount;

                            var lowerMethod = method.toLowerCase();
                            var isCash = lowerMethod === 'cash' || lowerMethod === 'tunai' || lowerMethod === 'uang tunai';
                            if (isCash) cash += amount;
                            else nonCash += amount;
                        }
                    }
                }

                var saleIds = [];
                if (sales) {
                    for (var j = 0; j < sales.length; j++) {
                        saleIds.push(sales[j].id);
                    }
                }

                if (saleIds.length === 0) {
                    return { sales: sales, cash: cash, nonCash: nonCash, total: total, totalTax: totalTax, totalDiscount: totalDiscount, completedCount: completedCount, paySummary: paySummary, items: [] };
                }

                var chunkSize = 200;
                var itemPromises = [];
                for (var k = 0; k < saleIds.length; k += chunkSize) {
                    var chunk = saleIds.slice(k, k + chunkSize);
                    itemPromises.push(supabase.from('sale_items').select('product_id, product_name, quantity, price').in('sale_id', chunk));
                }

                return Promise.all(itemPromises).then(function(results) {
                    var allItems = [];
                    for (var r = 0; r < results.length; r++) {
                        if (results[r].data) {
                            allItems = allItems.concat(results[r].data);
                        }
                    }
                    return { sales: sales, cash: cash, nonCash: nonCash, total: total, totalTax: totalTax, totalDiscount: totalDiscount, completedCount: completedCount, paySummary: paySummary, items: allItems };
                });
            })
            .then(function(baseData) {
                var items = baseData.items;
                if (!items || items.length === 0) return baseData;

                var productNameSet = {};
                var productIdSet = {};
                for (var n = 0; n < items.length; n++) {
                    if (items[n].product_name) productNameSet[items[n].product_name] = true;
                    if (items[n].product_id) productIdSet[items[n].product_id] = true;
                }
                
                var soldProductNameList = [];
                for (var keyName in productNameSet) { soldProductNameList.push(keyName); }
                var soldProductIdList = [];
                for (var keyId in productIdSet) { soldProductIdList.push(keyId); }

                var prodQuery = supabase.from('products').select('id, name, category');
                if (soldProductNameList.length > 0 || soldProductIdList.length > 0) {
                    var orParts = [];
                    if (soldProductNameList.length > 0) {
                        var namesPart = "";
                        for (var pIdx = 0; pIdx < soldProductNameList.length; pIdx++) {
                            namesPart += (pIdx === 0 ? "" : ",") + "\"" + soldProductNameList[pIdx] + "\"";
                        }
                        orParts.push("name.in.(" + namesPart + ")");
                    }
                    if (soldProductIdList.length > 0) {
                        orParts.push("id.in.(" + soldProductIdList.join(',') + ")");
                    }
                    prodQuery = prodQuery.or(orParts.join(','));
                }

                return prodQuery.then(function(specificProductsRes) {
                    var specificProducts = specificProductsRes.data;
                    var productCatMap = {};
                    var productIdMap = {};
                    if (specificProducts) {
                        for (var p = 0; p < specificProducts.length; p++) {
                            var pr = specificProducts[p];
                            var cat = (pr.category || 'LAINNYA').toUpperCase();
                            if (pr.name) productCatMap[pr.name] = cat;
                            if (pr.id) productIdMap[Number(pr.id)] = cat;
                        }
                    }

                    var catSummary = {};
                    var prodSummary = {};
                    for (var q = 0; q < items.length; q++) {
                        var item = items[q];
                        var name = item.product_name || 'Produk';
                        var productId = item.product_id ? Number(item.product_id) : null;
                        var catName = (productId ? productIdMap[productId] : null) || productCatMap[name] || 'LAINNYA';
                        var qty = Number(item.quantity) || 0;
                        var amountVal = qty * (Number(item.price) || 0);

                        if (amountVal > 0) {
                            catSummary[catName] = (catSummary[catName] || 0) + amountVal;
                            if (!prodSummary[name]) prodSummary[name] = { quantity: 0, amount: 0, category: catName };
                            prodSummary[name].quantity += qty;
                            prodSummary[name].amount += amountVal;
                        }
                    }
                    baseData.catSummary = catSummary;
                    baseData.prodSummary = prodSummary;
                    return baseData;
                });
            })
            .then(function(baseData) {
                return supabase
                    .from('sales_returns')
                    .select('refund_amount, payment_method')
                    .eq('branch_id', currentBranchId || session.branch_id)
                    .gte('created_at', openedAt)
                    .then(function(returnRes) {
                        var cashRefunds = 0;
                        var returnData = returnRes.data;
                        if (returnData) {
                            for (var r = 0; r < returnData.length; r++) {
                                var ret = returnData[r];
                                var rMethod = (ret.payment_method || '').toLowerCase().trim();
                                if (['tunai', 'cash', 'uang tunai'].indexOf(rMethod) !== -1) {
                                    cashRefunds += (Number(ret.refund_amount) || 0);
                                }
                            }
                        }
                        baseData.cashRefunds = cashRefunds;
                        return baseData;
                    });
            })
            .then(function(baseData) {
                return supabase
                    .from('petty_cash_transactions')
                    .select('amount, type, description')
                    .gte('created_at', openedAt)
                    .then(function(expenseRes) {
                        var cashExpenses = 0;
                        var cashTopups = 0;
                        var expenseData = expenseRes.data;
                        if (expenseData) {
                            for (var s = 0; s < expenseData.length; s++) {
                                var exp = expenseData[s];
                                if (exp.type === 'SPEND') {
                                    cashExpenses += (Number(exp.amount) || 0);
                                } else if (exp.type === 'TOPUP' && exp.description !== 'Saldo Awal') {
                                    cashTopups += (Number(exp.amount) || 0);
                                }
                            }
                        }
                        baseData.cashExpenses = cashExpenses;
                        baseData.cashTopups = cashTopups;
                        return baseData;
                    });
            })
            .then(function(baseData) {
                var startCash = parseFloat(session.starting_cash) || 0;
                var paymentSummaryList = [];
                for (var mKey in baseData.paySummary) { paymentSummaryList.push({ method: mKey, amount: baseData.paySummary[mKey] }); }
                
                var categorySummaryList = [];
                if (baseData.catSummary) {
                    for (var cKey in baseData.catSummary) { categorySummaryList.push({ name: cKey, amount: baseData.catSummary[cKey] }); }
                }
                
                var productSummaryList = [];
                if (baseData.prodSummary) {
                    for (var pKey in baseData.prodSummary) {
                        var pData = baseData.prodSummary[pKey];
                        productSummaryList.push({
                            name: pKey,
                            quantity: pData.quantity,
                            amount: pData.amount,
                            category: pData.category
                        });
                    }
                }

                setClosingData({
                    cash_sales: baseData.cash,
                    non_cash_sales: baseData.nonCash,
                    cash_refunds: baseData.cashRefunds,
                    cash_expenses: baseData.cashExpenses,
                    cash_topups: baseData.cashTopups,
                    total_sales: baseData.total,
                    total_tax: baseData.totalTax,
                    total_discount: baseData.totalDiscount,
                    total_orders: baseData.completedCount, 
                    expected_cash: startCash + baseData.cash + baseData.cashTopups - baseData.cashRefunds - baseData.cashExpenses,
                    payment_summary: paymentSummaryList,
                    category_summary: categorySummaryList,
                    product_summary: productSummaryList
                });
                clearTimeout(calcTimeout);
                setLoading(false);
            })['catch'](function(err) {
                console.error('[Shift] Calculation Error:', err);
                Alert.alert('Error', 'Gagal memuat ringkasan: ' + (err.message || err));
                clearTimeout(calcTimeout);
                setLoading(false);
            });
    };

    React.useEffect(function() {
        if (visible) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            if (mode === 'open') {
                setStartingCash('');
                setNotes('');
            } else if ((mode === 'close' || mode === 'force_close') && session) {
                calculateClosingData();
            }
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible, mode, session]);

    var handleOpenSession = function() {
        var cashValue = parseFloat(startingCash) || 0;
        setLoading(true);
        supabase.auth.getUser()
            .then(function(userRes) {
                var user = userRes.data.user;
                if (!user) throw new Error('User not authenticated');
                if (!currentBranchId) throw new Error('Branch ID tidak ditemukan.');

                return supabase.from('employees').select('name').eq('email', user.email).single()
                    .then(function(empRes) {
                        var emp = empRes.data;
                        var realName = (emp && emp.name) ? emp.name : (user.email ? user.email.split('@')[0] : 'Kasir');

                        return supabase.from('cashier_sessions').insert({
                            user_id: user.id,
                            branch_id: currentBranchId, 
                            employee_name: realName,
                            opened_at: new Date().toISOString(),
                            starting_cash: cashValue,
                            status: 'Open',
                            notes: notes
                        });
                    });
            })
            .then(function(insRes) {
                if (insRes.error) throw insRes.error;
                onComplete();
                onClose();
                setLoading(false);
            })['catch'](function(err) {
                Alert.alert('Error', 'Gagal membuka shift: ' + (err.message || err));
                setLoading(false);
            });
    };

    var handleCloseSession = function() {
        var actual = parseFloat(actualCash) || 0;
        var expected = closingData ? closingData.expected_cash : 0;
        setLoading(true);

        var getActiveSessionId = function() {
            if (session && session.id) return Promise.resolve(session.id);
            return supabase.from('cashier_sessions').select('id').eq('status', 'Open').limit(1).maybeSingle()
                .then(function(activeRes) {
                    if (activeRes.data) return activeRes.data.id;
                    throw new Error('Sesi tidak ditemukan.');
                });
        };

        getActiveSessionId()
            .then(function(sessionId) {
                return supabase.from('cashier_sessions').update({
                    closed_at: new Date().toISOString(),
                    status: 'Closed',
                    cash_sales: closingData ? closingData.cash_sales : 0,
                    qris_sales: closingData ? closingData.non_cash_sales : 0,
                    total_sales: closingData ? closingData.total_sales : 0,
                    expected_cash: expected,
                    actual_cash: actual,
                    difference: actual - expected,
                    notes: notes
                }).eq('id', sessionId);
            })
            .then(function(upRes) {
                if (upRes.error) throw upRes.error;

                setLoading(false);
                onClose();

                setTimeout(function() {
                    Promise.race([
                        supabase.auth.signOut(),
                        new Promise(function(_, reject) { setTimeout(function() { reject(new Error('Timeout')); }, 2000); })
                    ])['catch'](function(e) { console.warn('[Shift] Signout skipped/timeout'); })
                    .then(function() {
                        onComplete();
                    });
                }, 300);
            })['catch'](function(err) {
                setLoading(false);
                console.error('[Shift] Close Error:', err);
                Alert.alert('Error', 'Gagal menutup shift: ' + (err.message || err));
            });
    };

    var handlePrintSummary = function() {
        if (!closingData) return;
        var dataForReport = {
            cash_sales: closingData.cash_sales,
            non_cash_sales: closingData.non_cash_sales,
            cash_refunds: closingData.cash_refunds,
            cash_expenses: closingData.cash_expenses,
            cash_topups: closingData.cash_topups,
            total_sales: closingData.total_sales,
            total_tax: closingData.total_tax,
            total_discount: closingData.total_discount,
            total_orders: closingData.total_orders,
            expected_cash: closingData.expected_cash,
            payment_summary: closingData.payment_summary,
            category_summary: closingData.category_summary,
            product_summary: closingData.product_summary,
            starting_cash: parseFloat(session ? session.starting_cash : 0) || 0,
            actual_cash: parseFloat(actualCash) || 0,
            difference: (parseFloat(actualCash) || 0) - (closingData ? closingData.expected_cash : 0),
            employee_name: session ? session.employee_name : '',
            opened_at: session ? session.opened_at : ''
        };

        var catSummaryFormatted = [];
        if (dataForReport.category_summary) {
            for (var i = 0; i < dataForReport.category_summary.length; i++) {
                var c = dataForReport.category_summary[i];
                catSummaryFormatted.push({ category: c.name, amount: c.amount });
            }
        }

        var reportData = {
            shopName: (storeSettings && storeSettings.store_name) ? storeSettings.store_name : 'WINNY COFFEE PNK',
            address: (storeSettings && storeSettings.address) ? storeSettings.address : (branchAddress || ''),
            phone: (storeSettings && storeSettings.phone) ? storeSettings.phone : (branchPhone || ''),
            dateRange: new Date(dataForReport.opened_at).toLocaleString('id-ID') + ' - ' + new Date().toLocaleString('id-ID'),
            totalOrders: dataForReport.total_orders,
            totalSales: dataForReport.total_sales,
            totalTax: dataForReport.total_tax || 0,
            totalDiscount: dataForReport.total_discount || 0,
            paymentSummary: dataForReport.payment_summary,
            categorySummary: catSummaryFormatted,
            productSummary: [],
            openingBalance: dataForReport.starting_cash,
            cashTotal: dataForReport.cash_sales,
            qrTotal: dataForReport.non_cash_sales,
            expectedCash: dataForReport.expected_cash,
            actualCash: dataForReport.actual_cash,
            variance: dataForReport.difference,
            generatedBy: dataForReport.employee_name,
            showLogo: true,
            receiptLogoUrl: (storeSettings && storeSettings.receipt_logo_url) ? storeSettings.receipt_logo_url : ((storeSettings && storeSettings.logo_url) ? storeSettings.logo_url : (sessionSettings && sessionSettings.receipt_logo_url)),
            showCategoryOnSummary: storeSettings ? (storeSettings.show_category_on_summary !== false) : true,
            paperWidth: (storeSettings && storeSettings.receipt_paper_width === '80mm') ? 48 : 32
        };
        PrinterManager.printSalesReport(reportData)['catch'](function(err) {
            console.error('[Shift] Print Error:', err);
            Alert.alert('Printer Error', 'Gagal mencetak.');
        });
    };

    var formatCurrency = function(val) {
        var v = Math.floor(Number(val || 0));
        return 'Rp ' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    var diffVal = (parseFloat(actualCash) || 0) - (closingData ? closingData.expected_cash : 0);

    var CashierClosingSummaryModal = require('./CashierClosingSummaryModal')['default'];

    return React.createElement(Modal, { visible: visible, transparent: true, animationType: "fade", onRequestClose: onClose },
        React.createElement(View, { style: styles.overlay },
            React.createElement(Animated.View, { style: [styles.container, { opacity: fadeAnim }] },
                React.createElement(View, { style: styles.headerRow },
                    React.createElement(View, { style: [styles.iconBox, { backgroundColor: mode === 'open' ? '#f0fdf4' : '#fff7ed' }] },
                        React.createElement(Text, { style: { fontSize: 24, color: mode === 'open' ? '#16a34a' : '#ea580c' } }, mode === 'open' ? '🔓' : '🔒')
                    ),
                    React.createElement(View, { style: { flex: 1, marginLeft: 12 } },
                        React.createElement(Text, { style: styles.title }, mode === 'open' ? 'Buka Sesi Baru' : 'Tutup Sesi Kasir'),
                        React.createElement(Text, { style: styles.subtitle }, mode === 'open' ? 'Input modal awal untuk memulai' : "Shift #" + (session ? (session.id || '...') : '...'))
                    ),
                    React.createElement(TouchableOpacity, { onPress: onClose, style: styles.closeBtn },
                        React.createElement(Text, { style: { fontSize: 24, color: '#94a3b8' } }, "\u2715")
                    )
                ),
                React.createElement(ScrollView, { style: styles.content, showsVerticalScrollIndicator: false },
                    mode === 'open' ? React.createElement(View, { style: styles.inputSection },
                        React.createElement(Text, { style: styles.label }, "MODAL AWAL TUNAI"),
                        React.createElement(View, { style: styles.inputWrapper },
                            React.createElement(Text, { style: { fontSize: 18, color: '#64748b', marginRight: 10 } }, "\uD83D\uDCB5"),
                            React.createElement(TextInput, { style: styles.input, placeholder: "0", value: startingCash, onChangeText: setStartingCash, keyboardType: "numeric", autoFocus: true })
                        ),
                        React.createElement(View, { style: { marginTop: 12 } },
                            React.createElement(Text, { style: styles.label }, "CATATAN SHIFT (OPSIONAL)"),
                            React.createElement(TextInput, { style: [styles.input, styles.textArea], placeholder: "Cth: Shift Pagi", value: notes, onChangeText: setNotes, multiline: true, numberOfLines: 2 })
                        )
                    ) : (loading ? React.createElement(View, { style: styles.loadingBox },
                        React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" }),
                        React.createElement(Text, { style: styles.loadingText }, "Menghitung Ringkasan...")
                    ) : React.createElement(View, null,
                        React.createElement(View, { style: styles.summaryGrid },
                            React.createElement(View, { style: styles.summaryItem },
                                React.createElement(Text, { style: styles.summaryLabel }, "TUNAI (SISTEM)"),
                                React.createElement(Text, { style: styles.summaryValue }, formatCurrency(closingData ? closingData.cash_sales : 0))
                            ),
                            React.createElement(View, { style: [styles.summaryItem, { marginLeft: 10 }] },
                                React.createElement(Text, { style: styles.summaryLabel }, "MODAL AWAL"),
                                React.createElement(Text, { style: styles.summaryValue }, formatCurrency(session ? session.starting_cash : 0))
                            )
                        ),
                        React.createElement(View, { style: styles.expectedBox },
                            React.createElement(Text, { style: styles.expectedLabel }, "TOTAL (TUNAI+SISTEM)"),
                            React.createElement(Text, { style: styles.expectedValue }, formatCurrency(closingData ? closingData.expected_cash : 0))
                        ),
                        React.createElement(View, { style: styles.actualSection },
                            React.createElement(Text, { style: styles.label }, "TOTAL UANG TUNAI DI LACI"),
                            React.createElement(TextInput, { style: styles.actualInput, placeholder: "0", value: actualCash, onChangeText: setActualCash, keyboardType: "numeric", autoFocus: true }),
                            React.createElement(Text, { style: styles.hint }, "* Masukkan total uang fisik termasuk modal awal")
                        ),
                        actualCash !== '' ? React.createElement(View, { style: [styles.diffBox, { backgroundColor: diffVal === 0 ? '#f0fdf4' : '#fef2f2' }] },
                            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                                React.createElement(Text, { style: { fontSize: 16 } }, diffVal === 0 ? "\u2705" : "\u26A0\uFE0F"),
                                React.createElement(Text, { style: [styles.diffLabel, { marginLeft: 6 }] }, "Selisih Kas")
                            ),
                            React.createElement(Text, { style: [styles.diffValue, { color: diffVal === 0 ? '#16a34a' : '#ef4444' }] }, formatCurrency(diffVal))
                        ) : null
                    ))
                ),
                React.createElement(View, { style: styles.footer },
                    mode !== 'open' ? React.createElement(TouchableOpacity, { style: styles.summaryBtn, onPress: function() { setShowFullSummary(true); }, disabled: loading },
                        React.createElement(Text, { style: { fontSize: 18 } }, "\uD83D\uDCC4"),
                        React.createElement(Text, { style: [styles.summaryBtnText, { marginLeft: 6 }] }, "Lihat Detail")
                    ) : null,
                    React.createElement(TouchableOpacity, { style: [styles.cancelButton, { marginLeft: mode !== 'open' ? 10 : 0 }], onPress: onClose, disabled: loading },
                        React.createElement(Text, { style: styles.cancelBtnText }, "Batal")
                    ),
                    React.createElement(TouchableOpacity, { style: [styles.confirmButton, { backgroundColor: mode === 'open' ? '#16a34a' : '#ea580c', marginLeft: 10 }, loading ? styles.disabledButton : null], onPress: mode === 'open' ? handleOpenSession : handleCloseSession, disabled: loading },
                        loading ? React.createElement(ActivityIndicator, { color: "white", size: "small" }) : React.createElement(Text, { style: styles.confirmBtnText }, mode === 'open' ? 'Buka Shift' : 'Tutup Shift')
                    )
                )
            )
        ),
        React.createElement(CashierClosingSummaryModal, {
            visible: showFullSummary,
            onClose: function() { setShowFullSummary(false); },
            data: closingData ? {
                cash_sales: closingData.cash_sales,
                non_cash_sales: closingData.non_cash_sales,
                cash_refunds: closingData.cash_refunds,
                cash_expenses: closingData.cash_expenses,
                cash_topups: closingData.cash_topups,
                total_sales: closingData.total_sales,
                total_tax: closingData.total_tax,
                total_discount: closingData.total_discount,
                total_orders: closingData.total_orders,
                expected_cash: closingData.expected_cash,
                payment_summary: closingData.payment_summary,
                category_summary: closingData.category_summary,
                product_summary: closingData.product_summary,
                starting_cash: parseFloat(session ? session.starting_cash : 0) || 0,
                actual_cash: parseFloat(actualCash) || 0,
                difference: (parseFloat(actualCash) || 0) - (closingData ? closingData.expected_cash : 0),
                employee_name: session ? session.employee_name : '',
                opened_at: session ? session.opened_at : ''
            } : null,
            loading: loading,
            onPrint: handlePrintSummary
        })
    );
}

var styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    container: { backgroundColor: 'white', borderRadius: 28, width: '100%', maxWidth: 450, maxHeight: '85%', overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    subtitle: { fontSize: 12, color: '#64748b', marginTop: 1 },
    closeBtn: { padding: 6 },
    content: { padding: 20 },
    inputSection: { },
    label: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14 },
    input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b', fontWeight: '600' },
    textArea: { textAlignVertical: 'top', minHeight: 60, paddingHorizontal: 14, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    loadingBox: { padding: 30, alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontWeight: '600' },
    summaryGrid: { flexDirection: 'row', marginBottom: 10 },
    summaryItem: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    summaryLabel: { fontSize: 10, color: '#64748b', fontWeight: '700', marginBottom: 2 },
    summaryValue: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
    expectedBox: { backgroundColor: '#fff7ed', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#ffedd5', marginBottom: 16 },
    expectedLabel: { fontSize: 10, fontWeight: '800', color: '#c2410c', letterSpacing: 0.5, marginBottom: 2 },
    expectedValue: { fontSize: 20, fontWeight: '900', color: '#ea580c' },
    actualSection: { marginBottom: 12 },
    actualInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, fontSize: 24, fontWeight: '900', color: '#1e293b', textAlign: 'center' },
    hint: { fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
    diffBox: { padding: 12, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    diffLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
    diffValue: { fontSize: 14, fontWeight: '800' },
    footer: { flexDirection: 'row', padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc' },
    summaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    summaryBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    cancelButton: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
    cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    confirmButton: { flex: 1.5, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    confirmBtnText: { fontWeight: '800', color: 'white', fontSize: 14 },
    disabledButton: { opacity: 0.5, elevation: 0 }
});
