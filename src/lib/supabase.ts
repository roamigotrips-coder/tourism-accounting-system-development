import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://rwlzliiofhwycsvuttei.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bHpsaWlvZmh3eWNzdnV0dGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjE4NTMsImV4cCI6MjA4OTIzNzg1M30.qU0ZJmA1XwFsE-vAJAfzW4Hi12-Cn5fchoIkZb9JXfE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
