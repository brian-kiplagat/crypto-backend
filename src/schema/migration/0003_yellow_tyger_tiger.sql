CREATE TABLE `bitgo_tx` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`type` varchar(255) NOT NULL,
	`wallet` varchar(255) NOT NULL,
	`coin` varchar(255) NOT NULL,
	`transfer` varchar(255) NOT NULL,
	`hash` varchar(255) NOT NULL,
	`amount` decimal(20,8) NOT NULL,
	`state` varchar(255) NOT NULL,
	`ip` varchar(255) NOT NULL,
	`paid` boolean DEFAULT false,
	`usd` decimal(20,2) NOT NULL,
	`usdrate` decimal(20,8) NOT NULL,
	`height` varchar(255) NOT NULL,
	`email` int NOT NULL,
	`user_id` int NOT NULL,
	`confirmations` varchar(255) NOT NULL,
	`satoshi` decimal(20,8) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`tx` text,
	`status` varchar(255),
	`feeString` varchar(255),
	`payGoFee` varchar(255),
	`total_fee` decimal(20,8) DEFAULT '0.00000000',
	`coinpes_fee` decimal(20,8) DEFAULT '0.00000000',
	`requestId` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bitgo_tx_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `countries` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`iso` varchar(2) NOT NULL,
	`iso3` varchar(3) NOT NULL,
	`dial` varchar(5) NOT NULL,
	`currency` varchar(3),
	`currency_name` varchar(100),
	`reason` varchar(255),
	`active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `countries_id` PRIMARY KEY(`id`),
	CONSTRAINT `countries_iso_unique` UNIQUE(`iso`),
	CONSTRAINT `countries_iso3_unique` UNIQUE(`iso3`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`requestId` varchar(255) NOT NULL,
	`trade_id` int NOT NULL,
	`comment` text DEFAULT ('No comment yet'),
	`flag` text DEFAULT ('N/A'),
	`user_id` int NOT NULL,
	`target` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`method` varchar(50) NOT NULL,
	`photo_url` varchar(255) DEFAULT 'https://api.coinpes.com/avatar.webp',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`amount_btc` decimal(20,8) NOT NULL DEFAULT '0.00000000',
	`fiat` decimal(20,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`sender` int NOT NULL,
	`recepient` int NOT NULL,
	`request_id` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internal_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `methods` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`method_name` varchar(255) NOT NULL,
	`active` boolean DEFAULT true,
	CONSTRAINT `methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offer_country_restrictions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`offer_id` int NOT NULL,
	`country_iso` varchar(2) NOT NULL,
	`restriction_type` enum('allowed','blocked') NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `offer_country_restrictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`terms` text NOT NULL,
	`instructions` text NOT NULL,
	`currency` varchar(3) NOT NULL,
	`method` varchar(100) NOT NULL,
	`exchange_rate` decimal(20,8) NOT NULL,
	`margin` decimal(20,2) NOT NULL,
	`status` enum('active','inactive','paused') DEFAULT 'active',
	`active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`requestId` text,
	`type` enum('buy','sell') NOT NULL,
	`flag_expired` varchar(255) DEFAULT 'NOT_EXPIRED',
	`fiat_amount_original` decimal(20,2) NOT NULL DEFAULT '0.00',
	`fiat_amount_with_margin` decimal(20,2) NOT NULL DEFAULT '0.00',
	`btc_amount_with_margin` decimal(20,8) NOT NULL DEFAULT '0.00000000',
	`btc_amount_original` decimal(20,8) NOT NULL DEFAULT '0.00000000',
	`price` decimal(20,2) DEFAULT '0.00',
	`buyer` int NOT NULL,
	`seller` int NOT NULL,
	`status` enum('OPENED','PAID','SUCCESSFUL','CANCELLED_BUYER','CANCELLED_SELLER','CANCELLED_SYSTEM','AWARDED_BUYER','AWARDED_SELLER','DISPUTED') DEFAULT 'OPENED',
	`moderator_flag` varchar(255) DEFAULT 'NA',
	`offer_id` int NOT NULL,
	`cancelled` varchar(100) DEFAULT 'NA',
	`dispute_started` boolean DEFAULT false,
	`dispute_time` timestamp,
	`dispute_time_resolve` timestamp,
	`dispute_reason` varchar(255),
	`dispute_explanation` varchar(255),
	`dispute_started_by` varchar(50),
	`dispute_mod_notes` varchar(255),
	`escrow_return` boolean DEFAULT false,
	`expiry_time` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bitgo_tx` ADD CONSTRAINT `bitgo_tx_email_user_email_fk` FOREIGN KEY (`email`) REFERENCES `user`(`email`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bitgo_tx` ADD CONSTRAINT `bitgo_tx_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_trade_id_trades_id_fk` FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_target_user_id_fk` FOREIGN KEY (`target`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal` ADD CONSTRAINT `internal_sender_user_id_fk` FOREIGN KEY (`sender`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal` ADD CONSTRAINT `internal_recepient_user_id_fk` FOREIGN KEY (`recepient`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offer_country_restrictions` ADD CONSTRAINT `offer_country_restrictions_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trades` ADD CONSTRAINT `trades_buyer_user_id_fk` FOREIGN KEY (`buyer`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trades` ADD CONSTRAINT `trades_seller_user_id_fk` FOREIGN KEY (`seller`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trades` ADD CONSTRAINT `trades_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE no action ON UPDATE no action;