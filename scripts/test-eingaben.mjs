/**
 * Prüft die Eingabefelder und die Plausibilitätsprüfung im Browser.
 * Aufruf: node scripts/test-eingaben.mjs [Port]   (Standard: 3100)
 *
 * Getestet wird:
 *  1. Zahlenfelder lassen sich mit der Rücktaste vollständig leeren
 *  2. Wert 0 erzeugt eine Fehlermeldung
 *  3. Öffnung außerhalb des Bauteils wird erkannt
 *  4. Zu geringer Restquerschnitt erzeugt eine Warnung
 *  5. Fehlerhafte Schritte werden in der Schrittleiste markiert
 *  6. Die Zahlung ist bei Eingabefehlern gesperrt
 */
import { chromium } from "playwright";

const BASIS = `http://localhost:${process.argv[2] ?? 3100}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const seite = await browser.newPage({ viewport: { width: 1400, height: 1050 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
seite.on("console", (m) => {
  if (m.type() === "error") fehler.push("console: " + m.text());
});

await seite.goto(BASIS, { waitUntil: "networkidle" });
await seite.click("text=Weiter →");
await seite.waitForSelector("text=Grundmaße");

/* 1) Rücktaste muss das Feld vollständig leeren können */
const laenge = seite.locator('input[type="number"]').first();
await laenge.fill("12.5");
for (let i = 0; i < 4; i++) await seite.keyboard.press("Backspace");
if ((await laenge.inputValue()) !== "")
  throw new Error("Feld lässt sich mit der Rücktaste nicht leeren");
const pflicht = await seite.locator(".feldfehler").first().textContent();
if (!/Wert eintragen/.test(pflicht))
  throw new Error("Keine Meldung bei leerem Pflichtfeld: " + pflicht);

/* 2) Null ist unzulässig */
await laenge.fill("0");
const nullMeldung = await seite.locator(".feldfehler").first().textContent();
if (!/größer als 0/.test(nullMeldung))
  throw new Error("Keine Meldung bei Wert 0: " + nullMeldung);

/* 3) Öffnung außerhalb des Bauteils */
await laenge.fill("4");
await seite.click("text=Weiter →");
await seite.click("text=+ Öffnung hinzufügen");
await seite.waitForSelector("text=Automatisch berücksichtigte Details");
const felder = seite.locator('input[type="number"]');
await felder.nth(0).fill("3.5"); // x
await felder.nth(2).fill("2"); // Breite → ragt 1,50 m hinaus
await seite.waitForTimeout(250);
const raus = await seite.locator(".feldfehler").first().textContent();
if (!/ragt/.test(raus))
  throw new Error("Öffnung außerhalb des Bauteils wird nicht erkannt: " + raus);

/* 4) Zu schmaler Restquerschnitt → Warnung */
await felder.nth(0).fill("3.7");
await felder.nth(2).fill("0.2"); // rechts bleiben 10 cm
await seite.waitForTimeout(250);
const warnung = await seite.locator(".warnbox").first().textContent();
if (!/Restquerschnitt|Randabstand/.test(warnung))
  throw new Error("Keine Warnung bei zu geringem Randabstand: " + warnung);

/* 5) Fehlerhafte Schritte werden markiert */
await felder.nth(0).fill("3.5");
await felder.nth(2).fill("2");
await seite.waitForTimeout(250);
if ((await seite.locator(".schritte li.fehlerhaft").count()) < 1)
  throw new Error("Fehlerhafter Schritt wird in der Leiste nicht markiert");

/* 6) Zahlung bei Eingabefehlern gesperrt */
await seite.click("li:has-text('7 Ergebnis')");
await seite.waitForSelector(".fehlerbox");
await seite.check(".zustimmung input");
if (!(await seite.locator("button:has-text('Jetzt freischalten')").isDisabled()))
  throw new Error("Zahlung trotz Eingabefehlern möglich!");

await browser.close();
if (fehler.length) {
  console.log("BROWSER-FEHLER:");
  fehler.forEach((f) => console.log(" -", f));
  process.exit(1);
}
console.log(
  "Eingabeprüfung OK – Rücktaste, Null-Werte, Öffnung außerhalb, Randabstand, Schrittmarkierung, Zahlungssperre."
);
