
-- =====================================================================
-- 1. data_access_log: scope admin SELECT to the row's own team
-- =====================================================================
DROP POLICY IF EXISTS "Team admins can view their team's access log" ON public.data_access_log;
CREATE POLICY "Team admins can view their team's access log"
ON public.data_access_log
FOR SELECT
TO authenticated
USING (
  team_id IS NOT NULL
  AND public.is_team_admin(auth.uid(), team_id)
);

-- =====================================================================
-- 2. data_subject_requests: scope admin SELECT + INSERT to their team
-- =====================================================================
DROP POLICY IF EXISTS "Team admins can view their team's DSRs" ON public.data_subject_requests;
CREATE POLICY "Team admins can view their team's DSRs"
ON public.data_subject_requests
FOR SELECT
TO authenticated
USING (
  team_id IS NOT NULL
  AND public.is_team_admin(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Subjects and team admins can open requests" ON public.data_subject_requests;
CREATE POLICY "Subjects and team admins can open requests"
ON public.data_subject_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requester_user_id = auth.uid()
  AND (
    subject_user_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_admin(auth.uid(), team_id))
  )
);

-- =====================================================================
-- 3. customer-documents storage bucket: path-scoped to uploader
--    Convention (already used by app): `${auth.uid()}/${customer_id}/...`
--    Direct bucket access is uploader-only. Cross-tenant viewing is done
--    via server-issued signed URLs which bypass RLS.
-- =====================================================================
DROP POLICY IF EXISTS "Users can view their customer documents" ON storage.objects;
CREATE POLICY "Users can view their customer documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can upload customer documents" ON storage.objects;
CREATE POLICY "Users can upload customer documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their customer documents" ON storage.objects;
CREATE POLICY "Users can update their customer documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their customer documents" ON storage.objects;
CREATE POLICY "Users can delete their customer documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================================
-- 4. message-attachments storage bucket: conversation-scoped
--    Convention (buildMessageAttachmentPath):
--      `${conversation_id}/${user_id}/${ts}-${filename}`
--    SELECT: requester must be a member of the conversation
--    INSERT: requester must be a member AND must own the user_id folder
-- =====================================================================
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON storage.objects;
CREATE POLICY "Users can view attachments in their conversations"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Members can upload attachments to their conversations"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
  )
);
