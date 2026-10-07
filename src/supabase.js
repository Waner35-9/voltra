import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://bsyvuygsdweppcgxzjkb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzeXZ1eWdzZHdlcHBjZ3h6amtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njk1NzUsImV4cCI6MjA5MDQ0NTU3NX0.HWQPp4W089rGUM_ysfe8rqNk9L6LhJHWaUrVzcNbzb0"
);
