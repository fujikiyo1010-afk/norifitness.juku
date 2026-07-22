-- 週間プール(案1・条件1): プール経路の行は cycle_number=NULL で書き、
-- unique(user_id, cycle_number, day_number) を素通りさせる(週は date から導出)。
-- 既存の一本道行(cycle_number 有り)は不変。2026-07-22 きよむ承認 → dev/prod 適用済み。
alter table user_workout_logs alter column cycle_number drop not null;
