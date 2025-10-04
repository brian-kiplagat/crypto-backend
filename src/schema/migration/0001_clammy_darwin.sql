ALTER TABLE `emails` RENAME COLUMN `host_id` TO `user_id`;--> statement-breakpoint
ALTER TABLE `emails` DROP FOREIGN KEY `emails_host_id_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `emails` ADD CONSTRAINT `emails_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;