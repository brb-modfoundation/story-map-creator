// Supabase client — shared across all pages
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ifwmzmcnozyyavjjyqrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmd216bWNub3p5eWF2amp5cXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzc3MTgsImV4cCI6MjA5NjgxMzcxOH0.CvZI_3sqAhGy5iyQU3qQvEo3eGOfcHgzeZRvcRGHUTA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}
