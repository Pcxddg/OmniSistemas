import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://alcgeficxobsegeycrtu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsY2dlZmljeG9ic2VnZXljcnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTA2NTgsImV4cCI6MjA4NjA4NjY1OH0.3HfFMgCdI2HscBDBxm8w2u2sYhi0lLa1PRZUePD3qb4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
