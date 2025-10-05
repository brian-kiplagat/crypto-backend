ALTER TABLE `user` ADD `two_factor_secret` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `two_factor_enabled` boolean DEFAULT false;