-- mock_heatmap_data.sql
-- Replace 'YOUR_USER_ID' with your actual user UUID, or run this block to insert data for all users!

DO $$
DECLARE
    u_id UUID;
    v_date DATE;
    v_count INT;
    i INT;
BEGIN
    FOR u_id IN SELECT id FROM auth.users LOOP
        -- For each user, generate random data for the past 120 days
        FOR i IN 0..120 LOOP
            v_date := CURRENT_DATE - i;
            -- Generate a random number of activities (0 to 12)
            -- We make 0 more likely by subtracting an offset
            v_count := (random() * 15)::INT - 5;
            IF v_count < 0 THEN
                v_count := 0;
            END IF;

            IF v_count > 0 THEN
                INSERT INTO public.user_daily_activity (user_id, date, activity_count)
                VALUES (u_id, v_date, v_count)
                ON CONFLICT (user_id, date) 
                DO UPDATE SET activity_count = EXCLUDED.activity_count;
            END IF;
        END LOOP;
    END LOOP;
END $$;
