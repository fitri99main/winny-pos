import * as SupabaseLib from './supabase';
var supabase = SupabaseLib.supabase;

var PETTY_CASH_SCHEMA_MESSAGE = 'Modul Kas Kecil belum aktif di database. Jalankan `petty_cash_schema.sql` di Supabase SQL Editor, lalu coba lagi.';

export function isPettyCashSchemaMissingError(error) {
    if (!error || typeof error !== 'object') return false;

    var code = error.code;
    var message = error.message || '';
    var details = error.details || '';
    var hint = error.hint || '';
    var combined = message + ' ' + details + ' ' + hint;

    return code === 'PGRST205' || 
           code === '42P01' || 
           (
             /petty_cash_(sessions|transactions)/i.test(combined) && 
             /(schema cache|does not exist|could not find the table|relation)/i.test(combined)
           );
}

export function getPettyCashErrorMessage(error, fallback) {
    if (fallback === undefined) fallback = 'Terjadi kesalahan pada modul Kas Kecil.';
    if (isPettyCashSchemaMissingError(error)) {
        return PETTY_CASH_SCHEMA_MESSAGE;
    }
    return (error && error.message) ? error.message : fallback;
}

function wrapPettyCashError(error, fallback) {
    var message = getPettyCashErrorMessage(error, fallback);
    var wrapped = new Error(message);
    if (error && typeof error === 'object') {
        wrapped.code = error.code;
        wrapped.details = error.details;
        wrapped.hint = error.hint;
    }
    return wrapped;
}

export var PettyCashService = {
    getActiveSession: function(branchId) {
        return supabase
            .from('petty_cash_sessions')
            .select('*')
            .eq('branch_id', branchId)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1)
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal memuat sesi Kas Kecil aktif.');
                var data = res.data;
                return data && data.length > 0 ? data[0] : null;
            });
    },

    getSessions: function(branchId, limit) {
        if (limit === undefined) limit = 10;
        return supabase
            .from('petty_cash_sessions')
            .select('*')
            .eq('branch_id', branchId)
            .order('date', { ascending: false })
            .limit(limit)
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal memuat riwayat Kas Kecil.');
                return res.data;
            });
    },

    getTransactions: function(sessionId) {
        return supabase
            .from('petty_cash_transactions')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal memuat transaksi Kas Kecil.');
                return res.data;
            });
    },

    openSession: function(branchId, openingBalance, userId) {
        var today = new Date().toISOString().split('T')[0];
        
        return supabase
            .from('petty_cash_sessions')
            .select('id, date')
            .eq('branch_id', branchId)
            .eq('status', 'open')
            .limit(1)
            .then(function(checkRes) {
                if (checkRes.error) {
                    throw wrapPettyCashError(checkRes.error, 'Gagal memeriksa sesi Kas Kecil aktif.');
                }
                var existing = checkRes.data;
                if (existing && existing.length > 0) {
                    throw new Error('Terdapat saldo aktif yang belum ditutup (Tanggal: ' + existing[0].date + '). Tutup saldo tersebut terlebih dahulu.');
                }

                return supabase
                    .from('petty_cash_sessions')
                    .insert([{
                        date: today,
                        branch_id: branchId,
                        opening_balance: openingBalance,
                        expected_balance: openingBalance,
                        status: 'open',
                        created_by: userId
                    }])
                    .select()
                    .single();
            })
            .then(function(insRes) {
                if (insRes.error) throw wrapPettyCashError(insRes.error, 'Gagal membuka sesi Kas Kecil.');
                var data = insRes.data;

                return PettyCashService.addTransaction({
                    session_id: data.id,
                    type: 'TOPUP',
                    amount: openingBalance,
                    description: 'Saldo Awal',
                    reference_type: 'opening'
                }).then(function() {
                    return data;
                });
            });
    },

    closeSession: function(sessionId, actualBalance) {
        return supabase
            .from('petty_cash_sessions')
            .update({
                actual_closing_balance: actualBalance,
                status: 'closed',
                closed_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select()
            .single()
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal menutup sesi Kas Kecil.');
                return res.data;
            });
    },

    addTransaction: function(transaction) {
        return supabase
            .from('petty_cash_transactions')
            .insert([transaction])
            .select()
            .single()
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal menyimpan transaksi Kas Kecil.');
                return res.data;
            });
    },

    setBalance: function(sessionId, currentExpected, newReal) {
        var diff = newReal - currentExpected;
        if (diff === 0) return Promise.resolve();

        return PettyCashService.addTransaction({
            session_id: sessionId,
            type: diff > 0 ? 'TOPUP' : 'SPEND',
            amount: Math.abs(diff),
            description: 'Penyesuaian Saldo Real',
            reference_type: 'correction'
        });
    },

    updateTransaction: function(id, updates) {
        return supabase
            .from('petty_cash_transactions')
            .update(updates)
            .eq('id', id)
            .select()
            .single()
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal memperbarui transaksi Kas Kecil.');
                return res.data;
            });
    },

    deleteTransaction: function(id) {
        return supabase
            .from('petty_cash_transactions')
            .delete()
            .eq('id', id)
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal menghapus transaksi Kas Kecil.');
                return true;
            });
    },

    deleteSession: function(id) {
        return supabase
            .from('petty_cash_sessions')
            .delete()
            .eq('id', id)
            .then(function(res) {
                if (res.error) throw wrapPettyCashError(res.error, 'Gagal menghapus sesi Kas Kecil.');
                return true;
            });
    }
};
