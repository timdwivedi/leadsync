const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://jawxwcqvjztwyakrokwd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphd3h3Y3F2anp0d3lha3Jva3dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzIyNzEsImV4cCI6MjA4ODkwODI3MX0.S2YyspaZEa1c4d8cX_BUBSHtaiHOfIIaqtaVMBZLtAI'
);

async function run() {
  console.log('Signing up admin...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'admin@leadscraper.com',
    password: 'SuperSecretPassword123!',
  });
  
  if (authError && !authError.message.includes('User already registered')) {
    console.error('Auth error:', authError.message);
  }

  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@leadscraper.com',
    password: 'SuperSecretPassword123!'
  });

  if (loginErr) {
    console.error('Login error:', loginErr.message);
    return;
  }

  const userId = loginData.user.id;
  console.log('Logged in! User ID:', userId);

  const configStr = fs.readFileSync('config.json', 'utf8');
  const config = JSON.parse(configStr);

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      apify_key: config.apify_key,
      openai_key: config.openai_key,
      anthropic_key: config.anthropic_key,
      prospeo_key: config.prospeo_key,
      personalization_prompt: config.personalization_prompt
    })
    .eq('id', userId);

  if (updateErr) console.error('Profile update error:', updateErr.message);
  else console.log('Successfully synced local config to Supabase profile!');
}

run();
