// Supabase client — shared across all pages
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ifwmzmcnozyyavjjyqrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmd216bWNub3p5eWF2amp5cXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzc3MTgsImV4cCI6MjA5NjgxMzcxOH0.CvZI_3sqAhGy5iyQU3qQvEo3eGOfcHgzeZRvcRGHUTA';

export { SUPABASE_URL };
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Upload a dataset file to the 'datasets' storage bucket; returns its public URL
export async function uploadDataset(file, userId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('datasets').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('datasets').getPublicUrl(path);
  return data.publicUrl;
}

export function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}
