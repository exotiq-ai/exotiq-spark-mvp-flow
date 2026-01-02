# 🔍 TEAM MESSAGING - DEBUG & FIX GUIDE

**Date:** January 2, 2026  
**Status:** 🔴 **CRITICAL BUG** - Conversation Creation Failing  
**Error:** `Error fetching conversations` (useTeamMessaging.ts:212)

---

## 🚨 PROBLEM ANALYSIS

### Symptoms
1. ❌ Direct message creation fails
2. ❌ Group conversation creation fails
3. ❌ Error in console: "Error fetching conversations"
4. ⚠️ Line 212 in `useTeamMessaging.ts`

### Root Cause Hypothesis
Based on migration history, there were **RLS policy infinite recursion issues** that were fixed in multiple migrations:
- `20251225054044` - Fixed recursive policies
- `20251225055808` - Simplified policies (LATEST)

**Likely Issues:**
1. **Database not up-to-date** - Latest migrations not applied
2. **Missing profiles** - New users don't have profile entries
3. **Team member data missing** - Users not in team_members query
4. **RLS blocking member inserts** - Policies too restrictive

---

## 🔧 IMMEDIATE FIX: Enhanced Error Logging

### Step 1: Add Detailed Error Logging

**File:** `src/hooks/useTeamMessaging.ts`

**Replace lines 351-418 with:**

```typescript
// Create new conversation
const createConversation = useCallback(async (
  type: 'direct' | 'group' | 'channel',
  memberIds: string[],
  name?: string,
  description?: string,
  isCompanyWide = false
) => {
  if (!user) {
    console.error('[Messaging] ❌ No user authenticated');
    return null;
  }

  console.log('[Messaging] 🚀 Creating conversation:', {
    type,
    memberIds,
    name,
    isCompanyWide,
    currentUserId: user.id
  });

  try {
    // For direct messages, check if conversation already exists
    if (type === 'direct' && memberIds.length === 1) {
      const existingConv = conversations.find(c => 
        c.type === 'direct' && 
        c.members?.some(m => m.user_id === memberIds[0])
      );
      if (existingConv) {
        console.log('[Messaging] ✅ Found existing DM');
        setActiveConversation(existingConv);
        return existingConv;
      }
    }

    // Step 1: Create conversation
    console.log('[Messaging] Step 1: Creating conversation record...');
    const { data: conv, error: convError } = await supabase
      .from('team_conversations')
      .insert({
        name: name || null,
        description: description || null,
        type,
        is_company_wide: isCompanyWide,
        created_by: user.id,
      })
      .select()
      .single();

    if (convError) {
      console.error('[Messaging] ❌ Conversation creation failed:', convError);
      console.error('[Messaging] Error details:', {
        code: convError.code,
        message: convError.message,
        details: convError.details,
        hint: convError.hint
      });
      throw convError;
    }

    console.log('[Messaging] ✅ Conversation created:', conv.id);

    // Step 2: Add creator as admin
    console.log('[Messaging] Step 2: Adding creator as admin...');
    const { error: creatorError } = await supabase
      .from('conversation_members')
      .insert({
        conversation_id: conv.id,
        user_id: user.id,
        role: 'admin',
      });

    if (creatorError) {
      console.error('[Messaging] ❌ Failed to add creator:', creatorError);
      console.error('[Messaging] Error details:', {
        code: creatorError.code,
        message: creatorError.message,
        details: creatorError.details,
        hint: creatorError.hint
      });
      
      // Rollback: Delete the conversation
      await supabase
        .from('team_conversations')
        .delete()
        .eq('id', conv.id);
      
      throw creatorError;
    }

    console.log('[Messaging] ✅ Creator added as admin');

    // Step 3: Add other members
    console.log('[Messaging] Step 3: Adding members...', memberIds);
    const memberInserts = memberIds
      .filter(id => id !== user.id)
      .map(id => ({
        conversation_id: conv.id,
        user_id: id,
        role: 'member',
      }));

    if (memberInserts.length > 0) {
      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert(memberInserts);

      if (membersError) {
        console.error('[Messaging] ⚠️ Failed to add some members:', membersError);
        console.error('[Messaging] Error details:', {
          code: membersError.code,
          message: membersError.message,
          details: membersError.details,
          hint: membersError.hint,
          attemptedInserts: memberInserts
        });
        
        // Don't rollback - conversation is created, just missing members
        toast.error('Conversation created but some members could not be added');
      } else {
        console.log('[Messaging] ✅ All members added');
      }
    }

    // Step 4: Refresh conversations
    console.log('[Messaging] Step 4: Refreshing conversation list...');
    await fetchConversations();

    const newConv = conversations.find(c => c.id === conv.id) || conv as Conversation;
    setActiveConversation(newConv);
    
    console.log('[Messaging] ✅ Conversation creation complete!');
    toast.success('Conversation created successfully');
    
    return newConv;

  } catch (error: any) {
    console.error('[Messaging] ❌ Conversation creation failed:', error);
    console.error('[Messaging] Stack trace:', error.stack);
    
    toast.error(`Failed to create conversation: ${error.message || 'Unknown error'}`);
    return null;
  }
}, [user, conversations, fetchConversations]);
```

