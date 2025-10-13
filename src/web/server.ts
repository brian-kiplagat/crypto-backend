import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import type { Worker } from 'bullmq';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { connection } from '../lib/queue.js';
import { EmailRepository } from '../repository/email.ts';
import { NotificationRepository } from '../repository/notification.ts';
import { OfferRepository } from '../repository/offer.ts';
import { TradeRepository } from '../repository/trade.ts';
import { UserRepository } from '../repository/user.js';
import { WalletRepository } from '../repository/wallet.ts';
import { BitgoService } from '../service/bitgo.ts';
import { EmailService } from '../service/email.ts';
import { GoogleService } from '../service/google.js';
import { NotificationService } from '../service/notification.ts';
import { OfferService } from '../service/offer.ts';
import { PriceService } from '../service/price.ts';
import { TradeService } from '../service/trade.ts';
import { UserService } from '../service/user.js';
import { WalletService } from '../service/wallet.ts';
import { Tasker } from '../task/tasker.js';
import { AuthController } from './controller/auth.js';
import { EmailController } from './controller/email.ts';
import { GoogleController } from './controller/google.js';
import { NotificationController } from './controller/notification.ts';
import { OfferController } from './controller/offer.ts';
import { ERRORS, serveInternalServerError, serveNotFound } from './controller/resp/error.js';
import { StripeController } from './controller/stripe.js';
import { TradeController } from './controller/trade.ts';
import { TwitterController } from './controller/twitter.ts';
import { geolocation } from './middleware/geolocation.ts';
import { toggleBulkEmailValidator, updateBulkEmailValidator } from './validator/email.ts';
import {
  createNotificationValidator,
  updateNotificationValidator,
} from './validator/notification.ts';
import {
  createOfferValidator,
  filterOffersValidator,
  quickEditOfferValidator,
  toggleAllOffersValidator,
  toggleOfferValidator,
  updateOfferValidator,
} from './validator/offer.ts';
import { chargeAllCustomersValidator, chargeCustomerValidator } from './validator/stripe.js';
import {
  cancelTradeValidator,
  createTradeValidator,
  filterTradesValidator,
  getTradePriceValidator,
  markPaidValidator,
  openDisputeValidator,
  releaseCryptoValidator,
  reopenTradeValidator,
  resolveDisputeValidator,
} from './validator/trade.ts';
import {
  disable2FaValidator,
  emailVerificationValidator,
  generate2FaSetupValidator,
  inAppResetPasswordValidator,
  loginValidator,
  registerTokenValidator,
  registrationValidator,
  requestResetPasswordValidator,
  resetPasswordValidator,
  updateUserDetailsValidator,
  verify2FaValidator,
} from './validator/user.js';

export class Server {
  private app: Hono;
  private worker?: Worker;

  constructor(app: Hono) {
    this.app = app;
  }

  public async configure() {
    // Index path
    this.app.get('/', (c) => {
      return c.text('Ok');
    });

    // Static files
    this.app.use('/static/*', serveStatic({ root: './' }));

    // API Doc
    this.app.get('/doc', swaggerUI({ url: '/static/openapi.yaml' }));

    // Universal catchall
    this.app.notFound((c) => {
      return serveNotFound(c, ERRORS.NOT_FOUND);
    });

    // Error handling
    this.app.onError((err, c) => {
      return serveInternalServerError(c, err);
    });

    const api = this.app.basePath('/v1');

    // Setup repos
    const userRepo = new UserRepository();
    const emailRepo = new EmailRepository();
    const notificationRepo = new NotificationRepository();
    const offerRepo = new OfferRepository();
    const tradeRepo = new TradeRepository();
    const walletRepo = new WalletRepository();
    // Setup services
    const notificationService = new NotificationService(notificationRepo);
    const offerService = new OfferService(offerRepo);

    const userService = new UserService(userRepo);
    const emailService = new EmailService(emailRepo);
    const tradeService = new TradeService(tradeRepo, offerService, userService);
    const priceService = new PriceService();
    const walletService = new WalletService(walletRepo);
    const bitgoService = new BitgoService(userService, walletService);
    // Setup workers
    this.registerWorker(userService, emailService);

    // Setup controllers
    const authController = new AuthController(userService, bitgoService, walletService);

    const emailController = new EmailController(emailService, userService);

    // Add Google service and controller
    const googleService = new GoogleService(userService, bitgoService);
    const googleController = new GoogleController(googleService, userRepo);

    // Add Twitter controller
    const twitterController = new TwitterController();

    const notificationController = new NotificationController(notificationService, userService);
    const offerController = new OfferController(offerService, userService);
    const tradeController = new TradeController(
      tradeService,
      userService,
      offerService,
      priceService,
    );

    // Setup Stripe controller
    const stripeController = new StripeController();

    // Register routes
    this.registerUserRoutes(api, authController, googleController);
    this.registerTwitterRoutes(api, twitterController);

    this.registerEmailRoutes(api, emailController);
    this.registerNotificationRoutes(api, notificationController);
    this.registerOfferRoutes(api, offerController);
    this.registerTradeRoutes(api, tradeController);
    this.registerStripeRoutes(api, stripeController);
  }

