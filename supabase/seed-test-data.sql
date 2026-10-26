-- Test data for self-testing. Only touches the test accounts 000 (mechanic), 111 (retailer),
-- 222 (RM) and 333 (distributor). Clears their scans, spins, orders and redemptions, then adds:
--   Mechanic 000:    total 20,000 pts, redeemed 5,000 (cash), remaining 15,000
--   Retailer 111:    total 50,000 pts, redeemed 15,000 (gifts), remaining 35,000
--   Distributor 333: total 8,000 pts, redeemed 5,000 (cash), remaining 3,000
-- Claims, chat, promos and users are not touched. Safe to run again.

begin;

delete from public.redemptions
  where from_phone in ('000', '111', '333') or to_phone in ('000', '111', '333');
delete from public.orders where placed_by in ('000', '111');
delete from public.scans where phone in ('000', '111');
delete from public.spins where phone = '000';

-- Mechanic 000: 446 scans over the last ~55 days = 444 x 45 + 2 x 10 = 20,000 pts.
insert into public.scans (code, sku, serial, phone, points, created_at)
select 'ATLASDID|' || sku || '|SEED' || lpad(n::text, 5, '0'), sku, 'SEED' || lpad(n::text, 5, '0'),
       '000', pts, now() - ((446 - n) * interval '3 hours')
from (
  select n,
         case when n <= 2 then 'CCK-82L'
              else (array['CSK-CD70', 'CSK-CD70M', 'CSK-CD100', 'CSK-CG125'])[1 + n % 4] end as sku,
         case when n <= 2 then 10 else 45 end as pts
  from generate_series(1, 446) as n
) s;

-- Mechanic redeemed 5,000 pts for cash: 3,000 with the retailer, 2,000 with the distributor.
insert into public.redemptions (from_phone, to_phone, routed_to, points, status, amount, created_at, decided_at)
values
  ('000', '111', 'retailer', 3000, 'paid', 30000, now() - interval '20 days', now() - interval '19 days'),
  ('000', '333', 'distributor', 2000, 'paid', 20000, now() - interval '8 days', now() - interval '7 days');

-- Retailer 111: 11 delivered orders of 300 x CD100 (3,900 pts each) ...
insert into public.orders
  (placed_by, placed_by_role, rm, distributor, items, status, total, points,
   created_at, reviewed_at, dispatched_at, delivered_at)
select '111', 'retailer', '222', '333',
       '[{"sku": "CSK-CD100", "quantity": 300, "unitPrice": 1450}]'::jsonb,
       'delivered', 300 * 1450, 3900,
       now() - n * interval '5 days' - interval '3 days',
       now() - n * interval '5 days' - interval '2 days',
       now() - n * interval '5 days' - interval '1 day',
       now() - n * interval '5 days'
from generate_series(1, 11) as n;

-- ... one mixed delivered order (300 x CG125 + 100 x CD70 + 40 x Timing Chain Kit = 4,100 pts) ...
insert into public.orders
  (placed_by, placed_by_role, rm, distributor, items, status, total, points,
   created_at, reviewed_at, dispatched_at, delivered_at)
values ('111', 'retailer', '222', '333',
        '[{"sku": "CSK-CG125", "quantity": 300, "unitPrice": 1600},
          {"sku": "CSK-CD70", "quantity": 100, "unitPrice": 1200},
          {"sku": "CCK-84L", "quantity": 40, "unitPrice": 650}]'::jsonb,
        'delivered', 300 * 1600 + 100 * 1200 + 40 * 650, 4100,
        now() - interval '4 days', now() - interval '3 days', now() - interval '2 days',
        now() - interval '1 day');

-- ... and one new order waiting for the RM (650 pts on the way, not counted yet).
insert into public.orders (placed_by, placed_by_role, rm, distributor, items, status, points, created_at)
values ('111', 'retailer', '222', '333', '[{"sku": "CSK-CD100", "quantity": 50}]'::jsonb,
        'placed', 650, now() - interval '2 hours');

-- Retailer total = 11 x 3,900 + 4,100 + 3,000 (paid to the mechanic) = 50,000.
-- Retailer redeemed 15,000 pts for gifts.
insert into public.redemptions
  (from_phone, to_phone, routed_to, points, status, reward_id, reward_title, created_at, decided_at)
values
  ('111', '222', 'rm', 9000, 'paid', 1, 'LED TV 40 inch', now() - interval '15 days', now() - interval '13 days'),
  ('111', '333', 'distributor', 3000, 'paid', 11, 'Food Factory', now() - interval '10 days', now() - interval '9 days'),
  ('111', '333', 'distributor', 3000, 'paid', 12, 'Hot Plate', now() - interval '4 days', now() - interval '3 days');

-- Distributor 333 total = 2,000 (from the mechanic) + 6,000 (gifts given) = 8,000.
-- Distributor redeemed 5,000 pts for cash with the RM.
insert into public.redemptions (from_phone, to_phone, routed_to, points, status, amount, created_at, decided_at)
values ('333', '222', 'rm', 5000, 'paid', 50000, now() - interval '2 days', now() - interval '1 day');

commit;

-- Should show: 000 = 15000, 111 = 35000, 333 = 3000.
select phone, public.points_balance(phone) as remaining
from (values ('000'), ('111'), ('333')) as v (phone)
order by phone;
