CREATE TYPE "public"."anime_month" AS ENUM('january', 'april', 'july', 'october');--> statement-breakpoint
CREATE TYPE "public"."anime_status" AS ENUM('draft', 'upcoming', 'airing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."anime_type" AS ENUM('movie', 'japanese', 'american', 'chinese', 'adult');--> statement-breakpoint
CREATE TYPE "public"."danmaku_type" AS ENUM('scroll', 'top', 'bottom');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('pending', 'processing', 'done');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('consultation', 'suggestion', 'complaint', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'premium', 'user', 'guest');--> statement-breakpoint
CREATE TABLE "anime_to_tags" (
	"anime_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anime_to_tags_anime_id_tag_id_pk" PRIMARY KEY("anime_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "anime_to_topics" (
	"anime_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anime_to_topics_anime_id_topic_id_pk" PRIMARY KEY("anime_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "anime" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "anime_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"series_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"remark" varchar(25) NOT NULL,
	"cover" varchar(255) NOT NULL,
	"banner" varchar(255) NOT NULL,
	"status" "anime_status" NOT NULL,
	"type" "anime_type" NOT NULL,
	"year" smallint NOT NULL,
	"month" "anime_month" NOT NULL,
	"director" varchar(25) NOT NULL,
	"cv" text NOT NULL,
	"season" smallint NOT NULL,
	"season_name" varchar(25),
	"avg_score" real DEFAULT 0 NOT NULL,
	"score_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"anime_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_user_anime_unique" UNIQUE("user_id","anime_id")
);
--> statement-breakpoint
CREATE TABLE "danmaku" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "danmaku_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"video_id" integer NOT NULL,
	"text" varchar(50) NOT NULL,
	"mode" "danmaku_type" DEFAULT 'scroll' NOT NULL,
	"color" varchar(7) NOT NULL,
	"time" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"anime_id" integer NOT NULL,
	"type" "feedback_type" NOT NULL,
	"content" text NOT NULL,
	"status" "feedback_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "histories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "histories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"video_id" integer NOT NULL,
	"time" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "histories_user_video_unique" UNIQUE("user_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"anime_id" integer NOT NULL,
	"score" smallint NOT NULL,
	"content" text NOT NULL,
	"status" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_user_anime_unique" UNIQUE("user_id","anime_id")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "series_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(25) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"status" boolean DEFAULT false NOT NULL,
	"cover" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'guest' NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"avatar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "videos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"anime_id" integer NOT NULL,
	"title" varchar(100) NOT NULL,
	"episode" real NOT NULL,
	"url" varchar(255) NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anime_to_tags" ADD CONSTRAINT "anime_to_tags_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_to_tags" ADD CONSTRAINT "anime_to_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_to_topics" ADD CONSTRAINT "anime_to_topics_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_to_topics" ADD CONSTRAINT "anime_to_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime" ADD CONSTRAINT "anime_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "danmaku" ADD CONSTRAINT "danmaku_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "danmaku" ADD CONSTRAINT "danmaku_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "histories" ADD CONSTRAINT "histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "histories" ADD CONSTRAINT "histories_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anime_to_tags_anime_id_idx" ON "anime_to_tags" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "anime_to_tags_tag_id_idx" ON "anime_to_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "anime_to_topics_anime_id_idx" ON "anime_to_topics" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "anime_to_topics_topic_id_idx" ON "anime_to_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "anime_series_id_idx" ON "anime" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "anime_name_idx" ON "anime" USING btree ("name");--> statement-breakpoint
CREATE INDEX "anime_filter_idx" ON "anime" USING btree ("type","status","year","month");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_anime_id_idx" ON "collections" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "danmaku_user_id_idx" ON "danmaku" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "danmaku_video_id_idx" ON "danmaku" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "feedback_user_id_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_anime_id_idx" ON "feedback" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "histories_user_id_idx" ON "histories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "histories_video_id_idx" ON "histories" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "scores_user_id_idx" ON "scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scores_anime_id_idx" ON "scores" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "scores_status_idx" ON "scores" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" USING btree ("name");--> statement-breakpoint
CREATE INDEX "users_status_role_idx" ON "users" USING btree ("status","role");--> statement-breakpoint
CREATE INDEX "videos_anime_id_idx" ON "videos" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "videos_views_idx" ON "videos" USING btree ("views");

-- =============================================
-- pg_trgm 模糊搜索索引
-- =============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS anime_name_trgm_idx ON anime USING GIN (name gin_trgm_ops);

-- =============================================
-- 创建触发器函数
-- =============================================
CREATE OR REPLACE FUNCTION update_anime_score_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_anime_id INTEGER;  -- 声明一个变量存储动漫ID
BEGIN
	IF TG_OP = 'DELETE' THEN
		target_anime_id := OLD.anime_id;
	ELSE
		target_anime_id := NEW.anime_id;
	END IF;

	UPDATE anime
	SET
		-- 计算平均分
		avg_score = COALESCE(
			(SELECT AVG(score)::real FROM scores WHERE anime_id = target_anime_id),
			0
    	),
		-- 计算评分数量
		score_count = (
			SELECT COUNT(*) FROM scores WHERE anime_id = target_anime_id
		),
		-- 更新修改时间
    	updated_at = NOW()
  	WHERE id = target_anime_id;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 创建触发器
-- =============================================

-- 先删除已存在的同名触发器（避免重复创建报错）
DROP TRIGGER IF EXISTS scores_stats_trigger ON scores;

-- 创建新触发器
CREATE TRIGGER scores_stats_trigger
  	AFTER INSERT OR UPDATE OR DELETE
	-- 监听 scores 表
 	ON scores
	-- 每一行变化都触发一次
  	FOR EACH ROW
  	EXECUTE FUNCTION update_anime_score_stats();
