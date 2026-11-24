-- Leads do Bônus 12/12 (Instagram + WhatsApp) e liberação do bônus pelo servidor.
-- O link do Drive NÃO fica no HTML: só a função liberar_bonus() o devolve, depois de gravar o lead.

create table public.leads_bonus (
  id uuid primary key default gen_random_uuid(),
  instagram text not null check (instagram ~ '^[a-z0-9._]{1,30}$'),
  whatsapp text not null check (whatsapp ~ '^55[0-9]{10,11}$'),
  origem text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  acessos integer not null default 1 check (acessos >= 1),
  created_at timestamptz not null default now(),
  ultimo_acesso_em timestamptz not null default now(),
  unique (whatsapp)
);

comment on table public.leads_bonus is 'Leads do bônus 12/12 (stories). Escrita só via public.liberar_bonus(); leitura só service_role.';

alter table public.leads_bonus enable row level security;
revoke all on table public.leads_bonus from anon, authenticated;

-- Links entregues após o cadastro (anon não lê esta tabela)
create table public.bonus_config (
  chave text primary key,
  valor text not null
);
alter table public.bonus_config enable row level security;
revoke all on table public.bonus_config from anon, authenticated;

-- Os links (chaves drive_url e aulao_url) são inseridos direto no painel do Supabase, fora do repositório:
--   insert into public.bonus_config (chave, valor) values ('drive_url', '...'), ('aulao_url', '...');

create or replace function public.liberar_bonus(
  p_instagram text,
  p_whatsapp text,
  p_origem text default '',
  p_utm jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ig text := lower(regexp_replace(coalesce(p_instagram, ''), '^@+|\s', '', 'g'));
  v_wa text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_drive text;
  v_aulao text;
begin
  if v_wa !~ '^55' then v_wa := '55' || v_wa; end if;

  if v_ig !~ '^[a-z0-9._]{1,30}$' then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'fields', jsonb_build_object('instagram', 'Digite um @ válido'));
  end if;
  if v_wa !~ '^55[1-9][0-9]9[0-9]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'fields', jsonb_build_object('whatsapp', 'Digite um WhatsApp válido com DDD'));
  end if;

  insert into public.leads_bonus as l (instagram, whatsapp, origem, utm_source, utm_medium, utm_campaign, utm_content)
  values (
    v_ig, v_wa, left(coalesce(p_origem, ''), 500),
    left(coalesce(p_utm ->> 'utm_source', ''), 100),
    left(coalesce(p_utm ->> 'utm_medium', ''), 100),
    left(coalesce(p_utm ->> 'utm_campaign', ''), 100),
    left(coalesce(p_utm ->> 'utm_content', ''), 100)
  )
  on conflict (whatsapp) do update
    set acessos = l.acessos + 1,
        ultimo_acesso_em = now(),
        instagram = excluded.instagram;

  select valor into v_drive from public.bonus_config where chave = 'drive_url';
  select valor into v_aulao from public.bonus_config where chave = 'aulao_url';

  return jsonb_build_object('ok', true, 'drive_url', v_drive, 'aulao_url', v_aulao);
end;
$$;

revoke all on function public.liberar_bonus(text, text, text, jsonb) from public;
grant execute on function public.liberar_bonus(text, text, text, jsonb) to anon, authenticated;
