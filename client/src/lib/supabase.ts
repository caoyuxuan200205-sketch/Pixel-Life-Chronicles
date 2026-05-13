import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 增加安全校验，防止环境变量缺失导致黑屏
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 环境变量缺失！请检查 .env 文件。身份验证功能将暂时失效。');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
