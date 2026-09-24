CREATE POLICY "Upload own material files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Read approved or own material files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'materials' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.materials m WHERE m.file_path = storage.objects.name AND m.status = 'approved')
  )
);

CREATE POLICY "Delete own or staff material files" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'materials' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())
  )
);