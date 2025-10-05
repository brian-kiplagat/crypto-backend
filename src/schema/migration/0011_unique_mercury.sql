ALTER TABLE `bitgo_tx` RENAME COLUMN `requestId` TO `request_id`;--> statement-breakpoint
ALTER TABLE `feedback` RENAME COLUMN `requestId` TO `request_id`;--> statement-breakpoint
ALTER TABLE `trades` RENAME COLUMN `requestId` TO `request_id`;