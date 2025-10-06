import Stripe from 'stripe';
import env from '../lib/env.js';

export class StripeService {
    private stripe: Stripe;

    constructor() {
        const key = env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is not set');
        }
        this.stripe = new Stripe(key);
    }

    /**
     * Retrieves all customers with pagination
     * @param limit - Number of customers to retrieve per page
     * @returns Promise containing customers data
     */
    public async getCustomers(limit: number = 1000) {
        return await this.stripe.customers.list({ limit });
    }

    /**
     * Retrieves all customer cards with pagination
     * @returns Promise containing customer cards data
     */
    public async getCustomerCards() {
        let hasMore = true;
        let startingAfter: string | null = null;
        const allCustomerCards: any[] = [];

        while (hasMore) {
            const customers = await this.stripe.customers.list({
                limit: 100,
                starting_after: startingAfter || undefined,
            });

            for (const customer of customers.data) {
                const customerInfo = {
                    customerId: customer.id,
                    email: customer.email || customer.id,
                    cards: [] as any[]
                };

                // Fetch all card payment methods for this customer
                const paymentMethods = await this.stripe.paymentMethods.list({
                    customer: customer.id,
                    type: 'card',
                });

                if (paymentMethods.data.length === 0) {
                    customerInfo.cards = [];
                } else {
                    // Process each card
                    for (const pm of paymentMethods.data) {
                        const card = pm.card;
                        if (card) {
                            customerInfo.cards.push({
                                brand: card.brand.toUpperCase(),
                                last4: card.last4,
                                expMonth: card.exp_month,
                                expYear: card.exp_year,
                                paymentMethodId: pm.id
                            });
                        }
                    }
                }

                allCustomerCards.push(customerInfo);
            }

            // Pagination
            hasMore = customers.has_more;
            if (hasMore) {
                startingAfter = customers.data[customers.data.length - 1].id;
            }
        }

        return allCustomerCards;
    }

    /**
     * Charges a specific customer
     * @param customerId - The customer ID to charge
     * @param paymentMethodId - The payment method ID to use
     * @param email - Customer email for logging
     * @param amount - Amount to charge in pence (default: £2.00)
     * @returns Promise containing charge result
     */
    public async chargeCustomer(
        customerId: string,
        paymentMethodId: string,
        email: string,
        amount: number = 200 // £2.00 in pence
    ) {
        try {
            // Set as default payment method for invoices/future charges
            await this.stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });

            // Create a payment intent to charge the specified amount
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amount,
                currency: 'gbp',
                customer: customerId,
                payment_method: paymentMethodId,
                off_session: true,
                confirm: true,
            });

            return {
                success: true,
                paymentIntentId: paymentIntent.id,
                amount: amount,
                customerEmail: email
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                customerEmail: email
            };
        }
    }

    /**
     * Charges all customers with available payment methods
     * @param amount - Amount to charge in pence (default: £2.00)
     * @returns Promise containing array of charge results
     */
    public async chargeAllCustomers(amount: number = 200) {
        const customers = await this.stripe.customers.list({ limit: 1000 });
        const results: any[] = [];

        for (const customer of customers.data) {
            const paymentMethods = await this.stripe.paymentMethods.list({
                customer: customer.id,
                type: 'card',
            });

            if (paymentMethods.data.length === 0) {
                results.push({
                    customerId: customer.id,
                    email: customer.email || customer.id,
                    status: 'skipped',
                    reason: 'No cards found'
                });
                continue;
            }

            // Just pick the first card
            const paymentMethod = paymentMethods.data[0];
            const result = await this.chargeCustomer(
                customer.id,
                paymentMethod.id,
                customer.email || customer.id,
                amount
            );

            results.push({
                customerId: customer.id,
                email: customer.email || customer.id,
                ...result
            });
        }

        return results;
    }

    /**
     * Creates a new customer in Stripe
     * @param email - Customer email
     * @param name - Customer name (optional)
     * @returns Promise containing created customer
     */
    public async createCustomer(email: string, name?: string) {
        return await this.stripe.customers.create({
            email,
            name,
        });
    }

    /**
     * Retrieves a specific customer by ID
     * @param customerId - The customer ID
     * @returns Promise containing customer data
     */
    public async getCustomer(customerId: string) {
        return await this.stripe.customers.retrieve(customerId);
    }

    /**
     * Updates a customer
     * @param customerId - The customer ID
     * @param updateData - Data to update
     * @returns Promise containing updated customer
     */
    public async updateCustomer(customerId: string, updateData: Stripe.CustomerUpdateParams) {
        return await this.stripe.customers.update(customerId, updateData);
    }

    /**
     * Deletes a customer
     * @param customerId - The customer ID
     * @returns Promise containing deletion result
     */
    public async deleteCustomer(customerId: string) {
        return await this.stripe.customers.del(customerId);
    }

    /**
     * Lists payment methods for a customer
     * @param customerId - The customer ID
     * @param type - Payment method type (default: 'card')
     * @returns Promise containing payment methods
     */
    public async getCustomerPaymentMethods(customerId: string, type: Stripe.PaymentMethodListParams.Type = 'card') {
        return await this.stripe.paymentMethods.list({
            customer: customerId,
            type,
        });
    }
}