---

## 🔍 DIAGNOSTIC QUERIES

### Run these in Supabase SQL Editor to diagnose:

### 1. Check if migrations are applied:
```sql
SELECT version, name, executed_at 
FROM supabase_migrations.schema_migrations 
WHERE name LIKE '%conversation%' 
   OR name LIKE '%messaging%'
ORDER BY executed_at DESC;
```

### 2. Check current RLS policies:
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('team_conversations', 'conversation_members')
ORDER BY tablename, cmd;
```

### 3. Test conversation creation manually:
```sql
-- Replace YOUR_USER_ID with actual UUID
BEGIN;

-- Try creating a conversation
INSERT INTO public.team_conversations (name, type, created_by)
VALUES ('Test Conversation', 'group', 'YOUR_USER_ID')
RETURNING *;

-- Try adding member (use the conversation_id from above)
INSERT INTO public.conversation_members (conversation_id, user_id, role)
VALUES ('CONVERSATION_ID_FROM_ABOVE', 'YOUR_USER_ID', 'admin')
RETURNING *;

-- If successful, rollback (or COMMIT if you want to keep it)
ROLLBACK;
```

### 4. Check if user has profile:
```sql
-- Replace YOUR_USER_ID
SELECT 
  u.id as user_id,
  u.email,
  p.id as profile_id,
  p.full_name,
  p.onboarding_completed
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.id = 'YOUR_USER_ID';
```

### 5. Check team members:
```sql
-- See all users who could be added to conversations
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.created_at
FROM public.profiles p
WHERE p.onboarding_completed = true
ORDER BY p.created_at DESC;
```

---

## 🛠️ POTENTIAL FIXES

### Fix 1: Ensure User Has Profile

**Problem:** New users may not have profile entries

**Solution:** Create trigger to auto-create profile

```sql
-- Migration: 20260102000001_ensure_profile_creation.sql

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile if it doesn't exist
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on user creation
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill existing users without profiles
INSERT INTO public.profiles (id, email, full_name)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

---

### Fix 2: Simplify RLS Policies (If still having issues)

**Problem:** RLS policies too restrictive

**Solution:** Temporarily allow all authenticated users

```sql
-- Migration: 20260102000002_relax_conversation_policies.sql

-- Drop existing policies
DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;

-- Allow any authenticated user to add members to conversations they create
CREATE POLICY "conversation_members_insert"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Always allow if user is adding to their own created conversation
  EXISTS (
    SELECT 1 FROM public.team_conversations tc 
    WHERE tc.id = conversation_id 
    AND tc.created_by = auth.uid()
  )
  -- OR user is adding themselves
  OR user_id = auth.uid()
);
```

---

### Fix 3: Add Retry Logic to Hook

**Problem:** Race conditions or timing issues

**Solution:** Add exponential backoff retry

