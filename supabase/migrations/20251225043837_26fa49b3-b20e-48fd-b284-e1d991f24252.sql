-- Create a function to create notifications for mentions in team messages
CREATE OR REPLACE FUNCTION public.notify_mentioned_users()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user_id UUID;
  sender_name TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
  
  -- Loop through mentioned users
  IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions, 1) > 0 THEN
    FOREACH mentioned_user_id IN ARRAY NEW.mentions
    LOOP
      -- Don't notify yourself
      IF mentioned_user_id != NEW.sender_id THEN
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          mentioned_user_id,
          'mention',
          'You were mentioned',
          COALESCE(sender_name, 'Someone') || ' mentioned you: ' || LEFT(NEW.content, 100),
          jsonb_build_object(
            'conversation_id', NEW.conversation_id,
            'message_id', NEW.id,
            'sender_id', NEW.sender_id,
            'sender_name', sender_name
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS on_team_message_mentions ON team_messages;
CREATE TRIGGER on_team_message_mentions
  AFTER INSERT ON team_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_mentioned_users();