  private registerUserRoutes(api: Hono, authCtrl: AuthController, googleCtrl: GoogleController) {
    const user = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    user.get('/me', authCheck, authCtrl.me);
    user.post('/login', loginValidator, authCtrl.login);
    user.post('/register', registrationValidator, authCtrl.register);
    user.post('/send-token', emailVerificationValidator, authCtrl.sendToken);
    user.post('/verify-registration', registerTokenValidator, authCtrl.verifyRegistrationToken);
    user.post(
      '/request-reset-password',
      requestResetPasswordValidator,
      authCtrl.requestResetPassword,
    );
    user.post('/reset-password', resetPasswordValidator, authCtrl.resetPassword);
    user.post(
      '/reset-password-in-app',
      authCheck,
      inAppResetPasswordValidator,
      authCtrl.resetPasswordInApp,
    );
    user.put('/details', authCheck, updateUserDetailsValidator, authCtrl.updateUserDetails);

    // 2FA routes
    user.post('/2fa/setup', authCheck, generate2FaSetupValidator, authCtrl.generate2FaSetup);
    user.post('/2fa/verify', authCheck, verify2FaValidator, authCtrl.verify2Fa);
    user.post('/2fa/disable', authCheck, disable2FaValidator, authCtrl.disable2Fa);

    // Add Google auth routes
    user.get('/auth/google', googleCtrl.initiateAuth);
    user.get('/auth/google/callback', googleCtrl.handleCallback);
    api.route('/user', user);
  }

  private registerEmailRoutes(api: Hono, emailCtrl: EmailController) {
    const email = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // Apply auth middleware for authenticated routes
    email.use(authCheck);

    email.post('/toggle', toggleBulkEmailValidator, emailCtrl.toggleBulkEmail);
    email.get('/', emailCtrl.getEmails);
    email.get('/:id', emailCtrl.getEmail);
    email.put('/:id', updateBulkEmailValidator, emailCtrl.updateEmail);
    email.delete('/:id', emailCtrl.deleteEmail);

    api.route('/email', email);
  }

  private registerNotificationRoutes(api: Hono, notificationCtrl: NotificationController) {
    const notification = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // Apply auth middleware for all notification routes
    notification.use(authCheck);

    // Notification routes
    notification.post('/', createNotificationValidator, notificationCtrl.createNotification);
    notification.get('/my', notificationCtrl.getMyNotifications);
    notification.get('/my/unread', notificationCtrl.getMyUnreadNotifications);
    notification.get('/unread-count', notificationCtrl.getUnreadCount);
    notification.get('/:id', notificationCtrl.getNotification);
    notification.put('/:id', updateNotificationValidator, notificationCtrl.updateNotification);
    notification.post('/:id/read', notificationCtrl.markAsRead);
    notification.post('/mark-all-read', notificationCtrl.markAllAsRead);
    notification.delete('/:id', notificationCtrl.deleteNotification);
    notification.delete('/all', notificationCtrl.deleteAllNotifications);

    api.route('/notification', notification);
  }

