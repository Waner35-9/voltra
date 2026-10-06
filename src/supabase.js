import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://fhibwfkedbblrboxxozd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoaWJ3ZmtlZGJibHJib3h4b3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzc5MjgsImV4cCI6MjA4OTg1MzkyOH0.o-mvV5veRasmjcCW0jV8SfkDY3MbHqAdO5zg2fzQS4w"
);
