-- 난이도(diff 0~3)별로 플레이어(pid) 1명당 최고 기록 1행
CREATE TABLE IF NOT EXISTS scores (
  diff        INTEGER NOT NULL,
  pid         TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  t           REAL    NOT NULL,   -- 생존 시간(초)
  kills       INTEGER NOT NULL,
  lvl         INTEGER NOT NULL,
  combo       INTEGER NOT NULL,
  updated     INTEGER NOT NULL,   -- ms
  secret_hash TEXT    NOT NULL,   -- 등록자 secret 의 SHA-256 (본인만 갱신 가능)
  PRIMARY KEY (diff, pid)
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (diff, t DESC, kills DESC);
