/**
 * End-to-End-Test des Wizards im Headless-Browser (Demo-Modus ohne Stripe).
 * Aufruf: node scripts/test-e2e.mjs   (Server muss auf :3100 laufen)
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const BASIS = "http://localhost:3100";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
});
const seite = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
seite.on("console", (m) => {
  if (m.type() === "error") fehler.push("console: " + m.text());
});

await seite.goto(BASIS, { waitUntil: "networkidle" });
await seite.screenshot({ path: "/tmp/s1-bauteil.png" });

// Schritt 1 → 2: Wand ist vorgewählt
await seite.click("text=Weiter →");
await seite.fill('input[type="number"] >> nth=0', "8");
await seite.screenshot({ path: "/tmp/s2-masse.png" });

// Schritt 3: Öffnung hinzufügen
await seite.click("text=Weiter →");
await seite.click("text=+ Öffnung hinzufügen");
await seite.waitForSelector("text=Automatisch berücksichtigte Details");
await seite.screenshot({ path: "/tmp/s3-oeffnung.png" });

// Schritt 4: Anschlussdetails
await seite.click("text=Weiter →");
await seite.waitForSelector("text=Anschluss unten");
await seite.screenshot({ path: "/tmp/s4-anschluesse.png" });

// Schritt 5: Parameter
await seite.click("text=Weiter →");
await seite.waitForSelector("text=Betonklasse");
await seite.screenshot({ path: "/tmp/s5-parameter.png" });

// Schritt 6: Firmendaten
await seite.click("text=Weiter →");
await seite.fill('input[placeholder="Muster Bau GmbH"]', "Rößler Bau GmbH");
await seite.fill('input[placeholder="EFH Familie Muster"]', "Testvorhaben");

// Schritt 7: Vorschau + Demo-Checkout
await seite.click("text=Weiter →");
await seite.waitForSelector("text=Baustahl gesamt");
await seite.screenshot({ path: "/tmp/s7-vorschau.png" });
await seite.click("text=Jetzt freischalten");
await seite.waitForURL("**/erfolg?demo=1");
await seite.waitForSelector("text=Demo-Modus");
await seite.screenshot({ path: "/tmp/s8-erfolg.png" });

// PDF-Download über die API (mit sessionStorage-Projekt, wie die Seite es tut)
const projekt = await seite.evaluate(() => sessionStorage.getItem("bewehrung_projekt"));
const antwort = await seite.request.post(BASIS + "/api/dokumente", {
  data: { typ: "biegeliste", demo: true, projekt: JSON.parse(projekt) },
});
if (antwort.status() !== 200) throw new Error("PDF-API: " + antwort.status() + " " + (await antwort.text()));
const pdf = await antwort.body();
if (!pdf.subarray(0, 4).toString().includes("%PDF")) throw new Error("Kein PDF erhalten");
writeFileSync("/tmp/e2e-biegeliste.pdf", pdf);

// Negativtest: ohne demo-Flag und ohne Session darf NICHTS geliefert werden
const gesperrt = await seite.request.post(BASIS + "/api/dokumente", {
  data: { typ: "biegeliste", projekt: JSON.parse(projekt) },
});
if (gesperrt.status() !== 402) throw new Error("Paywall-Lücke! Status: " + gesperrt.status());

await browser.close();
if (fehler.length) {
  console.log("BROWSER-FEHLER:");
  fehler.forEach((f) => console.log(" -", f));
  process.exit(1);
}
console.log("E2E OK – Screenshots unter /tmp/s*.png, PDF /tmp/e2e-biegeliste.pdf, Paywall dicht (402).");
