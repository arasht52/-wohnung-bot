import { Router } from "express";
import { body } from "express-validator";
import { profileRules, validate } from "../middleware/validate.js";
import { generateBewerbungsmappe } from "../services/pdfService.js";

const router = Router();

router.post(
  "/generate-bewerbungsmappe",
  [
    ...profileRules,
    body("anschreiben").trim().notEmpty().isLength({ max: 2000 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { anschreiben, ...profileData } = req.body;
      const pdfBuffer = await generateBewerbungsmappe(profileData, anschreiben);

      const filename = `Bewerbungsmappe_${profileData.lastName}_${profileData.firstName}.pdf`
        .replace(/\s+/g, "_");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("generate-bewerbungsmappe error:", err.message);
      res.status(500).json({ error: "Failed to generate PDF. Please try again." });
    }
  }
);

export default router;