```typescript
// src/hooks/useTeamMessaging.ts

const createConversationWithRetry = async (
  type: 'direct' | 'group' | 'channel',
  memberIds: string[],
  name?: string,
  description?: string,
  isCompanyWide = false,
  retries = 3
): Promise<Conversation | null> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Messaging] Attempt ${attempt}/${retries}`);
      const result = await createConversation(type, memberIds, name, description, isCompanyWide);
      
      if (result) {
        return result;
      }
      
      // If null result but no error, wait and retry
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
        console.log(`[Messaging] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`[Messaging] Attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry
      const delay = Math.pow(2, attempt) * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
};
```

---

## 🧪 TESTING PROCEDURE

### Step 1: Enable Enhanced Logging
1. Apply the enhanced error logging code above
2. Refresh the application
3. Open browser DevTools Console

### Step 2: Attempt Conversation Creation
1. Click "New Message" button
2. Select "Direct Message"
3. Choose a team member
4. Click "Create"
5. **Watch the console for detailed logs**

### Step 3: Check Console Output

**Expected Success Pattern:**
```
[Messaging] 🚀 Creating conversation: {...}
[Messaging] Step 1: Creating conversation record...
[Messaging] ✅ Conversation created: abc-123-def
[Messaging] Step 2: Adding creator as admin...
[Messaging] ✅ Creator added as admin
[Messaging] Step 3: Adding members...
[Messaging] ✅ All members added
[Messaging] Step 4: Refreshing conversation list...
[Messaging] ✅ Conversation creation complete!
```

**Error Pattern to Look For:**
```
[Messaging] ❌ Conversation creation failed: {...}
[Messaging] Error details: {
  code: "42501",  // ← PostgreSQL error code
  message: "...", // ← Human-readable error
  details: "...", // ← Additional context
  hint: "..."     // ← Suggested fix
}
```

### Step 4: Interpret Error Codes

| Error Code | Meaning | Fix |
|------------|---------|-----|
| `42501` | Insufficient privilege (RLS block) | Apply Fix 2 (RLS) |
| `23503` | Foreign key violation | Apply Fix 1 (Profile) |
| `23505` | Unique violation | User already in conversation |
| `42P01` | Table doesn't exist | Run migrations |
| `42703` | Column doesn't exist | Run migrations |

---

## 🚀 QUICK START: APPLY FIXES

### 1. Apply Enhanced Logging (Do this first!)
```bash
# Edit src/hooks/useTeamMessaging.ts and replace createConversation function
# with the enhanced version above
```

### 2. Apply Database Fixes
```bash
# Apply profile creation fix
npx supabase db push --linked

# Or manually via Supabase SQL Editor:
# Copy-paste Fix 1 SQL code
```

### 3. Test Thoroughly
```bash
# Start dev server
npm run dev

# Test scenarios:
# 1. Create DM with existing user
# 2. Create group with 3+ users
# 3. Create channel
# 4. Send messages
# 5. Test @mentions
```

---

## 📊 SUCCESS METRICS

### Before Fix:
- ❌ 0% conversation creation success rate
- ❌ Console errors visible
- ❌ Users cannot communicate

### After Fix:
- ✅ 100% conversation creation success rate
- ✅ Clean console (no errors)
- ✅ Messages sending successfully
- ✅ @mentions working
- ✅ File attachments working

---

## 🔗 RELATED FILES

### Code Files:
- `src/hooks/useTeamMessaging.ts` (lines 351-418) - Main logic
- `src/components/messaging/TeamMessaging.tsx` - UI component
- `src/components/messaging/NewConversationDialog.tsx` - Creation UI
- `src/components/messaging/MessageThread.tsx` - Message display

### Database Files:
- `supabase/migrations/20251225041305_aa0567bd-a0b6-4333-b2cf-edfefc51493a.sql` - Original schema
- `supabase/migrations/20251225055808_f635fc4e-501a-4c30-a347-21b430c60306.sql` - Latest RLS fixes

---

## 📞 NEED HELP?

If errors persist after applying fixes:

1. **Copy full console logs** (including error details)
2. **Run diagnostic queries** (section above)
3. **Check Supabase Dashboard**:
   - Database → Table Editor → team_conversations
   - Database → Table Editor → conversation_members
   - Authentication → Users (verify users exist)
   - Database → Policies (verify RLS policies)

4. **Share results** with error codes and logs

---

**Next Steps:**
1. Apply enhanced logging
2. Test conversation creation
3. Review console logs
4. Apply appropriate fix (1, 2, or 3)
5. Re-test and verify success

