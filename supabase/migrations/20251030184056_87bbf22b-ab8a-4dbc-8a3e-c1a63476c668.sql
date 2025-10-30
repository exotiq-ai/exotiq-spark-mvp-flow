-- Create maintenance_schedules table
CREATE TABLE public.maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  service_provider TEXT,
  estimated_cost NUMERIC,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  message_type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on maintenance_schedules
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for maintenance_schedules
CREATE POLICY "Users can view own maintenance schedules"
ON public.maintenance_schedules
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own maintenance schedules"
ON public.maintenance_schedules
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own maintenance schedules"
ON public.maintenance_schedules
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own maintenance schedules"
ON public.maintenance_schedules
FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for messages
CREATE POLICY "Users can view own messages"
ON public.messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own messages"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for maintenance_schedules updated_at
CREATE TRIGGER update_maintenance_schedules_updated_at
BEFORE UPDATE ON public.maintenance_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_maintenance_schedules_user_id ON public.maintenance_schedules(user_id);
CREATE INDEX idx_maintenance_schedules_vehicle_id ON public.maintenance_schedules(vehicle_id);
CREATE INDEX idx_maintenance_schedules_scheduled_date ON public.maintenance_schedules(scheduled_date);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_booking_id ON public.messages(booking_id);