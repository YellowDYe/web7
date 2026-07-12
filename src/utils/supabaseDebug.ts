import { supabase } from '../config/supabase';

export const debugSupabaseConnection = async () => {
  console.log('=== SUPABASE CONNECTION DEBUG ===');

  // Check environment variables
  console.log('1. Environment Variables:');
  console.log('   VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'Set ✓' : 'Missing ✗');
  console.log('   VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set ✓' : 'Missing ✗');

  // Test direct REST API access
  console.log('\n2. Testing Direct REST API Access:');
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/cms_pages?select=count`;
    console.log('   URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      }
    });

    console.log('   Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('   Response:', text);

    if (response.ok) {
      console.log('   ✓ Direct REST API access works!');
    } else {
      console.log('   ✗ Direct REST API access failed');
    }
  } catch (error) {
    console.log('   ✗ Error:', error);
  }

  // Test Supabase client
  console.log('\n3. Testing Supabase Client:');
  try {
    const startTime = Date.now();
    const { data, error, count } = await supabase
      .from('cms_pages')
      .select('*', { count: 'exact' });
    const endTime = Date.now();

    console.log('   Query time:', endTime - startTime, 'ms');
    console.log('   Error:', error);
    console.log('   Count:', count);
    console.log('   Data sample:', data?.[0]);

    if (!error) {
      console.log('   ✓ Supabase client works!');
    } else {
      console.log('   ✗ Supabase client failed:', error.message);
    }
  } catch (error) {
    console.log('   ✗ Exception:', error);
  }

  // Test authentication status
  console.log('\n4. Authentication Status:');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('   User authenticated:', session.user.email);
    } else {
      console.log('   No active session (anonymous access)');
    }
  } catch (error) {
    console.log('   ✗ Error checking auth:', error);
  }

  console.log('\n=== END DEBUG ===');
};

// Auto-run on import in development
if (import.meta.env.DEV) {
  console.log('Running Supabase connection debug...');
  setTimeout(() => {
    debugSupabaseConnection().catch(console.error);
  }, 1000);
}