  private registerOfferRoutes(api: Hono, offerCtrl: OfferController) {
    const offer = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // Apply auth middleware for all offer routes
    offer.use(authCheck);
    offer.use(geolocation());

    // Offer routes
    offer.post('/', createOfferValidator, offerCtrl.createOffer);
    offer.get('/my', offerCtrl.getMyOffers);
    offer.get('/active', offerCtrl.getActiveOffers);
    offer.post('/filter', filterOffersValidator, offerCtrl.filterOffers);
    offer.get('/:id', offerCtrl.getOffer);
    offer.put('/:id', updateOfferValidator, offerCtrl.updateOffer);
    offer.patch('/:id/quick-edit', quickEditOfferValidator, offerCtrl.quickEdit);
    offer.patch('/:id/toggle', toggleOfferValidator, offerCtrl.toggleOffer);
    offer.patch('/toggle-all', toggleAllOffersValidator, offerCtrl.toggleAllOffers);
    offer.delete('/:id', offerCtrl.deleteOffer);
    offer.delete('/all', offerCtrl.deleteAllOffers);

    api.route('/offer', offer);
  }

  private registerTradeRoutes(api: Hono, tradeCtrl: TradeController) {
    const trade = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    trade.post('/price', getTradePriceValidator, tradeCtrl.getTradePrice);
    // Apply auth middleware for all trade routes
    trade.use(authCheck);
    trade.use(geolocation());

    // Trade routes
    trade.post('/', createTradeValidator, tradeCtrl.createTrade);
    trade.get('/my', tradeCtrl.getMyTrades);
    trade.post('/filter', filterTradesValidator, tradeCtrl.filterTrades);
    trade.get('/expired', tradeCtrl.getExpiredTrades);
    trade.get('/disputed', tradeCtrl.getDisputedTrades);
    trade.get('/:id', tradeCtrl.getTrade);
    trade.post('/:id/reopen', reopenTradeValidator, tradeCtrl.reopenTrade);
    trade.post('/:id/mark-paid', markPaidValidator, tradeCtrl.markPaid);
    trade.post('/:id/cancel', cancelTradeValidator, tradeCtrl.cancelTrade);
    trade.post('/:id/dispute', openDisputeValidator, tradeCtrl.openDispute);
    trade.post('/:id/resolve-dispute', resolveDisputeValidator, tradeCtrl.resolveDispute);
    trade.post('/:id/release', releaseCryptoValidator, tradeCtrl.releaseCrypto);
    trade.delete('/:id', tradeCtrl.deleteTrade);

    api.route('/trade', trade);
  }

  private registerStripeRoutes(api: Hono, stripeCtrl: StripeController) {
    const stripe = new Hono();

    // No authentication required for Stripe routes as requested
    // Customer routes
    stripe.get('/customers', stripeCtrl.getCustomers);
    stripe.get('/customers/:id', stripeCtrl.getCustomer);

    // Customer cards and payment methods
    stripe.get('/customer-cards', stripeCtrl.getCustomerCards);
    stripe.get('/customers/:id/payment-methods', stripeCtrl.getCustomerPaymentMethods);

    // Charging routes
    stripe.post('/charge-customer', chargeCustomerValidator, stripeCtrl.chargeCustomer);
    stripe.post(
      '/charge-all-customers',
      chargeAllCustomersValidator,
      stripeCtrl.chargeAllCustomers,
    );

    api.route('/stripe', stripe);
  }

  private registerTwitterRoutes(api: Hono, twitterCtrl: TwitterController) {
    const twitter = new Hono();

    // Twitter OAuth routes
    twitter.get('/auth', twitterCtrl.initiateAuth);
    twitter.get('/callback', twitterCtrl.handleCallback);

    api.route('/twitter', twitter);
  }

  private registerWorker(userService: UserService, emailService: EmailService) {
    const tasker = new Tasker(userService, emailService);
    const worker = tasker.setup();
    if (worker.isRunning()) {
      logger.info('Worker is running');
    }
    this.worker = worker;
  }

  public async shutDownWorker() {
    await this.worker?.close();
    await connection.quit();
  }
}
