import { z } from "zod";

export const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().regex(usernameRegex),
  password: z.string().min(6),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(6),
});

export const profileUpdateSchema = z.object({
  bio: z.string().max(160).optional(),
  avatar_url: z.string().url().optional(),
  website: z.string().url().optional(),
  location: z.string().max(80).optional(),
  first_name: z.string().max(80).optional(),
  last_name: z.string().max(80).optional(),
});

export const postSchema = z.object({
  content: z.string().max(280),
  image_url: z.string().url().optional(),
});

export const commentSchema = z.object({
  content: z.string().min(1).max(280),
});
