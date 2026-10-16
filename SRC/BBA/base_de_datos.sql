
-- 1) TABLAS
-- ---------------------------------------------------------------------

-- TICKET: incidencia subida desde el Excel de Jira, a nombre de su dueño
create table if not exists public.tickets (
  id                bigint generated always as identity primary key,
  user_id           uuid        not null default auth.uid()
                                references auth.users (id) on delete cascade,
  identificador_tk  text        not null,
  estado            text        not null default 'Sin dato',
  datos             jsonb       not null default '{}'::jsonb,
  creado_en         timestamptz not null default now(),
  constraint uq_tickets_usuario_tk   unique (user_id, identificador_tk),
  constraint ck_tickets_identificador check (length(trim(identificador_tk)) > 0)
);

-- AGENDA_DIA: ticket programado para trabajarse en una fecha
create table if not exists public.agenda_dia (
  id               bigint generated always as identity primary key,
  user_id          uuid    not null default auth.uid()
                           references auth.users (id) on delete cascade,
  ticket_id        bigint  not null
                           references public.tickets (id) on delete cascade,
  fecha            date    not null,
  prioridad        integer not null,
  bloqueado        boolean not null default false,
  depende_de       text,
  tiempo_estimado  integer,
  comentario       text,
  creado_en        timestamptz not null default now(),
  constraint uq_agenda_fecha_ticket unique (fecha, ticket_id),
  constraint ck_agenda_prioridad    check (prioridad > 0),
  constraint ck_agenda_depende_de   check (depende_de is null or depende_de in ('Analista', 'Tercero')),
  constraint ck_agenda_tiempo       check (tiempo_estimado is null or tiempo_estimado >= 0)
);

-- RESOLUCION: historial de cómo se resolvió cada ticket (conocimiento del equipo)
create table if not exists public.resoluciones (
  id                bigint generated always as identity primary key,
  user_id           uuid  not null default auth.uid()
                          references auth.users (id) on delete cascade,
  usuario_nombre    text  not null,
  identificador_tk  text  not null,
  resumen           text,
  solucion          text  not null,
  fecha_resolucion  date  not null,
  creado_en         timestamptz not null default now(),
  constraint ck_resoluciones_solucion check (length(trim(solucion)) > 0),
  constraint fk_resoluciones_ticket
    foreign key (user_id, identificador_tk)
    references public.tickets (user_id, identificador_tk)
);


-- ---------------------------------------------------------------------
-- 3) ÍNDICES (aceleran las consultas más frecuentes de la aplicación)
-- ---------------------------------------------------------------------
create index if not exists ix_tickets_usuario_estado on public.tickets (user_id, estado);
create index if not exists ix_agenda_usuario_fecha   on public.agenda_dia (user_id, fecha);
create index if not exists ix_resol_fecha            on public.resoluciones (fecha_resolucion desc);
create index if not exists ix_resol_usuario          on public.resoluciones (user_id);
create index if not exists ix_resol_ticket           on public.resoluciones (user_id, identificador_tk);


-- ---------------------------------------------------------------------
-- 4) SEGURIDAD A NIVEL DE FILA (Row Level Security)
--    Tickets y agenda: cada usuario ve y modifica solo lo suyo.
--    Resoluciones: todo el equipo las lee; solo se crea/edita/borra lo propio.
-- ---------------------------------------------------------------------
alter table public.tickets      enable row level security;
alter table public.agenda_dia   enable row level security;
alter table public.resoluciones enable row level security;

drop policy if exists "tickets: solo los del usuario" on public.tickets;
create policy "tickets: solo los del usuario" on public.tickets
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agenda: solo la del usuario" on public.agenda_dia;
create policy "agenda: solo la del usuario" on public.agenda_dia
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "resoluciones: lectura del equipo" on public.resoluciones;
create policy "resoluciones: lectura del equipo" on public.resoluciones
  for select to authenticated using (true);

drop policy if exists "resoluciones: crear las propias" on public.resoluciones;
create policy "resoluciones: crear las propias" on public.resoluciones
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "resoluciones: editar las propias" on public.resoluciones;
create policy "resoluciones: editar las propias" on public.resoluciones
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "resoluciones: borrar las propias" on public.resoluciones;
create policy "resoluciones: borrar las propias" on public.resoluciones
  for delete to authenticated using (user_id = auth.uid());

