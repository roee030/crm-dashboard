-- SignalDesk — dev seed.
-- Creates one auth user (the onboarding trigger auto-provisions profile + workspace
-- + owner membership), then populates realistic demo calls / transcripts / insights
-- so every dashboard KPI, chart, and trend renders with meaningful data immediately.
--
-- Login:  dev@signaldesk.test  /  devpassword
-- Loaded by `supabase db reset`. Safe to re-run (idempotent on the auth user).

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@signaldesk.test',
  crypt('devpassword', gen_salt('bf')),
  now(),
  '{"full_name":"Dev User"}',
  now(), now()
)
on conflict (id) do nothing;

do $$
declare
  dev uuid := '00000000-0000-0000-0000-000000000001';
  ws  uuid;
  cid uuid;
begin
  select workspace_id into ws
  from public.workspace_members
  where user_id = dev
  order by created_at asc
  limit 1;

  if ws is null then
    raise notice 'No workspace for dev user; onboarding trigger missing?';
    return;
  end if;

  -- Avoid duplicating demo data on re-run.
  if exists (select 1 from public.calls where workspace_id = ws) then
    return;
  end if;

  -- Helper to insert a full call (call + transcript + insight) in one shot.
  -- ---- Call 1: EN, positive, Discovery ----
  insert into public.calls (workspace_id, uploaded_by, title, direction, customer_name, customer_email, customer_phone, language, status, duration_sec, created_at, updated_at)
  values (ws, dev, 'Acme Corp — Discovery', 'outbound', 'Acme Corp', 'buyer@acme.com', '+1-415-555-0101', 'en', 'completed', 742, now() - interval '26 days', now() - interval '26 days')
  returning id into cid;
  insert into public.transcripts (call_id, workspace_id, model, language, full_text, confidence, utterances)
  values (cid, ws, 'assemblyai-stt-3-7', 'en', 'Thanks for taking the time today. We are exploring tools to analyze our sales calls. Our main concern is pricing and how fast we can get value.', 0.94,
    '[{"speaker":"A","start_ms":0,"end_ms":4200,"text":"Thanks for taking the time today."},{"speaker":"B","start_ms":4300,"end_ms":12000,"text":"Happy to. We are exploring tools to analyze our sales calls."},{"speaker":"B","start_ms":12100,"end_ms":19000,"text":"Our main concern is pricing and how fast we can get value."}]'::jsonb);
  insert into public.insights (call_id, workspace_id, model, summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation)
  values (cid, ws, 'claude-sonnet-4-6', 'Positive discovery call. Buyer is interested but wants clarity on pricing and time-to-value.', 'positive', 0.62,
    '[{"text":"Pricing clarity needed","category":"price"},{"text":"Time to value","category":"timing"}]'::jsonb,
    '[{"text":"Send ROI one-pager","owner":"AE","due_hint":"this week"},{"text":"Schedule technical demo","owner":"SE","due_hint":"next week"}]'::jsonb,
    'Discovery');

  -- ---- Call 2: HE, negative, Closed Lost ----
  insert into public.calls (workspace_id, uploaded_by, title, direction, customer_name, customer_email, language, status, duration_sec, created_at, updated_at)
  values (ws, dev, 'גלובל טק — שיחת מעקב', 'inbound', 'Global Tech', 'contact@globaltech.co.il', 'he', 'completed', 531, now() - interval '22 days', now() - interval '22 days')
  returning id into cid;
  insert into public.transcripts (call_id, workspace_id, model, language, full_text, confidence, utterances)
  values (cid, ws, 'assemblyai-stt-3-7', 'he', 'שלום, רציתי לעדכן שהמחיר גבוה מדי עבורנו כרגע, ואנחנו לא בטוחים לגבי האמינות של הפתרון.', 0.91,
    '[{"speaker":"A","start_ms":0,"end_ms":3800,"text":"שלום, תודה שחזרת אליי."},{"speaker":"B","start_ms":3900,"end_ms":11000,"text":"רציתי לעדכן שהמחיר גבוה מדי עבורנו כרגע."},{"speaker":"B","start_ms":11100,"end_ms":17000,"text":"ואנחנו לא בטוחים לגבי האמינות של הפתרון."}]'::jsonb);
  insert into public.insights (call_id, workspace_id, model, summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation)
  values (cid, ws, 'claude-sonnet-4-6', 'הלקוח הביע חשש ממחיר ומאמינות. סבירות סגירה נמוכה בשלב זה.', 'negative', -0.55,
    '[{"text":"המחיר גבוה מהתקציב","category":"price"},{"text":"ספק באמינות הפתרון","category":"trust"}]'::jsonb,
    '[{"text":"לשלוח סיפורי הצלחה של לקוחות","owner":"AE","due_hint":"מחר"}]'::jsonb,
    'Closed Lost');

  -- ---- Call 3: EN, neutral, Proposal ----
  insert into public.calls (workspace_id, uploaded_by, title, direction, customer_name, customer_email, language, status, duration_sec, created_at, updated_at)
  values (ws, dev, 'Northwind — Proposal review', 'outbound', 'Northwind', 'ops@northwind.com', 'en', 'completed', 968, now() - interval '18 days', now() - interval '18 days')
  returning id into cid;
  insert into public.transcripts (call_id, workspace_id, model, language, full_text, confidence, utterances)
  values (cid, ws, 'assemblyai-stt-3-7', 'en', 'The proposal looks reasonable. Timing is the main question since our budget cycle starts next quarter.', 0.93,
    '[{"speaker":"A","start_ms":0,"end_ms":5000,"text":"The proposal looks reasonable."},{"speaker":"B","start_ms":5100,"end_ms":13000,"text":"Timing is the main question since our budget cycle starts next quarter."}]'::jsonb);
  insert into public.insights (call_id, workspace_id, model, summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation)
  values (cid, ws, 'claude-sonnet-4-6', 'Neutral-to-warm. Proposal accepted in principle; timing tied to next-quarter budget.', 'neutral', 0.12,
    '[{"text":"Budget cycle timing","category":"timing"}]'::jsonb,
    '[{"text":"Share phased rollout option","owner":"AE","due_hint":"this week"}]'::jsonb,
    'Proposal');

  -- ---- Call 4: HE, positive, Negotiation ----
  insert into public.calls (workspace_id, uploaded_by, title, direction, customer_name, customer_email, language, status, duration_sec, created_at, updated_at)
  values (ws, dev, 'מובייל פלוס — משא ומתן', 'outbound', 'Mobile Plus', 'cfo@mobileplus.co.il', 'he', 'completed', 814, now() - interval '13 days', now() - interval '13 days')
  returning id into cid;
  insert into public.transcripts (call_id, workspace_id, model, language, full_text, confidence, utterances)
  values (cid, ws, 'assemblyai-stt-3-7', 'he', 'אהבנו את המוצר. אם נוכל להגיע להסכמה על תנאי התשלום, נתקדם לחתימה החודש.', 0.9,
    '[{"speaker":"A","start_ms":0,"end_ms":4200,"text":"אהבנו את המוצר מאוד."},{"speaker":"B","start_ms":4300,"end_ms":12000,"text":"אם נוכל להגיע להסכמה על תנאי התשלום, נתקדם לחתימה החודש."}]'::jsonb);
  insert into public.insights (call_id, workspace_id, model, summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation)
  values (cid, ws, 'claude-sonnet-4-6', 'שיחה חיובית בשלב משא ומתן. נותרו תנאי תשלום לסגירה.', 'positive', 0.7,
    '[{"text":"תנאי תשלום","category":"price"}]'::jsonb,
    '[{"text":"להכין טיוטת חוזה","owner":"AE","due_hint":"השבוע"}]'::jsonb,
    'Negotiation');

  -- ---- Call 5: EN, positive, Closed Won ----
  insert into public.calls (workspace_id, uploaded_by, title, direction, customer_name, customer_email, language, status, duration_sec, created_at, updated_at)
  values (ws, dev, 'Vertex Labs — Closing call', 'inbound', 'Vertex Labs', 'deals@vertexlabs.com', 'en', 'completed', 655, now() - interval '9 days', now() - interval '9 days')
  returning id into cid;
  insert into public.transcripts (call_id, workspace_id, model, language, full_text, confidence, utterances)
  values (cid, ws, 'assemblyai-stt-3-7', 'en', 'We are ready to move forward. Send the contract and we will sign this week.', 0.96,
    '[{"speaker":"A","start_ms":0,"end_ms":4000,"text":"We are ready to move forward."},{"speaker":"B","start_ms":4100,"end_ms":9000,"text":"Send the contract and we will sign this week."}]'::jsonb);
  insert into public.insights (call_id, workspace_id, model, summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation)
  values (cid, ws, 'claude-sonnet-4-6', 'Deal won. Customer committed and awaiting contract.', 'positive', 0.88,
    '[]'::jsonb,
    '[{"text":"Send contract for signature","owner":"AE","due_hint":"today"}]'::jsonb,
    'Closed Won');

  -- ---- Call 6: HE, neutral, Discovery ----
  insert into public.calls (workspace_id, uploaded_by, title, direction, customer_name, customer_email, language, status, duration_sec, created_at, updated_at)
  values (ws, dev, 'סטארט-אפ נק''ה — שיחת היכרות', 'outbound', 'Nekuda', 'hello@nekuda.io', 'he', 'completed', 489, now() - interval '5 days', now() - interval '5 days')
  returning id into cid;
  insert into public.transcripts (call_id, workspace_id, model, language, full_text, confidence, utterances)
  values (cid, ws, 'assemblyai-stt-3-7', 'he', 'אנחנו בשלב מחקר. נשמח להבין איך המוצר משתלב עם ה-CRM שלנו.', 0.89,
    '[{"speaker":"A","start_ms":0,"end_ms":3500,"text":"אנחנו בשלב מחקר."},{"speaker":"B","start_ms":3600,"end_ms":10500,"text":"נשמח להבין איך המוצר משתלב עם ה-CRM שלנו."}]'::jsonb);
  insert into public.insights (call_id, workspace_id, model, summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation)
  values (cid, ws, 'claude-sonnet-4-6', 'שיחת היכרות ניטרלית. עניין באינטגרציה עם ה-CRM.', 'neutral', 0.05,
    '[{"text":"שאלת אינטגרציה עם CRM","category":"features"}]'::jsonb,
    '[{"text":"לשלוח מסמך אינטגרציות","owner":"SE","due_hint":"השבוע"}]'::jsonb,
    'Discovery');

  -- ---- Call 7: EN, negative, Proposal (competitor) ----
  insert into public.calls (workspace_id, uploaded_by, title, direction, customer_name, customer_email, language, status, duration_sec, created_at, updated_at)
  values (ws, dev, 'Pinnacle — Competitive review', 'inbound', 'Pinnacle', 'it@pinnacle.com', 'en', 'completed', 723, now() - interval '2 days', now() - interval '2 days')
  returning id into cid;
  insert into public.transcripts (call_id, workspace_id, model, language, full_text, confidence, utterances)
  values (cid, ws, 'assemblyai-stt-3-7', 'en', 'We are also evaluating a competitor that is cheaper. We like your features but need to justify the price difference.', 0.92,
    '[{"speaker":"A","start_ms":0,"end_ms":5200,"text":"We are also evaluating a competitor that is cheaper."},{"speaker":"B","start_ms":5300,"end_ms":13000,"text":"We like your features but need to justify the price difference."}]'::jsonb);
  insert into public.insights (call_id, workspace_id, model, summary, sentiment_label, sentiment_score, objections, action_items, deal_stage_recommendation)
  values (cid, ws, 'claude-sonnet-4-6', 'At risk. Competitor on price; differentiation needed to hold the deal.', 'negative', -0.3,
    '[{"text":"Competitor is cheaper","category":"competitor"},{"text":"Price difference justification","category":"price"}]'::jsonb,
    '[{"text":"Build competitive comparison","owner":"AE","due_hint":"this week"},{"text":"Offer pilot program","owner":"AE","due_hint":"next week"}]'::jsonb,
    'Proposal');
end $$;
