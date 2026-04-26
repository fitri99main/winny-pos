import { supabase } from './supabase';

const PETTY_CASH_SCHEMA_MESSAGE = 'Modul Kas Kecil belum aktif di database. Jalankan `petty_cash_schema.sql` di Supabase SQL Editor, lalu coba lagi.';

type PettyCashErrorLike = {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
};

export function isPettyCashSchemaMissingError(error: unknown) {
    if (!error || typeof error !== 'object') return false;

    const { code, message = '', details = '', hint = '' } = error as PettyCashErrorLike;
    const combined = `${message} ${details} ${hint}`;

    return code === 'PGRST205' ||
        code === '42P01' ||
        (
            /petty_cash_(sessions|transactions)/i.test(combined) &&
            /(schema cache|does not exist|could not find the table|relation)/i.test(combined)
        );
}

export function getPettyCashErrorMessage(error: unknown, fallback = 'Terjadi kesalahan pada modul Kas Kecil.') {
    if (isPettyCashSchemaMissingError(error)) {
        return PETTY_CASH_SCHEMA_MESSAGE;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return (error as { message: string }).message;
    }

    return fallback;
}

function wrapPettyCashError(error: unknown, fallback?: string) {
    const message = getPettyCashErrorMessage(error, fallback);

    if (error instanceof Error && error.message === message) {
        return error;
    }

    const wrapped = new Error(message);

    if (error && typeof error === 'object') {
        Object.assign(wrapped, {
            code: (error as PettyCashErrorLike).code,
            details: (error as PettyCashErrorLike).details,
            hint: (error as PettyCashErrorLike).hint,
        });
    }

    return wrapped;
}

export interface PettyCashSession {
    id: number;
    date: string;
    branch_id: string;
    opening_balance: number;
    expected_balance: number;
    actual_closing_balance?: number;
    status: 'open' | 'closed';
    created_at: string;
    created_by?: string;
    closed_at?: string;
}

export interface PettyCashTransaction {
    id: number;
    session_id: number;
    type: 'TOPUP' | 'SPEND';
    amount: number;
    description: string;
    reference_type?: string;
    reference_id?: string;
    created_at: string;
}

export const PettyCashService = {
    async getActiveSession(branchId: string) {
        const { data, error } = await supabase
            .from('petty_cash_sessions')
            .select('*')
            .eq('branch_id', branchId)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (error) throw wrapPettyCashError(error, 'Gagal memuat sesi Kas Kecil aktif.');
        return (data && data.length > 0) ? (data[0] as PettyCashSession) : null;
    },

    async getSessions(branchId: string, limit = 10) {
        const { data, error } = await supabase
            .from('petty_cash_sessions')
            .select('*')
            .eq('branch_id', branchId)
            .order('date', { ascending: false })
            .limit(limit);
        
        if (error) throw wrapPettyCashError(error, 'Gagal memuat riwayat Kas Kecil.');
        return data as PettyCashSession[];
    },

    async getTransactions(sessionId: number) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });
        
        if (error) throw wrapPettyCashError(error, 'Gagal memuat transaksi Kas Kecil.');
        return data as PettyCashTransaction[];
    },

    async openSession(branchId: string, openingBalance: number, userId?: string) {
        const today = new Date().toISOString().split('T')[0];
        
        // Check if ANY session is still open for this branch
        const { data: existing, error: existingError } = await supabase
            .from('petty_cash_sessions')
            .select('id, date')
            .eq('branch_id', branchId)
            .eq('status', 'open')
            .limit(1);

        if (existingError) {
            throw wrapPettyCashError(existingError, 'Gagal memeriksa sesi Kas Kecil aktif.');
        }

        if (existing && existing.length > 0) {
            throw new Error(`Terdapat saldo aktif yang belum ditutup (Tanggal: ${existing[0].date}). Tutup saldo tersebut terlebih dahulu.`);
        }

        const { data, error } = await supabase
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
        
        if (error) throw wrapPettyCashError(error, 'Gagal membuka sesi Kas Kecil.');

        // Record opening as first transaction
        await this.addTransaction({
            session_id: data.id,
            type: 'TOPUP',
            amount: openingBalance,
            description: 'Saldo Awal',
            reference_type: 'opening'
        });

        return data as PettyCashSession;
    },

    async closeSession(sessionId: number, actualBalance: number) {
        const { data, error } = await supabase
            .from('petty_cash_sessions')
            .update({
                actual_closing_balance: actualBalance,
                status: 'closed',
                closed_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select()
            .single();
        
        if (error) throw wrapPettyCashError(error, 'Gagal menutup sesi Kas Kecil.');
        return data as PettyCashSession;
    },

    async addTransaction(transaction: Partial<PettyCashTransaction>) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .insert([transaction])
            .select()
            .single();
        
        if (error) throw wrapPettyCashError(error, 'Gagal menyimpan transaksi Kas Kecil.');
        return data as PettyCashTransaction;
    },

    async setBalance(sessionId: number, currentExpected: number, newReal: number) {
        const diff = newReal - currentExpected;
        if (diff === 0) return;

        return this.addTransaction({
            session_id: sessionId,
            type: diff > 0 ? 'TOPUP' : 'SPEND',
            amount: Math.abs(diff),
            description: 'Penyesuaian Saldo Real',
            reference_type: 'correction'
        });
    },

    async updateTransaction(id: number, updates: Partial<PettyCashTransaction>) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw wrapPettyCashError(error, 'Gagal memperbarui transaksi Kas Kecil.');
        return data as PettyCashTransaction;
    },

    async deleteTransaction(id: number) {
        const { error } = await supabase
            .from('petty_cash_transactions')
            .delete()
            .eq('id', id);
        
        if (error) throw wrapPettyCashError(error, 'Gagal menghapus transaksi Kas Kecil.');
        return true;
    },

    async deleteSession(id: number) {
        const { error } = await supabase
            .from('petty_cash_sessions')
            .delete()
            .eq('id', id);
        
        if (error) throw wrapPettyCashError(error, 'Gagal menghapus sesi Kas Kecil.');
        return true;
    }
};
