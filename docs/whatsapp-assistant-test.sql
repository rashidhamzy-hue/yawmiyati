-- Rollback-only fixture test for supabase/migrations/20261130150000_whatsapp_assistant.sql.
-- Proves: a repeated message id is answered once; an order's status is told only to the phone that placed it; the
-- confirmation tap works once, only for the right phone, and opens only when the gate asked for it; no table holds a
-- phone number or message text; nothing is reachable by anon or signed-in visitors.
begin;
do $$
declare res jsonb; h1 text := repeat('a1', 32); h2 text := repeat('b2', 32); bk text := repeat('e5', 32); t0 timestamptz := now() - interval '3 days';
  ord text := '{"woo_order_id":%s,"order_number":"%s","status":"%s","raw_status":"x","placed_at":"%s","modified_at":"%s","total_minor":17700,"items":[{"sku":"FIX","quantity":1,"total_minor":14900}],"phone_hash":"%s"}';
begin
 if not public.whatsapp_seen_once('wamid.TEST1') or public.whatsapp_seen_once('wamid.TEST1') or not public.whatsapp_seen_once('wamid.TEST2') then raise exception 'seen once'; end if;
 perform public.order_tracking_upsert('sa', ('['||format(ord,920001,'2001','shipped',t0,t0,h1)||','||format(ord,920002,'2002','refused',t0,t0,h1)||']')::jsonb);
 res := public.order_status_lookup('2001', h1);
 if res->>'status'<>'shipped' or res->>'store'<>'sa' then raise exception 'lookup %',res; end if;
 if public.order_status_lookup('2001', h2) is not null or public.order_status_lookup('9999', h1) is not null then raise exception 'lookup leaked another customer''s order'; end if;
 -- h1 has one undelivered order: the gate asks for a confirmation and opens it.
 res := public.order_gate('sa', h1, null, bk, 'YM-3001', null);
 if res->>'action'<>'confirm_whatsapp' or (select status from public.order_confirmations where order_ref='YM-3001')<>'awaiting' then raise exception 'gate %',res; end if;
 if (public.order_whatsapp_confirm('YM-3001', h2)->>'confirmed')::boolean then raise exception 'another phone confirmed'; end if;
 if (public.order_whatsapp_confirm('YM-9999', h1)->>'confirmed')::boolean then raise exception 'unknown order confirmed'; end if;
 res := public.order_whatsapp_confirm('YM-3001', h1);
 if not (res->>'confirmed')::boolean or res->>'store'<>'sa' or (select status from public.order_confirmations where order_ref='YM-3001')<>'confirmed' then raise exception 'confirm %',res; end if;
 if (public.order_whatsapp_confirm('YM-3001', h1)->>'confirmed')::boolean then raise exception 'confirmed twice'; end if;
 -- An allowed order opens no confirmation.
 perform public.order_gate('sa', h2, null, bk, 'YM-3002', null);
 if exists (select 1 from public.order_confirmations where order_ref='YM-3002') then raise exception 'confirmation opened for an allowed order'; end if;
 if exists (select 1 from information_schema.columns where table_schema='public' and table_name in ('whatsapp_seen','order_confirmations') and column_name ~ '(^phone$|wa_id|text|body|name)') then raise exception 'personal column present'; end if;
 if has_function_privilege('authenticated','public.order_status_lookup(text,text)','execute') or has_function_privilege('anon','public.order_whatsapp_confirm(text,text)','execute')
    or has_table_privilege('authenticated','public.order_confirmations','select') or has_function_privilege('anon','public.whatsapp_seen_once(text)','execute') then raise exception 'privileges'; end if;
 raise notice 'whatsapp assistant: all checks passed';
end $$;
rollback;
