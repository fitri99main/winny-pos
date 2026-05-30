const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';
const supabase = createClient(supabaseUrl, supabaseKey);

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function run() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    const end = new Date(now);

    const dateFilter = {
        start: formatDateForInput(start),
        end: formatDateForInput(end)
    };
    console.log("dateFilter", dateFilter);

    const queryStart = new Date(`${dateFilter.start}T00:00:00`);
    queryStart.setDate(queryStart.getDate() - 1);
    const queryEnd = new Date(`${dateFilter.end}T23:59:59.999`);
    queryEnd.setDate(queryEnd.getDate() + 1);

    console.log("queryStart", queryStart.toISOString());
    console.log("queryEnd", queryEnd.toISOString());

    let allSales = [];
    let from = 0;
    let hasMore = true;
    const pageSize = 1000;
    const currentBranchId = '7';

    while (hasMore) {
        const { data, error } = await supabase
            .from('sales')
            .select('id, total_amount, status, date, branch_id')
            .eq('branch_id', Number(currentBranchId))
            .gte('date', queryStart.toISOString())
            .lte('date', queryEnd.toISOString())
            .order('date', { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
            allSales = [...allSales, ...data];
            if (data.length < pageSize) hasMore = false;
            else from += pageSize;
        } else {
            hasMore = false;
        }
    }

    console.log("Fetched historical items:", allSales.length);

    // Apply exact filter as processedSales
    const filteredSales = allSales.filter(sale => {
        const d = new Date(sale.date);
        const saleDate = formatDateForInput(d);
        if (dateFilter.start && saleDate < dateFilter.start) return false;
        if (dateFilter.end && saleDate > dateFilter.end) return false;
        return true;
    });

    console.log("Filtered items:", filteredSales.length);

    const totalStats = filteredSales.reduce((sum, sale) => sum + (sale.status !== 'Returned' ? sale.total_amount : 0), 0);
    console.log("statsTotal with status !== 'Returned':", totalStats);

    const completedStats = filteredSales.reduce((sum, sale) => sum + (['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture', 'ready'].includes((sale.status||'').toLowerCase()) ? sale.total_amount : 0), 0);
    console.log("statsTotal with isCompletedSale:", completedStats);
}
run();
