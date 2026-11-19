create table public.catalog_import_candidates (
 store_code text not null references public.stores(code),
 woo_product_id bigint not null check(woo_product_id>0),
 woo_variation_id bigint not null default 0 check(woo_variation_id>=0),
 supplier_sku text not null,
 title text not null,
 observed_price_minor bigint check(observed_price_minor>=0),
 observed_stock text not null check(observed_stock in ('available','unavailable','unknown')),
 observed_at timestamptz not null,
 primary key(store_code,woo_product_id,woo_variation_id)
);
create table public.commercial_recommendations (
 id uuid primary key default gen_random_uuid(),
 store_code text not null references public.stores(code),
 listing_id uuid,
 kind text not null check(kind in ('catalog_import','publish','price','promotion','retire')),
 rationale text not null,
 evidence jsonb not null default '{}'::jsonb,
 proposal jsonb not null,
 state text not null default 'pending' check(state in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 foreign key(store_code,listing_id) references public.country_listings(store_code,id)
);
create table public.owner_decision_events (
 id uuid primary key default gen_random_uuid(),
 recommendation_id uuid not null unique references public.commercial_recommendations(id),
 actor_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','rejected')),
 decided_at timestamptz not null default now()
);
alter table public.catalog_import_candidates enable row level security;
alter table public.commercial_recommendations enable row level security;
alter table public.owner_decision_events enable row level security;
revoke all on public.catalog_import_candidates,public.commercial_recommendations,public.owner_decision_events from anon,authenticated;
create function public.dashboard_recommendations(p_store text)
returns table(id uuid,kind text,rationale text,state text,proposal jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 return query select r.id,r.kind,r.rationale,r.state,r.proposal,r.created_at from public.commercial_recommendations r where r.store_code=p_store order by r.created_at desc,r.id limit 100;
end $$;
create function public.review_recommendation(p_store text,p_id uuid,p_decision text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dashboard_members m where m.user_id=auth.uid() and m.store_code=p_store) then raise exception using errcode='42501',message='Access denied'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 update public.commercial_recommendations set state=p_decision,reviewed_at=now(),reviewed_by=auth.uid() where id=p_id and store_code=p_store and state='pending';
 if not found then raise exception 'Recommendation not pending or unavailable'; end if;
 insert into public.owner_decision_events(recommendation_id,actor_id,decision) values(p_id,auth.uid(),p_decision);
end $$;
revoke all on function public.dashboard_recommendations(text),public.review_recommendation(text,uuid,text) from public,anon;
grant execute on function public.dashboard_recommendations(text),public.review_recommendation(text,uuid,text) to authenticated;
