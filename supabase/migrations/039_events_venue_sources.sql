-- 館方展覽來源第一批（Q-62 續，10/15）：events.source 放寬，加入 11 個美術館、博物館、展演場館。
-- 開放資料：科博館 nmns、海生館 nmmba；館方網站列表：松菸 songshan、科工館 nstm、南美館 tnam、
-- 臺博館 ntm、史博館 nmh、中正紀念堂 cksmh、C-LAB clab、當代館 moca、關渡美術館 kdmofa。
-- 只換 check constraint，不動資料。冪等可重複執行。

alter table events drop constraint if exists events_source_check;
alter table events add constraint events_source_check check (
  source in (
    'kktix', 'opentix', 'accupass', 'tfam',
    'nmns', 'nmmba', 'songshan', 'nstm', 'tnam', 'ntm', 'nmh', 'cksmh', 'clab', 'moca', 'kdmofa'
  )
);
