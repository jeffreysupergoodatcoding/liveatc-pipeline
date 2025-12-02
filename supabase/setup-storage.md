# Supabase Storage Setup

Run these commands in the Supabase SQL Editor to set up storage buckets and policies:

## Create Storage Buckets

1. Go to Supabase Dashboard > Storage
2. Create two buckets:
   - `liveatc-raw` (for full recordings)
   - `liveatc-segments` (for individual segments)

## Storage Policies

Run this SQL to set up RLS policies:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to liveatc-segments (for playback in admin interface)
CREATE POLICY "Public read access for segments"
ON storage.objects FOR SELECT
USING (bucket_id = 'liveatc-segments');

-- Allow authenticated users to upload to liveatc-raw
CREATE POLICY "Service role upload to raw"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'liveatc-raw');

-- Allow authenticated users to upload to liveatc-segments
CREATE POLICY "Service role upload to segments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'liveatc-segments');

-- Allow service role to delete from both buckets
CREATE POLICY "Service role delete from raw"
ON storage.objects FOR DELETE
USING (bucket_id = 'liveatc-raw');

CREATE POLICY "Service role delete from segments"
ON storage.objects FOR DELETE
USING (bucket_id = 'liveatc-segments');
```

## Alternative: Create via SQL

```sql
-- Insert buckets (if using SQL instead of UI)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('liveatc-raw', 'liveatc-raw', false),
  ('liveatc-segments', 'liveatc-segments', true);
```

Note: The `liveatc-segments` bucket is public so audio can be played in the admin interface.
The `liveatc-raw` bucket is private since raw recordings are only for processing.
