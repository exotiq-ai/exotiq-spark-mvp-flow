-- Increase vehicle-photos bucket file size limit to 50MB
UPDATE storage.buckets 
SET file_size_limit = 52428800  -- 50 MB (52,428,800 bytes)
WHERE name = 'vehicle-photos';