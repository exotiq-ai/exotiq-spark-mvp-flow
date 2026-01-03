-- Phase 1a: Add 'owner' to app_role enum
-- This must be committed before using the new value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner' BEFORE 'admin';