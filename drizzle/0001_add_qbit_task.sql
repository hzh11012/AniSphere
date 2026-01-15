CREATE TYPE "public"."task_status" AS ENUM('pending', 'transcoding', 'transcoded', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"torrent_hash" varchar(64) NOT NULL,
	"file_index" integer NOT NULL,
	"filename" varchar(500) NOT NULL,
	"file_path" varchar(1000) NOT NULL,
	"file_size" bigint NOT NULL,
	"needs_transcode" boolean DEFAULT false NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"transcode_progress" integer DEFAULT 0 NOT NULL,
	"transcode_output_path" varchar(1000),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_torrent_hash_idx" ON "tasks" USING btree ("torrent_hash");