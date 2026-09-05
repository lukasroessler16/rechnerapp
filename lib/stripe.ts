/**
 * Zentrale Stripe-Client-Instanziierung.
 *
 * WICHTIG: In Vercels Serverless-Umgebung kommt es mit dem Standard-
 * HTTP-Client von stripe-node (Node „https"-Modul) gelegentlich zu
 * Verbindungsabbrüchen: "An error occurred with our connection to
 * Stripe. Request was retried N times." Der von Stripe empfohlene Fix
 * ist, den nativen fetch-basierten HTTP-Client zu verwenden.
 */
import Stripe from "stripe";

export function stripeClient(schluessel: string): Stripe {
  return new Stripe(schluessel, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}