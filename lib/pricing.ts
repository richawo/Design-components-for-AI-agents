import type { Plan } from "./license";

/** Edit prices here. Stripe price ids come from env so test and live can differ. */
export const PLANS: {
  id: Plan;
  name: string;
  price: number;
  cadence: "year" | "once";
  seats: number;
  stripePriceEnv: string;
  mode: "subscription" | "payment";
}[] = [
  { id: "pro-yearly", name: "Pro yearly", price: 99, cadence: "year", seats: 1, stripePriceEnv: "STRIPE_PRICE_PRO_YEARLY", mode: "subscription" },
  { id: "pro-lifetime", name: "Pro lifetime", price: 179, cadence: "once", seats: 1, stripePriceEnv: "STRIPE_PRICE_PRO_LIFETIME", mode: "payment" },
  { id: "team-yearly", name: "Team yearly", price: 299, cadence: "year", seats: 10, stripePriceEnv: "STRIPE_PRICE_TEAM_YEARLY", mode: "subscription" },
  { id: "team-lifetime", name: "Team lifetime", price: 499, cadence: "once", seats: 10, stripePriceEnv: "STRIPE_PRICE_TEAM_LIFETIME", mode: "payment" },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id);
