ALTER TABLE `offers` RENAME COLUMN `min_trades` TO `minimum_trades`;--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `limit_block`;