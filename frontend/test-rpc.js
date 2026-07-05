import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Calling performance_dashboard_rpc...");
const { data, error } = await supabase.rpc('performance_dashboard_rpc', {
  p_month_year: '2026-05', // Try a valid month
});

if (error) {
  console.error("RPC Error Details:", JSON.stringify(error, null, 2));
} else {
  console.log("Success! Data preview:", JSON.stringify(data).substring(0, 200));
}
