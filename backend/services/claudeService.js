import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildPrompt(data) {
  const petLine = data.hasPets
    ? "Ich halte ein Haustier und bin mir meiner Verantwortung als Mieter dabei vollständig bewusst."
    : "Ich halte keine Haustiere.";

  const extraLine = data.extraNote
    ? `Zusätzliche Information: ${data.extraNote}`
    : "";

  return `Du bist ein Experte für deutsche Wohnungsbewerbungen.

Schreibe ein professionelles, warmherziges und überzeugendes Anschreiben für eine Wohnungsbewerbung.

Bewerberdaten:
- Name: ${data.firstName} ${data.lastName}
- Beruf: ${data.job}
- Monatliches Nettoeinkommen: ${data.income} €
- Haushaltsgröße: ${data.familySize} Person(en)
- ${petLine}
- Gewünschte Stadt: ${data.city}
- Maximale Warmmiete: ${data.maxRent} €/Monat
- Zimmeranzahl: ${data.rooms} Zimmer
- Gewünschter Einzugstermin: ${data.moveDate}
${extraLine}

Vorgaben für das Anschreiben:
- Beginne mit: "Sehr geehrte Damen und Herren,"
- Ende mit:
"Mit freundlichen Grüßen,
${data.firstName} ${data.lastName}"
- Maximal 180 Wörter
- Natürliches Deutsch
- Kein roboterhafter Stil
- Warm, aber nicht übertrieben enthusiastisch
- Betone: stabile finanzielle Lage, Zuverlässigkeit und sorgsamen Umgang mit der Wohnung
- Kein Briefkopf
- Kein Datum
- Keine Adresse
- Nur den Brieftext ausgeben

Schreibe NUR den Brieftext. Keine Erklärungen.`;
}

export async function generateAnschreiben(data) {
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
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
