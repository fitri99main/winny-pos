
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkUser() {
    console.log('Searching for user: kasir02@winny.com');
    // Auth users can only be checked via admin API usually, but we can check profiles
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', 'kasir02@winny.com');

    if (error) {
        console.error('Error fetching profile:', error);
    } else {
        console.log('Profiles found:', profiles);
        if (profiles.length > 0) {
            const profile = profiles[0];
            console.log('Checking role:', profile.role);
            if (profile.role) {
                const { data: role, error: roleError } = await supabase
                    .from('roles')
                    .select('*')
                    .ilike('name', profile.role.trim());
                console.log('Role data:', role || roleError);
            }
        }
    }
}

checkUser();
