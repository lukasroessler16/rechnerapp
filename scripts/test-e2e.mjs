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
const seite = await browser.newPage({
  viewport: { width: 1400, height: 1000 },
  acceptDownloads: true,
});
const fehler = [];
seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
seite.on("console", (m) => {
  if (m.type() === "error") fehler.push("console: " + m.text());
});

await seite.goto(BASIS + "/rechner", { waitUntil: "networkidle" });

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

// --- Wand in zwei Abschnitten ---
// Der zweite Abschnitt muss im Preis und in der Dateiliste ankommen; das ist
// der Teil, bei dem ein Fehler unmittelbar Geld kostet.
await seite.click("button:has-text('+ Abschnitt')");
await seite.waitForSelector("text=Abschnitt 2 von 2");
await seite.fill('input[type="number"] >> nth=0', "6");
// zurück zur Vorschau
await seite.click(".schritte li:last-child button, .schritte li:last-child");
await seite.waitForSelector("text=Das ganze Bauvorhaben");
const zwei = JSON.parse(
  await seite.evaluate(() => sessionStorage.getItem("bewehrung_projekt"))
);
if (zwei.length !== 2) throw new Error("Der zweite Abschnitt wurde nicht gespeichert.");
if (zwei[1].details.links !== "wand_weiter" || zwei[0].details.rechts !== "wand_weiter")
  throw new Error("An der neuen Fuge muss beidseits 'Wand läuft weiter' stehen.");
if (zwei[1].masse.hoehe !== zwei[0].masse.hoehe || zwei[1].masse.dicke !== zwei[0].masse.dicke)
  throw new Error("Höhe und Dicke müssen in allen Abschnitten gleich sein.");

// Die Fuge ist auch in der Oberfläche nicht wählbar
await seite.click("text=4 Anschlüsse");
await seite.waitForSelector("text=Anschluss unten");
const festeRaender = await seite.locator(".detail-wahl.gesperrt select[disabled]").count();
if (festeRaender !== 1)
  throw new Error(
    `Im letzten Abschnitt muss genau der linke Anschluss gesperrt sein, gesperrt: ${festeRaender}`
  );
await seite.click("text=7 Ergebnis");
await seite.waitForSelector("text=Das ganze Bauvorhaben");

const planZwei = await seite.request.post(BASIS + "/api/dokumente", {
  data: { plan: true, demo: true, projekt: zwei },
});
const planDaten = await planZwei.json();
if (planDaten.dokumente?.length !== 7)
  throw new Error(
    "Zwei Abschnitte müssen 2 × 3 + 1 = 7 Blätter ergeben, geliefert: " +
      planDaten.dokumente?.length
  );
if (!planDaten.paketname?.endsWith(".zip")) throw new Error("Kein ZIP-Name im Plan.");

// Das ganze Paket als ZIP
const paket = await seite.request.post(BASIS + "/api/dokumente", {
  data: { paket: true, demo: true, projekt: zwei },
});
if (paket.status() !== 200)
  throw new Error("ZIP-API: " + paket.status() + " " + (await paket.text()));
const zip = await paket.body();
if (zip.subarray(0, 2).toString() !== "PK") throw new Error("Kein ZIP erhalten");
writeFileSync("/tmp/e2e-paket.zip", zip);

// Wieder auf einen Abschnitt zurück, damit der Demo-Checkout unverändert läuft
await seite.click("button:has-text('Abschnitt 2 entfernen')");
await seite.waitForSelector("text=Baustahl gesamt");
// Die Zustimmung wird beim Verlassen der Vorschau zurückgesetzt – sie muss
// bewusst für genau diese Bestellung erteilt werden.
await seite.check(".zustimmung input");

// --- Weiter durch den Demo-Checkout ---
await knopf.click();
try {
  await seite.waitForURL("**/erfolg?demo=1");
} catch {
  // Häufigster Grund: In .env.local steht ein STRIPE_SECRET_KEY, dann geht
  // der Checkout zu Stripe statt in den Demo-Modus. Ohne diesen Hinweis
  // steht hier nur ein nichtssagender Timeout.
  throw new Error(
    "Der Checkout ist nicht auf der Demo-Erfolgsseite gelandet (aktuell: " +
      seite.url() +
      "). Läuft der Server mit gesetztem STRIPE_SECRET_KEY? Für diesen Test " +
      "starten mit: STRIPE_SECRET_KEY= DEMO_MODUS=1 npm run dev"
  );
}
await seite.waitForSelector("text=Demo-Modus");

// Die Erfolgsseite lädt das Paket von selbst – wer bezahlt und den Tab
// schließt, ohne geklickt zu haben, darf nicht leer ausgehen.
const automatisch = await seite.waitForEvent("download", { timeout: 20_000 });
if (!automatisch.suggestedFilename().endsWith(".zip"))
  throw new Error("Der automatische Download ist keine ZIP-Datei: " + automatisch.suggestedFilename());
await seite.waitForSelector("text=heruntergeladen");

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
  "E2E OK – Checkbox erzwungen (UI + Server), Abschnitte im Plan (7 Blätter) und als ZIP, " +
    "automatischer Download läuft, Paywall dicht (402), Webhook signaturgeschützt."
);
