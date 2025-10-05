ALTER TABLE `offers` ADD `minimum` decimal(20,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `maximum` decimal(20,2) DEFAULT '0.00' NOT NULL;