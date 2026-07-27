import { Request, Response, NextFunction } from "express";

export function validateBody(...requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of requiredFields) {
      const value = req.body[field];
      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        res.status(400).json({ error: `${field} is required` });
        return;
      }
    }
    next();
  };
}
