import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildPrompt(data) {
  const familySize = Number.parseInt(String(data.familySize || "1"), 10);
  const isPlural = Number.isFinite(familySize) && familySize >= 2;

  const applicantName = `${data.firstName || ""} ${data.lastName || ""}`.trim();

  const petLine = data.hasPets
    ? isPlural
      ? "Wir halten ein Haustier und gehen verantwortungsvoll damit um."
      : "Ich halte ein Haustier und gehe verantwortungsvoll damit um."
    : isPlural
      ? "Wir halten keine Haustiere."
      : "Ich halte keine Haustiere.";

  const extraLine = data.extraNote
    ? `Zusätzliche Information: ${data.extraNote}`
    : "Zusätzliche Information: Keine";

  const grammarRule = isPlural
    ? 'Der gesamte Brief muss konsequent in der Wir-Form geschrieben werden. Verwende ausschließlich "wir", "uns" und "unser". Verwende niemals "ich", "mich", "mein" oder "mir".'
    : 'Der gesamte Brief muss konsequent in der Ich-Form geschrieben werden. Verwende "ich", "mich", "mein" und "mir".';

  return `Du bist ein Experte für deutsche Wohnungsbewerbungen.

Aufgabe:
Schreibe ein professionelles, natürliches und höfliches Anschreiben für eine Wohnungsbewerbung auf Deutsch.

Bewerberdaten:
- Name des Bewerbers: ${applicantName}
- Beruf: ${data.job || ""}
- Monatliches Nettoeinkommen: ${data.income || ""} €
- Haushaltsgröße: ${data.familySize || "1"} Person(en)
- Haustiere: ${data.hasPets ? "Ja" : "Nein"}
- Wohnort/Zielstadt: ${data.city || ""}
- Maximale Warmmiete: ${data.maxRent || ""} €/Monat
- Zimmeranzahl: ${data.rooms || ""} Zimmer
- Gewünschter Einzugstermin: ${data.moveDate || ""}
- ${petLine}
- ${extraLine}

Sehr wichtige Regeln:
- Beginne exakt mit: Sehr geehrte Damen und Herren,
- Ende exakt mit:
Mit freundlichen Grüßen,
[Name in lateinischer Schrift]
- Maximal 180 Wörter.
- Kein Briefkopf.
- Kein Datum.
- Keine Adresse.
- Kein Betreff.
- Kein Markdown.
- Keine Aufzählung.
- Nur den fertigen Brieftext ausgeben.
- Natürliches Deutsch, kein roboterhafter Stil.
- Warm, aber nicht übertrieben enthusiastisch.
- Keine erfundenen Informationen.
- Erfinde keine bisherigen Wohnorte.
- Erfinde keine finanziellen Rücklagen.
- Erfinde keine SCHUFA, Referenzen oder Unterlagen.
- Nicht "wunderschöne Stadt" schreiben.
- Nicht behaupten, dass die Miete garantiert gezahlt wird.
- ${grammarRule}
- Wenn der Name in persischer oder arabischer Schrift geschrieben ist, transliteriere ihn in eine übliche lateinische Schreibweise.
- Beispiel: آرش تفرشی → Arash Tafreshi
- Verwende im gesamten Brief und in der Unterschrift ausschließlich die lateinische Schreibweise des Namens.
- Schreibe niemals persische oder arabische Schriftzeichen im Brief.
- Verwende den Namen des Bewerbers als Unterschrift.
- Wenn keine Haustiere vorhanden sind, erwähne das natürlich und positiv.

Schreibe NUR den Brieftext. Keine Erklärung.`;
}

export async function generateAnschreiben(data) {
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 700,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: buildPrompt(data),
      },
    ],
  });

  const text = message.content?.[0]?.text;

  if (!text) {
    throw new Error("Empty response from AI");
  }

  return text.trim();
}
