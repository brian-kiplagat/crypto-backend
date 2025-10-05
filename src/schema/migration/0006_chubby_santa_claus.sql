ALTER TABLE `offers` RENAME COLUMN `method` TO `method_id`;--> statement-breakpoint
ALTER TABLE `offers` MODIFY COLUMN `method_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_method_id_methods_id_fk` FOREIGN KEY (`method_id`) REFERENCES `methods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `exchange_rate`;