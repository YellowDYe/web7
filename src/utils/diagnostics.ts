import { supabase } from '../config/supabase';

export interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export const runDiagnostics = async (): Promise<DiagnosticResult[]> => {
  const results: DiagnosticResult[] = [];

  console.log('[Diagnostics] Starting comprehensive diagnostic checks...');

  results.push({
    name: 'Environment Variables',
    status: import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? 'pass' : 'fail',
    message: import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
      ? 'Environment variables are configured'
      : 'Environment variables are missing',
    details: `URL: ${import.meta.env.VITE_SUPABASE_URL || 'Missing'}`
  });

  try {
    console.log('[Diagnostics] Testing basic connectivity via REST API...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const restUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`;
    const response = await fetch(restUrl, {
      method: 'HEAD',
      signal: controller.signal,
      credentials: 'omit',
      mode: 'cors',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });

    clearTimeout(timeoutId);

    results.push({
      name: 'Network Connectivity',
      status: response.ok || response.status === 404 ? 'pass' : 'warning',
      message: `Supabase REST API is ${response.ok || response.status === 404 ? 'reachable' : 'responding with errors'}`,
      details: `HTTP Status: ${response.status} (404 is OK - means API is accessible)`
    });
  } catch (error) {
    results.push({
      name: 'Network Connectivity',
      status: 'fail',
      message: 'Cannot reach Supabase REST API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  try {
    console.log('[Diagnostics] Testing authentication status...');
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError) {
      results.push({
        name: 'Authentication',
        status: 'warning',
        message: 'Auth check failed',
        details: authError.message
      });
    } else {
      results.push({
        name: 'Authentication',
        status: 'pass',
        message: session ? 'User is authenticated' : 'No active session (expected for public pages)',
        details: session ? `User ID: ${session.user.id}` : 'Anonymous access'
      });
    }
  } catch (error) {
    results.push({
      name: 'Authentication',
      status: 'fail',
      message: 'Auth check error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  try {
    console.log('[Diagnostics] Testing database query (cms_pages count)...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const queryPromise = supabase
      .from('cms_pages')
      .select('count', { count: 'exact', head: true });

    const { count, error: queryError } = await Promise.race([
      queryPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timed out after 10s')), 10000)
      )
    ]);

    clearTimeout(timeoutId);

    if (queryError) {
      results.push({
        name: 'Database Query',
        status: 'fail',
        message: 'Failed to query cms_pages table',
        details: queryError.message
      });
    } else {
      results.push({
        name: 'Database Query',
        status: 'pass',
        message: `Successfully queried cms_pages table`,
        details: `Found ${count || 0} pages`
      });
    }
  } catch (error) {
    results.push({
      name: 'Database Query',
      status: 'fail',
      message: 'Database query failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  try {
    console.log('[Diagnostics] Testing RLS policies...');
    const { data, error: rlsError } = await supabase
      .from('cms_pages')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (rlsError) {
      results.push({
        name: 'RLS Policies',
        status: 'fail',
        message: 'RLS policy check failed',
        details: rlsError.message
      });
    } else {
      results.push({
        name: 'RLS Policies',
        status: 'pass',
        message: 'RLS policies allow read access',
        details: data ? 'Successfully read sample record' : 'No records found but RLS allows access'
      });
    }
  } catch (error) {
    results.push({
      name: 'RLS Policies',
      status: 'fail',
      message: 'RLS check error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  console.log('[Diagnostics] Diagnostic checks complete:', results);
  return results;
};
