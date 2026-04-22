## SocialConnect

SocialConnect is a Next.js + Supabase social media app with JWT authentication, user profiles, post creation (with image upload), likes/comments, follow/unfollow, and a personalized feed.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Add environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

3. In Supabase SQL editor, run:

`supabase/schema.sql`

4. Create a public storage bucket named `files`.

5. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Implemented API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/users`
- `GET /api/users/:userId`
- `GET|PATCH /api/users/me`
- `POST|DELETE /api/users/:userId/follow`
- `GET /api/users/:userId/followers`
- `GET /api/users/:userId/following`
- `GET|POST /api/posts`
- `GET|PATCH|DELETE /api/posts/:postId`
- `POST|DELETE /api/posts/:postId/like`
- `GET|POST /api/posts/:postId/comments`
- `DELETE /api/posts/:postId/comments/:commentId`
- `GET /api/feed`
- `POST /api/upload`

## Notes

- Uploaded files are validated for JPEG/PNG and max 2MB.
- Feed is chronological. When authenticated and following users, feed narrows to followed users.
- `like_count` and `comment_count` are denormalized on posts and updated through RPC functions.

## Deployment

Deploy on Vercel or Netlify after setting the same environment variables.
Url:https://social-nest-8lym.vercel.app/

