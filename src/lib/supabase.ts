import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kzbkebzlbiakwfdsrttz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6YmtlYnpsYmlha3dmZHNydHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc2NTAsImV4cCI6MjEwMjA0MzY1MH0.dpJK5MT-jSQMLyf_Q0-iLpC_KkePuDxcDluLtvMU-ps';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
