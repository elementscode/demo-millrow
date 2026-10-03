-- add store

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create type userRole as enum ('customer', 'admin');

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  name text not null,
  passwordHash text not null,
  role userRole not null default 'customer'
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

create table collections (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  position integer not null default 0
);

create trigger collectionsTouchUpdatedAt
  before update on collections
  for each row execute function touchUpdatedAt();

create table products (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  collectionId uuid not null references collections (id),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  -- Tasting notes, origin, process: short facts shown beside the description.
  notes text not null default '',
  origin text not null default '',
  process text not null default '',
  roast text not null default '',
  published boolean not null default true,
  featured boolean not null default false,
  position integer not null default 0
);

create index productsCollectionIdx on products (collectionId, position);

create trigger productsTouchUpdatedAt
  before update on products
  for each row execute function touchUpdatedAt();

create table productPhotos (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  productId uuid not null references products (id) on delete cascade,
  name text not null default '',
  alt text not null default '',
  contentType text not null,
  data bytea not null,
  -- The cache key in the photo url; Postgres keeps it in step with the bytes.
  hash text generated always as (encode(sha256(data), 'hex')) stored,
  position integer not null default 0
);

create index productPhotosProductIdx on productPhotos (productId, position);

create trigger productPhotosTouchUpdatedAt
  before update on productPhotos
  for each row execute function touchUpdatedAt();

create table variants (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  productId uuid not null references products (id) on delete cascade,
  size text not null default '',
  grind text not null default '',
  priceCents integer not null check (priceCents >= 0),
  stock integer not null default 0 check (stock >= 0),
  position integer not null default 0
);

create index variantsProductIdx on variants (productId, position);

create trigger variantsTouchUpdatedAt
  before update on variants
  for each row execute function touchUpdatedAt();

create type orderStatus as enum ('pending', 'paid', 'shipped', 'refunded', 'cancelled');

create sequence orderNumbers start 1001;

create table orders (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  number integer not null unique default nextval('orderNumbers'),
  status orderStatus not null default 'pending',
  email text not null,
  name text not null,
  address1 text not null,
  address2 text not null default '',
  city text not null,
  region text not null default '',
  postalCode text not null,
  country text not null default 'US',
  itemCount integer not null default 0,
  subtotalCents integer not null default 0,
  shippingCents integer not null default 0,
  totalCents integer not null default 0,
  stripeSessionId text unique,
  paymentIntentId text,
  carrier text not null default '',
  trackingNumber text not null default '',
  paidAt timestamptz,
  shippedAt timestamptz,
  refundedAt timestamptz
);

create index ordersStatusIdx on orders (status, createdAt desc);
create index ordersEmailIdx on orders (lower(email));

create trigger ordersTouchUpdatedAt
  before update on orders
  for each row execute function touchUpdatedAt();

create table orderLines (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  orderId uuid not null references orders (id) on delete cascade,
  productId uuid references products (id) on delete set null,
  variantId uuid references variants (id) on delete set null,
  -- Copied at purchase so an order reads the same after the catalog changes.
  productName text not null,
  variantLabel text not null default '',
  unitCents integer not null,
  quantity integer not null check (quantity > 0)
);

create index orderLinesOrderIdx on orderLines (orderId);

create trigger orderLinesTouchUpdatedAt
  before update on orderLines
  for each row execute function touchUpdatedAt();

create table payments (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  stripeSessionId text not null unique,
  orderId uuid not null references orders (id),
  amountTotal integer not null,
  currency text not null
);

create trigger paymentsTouchUpdatedAt
  before update on payments
  for each row execute function touchUpdatedAt();

-- One row per url the app has served from. Production registers its own
-- Stripe webhook endpoint on the first checkout and keeps the secret here.
create table stripeWebhooks (
  url text primary key,
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  endpointId text not null,
  secret text not null
);

create trigger stripeWebhooksTouchUpdatedAt
  before update on stripeWebhooks
  for each row execute function touchUpdatedAt();

-- Stock changes from checkout, payment, the admin and psql all reach open
-- pages: the write is the broadcast. Whole-table and per-product channels.
create or replace function variantsNotify() returns trigger
language plpgsql as $$
declare
  r record;
  payload text;
begin
  r := coalesce(new, old);

  payload := json_build_object(
    'op', lower(tg_op),
    'data', json_build_object(
      'id', r.id,
      'productId', r.productId,
      'size', r.size,
      'grind', r.grind,
      'priceCents', r.priceCents,
      'stock', r.stock,
      'position', r.position
    )
  )::text;

  perform pg_notify(channel_name('variants'), payload);
  perform pg_notify(channel_name('variants:productId=' || r.productId), payload);

  return r;
end;
$$;

create trigger variantsNotifyTrigger
  after insert or update or delete on variants
  for each row execute function variantsNotify();

create or replace function ordersNotify() returns trigger
language plpgsql as $$
declare
  r record;
  payload text;
begin
  r := coalesce(new, old);

  payload := json_build_object(
    'op', lower(tg_op),
    'data', json_build_object(
      'id', r.id,
      'number', r.number,
      'status', r.status,
      'email', r.email,
      'name', r.name,
      'city', r.city,
      'region', r.region,
      'itemCount', r.itemCount,
      'totalCents', r.totalCents,
      'carrier', r.carrier,
      'trackingNumber', r.trackingNumber,
      'createdAt', json_build_object('$type', 'Date', '$value', (extract(epoch from r.createdAt) * 1000)::bigint)
    )
  )::text;

  perform pg_notify(channel_name('orders'), payload);
  perform pg_notify(channel_name('storeActivity'), json_build_object('orderId', r.id)::text);

  return r;
end;
$$;

create trigger ordersNotifyTrigger
  after insert or update or delete on orders
  for each row execute function ordersNotify();
