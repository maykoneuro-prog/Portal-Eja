import { createClient } from '@supabase/supabase-js';

// No Vite/Vercel Client-side, as variáveis DEVEM ter o prefixo VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const formatUrl = (url: string) => {
  if (!url) return '';
  let formatted = url.trim();
  // Limpeza de aspas comuns em colagens de env vars
  formatted = formatted.replace(/^["']|["']$/g, '');
  if (formatted && !formatted.startsWith('http')) {
    formatted = `https://${formatted}`;
  }
  return formatted.replace(/\/+$/, '');
};

const finalUrl = formatUrl(supabaseUrl);
const finalKey = supabaseAnonKey.trim().replace(/^["']|["']$/g, '');

export const isSupabaseConfigured = 
  finalUrl.startsWith('https://') && 
  !finalUrl.includes('missing-project-id') &&
  finalKey.length > 20;

if (isSupabaseConfigured) {
  console.log('✅ Supabase conectado em:', finalUrl.replace(/^https?:\/\//, ''));
} else {
  console.error('❌ ERRO DE CONFIGURAÇÃO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes.');
  console.info('Status das variáveis:', {
    URL: !!finalUrl ? 'Carregada (oculta)' : 'FALTANDO',
    KEY: !!finalKey ? `Carregada (${finalKey.length} chars, oculta)` : 'FALTANDO'
  });
}

// Garantimos URLs válidas syntactically para evitar crash no createClient
const fallbackUrl = 'https://missing-project-id.supabase.co';
const fallbackKey = 'missing-anon-key';

export const supabase = createClient(
  isSupabaseConfigured ? finalUrl : fallbackUrl,
  isSupabaseConfigured ? finalKey : fallbackKey
);
