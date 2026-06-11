import PDFDocument from "pdfkit";

/**
 * Fix 4 — Replace Unicode checkbox symbols (☑ ☐) with ASCII equivalents.
 * PDFKit's built-in Helvetica only covers the WinAnsi/Latin-1 range.
 * U+2610 (☐) and U+2611 (☑) fall outside that range and render as
 * missing-glyph boxes on some systems. "[x]" and "[ ]" are universally safe.
 */
function checkItem(doc, label, checked, fullWidth) {
  const mark = checked ? "[x]" : "[ ]";
  doc.fontSize(10).fillColor("#1A1A2E").font("Helvetica")
    .text(`${mark}  ${label}`, 70, doc.y, { width: fullWidth - 20 });
  doc.moveDown(0.5);
}

export function generateBewerbungsmappe(data, anschreiben) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 60, size: "A4" });

    doc.on("data",  (chunk) => chunks.push(chunk));
    doc.on("end",   ()      => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const NAVY  = "#1A1A2E";
    const GOLD  = "#C8A97E";
    const GRAY  = "#6b7280";
    const LIGHT = "#f3f4f6";
    const fullWidth = doc.page.width - 120;

    function rule(color = GOLD) {
      doc.moveTo(60, doc.y).lineTo(60 + fullWidth, doc.y)
        .strokeColor(color).lineWidth(1).stroke();
      doc.moveDown(0.5);
    }

    function sectionHeader(title) {
      doc.moveDown(1);
      doc.fontSize(11).fillColor(NAVY).font("Helvetica-Bold")
        .text(title.toUpperCase(), 60, doc.y, { width: fullWidth });
      doc.moveDown(0.3);
      rule(GOLD);
    }

    function labelValue(label, value) {
      const y = doc.y;
      doc.fontSize(9).fillColor(GRAY).font("Helvetica").text(label, 60, y, { width: 140 });
      doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold").text(value || "—", 210, y, { width: fullWidth - 150 });
      doc.moveDown(0.6);
    }

    // ════════════════════════════════════════
    // PAGE 1 — Anschreiben
    // ════════════════════════════════════════
    doc.rect(0, 0, doc.page.width, 8).fill(GOLD);

    doc.fontSize(22).fillColor(NAVY).font("Helvetica-Bold")
      .text("Wohnungsbewerbung", 60, 30, { width: fullWidth });
    doc.fontSize(12).fillColor(GOLD).font("Helvetica")
      .text(`${data.firstName} ${data.lastName}`, 60, 60);
    doc.fontSize(9).fillColor(GRAY)
      .text(`${data.job}  ·  ${data.city}  ·  Einzug: ${data.moveDate}`, 60, 78);

    doc.y = 110;
    rule(GOLD);

    doc.moveDown(0.5);
    doc.fontSize(10.5).fillColor(NAVY).font("Helvetica")
      .text(anschreiben, 60, doc.y, { width: fullWidth, lineGap: 4, align: "justify" });

    // ════════════════════════════════════════
    // PAGE 2 — Kurzprofil + Mietgesuch + Checkliste
    // ════════════════════════════════════════
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 8).fill(GOLD);
    doc.y = 30;

    sectionHeader("Kurzprofil des Bewerbers");
    labelValue("Name",           `${data.firstName} ${data.lastName}`);
    labelValue("Beruf",          data.job);
    labelValue("Nettoeinkommen", `${data.income} € / Monat`);
    labelValue("Haushaltsgröße", `${data.familySize} Person(en)`);
    labelValue("Haustiere",      data.hasPets ? "Ja" : "Nein");

    sectionHeader("Mietgesuch");
    labelValue("Gewünschte Stadt", data.city);
    labelValue("Max. Warmmiete",   `${data.maxRent} € / Monat`);
    labelValue("Zimmeranzahl",     `${data.rooms} Zimmer`);
    labelValue("Einzugstermin",    data.moveDate);
    if (data.extraNote) labelValue("Anmerkung", data.extraNote);

    // Rent ratio box
    const rentRatio = ((parseInt(data.maxRent) / parseInt(data.income)) * 100).toFixed(0);
    doc.moveDown(0.5);
    const boxY = doc.y;
    doc.roundedRect(60, boxY, fullWidth, 36, 6).fill(LIGHT);
    doc.fontSize(9).fillColor(GRAY).font("Helvetica")
      .text("Mietbelastungsquote", 72, boxY + 6);
    doc.fontSize(13).fillColor(NAVY).font("Helvetica-Bold")
      .text(`${rentRatio} %`, 72, boxY + 18);
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text("(Empfehlung: unter 33 %)", 150, boxY + 20);
    doc.moveDown(3);

    sectionHeader("Dokumenten-Checkliste");

    const docItems = [
      "Personalausweis / Reisepass",
      "Einkommensnachweise (letzte 3 Monate)",
      "SCHUFA-Auskunft",
      "Mietschuldenfreiheitsbescheinigung",
      "Arbeitsvertrag oder Arbeitgeberbestaetigung",
      "Buergschaft (falls erforderlich)",
    ];
    docItems.forEach((label) => checkItem(doc, label, false, fullWidth));

    doc.moveDown(0.5);
    doc.fontSize(8.5).fillColor(GRAY).font("Helvetica")
      .text(
        "Hinweis: Diese Checkliste ist ein Orientierungsrahmen. " +
        "Bitte erfragen Sie beim Vermieter, welche Unterlagen konkret benoetigt werden.",
        60, doc.y, { width: fullWidth }
      );

    // Footer
    const footerY = doc.page.height - 40;
    doc.rect(0, footerY - 4, doc.page.width, 1).fill(GOLD);
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(
        `Erstellt mit Wohnung Bot  ·  ${new Date().toLocaleDateString("de-DE")}`,
        60, footerY, { width: fullWidth, align: "center" }
      );

    doc.end();
  });
}
