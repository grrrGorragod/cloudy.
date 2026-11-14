-- ผู้ใช้: เก็บแค่ hash ของกุญแจ ไม่เก็บกุญแจจริง ไม่เก็บ IP
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  key_hash   TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 24),
  tag        CHAR(4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_name_tag ON users (lower(name), tag);

-- โพสหมดอายุเองตาม expires_at (สูงสุด 14 วัน บังคับที่โค้ดฝั่งเซิร์ฟเวอร์)
CREATE TABLE IF NOT EXISTS posts (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  mode       TEXT NOT NULL CHECK (mode IN ('free', 'reactions')),
  warn       BOOLEAN NOT NULL DEFAULT false,
  hidden     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_expires ON posts (expires_at);
CREATE INDEX IF NOT EXISTS posts_user    ON posts (user_id, created_at);

CREATE TABLE IF NOT EXISTS replies (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  to_reply_id BIGINT REFERENCES replies(id) ON DELETE SET NULL,
  warn        BOOLEAN NOT NULL DEFAULT false,
  hidden      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS replies_post ON replies (post_id, created_at);
CREATE INDEX IF NOT EXISTS replies_user ON replies (user_id, created_at);

-- ปุ่มห่วงใย: หนึ่งคนกดได้หนึ่งครั้งต่อโพส
CREATE TABLE IF NOT EXISTS care (
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  reply_id    BIGINT REFERENCES replies(id) ON DELETE CASCADE,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((post_id IS NULL) <> (reply_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_once_post  ON reports (reporter_id, post_id)  WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_once_reply ON reports (reporter_id, reply_id) WHERE reply_id IS NOT NULL;

-- ผ่านการตรวจโดยแอดมินแล้ว: ถ้าแอดมินอนุมัติหลังถูกซ่อนจากรายงาน รายงานเพิ่มจะไม่ซ่อนซ้ำอีก
ALTER TABLE posts   ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT false;
