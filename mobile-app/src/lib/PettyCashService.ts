import { supabase } from './supabase';

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
        
        if (error) throw error;
        return (data && data.length > 0) ? (data[0] as PettyCashSession) : null;
    },

    async getSessions(branchId: string, limit = 10) {
        const { data, error } = await supabase
            .from('petty_cash_sessions')
            .select('*')
            .eq('branch_id', branchId)
            .order('date', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data as PettyCashSession[];
    },

    async getTransactions(sessionId: number) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as PettyCashTransaction[];
    },

    async openSession(branchId: string, openingBalance: number, userId?: string) {
        const today = new Date().toISOString().split('T')[0];
        
        // Check if session already exists for today
        const { data: existing } = await supabase
            .from('petty_cash_sessions')
            .select('id')
            .eq('branch_id', branchId)
            .eq('date', today)
            .single();

        if (existing) {
            throw new Error('Sesi untuk hari ini sudah ada.');
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
        
        if (error) throw error;

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
        
        if (error) throw error;
        return data as PettyCashSession;
    },

    async addTransaction(transaction: Partial<PettyCashTransaction>) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .insert([transaction])
            .select()
            .single();
        
        if (error) throw error;
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
        
        if (error) throw error;
        return data as PettyCashTransaction;
    },

    async deleteTransaction(id: number) {
        const { error } = await supabase
            .from('petty_cash_transactions')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    },

    async deleteSession(id: number) {
        const { error } = await supabase
            .from('petty_cash_sessions')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    }
};
