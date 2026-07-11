CREATE INDEX "anime_name_pinyin_trgm_idx" ON "anime" USING GIN ("name_pinyin" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "anime_name_initials_trgm_idx" ON "anime" USING GIN ("name_initials" gin_trgm_ops);
