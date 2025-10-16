import type { Context } from 'hono';
// Twilio SDK imports
import twilio from 'twilio';

import env from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

export class VoiceController {
    public getToken = async (c: Context) => {
        try {
            const identity = c.req.query('identity') || 'website_user';

            const { AccessToken } = twilio.jwt;
            const { VoiceGrant } = AccessToken;

            if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_API_KEY || !env.TWILIO_API_SECRET) {
                return c.json({ error: 'Twilio credentials not configured' }, 500);
            }

            const token = new AccessToken(
                env.TWILIO_ACCOUNT_SID,
                env.TWILIO_API_KEY,
                env.TWILIO_API_SECRET,
                { identity: String(identity) },
            );

            const grant = new VoiceGrant({
                outgoingApplicationSid: env.TWIML_APP_SID,
                incomingAllow: true,
            });
            token.addGrant(grant);

            return c.json({ token: token.toJwt(), identity });
        } catch (error) {
            logger.error('Failed to create Twilio token', { error });
            return c.json({ error: 'Failed to create Twilio token' }, 500);
        }
    };

    public createCall = async (c: Context) => {
        try {
            if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
                return c.json({ error: 'Twilio credentials not configured' }, 500);
            }

            const body = await c.req.json<{ to: string }>();
            const { to } = body;
            if (!to) return c.json({ error: '`to` is required' }, 400);

            const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

            const call = await client.calls.create({
                to,
                from: env.TWILIO_PHONE_NUMBER,
                url: `${c.req.url.replace(c.req.path, '')}/v1/voice/response`,
            });

            return c.json({ success: true, call_sid: call.sid });
        } catch (error) {
            logger.error('Failed to create call', { error });
            return c.json({ error: 'Failed to create call' }, 500);
        }
    };

    public voiceResponse = async (c: Context) => {
        try {
            const twiml = new twilio.twiml.VoiceResponse();
            const dial = twiml.dial();
            // Bridge to client (web user)
            dial.client('agent');
            const twimlResponse = twiml.toString();
            logger.info(twimlResponse);
            c.header('Content-Type', 'text/xml');
            return c.body(twimlResponse);
        } catch (error) {
            logger.error('Failed to serve TwiML', { error });
            return c.json({ error: 'Failed to serve TwiML' }, 500);
        }
    };
}
