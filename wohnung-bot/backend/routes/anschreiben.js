import { Router } from "express";
import { profileRules, validate } from "../middleware/validate.js";
import { generateAnschreiben } from "../services/claudeService.js";
import { upsertUser } from "../db.js";

const router = Router();

router.post("/generate-anschreiben", profileRules, validate, async (req, res) => {
  try {
    const data = req.body;

    if (data.telegramUserId) {
      upsertUser(data);
    }

    const anschreiben = await generateAnschreiben(data);
    res.json({ anschreiben });
  } catch (err) {
    console.error("generate-anschreiben error:", err.message);
    res.status(500).json({ error: "Failed to generate Anschreiben. Please try again." });
  }
});

export default router;
