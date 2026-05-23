import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://rescounts:rescounts@localhost:5432/rescounts"),
});

export const config = envSchema.parse(process.env);
