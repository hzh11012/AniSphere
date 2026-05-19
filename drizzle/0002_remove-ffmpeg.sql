ALTER TABLE "tasks" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'completed');--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."task_status";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DATA TYPE "public"."task_status" USING "status"::"public"."task_status";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "needs_transcode";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "transcode_progress";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "transcode_output_path";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "error_message";