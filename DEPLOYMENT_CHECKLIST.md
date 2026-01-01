# ✅ Rari Widget Deployment Checklist

**Print this out and check off as you go!**

---

## 📋 Pre-Deployment

- [ ] **Backup current code** (it's in git, but just in case)
  ```bash
  git add .
  git commit -m "backup: before widget integration"
  ```

- [ ] **Review production component**
  - [ ] Open `src/components/rari/RariWidgetInterface.tsx`
  - [ ] Scan through the code
  - [ ] Looks good? ✅

- [ ] **Check database is ready**
  - [ ] Tables `rari_conversations` and `rari_messages` exist
  - [ ] RLS policies are active
  - [ ] Test connection in Supabase dashboard

---

## 🚀 Deployment (5 minutes)

### Step 1: Update Dashboard Component

- [ ] **Open** `src/pages/Dashboard.tsx`

- [ ] **Change import** (around line 20):
  ```typescript
  // OLD:
  import { RariVoiceInterface } from '@/components/rari/RariVoiceInterface';
  
  // NEW:
  import { RariWidgetInterface } from '@/components/rari/RariWidgetInterface';
  ```

- [ ] **Replace component** (around line 150):
  ```typescript
  // OLD:
  <RariVoiceInterface />
  
  // NEW:
  <RariWidgetInterface />
  ```

- [ ] **Save file** (Cmd+S / Ctrl+S)

### Step 2: Test Locally

- [ ] **Start dev server**
  ```bash
  npm run dev
  ```

- [ ] **Open in browser** (should auto-open)
  - URL: `http://localhost:5173` (or whatever Vite shows)

- [ ] **Navigate to Dashboard**
  - [ ] Click "Dashboard" in nav
  - [ ] Wait for page to load

- [ ] **Open Rari**
  - [ ] Click Rari button (microphone icon)
  - [ ] Dialog should open

- [ ] **Check loading state**
  - [ ] See "Loading Rari..." spinner?
  - [ ] Widget loads (spinner disappears)?
  - [ ] See "Ready" badge?

### Step 3: Test Transcripts

- [ ] **Start conversation**
  - [ ] Click widget in center
  - [ ] Grant microphone permission
  - [ ] See widget activate?

- [ ] **Test user speech**
  - [ ] Say: "Hello Rari"
  - [ ] **See your text appear?** ← KEY TEST!
  - [ ] Text appears in real-time?

- [ ] **Test Rari response**
  - [ ] Hear Rari's voice?
  - [ ] **See Rari's text appear?** ← KEY TEST!
  - [ ] Both voice + text working?

- [ ] **Test conversation flow**
  - [ ] Ask: "What's the fleet status?"
  - [ ] Transcripts update?
  - [ ] Message count increases?

### Step 4: Test Database

- [ ] **Open browser console** (F12)
  - [ ] See: `[Rari Widget] Conversation starting...`?
  - [ ] See: `[Rari Persistence] Conversation started`?
  - [ ] See: `[Rari Persistence] Message saved`?

- [ ] **Check Supabase**
  - [ ] Open Supabase dashboard
  - [ ] Go to Table Editor
  - [ ] Open `rari_conversations` table
  - [ ] See new conversation row?
  - [ ] Open `rari_messages` table
  - [ ] See message rows?

### Step 5: Test Responsive

- [ ] **Test desktop** (> 1024px)
  - [ ] Resize browser wide
  - [ ] See sidebar on left?
  - [ ] Widget on right?
  - [ ] Layout looks good?

- [ ] **Test tablet** (768-1023px)
  - [ ] Resize browser medium
  - [ ] Sidebar hidden?
  - [ ] Single column layout?
  - [ ] Header shows?

- [ ] **Test mobile** (< 768px)
  - [ ] Resize browser narrow
  - [ ] Or open in phone DevTools
  - [ ] Minimal header?
  - [ ] Widget full width?
  - [ ] Icon-only buttons?

### Step 6: Test Mobile (Real Device - Optional)

- [ ] **Get local network URL**
  - Dev server should show: `Network: http://192.168.x.x:5173`
  
- [ ] **Open on phone**
  - [ ] Type URL in phone browser
  - [ ] Dashboard loads?
  - [ ] Open Rari
  - [ ] Test transcripts
  - [ ] Responsive layout good?

---

## 🏗️ Build & Deploy

### Build for Production

- [ ] **Stop dev server** (Ctrl+C)

- [ ] **Build**
  ```bash
  npm run build
  ```

- [ ] **Check for errors**
  - [ ] Build successful?
  - [ ] No TypeScript errors?
  - [ ] No warnings?

- [ ] **Test production build** (optional)
  ```bash
  npm run preview
  ```
  - [ ] Open preview URL
  - [ ] Test transcripts one more time

### Deploy to Git

- [ ] **Check status**
  ```bash
  git status
  ```
  - [ ] See modified files?
  - [ ] See new files?

- [ ] **Stage changes**
  ```bash
  git add .
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: integrate ElevenLabs widget with working transcripts

  - Replace deprecated @11labs/react SDK with official widget
  - Add RariWidgetInterface component (production-ready)
  - Transcripts now display in real-time
  - Database persistence active
  - Entity detection connected
  - Fully responsive (mobile/tablet/desktop)
  - Glass-card styling matches ExotIQ brand"
  ```

- [ ] **Push**
  ```bash
  git push
  ```

- [ ] **Check CI/CD** (if you have auto-deploy)
  - [ ] Build passes?
  - [ ] Deploy succeeds?

---

## 🧪 Post-Deployment Testing

### Test on Production

- [ ] **Open production URL**
  - [ ] Navigate to Dashboard
  - [ ] Open Rari
  - [ ] Test transcripts
  - [ ] Works? ✅

### Test on Real Devices

- [ ] **iOS (iPhone/iPad)**
  - [ ] Safari: Works?
  - [ ] Chrome: Works?
  - [ ] Layout: Good?

- [ ] **Android**
  - [ ] Chrome: Works?
  - [ ] Samsung Internet: Works?
  - [ ] Layout: Good?

- [ ] **Desktop**
  - [ ] Chrome: Works?
  - [ ] Safari: Works?
  - [ ] Firefox: Works?

---

## 🐛 Troubleshooting

### If Widget Doesn't Load:

- [ ] Check console for errors
- [ ] Verify internet connection
- [ ] Check Network tab (widget script loaded?)
- [ ] Try hard refresh (Cmd+Shift+R)

### If Transcripts Don't Appear:

- [ ] Check console for `[Rari Widget] Event: transcript`
- [ ] Verify microphone permission granted
- [ ] Try in different browser
- [ ] Check ElevenLabs agent settings

### If Database Not Saving:

- [ ] Check console for `[Rari Persistence] Message saved`
- [ ] Verify Supabase connection (check .env)
- [ ] Check RLS policies (tables accessible?)
- [ ] Verify user is logged in

### If Layout Looks Broken:

- [ ] Clear browser cache
- [ ] Hard refresh
- [ ] Check responsive breakpoints
- [ ] Test in incognito (no extensions)

---

## 📊 Success Criteria

**Before marking as "DONE", verify:**

- [ ] ✅ Widget loads without errors
- [ ] ✅ Transcripts appear in real-time
- [ ] ✅ Voice quality is excellent
- [ ] ✅ Database persistence works
- [ ] ✅ Works on mobile (tested)
- [ ] ✅ Works on tablet (tested)
- [ ] ✅ Works on desktop (tested)
- [ ] ✅ Console shows no errors
- [ ] ✅ Responsive layout looks good
- [ ] ✅ Loading states work
- [ ] ✅ Error handling works
- [ ] ✅ Matches ExotIQ design

**All checked?** 🎉 **YOU'RE DONE!**

---

## 📝 Notes Section

Use this space to track issues or observations:

**Issues Found:**
- 
- 
- 

**Things to Improve:**
- 
- 
- 

**User Feedback:**
- 
- 
- 

---

## 🎉 Completion

- [ ] **All tests passed**
- [ ] **Deployed to production**
- [ ] **Team notified**
- [ ] **Documentation updated** (if needed)
- [ ] **Celebration!** 🎊

**Completion Date:** ________________

**Deployed By:** ________________

**Time Taken:** ________ minutes

---

## 📚 What's Next?

Now that transcripts are working, consider:

- [ ] Phase 2: Add history view UI
- [ ] Phase 2: Implement export feature
- [ ] Phase 2: Add clickable entity links
- [ ] Phase 3: Analytics on Rari usage
- [ ] Phase 3: A/B testing
- [ ] Phase 3: Advanced features

See `RARI_WIDGET_INTEGRATION_PLAN.md` for full roadmap.

---

**Good luck! You've got this!** 🚀✨
