CREATE TABLE `bitcoin_addresses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`address` varchar(255) NOT NULL,
	`wallet_id` varchar(255) NOT NULL,
	`label` varchar(255) NOT NULL,
	`chain` int NOT NULL,
	`index` int NOT NULL,
	`address_type` varchar(50),
	`created_at` timestamp DEFAULT (now()),
	`metadata` json,
	CONSTRAINT `bitcoin_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `bitcoin_addresses_address_unique` UNIQUE(`address`)
);
--> statement-breakpoint
ALTER TABLE `bitcoin_addresses` ADD CONSTRAINT `bitcoin_addresses_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;