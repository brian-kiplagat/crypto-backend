import { createMiddleware } from 'hono/factory';

export const geolocation = () =>
  createMiddleware(async (c, next) => {
    //const { email } = c.get('jwtPayload');

    /* Check if user is a member
    const isMember = membersArray.some((member) => member?.user?.email === email);
    if (!isMember) {
      return serveBadRequest(c, ERRORS.TEAM_MEMBER_NOT_FOUND);
    }*/

    // Set the host and team ID in the context for downstream use
    c.set('x-country-iso', 'US');
    c.set('x-vpn', 'false');

    await next();
  });
