const { createClient } = require('@supabase/supabase-client');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('products').select('id, name, stock').eq('name', 'Air Mineral 600 mL');
  console.log(JSON.stringify(data, null, 2));
}
check();
