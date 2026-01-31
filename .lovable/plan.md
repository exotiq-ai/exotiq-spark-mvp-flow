

# Fix Rari Message Persistence with Enhanced Debugging

## Problem Summary

The database shows **41 conversations created but 0 messages saved**. This confirms a persistence failure in the message saving flow.

### Root Cause Analysis

After reviewing the code, I've identified **three likely failure points**:

1. **Race Condition (Primary Suspect)**: The `startConversationDb()` call is asynchronous (line 246-255), but `onMessage` events can fire before the `.then()` callback completes. Even though we update the ref synchronously in the callback, there's still a window where `conversationDbIdRef.current` is null.

2. **Silent RLS Failures**: The RLS policy on `rari_messages` requires `EXISTS (SELECT 1 FROM rari_conversations WHERE id = conversation_id AND user_id = auth.uid())`. If the conversation hasn't fully propagated or there's a timing issue, inserts fail silently.

3. **Missing Error Details**: Current error handling uses `.catch()` but doesn't log enough context to diagnose why saves fail.

---

## Implementation Plan

### Step 1: Add Comprehensive Logging to `saveMessageToDb`

Trace every call with full state context:

```typescript
const saveMessageToDb = useCallback((message: Message) => {
  const dbId = conversationDbIdRef.current;
  const userId = user?.id;
  
  console.log('[Rari Message Save] Attempting save:', {
    hasDbId: !!dbId,
    dbId,
    hasUser: !!userId,
    userId,
    messageRole: message.role,
    messagePreview: message.content.substring(0, 50),
    timestamp: new Date().toISOString(),
  });
  
  if (!dbId) {
    console.error('[Rari Message Save] ❌ BLOCKED - No conversation DB ID', {
      conversationDbIdState: conversationDbId,
      conversationDbIdRef: conversationDbIdRef.current,
      conversationIdState: conversationId,
    });
    return;
  }
  
  saveMessage(dbId, message)
    .then(() => {
      console.log('[Rari Message Save] ✅ Success');
    })
    .catch(err => {
      console.error('[Rari Message Save] ❌ Failed:', err);
    });
}, [saveMessage, user?.id, conversationDbId, conversationId]);
```

### Step 2: Add Logging to `useRariConversationPersistence.saveMessage`

Log every step in the persistence hook:

```typescript
const saveMessage = useCallback(async (
  conversationId: string,
  message: Message
): Promise<void> => {
  console.log('[Rari Persistence] saveMessage called:', {
    conversationId,
    hasUser: !!user,
    userId: user?.id,
    role: message.role,
    contentLength: message.content.length,
  });

  if (!user || !conversationId) {
    console.error('[Rari Persistence] ❌ Validation failed:', {
      hasUser: !!user,
      conversationId,
    });
    return;
  }

  setIsSaving(true);
  try {
    console.log('[Rari Persistence] Inserting message...');
    
    const { data, error } = await supabase
      .from('rari_messages')
      .insert({
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        created_at: message.timestamp.toISOString(),
      })
      .select('id'); // Get the inserted ID back

    if (error) {
      console.error('[Rari Persistence] ❌ Supabase error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return;
    }

    console.log('[Rari Persistence] ✅ Message saved:', {
      insertedId: data?.[0]?.id,
      conversationId,
      role: message.role,
    });
  } catch (err) {
    console.error('[Rari Persistence] ❌ Unexpected error:', err);
  } finally {
    setIsSaving(false);
  }
}, [user]);
```

### Step 3: Add Message Queue for Race Condition Fix

Queue messages that arrive before DB ID is available:

```typescript
// New state for message queue
const pendingMessagesRef = useRef<Message[]>([]);

// Modified saveMessageToDb with queue
const saveMessageToDb = useCallback((message: Message) => {
  const dbId = conversationDbIdRef.current;
  
  console.log('[Rari Message Save] Attempting save:', {
    hasDbId: !!dbId,
    dbId,
    queueLength: pendingMessagesRef.current.length,
  });
  
  if (!dbId) {
    // Queue the message for later
    console.warn('[Rari Message Save] ⏳ Queuing message (no DB ID yet)');
    pendingMessagesRef.current.push(message);
    return;
  }
  
  saveMessage(dbId, message).catch(console.error);
}, [saveMessage]);

// Flush queue when DB ID becomes available
useEffect(() => {
  if (conversationDbId && pendingMessagesRef.current.length > 0) {
    console.log('[Rari Message Queue] Flushing queued messages:', 
      pendingMessagesRef.current.length);
    
    const pending = [...pendingMessagesRef.current];
    pendingMessagesRef.current = [];
    
    pending.forEach(msg => {
      saveMessage(conversationDbId, msg).catch(console.error);
    });
  }
}, [conversationDbId, saveMessage]);
```

### Step 4: Enhance `startConversationDb` Error Handling

Add better logging for conversation creation:

```typescript
// In RariVoiceInterface.tsx, lines 246-255
startConversationDb(id)
  .then((dbId) => {
    if (dbId) {
      console.log('[Rari] ✅ Database conversation created:', {
        dbId,
        sessionId: id,
        userId: user?.id,
        pendingMessages: pendingMessagesRef.current.length,
      });
      conversationDbIdRef.current = dbId;
      setConversationDbId(dbId);
    } else {
      console.error('[Rari] ❌ startConversationDb returned null');
    }
  })
  .catch((err) => {
    console.error('[Rari] ❌ Database conversation failed:', {
      error: err,
      sessionId: id,
    });
  });
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/rari/RariVoiceInterface.tsx` | Add detailed logging, message queue, flush logic |
| `src/hooks/useRariConversationPersistence.ts` | Add comprehensive logging to all operations |

---

## Expected Console Output After Fix

**Successful flow:**
```
[Rari] ✅ Database conversation created: {dbId: "abc-123", sessionId: "conv_xxx", pendingMessages: 0}
[Rari Message Save] Attempting save: {hasDbId: true, dbId: "abc-123", ...}
[Rari Persistence] saveMessage called: {conversationId: "abc-123", hasUser: true, ...}
[Rari Persistence] Inserting message...
[Rari Persistence] ✅ Message saved: {insertedId: "msg-456", ...}
```

**Race condition detected (queue working):**
```
[Rari Message Save] ⏳ Queuing message (no DB ID yet)
[Rari] ✅ Database conversation created: {dbId: "abc-123", pendingMessages: 1}
[Rari Message Queue] Flushing queued messages: 1
[Rari Persistence] ✅ Message saved: {insertedId: "msg-456", ...}
```

**RLS policy failure:**
```
[Rari Persistence] ❌ Supabase error: {code: "42501", message: "new row violates RLS policy", ...}
```

---

## Testing Checklist

After deployment:

- [ ] Start a Rari conversation and speak a message
- [ ] Check console for message flow logs
- [ ] Verify message appears in `rari_messages` table
- [ ] Test rapid messages (queue should flush properly)
- [ ] Test disconnecting mid-conversation (messages should persist)

