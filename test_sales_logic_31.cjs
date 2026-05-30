const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uznrwhvczihnrzmlcrif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bnJ3aHZjemlobnJ6bWxjcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDgzODMsImV4cCI6MjA4NDM4NDM4M30.r-ZO80J7jMTLO6n3Hy40fP5jiYIFcyE5Sl3xry2znIg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const thirtyOneDaysAgo = new Date();
  thirtyOneDaysAgo.setDate(today.getDate() - 30);
  thirtyOneDaysAgo.setHours(0, 0, 0, 0);

  let allData = [];
  let offset = 0;
  let hasMore = true;

  while(hasMore) {
    const res = await fetch(`${supabaseUrl}/rest/v1/sales?select=total_amount,status,date,branch_id&offset=${offset}&limit=1000`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < 1000) hasMore = false;
      else offset += 1000;
    }
  }

  const filtered = allData.filter(s => {
      const d = new Date(s.date);
      return d >= thirtyOneDaysAgo && d <= today;
  });
  
  let total = 0;
  let count = 0;
  for (const s of filtered) {
    if (s.branch_id === 7 && s.status !== 'Returned') {
       total += s.total_amount;
       count++;
    }
  }
  
  console.log(`Total 31 days: ${total} from ${count} sales.`);
}
run();
