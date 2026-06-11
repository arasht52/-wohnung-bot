import { body, validationResult } from "express-validator";

export const profileRules = [
  body("firstName").trim().notEmpty().isLength({ max: 60 }),
  body("lastName").trim().notEmpty().isLength({ max: 60 }),
  body("job").trim().notEmpty().isLength({ max: 100 }),
  body("income").isInt({ min: 100, max: 99999 }),
  body("familySize").isInt({ min: 1, max: 10 }),
  body("hasPets").isBoolean(),
  body("city").trim().notEmpty().isLength({ max: 80 }),
  body("maxRent").isInt({ min: 100, max: 99999 }),
  body("rooms").trim().notEmpty(),
  body("moveDate").isISO8601(),
  body("extraNote").optional().trim().isLength({ max: 500 }),
];

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
