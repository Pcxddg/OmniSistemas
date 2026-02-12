
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCashRegister() {
    console.log('--- STRICT DEBUGGING---');

    // 1. Fetch Register
    console.log('1. Fetching latest register...');
    const { data: registers, error: regError } = await supabase
        .from('cash_registers')
        .select('*')
        .not('opening_time', 'is', null)
        .order('opening_time', { ascending: false })
        .limit(1);

    if (regError) {
        console.error('Register Fetch Error:', regError);
        return;
    }

    if (!registers || registers.length === 0) {
        console.error('No registers found!');
        return;
    }

    const reg = registers[0];
    console.log('Found Register:', reg.id, 'Status:', reg.status, 'Opened:', reg.opening_time);

    // 2. Fetch RPC Totals
    console.log('2. Calling RPC get_cash_register_totals...');
    const { data: totalsData, error: rpcError } = await supabase
        .rpc('get_cash_register_totals', { p_register_id: reg.id });

    if (rpcError) {
        console.error('RPC Error:', rpcError);
    } else {
        console.log('RPC Response:', JSON.stringify(totalsData, null, 2));
    }
}

debugCashRegister();
