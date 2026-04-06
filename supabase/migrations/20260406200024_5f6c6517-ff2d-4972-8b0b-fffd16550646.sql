
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE customers
    SET 
      total_bookings = (SELECT COUNT(*) FROM bookings WHERE customer_id = NEW.customer_id),
      lifetime_value = (SELECT COALESCE(SUM(total_value), 0) FROM bookings WHERE customer_id = NEW.customer_id AND status NOT IN ('cancelled', 'pending')),
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

UPDATE customers c
SET lifetime_value = COALESCE((
  SELECT SUM(b.total_value) FROM bookings b 
  WHERE b.customer_id = c.id AND b.status NOT IN ('cancelled', 'pending')
), 0),
total_bookings = COALESCE((
  SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id
), 0),
updated_at = NOW();
