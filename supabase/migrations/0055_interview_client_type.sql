-- Add a "client" interview type so recruiters can mark a candidate's client
-- interview (the day the client meets them) — surfaced on the dashboard's
-- day planner so the team can see who's interviewing when, without chasing it
-- on phone/WhatsApp. (ADD VALUE runs outside a transaction; Supabase SQL editor
-- handles that fine.)
alter type interview_type add value if not exists 'client';
