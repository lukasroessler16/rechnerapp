/**
 * End-to-End-Test des Wizards im Headless-Browser (Demo-Modus ohne Stripe).
 * Aufruf: node scripts/test-e2e.mjs [Port]   (Standard: 3100)
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const BASIS = `http://localhost:${process.argv[2] ?? 3100}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const seite = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
seite.on("console", (m) => {
  if (m.type() === "error") fehler.push("console: " + m.text());
});

await seite.goto(BASIS, { waitUntil: "networkidle" });

// Schritt 1 → 2: Wand ist vorgewählt
await seite.click("text=Weiter →");
await seite.fill('input[type="number"] >> nth=0', "8");

// Schritt 3: Öffnung hinzufügen
await seite.click("text=Weiter →");
await seite.click("text=+ Öffnung hinzufügen");
await seite.waitForSelector("text=Automatisch berücksichtigte Details");

// Schritt 4 + 5
await seite.click("text=Weiter →");
await seite.waitForSelector("text=Anschluss unten");
await seite.click("text=Weiter →");
await seite.waitForSelector("text=Bautechnische Parameter");

// Schritt 6: Firmendaten
await seite.click("text=Weiter →");
await seite.fill('input[placeholder="Muster Bau GmbH"]', "Rößler Bau GmbH");
await seite.fill('input[placeholder="EFH Familie Muster"]', "Testvorhaben");

// Schritt 7: Vorschau
await seite.click("text=Weiter →");
await seite.waitForSelector("text=Baustahl gesamt");

// --- Prüfung: Zahlungsknopf ist ohne Zustimmung gesperrt ---
const knopf = seite.locator("button:has-text('Jetzt freischalten')");
if (!(await knopf.isDisabled()))
  throw new Error("Zahlungsknopf ist ohne Rücktrittsverzicht NICHT gesperrt!");

// Zustimmung setzen → Knopf muss aktiv werden
await seite.check(".zustimmung input");
if (await knopf.isDisabled())
  throw new Error("Zahlungsknopf bleibt trotz Zustimmung gesperrt!");

// --- Serverseitige Prüfung: Checkout ohne Zustimmung muss abgelehnt werden ---
const projekt = JSON.parse(
  await seite.evaluate(() => sessionStorage.getItem("bewehrung_projekt"))
);
const ohneZustimmung = await seite.request.post(BASIS + "/api/checkout", {
  data: { projekt },
});
if (ohneZustimmung.status() !== 400)
  throw new Error(
    "Checkout ohne Zustimmung wurde NICHT abgelehnt (Status " + ohneZustimmung.status() + ")"
  );

// --- Weiter durch den Demo-Checkout ---
await knopf.click();
await seite.waitForURL("**/erfolg?demo=1");
await seite.waitForSelector("text=Demo-Modus");

// PDF-Abruf über die API
const antwort = await seite.request.post(BASIS + "/api/dokumente", {
  data: { typ: "stueckliste", demo: true, projekt },
});
if (antwort.status() !== 200)
  throw new Error("PDF-API: " + antwort.status() + " " + (await antwort.text()));
const pdf = await antwort.body();
if (!pdf.subarray(0, 4).toString().includes("%PDF")) throw new Error("Kein PDF erhalten");
writeFileSync("/tmp/e2e-stueckliste.pdf", pdf);

// --- Paywall: ohne Demo-Flag und ohne Session darf nichts geliefert werden ---
const gesperrt = await seite.request.post(BASIS + "/api/dokumente", {
  data: { typ: "stueckliste", projekt },
});
if (gesperrt.status() !== 402) throw new Error("Paywall-Lücke! Status: " + gesperrt.status());

// --- Webhook: ohne gültige Signatur darf nichts passieren ---
const webhook = await seite.request.post(BASIS + "/api/stripe-webhook", {
  data: { fake: true },
});
if (webhook.status() === 200)
  throw new Error("Webhook akzeptiert unsignierte Anfragen! Status: " + webhook.status());

await browser.close();
if (fehler.length) {
  console.log("BROWSER-FEHLER:");
  fehler.forEach((f) => console.log(" -", f));
  process.exit(1);
}
console.log(
  "E2E OK – Checkbox erzwungen (UI + Server), Paywall dicht (402), Webhook signaturgeschützt."
);
