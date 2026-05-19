CREATE OR REPLACE FUNCTION reject_confirmed_prediction_changes() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.admin_override', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'confirmed predictions cannot be changed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
