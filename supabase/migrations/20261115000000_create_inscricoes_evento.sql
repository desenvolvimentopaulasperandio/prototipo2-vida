-- Inscrições do Super Aulão. Só a Edge Function (service_role) lê/escreve.

create table public.inscricoes_evento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  email text not null,
  evento text not null,
  data_evento date not null,
  origem text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  utm_term text not null default '',
  "timestamp" timestamptz not null,
  status_webhook text not null default 'pending' check (status_webhook in ('pending', 'sent', 'failed')),
  tentativas_envio integer not null default 0 check (tentativas_envio >= 0),
  erro_webhook text,
  created_at timestamptz not null default now()
);

comment on table public.inscricoes_evento is 'Leads do Super Aulão. Gravados pela Edge Function registrar-inscricao antes do envio ao webhook.';

-- Reenvio: leads ainda não entregues ao webhook (select ... where status_webhook <> 'sent' order by created_at)
create index inscricoes_evento_reenvio_idx on public.inscricoes_evento (created_at) where status_webhook <> 'sent';
create index inscricoes_evento_evento_email_idx on public.inscricoes_evento (evento, email);

-- RLS ligada e SEM policies: anon/authenticated não leem nem alteram nada. service_role ignora RLS.
alter table public.inscricoes_evento enable row level security;
revoke all on table public.inscricoes_evento from anon, authenticated;

-- Limite de requisições por IP (guarda só o hash do IP, em janelas fixas)
create table public.inscricoes_rate_limit (
  ip_hash text not null,
  janela_inicio timestamptz not null,
  contagem integer not null default 0,
  primary key (ip_hash, janela_inicio)
);
alter table public.inscricoes_rate_limit enable row level security;
revoke all on table public.inscricoes_rate_limit from anon, authenticated;

create or replace function public.registrar_tentativa_inscricao(p_ip_hash text, p_limite integer, p_janela_seg integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_janela timestamptz;
  v_cont integer;
begin
  v_janela := to_timestamp(floor(extract(epoch from now()) / p_janela_seg) * p_janela_seg);
  insert into public.inscricoes_rate_limit as r (ip_hash, janela_inicio, contagem)
  values (p_ip_hash, v_janela, 1)
  on conflict (ip_hash, janela_inicio) do update set contagem = r.contagem + 1
  returning r.contagem into v_cont;

  if random() < 0.02 then
    delete from public.inscricoes_rate_limit where janela_inicio < now() - interval '1 day';
  end if;

  return v_cont <= p_limite;
end;
$$;

revoke all on function public.registrar_tentativa_inscricao(text, integer, integer) from public, anon, authenticated;
grant execute on function public.registrar_tentativa_inscricao(text, integer, integer) to service_role;
