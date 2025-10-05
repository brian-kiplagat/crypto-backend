ALTER TABLE `user` RENAME COLUMN `is_banned` TO `health`;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `health` enum('active','banned','on_hold','suspended','blocked') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `offers` ADD `deauth` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `offers` ADD `id_verification` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `offers` ADD `full_name_required` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `offers` ADD `min_trades` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `offers` ADD `new_trader_limit` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `offers` ADD `limit_block` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `offers` ADD `vpn` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `offers` ADD `limit_countries` enum('none','blocked','allowed') DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `offers` ADD `blocked_countries` json;--> statement-breakpoint
ALTER TABLE `offers` ADD `allowed_countries` json;