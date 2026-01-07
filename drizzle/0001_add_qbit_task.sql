CREATE TYPE "public"."task_status" AS ENUM('pending', 'downloading', 'downloaded', 'transcoding', 'transcoded', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"torrent_url" text NOT NULL,
	"torrent_hash" varchar(64),
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"download_path" varchar(500),
	"file_size" bigint,
	"download_progress" integer DEFAULT 0 NOT NULL,
	"transcode_temp_dir" varchar(500),
	"transcode_progress" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"failed_at_status" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");