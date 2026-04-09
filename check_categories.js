const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Try to find .env file
const envPath = path.join(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL || envConfig.NEXT_PUBLIC_SUPABASE_URL || envConfig.SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY || envConfig.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
  const { data, error } = await supabase.from('categories').select('name');
  if (error) {
    console.error(error);
  } else {
    console.log('Categories:', data.map(c => c.name));
  }
}

checkCategories();
