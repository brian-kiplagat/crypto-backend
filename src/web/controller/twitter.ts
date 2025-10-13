import type { Context } from 'hono';
import OAuth from 'oauth';

import env from '../../lib/env.ts';
import { logger } from '../../lib/logger.js';
import { serveBadRequest } from './resp/error.ts';

export class TwitterController {
  private oauth: OAuth.OAuth;

  constructor() {
    this.oauth = new OAuth.OAuth(
      'https://api.x.com/oauth/request_token',
      'https://api.x.com/oauth/access_token',
      env.TWITTER_CONSUMER_KEY,
      env.TWITTER_CONSUMER_SECRET,
      '1.0A',
      env.TWITTER_CALLBACK_URL,
      'HMAC-SHA1',
    );
  }

  /**
   * Step 1: Get OAuth request token
   */
  public initiateAuth = async (c: Context) => {
    try {
      const { token, tokenSecret } = await new Promise<{ token: string; tokenSecret: string }>(
        (resolve, reject) => {
          this.oauth.getOAuthRequestToken((err, token, tokenSecret) => {
            if (err) reject(err);
            else resolve({ token, tokenSecret });
          });
        },
      );

      // Step 2: Return authorization URL
      const authUrl = `https://api.x.com/oauth/authorize?oauth_token=${token}`;

      return c.json({
        success: true,
        authUrl,
        token,
        tokenSecret,
      });
    } catch (error) {
      logger.error('Failed to initiate Twitter auth:', error);
      return serveBadRequest(c, 'Failed to initiate Twitter authentication');
    }
  };

  /**
   * Step 3: Handle callback and exchange verifier for access token
   */
  public handleCallback = async (c: Context) => {
    try {
      const token = c.req.query('oauth_token');
      const verifier = c.req.query('oauth_verifier');
      const tokenSecret = c.req.query('oauth_token_secret');

      if (!token || !verifier || !tokenSecret) {
        return serveBadRequest(c, 'Missing OAuth parameters');
      }

      const { accessToken, accessTokenSecret } = await new Promise<{
        accessToken: string;
        accessTokenSecret: string;
      }>((resolve, reject) => {
        this.oauth.getOAuthAccessToken(
          token,
          tokenSecret,
          verifier,
          (err, accessToken, accessTokenSecret) => {
            if (err) reject(err);
            else resolve({ accessToken, accessTokenSecret });
          },
        );
      });

      return c.json({
        success: true,
        accessToken,
        accessTokenSecret,
      });
    } catch (error) {
      logger.error('Twitter callback failed:', error);
      return serveBadRequest(c, 'Failed to complete Twitter authentication');
    }
  };
}
