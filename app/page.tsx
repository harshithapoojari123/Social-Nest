"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";

type Tab = "feed" | "explore" | "create" | "profile";
type AuthMode = "login" | "register";

type Profile = {
  id: string;
  email?: string | null;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  website?: string | null;
  location?: string | null;
};

type PublicUser = {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  posts_count?: number | null;
  follower_count?: number | null;
  following_count?: number | null;
};

type Post = {
  id: string;
  author_id?: string | null;
  content: string;
  image_url?: string | null;
  like_count?: number | null;
  comment_count?: number | null;
  created_at: string;
  author?: {
    id?: string;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author?: {
    id?: string;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

type FollowingEntry = {
  following?: {
    id?: string;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

type RegisterForm = {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
};

type ProfileForm = {
  first_name: string;
  last_name: string;
  bio: string;
  website: string;
  location: string;
  avatar_url: string;
};

type EditingPost = {
  id: string;
  content: string;
  image_url: string;
  imageFile: File | null;
};

const TOKEN_KEY = "socialnest_token";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function initialsFromName(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "SN";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function emptyProfileForm(profile?: Profile | null): ProfileForm {
  return {
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    bio: profile?.bio ?? "",
    website: profile?.website ?? "",
    location: profile?.location ?? "",
    avatar_url: profile?.avatar_url ?? "",
  };
}

function displayName(profile?: Profile | null) {
  if (!profile) {
    return "Creator";
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return fullName || profile.username;
}

function cleanText(value: string) {
  return value.trim();
}

function optionalUrl(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
}

function Avatar({
  name,
  src,
  className = "",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-[linear-gradient(135deg,rgba(56,189,248,0.35),rgba(15,23,42,1))] font-semibold text-white`}
    >
      {initialsFromName(name)}
    </div>
  );
}

function PostCard({
  post,
  token,
  owner,
  isFollowingAuthor,
  isEditing,
  editingDraft,
  busyAction,
  followBusy,
  onRefresh,
  onStartEdit,
  onCancelEdit,
  onDelete,
  onToggleFollow,
  onEditDraftChange,
  onEditImageFileChange,
  onSaveEdit,
}: {
  post: Post;
  token: string | null;
  owner: boolean;
  isFollowingAuthor: boolean;
  isEditing: boolean;
  editingDraft: EditingPost | null;
  busyAction: string | null;
  followBusy: boolean;
  onRefresh: () => Promise<void>;
  onStartEdit: (post: Post) => void;
  onCancelEdit: () => void;
  onDelete: (post: Post) => void;
  onToggleFollow: (post: Post) => Promise<void>;
  onEditDraftChange: (field: "content" | "image_url", value: string) => void;
  onEditImageFileChange: (file: File | null) => void;
  onSaveEdit: () => void;
}) {
  const authorName = post.author?.username ?? "unknown";
  const authorId = post.author?.id ?? post.author_id ?? null;
  const isBusy = busyAction === `delete-post:${post.id}` || busyAction === `edit-post:${post.id}`;
  const [liked, setLiked] = useState(false);
  const [likesBusy, setLikesBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsBusy, setCommentsBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [interactionError, setInteractionError] = useState("");

  async function toggleLike() {
    if (!token) {
      setInteractionError("Please log in to like posts.");
      return;
    }

    setLikesBusy(true);
    setInteractionError("");

    try {
      if (liked) {
        await apiRequest(`/api/posts/${post.id}/like`, { method: "DELETE" }, token);
        setLiked(false);
      } else {
        try {
          await apiRequest(`/api/posts/${post.id}/like`, { method: "POST" }, token);
          setLiked(true);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Like failed.";
          if (message.toLowerCase().includes("unique")) {
            await apiRequest(`/api/posts/${post.id}/like`, { method: "DELETE" }, token);
            setLiked(false);
          } else {
            throw err;
          }
        }
      }

      await onRefresh();
    } catch (err) {
      setInteractionError(err instanceof Error ? err.message : "Could not update like.");
    } finally {
      setLikesBusy(false);
    }
  }

  async function toggleFollow() {
    if (!token || !authorId || owner) {
      return;
    }

    setInteractionError("");

    try {
      await onToggleFollow(post);
    } catch (err) {
      setInteractionError(err instanceof Error ? err.message : "Could not update follow state.");
    }
  }

  async function loadComments() {
    if (commentsBusy) {
      return;
    }

    setCommentsBusy(true);
    setInteractionError("");

    try {
      const response = await apiRequest<{ results: Comment[] }>(`/api/posts/${post.id}/comments`);
      setComments(response.results ?? []);
    } catch (err) {
      setInteractionError(err instanceof Error ? err.message : "Could not load comments.");
    } finally {
      setCommentsBusy(false);
    }
  }

  async function openComments() {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && comments.length === 0) {
      await loadComments();
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setInteractionError("Please log in to comment.");
      return;
    }

    const content = commentDraft.trim();
    if (!content) {
      return;
    }

    setCommentSubmitting(true);
    setInteractionError("");

    try {
      await apiRequest(
        `/api/posts/${post.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ content }),
        },
        token
      );
      setCommentDraft("");
      setCommentsOpen(true);
      await Promise.all([loadComments(), onRefresh()]);
    } catch (err) {
      setInteractionError(err instanceof Error ? err.message : "Could not add comment.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  return (
    <article className="glass-strong overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar
            name={authorName}
            src={post.author?.avatar_url ?? null}
            className="h-11 w-11 rounded-full"
          />
          <div>
            <p className="font-semibold text-white">@{authorName}</p>
            <p className="text-xs text-slate-400">{relativeTime(post.created_at)}</p>
          </div>
        </div>

        {owner ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStartEdit(post)}
              className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-300/60 hover:bg-sky-400/20"
              disabled={isBusy}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(post)}
              className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:border-rose-300/60 hover:bg-rose-400/20"
              disabled={isBusy}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-5">
        {isEditing && editingDraft ? (
          <div className="space-y-4">
            <textarea
              value={editingDraft.content}
              onChange={(e) => onEditDraftChange("content", e.target.value)}
              rows={5}
              className="min-h-32 w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
            />

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={editingDraft.image_url}
                onChange={(e) => onEditDraftChange("image_url", e.target.value)}
                placeholder="Image link for this post"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
              />
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15">
                Upload file
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => onEditImageFileChange(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {editingDraft.image_url ? (
              <img
                src={editingDraft.image_url}
                alt="Edited preview"
                className="h-56 w-full rounded-[24px] object-cover"
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSaveEdit}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyAction === `edit-post:${post.id}`}
              >
                {busyAction === `edit-post:${post.id}` ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                disabled={busyAction === `edit-post:${post.id}`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {post.content}
            </p>

            {post.image_url ? (
              <img
                src={post.image_url}
                alt="Post visual"
                className="max-h-[36rem] w-full rounded-[24px] object-cover"
              />
            ) : null}

            <div className="flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">
                  {formatCount(post.like_count ?? 0)} likes
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">
                  {formatCount(post.comment_count ?? 0)} comments
                </span>
                <button
                  type="button"
                  onClick={toggleLike}
                  disabled={likesBusy || !token}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {liked ? "Unlike" : "Like"}
                </button>
                <button
                  type="button"
                  onClick={openComments}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{commentsOpen ? "Hide comments" : "Comment"}</span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {formatCount(post.comment_count ?? 0)}
                    </span>
                  </span>
                </button>
                {!owner && token ? (
                  <button
                    type="button"
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isFollowingAuthor ? "Unfollow" : "Follow"}
                  </button>
                ) : null}
              </div>
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Social Nest
              </span>
            </div>

            {interactionError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {interactionError}
              </div>
            ) : null}

            {commentsOpen ? (
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <form className="space-y-3" onSubmit={submitComment}>
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    rows={3}
                    maxLength={280}
                    className="w-full rounded-2xl border border-white/10 bg-[#060b18] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50"
                    placeholder={token ? "Write a comment..." : "Log in to comment"}
                    disabled={!token}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="submit"
                      disabled={!token || commentSubmitting}
                      className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {commentSubmitting ? "Posting..." : "Post comment"}
                    </button>
                    <button
                      type="button"
                      onClick={loadComments}
                      disabled={commentsBusy}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {commentsBusy ? "Loading..." : "Refresh"}
                    </button>
                  </div>
                </form>

                {commentsBusy && comments.length === 0 ? (
                  <p className="text-sm text-slate-400">Loading comments...</p>
                ) : comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-2xl border border-white/10 bg-[#060b18] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">
                            @{comment.author?.username ?? "unknown"}
                          </p>
                          <p className="text-xs text-slate-500">{relativeTime(comment.created_at)}</p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    No comments yet. Be the first to start the conversation.
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [landingPosts, setLandingPosts] = useState<Post[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    email: "",
    username: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [createContent, setCreateContent] = useState("");
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImageKey, setCreateImageKey] = useState(0);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm());
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarKey, setProfileAvatarKey] = useState(0);
  const [editingPost, setEditingPost] = useState<EditingPost | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);

  async function loadLandingPreview() {
    const data = await apiRequest<{ results: Post[] }>("/api/posts?scope=explore&page_size=2");
    setLandingPosts(data.results ?? []);
  }

  async function loadAuthenticatedData(currentToken: string) {
    const profileData = await apiRequest<Profile>("/api/users/me", {}, currentToken);
    const [feedData, exploreData, usersData] = await Promise.all([
      apiRequest<{ results: Post[] }>("/api/posts?scope=mine&page_size=50", {}, currentToken),
      apiRequest<{ results: Post[] }>("/api/posts?scope=explore&page_size=50", {}, currentToken),
      apiRequest<{ results: PublicUser[] }>("/api/users", {}, currentToken),
    ]);
    const [followersResult, followingResult] = await Promise.allSettled([
      apiRequest<{ results: Array<unknown> }>(`/api/users/${profileData.id}/followers`, {}, currentToken),
      apiRequest<{ results: Array<unknown> }>(`/api/users/${profileData.id}/following`, {}, currentToken),
    ]);

    setProfile(profileData);
    setProfileForm(emptyProfileForm(profileData));
    setFeedPosts(feedData.results ?? []);
    setExplorePosts(exploreData.results ?? []);
    setUsers(usersData.results ?? []);
    setFollowersCount(
      followersResult.status === "fulfilled" ? followersResult.value.results?.length ?? 0 : 0
    );
    setFollowingCount(
      followingResult.status === "fulfilled" ? followingResult.value.results?.length ?? 0 : 0
    );
    setFollowingIds(
      followingResult.status === "fulfilled"
        ? new Set(
            (followingResult.value.results ?? [])
              .map((entry) => (entry as FollowingEntry).following?.id)
              .filter((value): value is string => Boolean(value))
          )
        : new Set()
    );

    return profileData;
  }

  function resetSessionState() {
    setToken(null);
    setProfile(null);
    setFeedPosts([]);
    setExplorePosts([]);
    setUsers([]);
    setFollowersCount(0);
    setFollowingCount(0);
    setActiveTab("feed");
    setEditingPost(null);
    setProfileAvatarFile(null);
    setCreateImageFile(null);
    setCreateContent("");
    setCreateImageUrl("");
    setProfileForm(emptyProfileForm());
    setCreateImageKey((value) => value + 1);
    setProfileAvatarKey((value) => value + 1);
  }

  async function refreshPublicView() {
    await loadLandingPreview();
  }

  async function refreshCurrentData() {
    if (token) {
      await loadAuthenticatedData(token);
      return;
    }

    await loadLandingPreview();
  }

  async function runAction(actionName: string, task: () => Promise<void>) {
    setBusyAction(actionName);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadFile(file: File, folder: string, currentToken: string) {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("folder", folder);

    const response = await apiRequest<{ url: string }>("/api/upload", { method: "POST", body: formData }, currentToken);
    return response.url;
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadLandingPreview();

        if (!active) {
          return;
        }

        const savedToken = localStorage.getItem(TOKEN_KEY);
        if (!savedToken) {
          return;
        }

        const restoredProfile = await loadAuthenticatedData(savedToken);
        setToken(savedToken);
        if (active) {
          setActiveTab("feed");
          setMessage(`Welcome back, ${displayName(restoredProfile)}`);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        localStorage.removeItem(TOKEN_KEY);
        resetSessionState();
        await loadLandingPreview();
        setError(err instanceof Error ? err.message : "Could not load the app.");
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    await runAction("login", async () => {
      const data = await apiRequest<{ access_token: string; user: Profile }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      localStorage.setItem(TOKEN_KEY, data.access_token);
      await loadAuthenticatedData(data.access_token);
      setToken(data.access_token);
      setMessage(`Signed in as @${data.user.username}`);
      setActiveTab("feed");
    });
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    await runAction("register", async () => {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });

      setLoginForm({
        identifier: registerForm.email,
        password: registerForm.password,
      });
      setAuthMode("login");
      setMessage("Account created. You can log in now.");
    });
  }

  async function handleCreatePost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!token) {
      return;
    }

    await runAction("create", async () => {
      const content = cleanText(createContent);
      if (!content) {
        throw new Error("Write something before posting.");
      }

      let imageUrl: string | undefined;
      if (createImageFile) {
        imageUrl = await uploadFile(createImageFile, "posts", token);
      } else {
        imageUrl = optionalUrl(createImageUrl, "Image link");
      }

      await apiRequest(
        "/api/posts",
        {
          method: "POST",
          body: JSON.stringify({
            content,
            image_url: imageUrl,
          }),
        },
        token
      );

      setCreateContent("");
      setCreateImageUrl("");
      setCreateImageFile(null);
      setCreateImageKey((value) => value + 1);
      setMessage("Post published.");
      await loadAuthenticatedData(token);
      setActiveTab("feed");
    });
  }

  async function saveProfile() {
    if (!token) {
      return;
    }

    await runAction("profile-save", async () => {
      const payload: Record<string, string> = {};

      const firstName = cleanText(profileForm.first_name);
      const lastName = cleanText(profileForm.last_name);
      const bio = cleanText(profileForm.bio);
      const website = optionalUrl(profileForm.website, "Website");
      const location = cleanText(profileForm.location);
      let avatarUrl: string | undefined;

      if (profileAvatarFile) {
        avatarUrl = await uploadFile(profileAvatarFile, "avatars", token);
      } else {
        avatarUrl = optionalUrl(profileForm.avatar_url, "Avatar URL");
      }

      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      if (bio) payload.bio = bio;
      if (website) payload.website = website;
      if (location) payload.location = location;
      if (avatarUrl) payload.avatar_url = avatarUrl;

      const updated = await apiRequest<Profile>(
        "/api/users/me",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token
      );

      setProfile(updated);
      setProfileForm(emptyProfileForm(updated));
      setProfileAvatarFile(null);
      setProfileAvatarKey((value) => value + 1);
      setMessage("Profile updated.");
      await loadAuthenticatedData(token);
    });
  }

  function startEditing(post: Post) {
    setEditingPost({
      id: post.id,
      content: post.content,
      image_url: post.image_url ?? "",
      imageFile: null,
    });
  }

  function updateEditingDraft(field: "content" | "image_url", value: string) {
    setEditingPost((current) => (current ? ({ ...current, [field]: value } as EditingPost) : current));
  }

  function updateEditingImage(file: File | null) {
    setEditingPost((current) => (current ? { ...current, imageFile: file } : current));
  }

  async function savePostEdit() {
    if (!token || !editingPost) {
      return;
    }

    await runAction(`edit-post:${editingPost.id}`, async () => {
      const content = cleanText(editingPost.content);
      if (!content) {
        throw new Error("Post content cannot be empty.");
      }

      let imageUrl: string | undefined;
      if (editingPost.imageFile) {
        imageUrl = await uploadFile(editingPost.imageFile, "posts", token);
      } else {
        imageUrl = optionalUrl(editingPost.image_url, "Image link");
      }

      await apiRequest(
        `/api/posts/${editingPost.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            content,
            image_url: imageUrl,
          }),
        },
        token
      );

      setEditingPost(null);
      setMessage("Post updated.");
      await loadAuthenticatedData(token);
    });
  }

  async function deletePost(post: Post) {
    if (!token) {
      return;
    }

    const confirmed = window.confirm("Delete this post? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    await runAction(`delete-post:${post.id}`, async () => {
      await apiRequest(`/api/posts/${post.id}`, { method: "DELETE" }, token);
      if (editingPost?.id === post.id) {
        setEditingPost(null);
      }
      setMessage("Post deleted.");
      await loadAuthenticatedData(token);
    });
  }

  async function toggleFollow(post: Post) {
    if (!token) {
      return;
    }

    const authorId = post.author?.id ?? post.author_id;
    if (!authorId || authorId === profile?.id) {
      return;
    }

    const actionKey = `follow:${authorId}`;
    setFollowBusyId(actionKey);
    try {
      const currentlyFollowing = followingIds.has(authorId);
      await apiRequest(
        `/api/users/${authorId}/follow`,
        { method: currentlyFollowing ? "DELETE" : "POST" },
        token
      );
      await loadAuthenticatedData(token);
    } finally {
      setFollowBusyId(null);
    }
  }

  async function toggleFollowUser(userId: string) {
    if (!token || !profile?.id || userId === profile.id) {
      return;
    }

    const actionKey = `follow:${userId}`;
    setFollowBusyId(actionKey);
    try {
      const currentlyFollowing = followingIds.has(userId);
      await apiRequest(
        `/api/users/${userId}/follow`,
        { method: currentlyFollowing ? "DELETE" : "POST" },
        token
      );
      await loadAuthenticatedData(token);
    } finally {
      setFollowBusyId(null);
    }
  }

  async function logout() {
    const currentToken = token;
    if (currentToken) {
      await apiRequest("/api/auth/logout", { method: "POST" }, currentToken).catch(() => null);
    }

    localStorage.removeItem(TOKEN_KEY);
    resetSessionState();
    setMessage("Signed out.");
    await refreshPublicView();
  }

  function handleProfileAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setProfileAvatarFile(file);
  }

  function handleCreateFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCreateImageFile(file);
  }

  const showAuth = !token;
  const recentPosts = showAuth ? landingPosts.slice(0, 2) : feedPosts.slice(0, 2);
  const profilePosts = feedPosts;
  const profileName = displayName(profile);
  const profileHandle = profile?.username ? `@${profile.username}` : "@you";
  const postsCount = feedPosts.length;
  const isOwnedPost = (post: Post) => {
    if (!profile?.id || !token) {
      return false;
    }

    return post.author_id === profile.id || post.author?.id === profile.id;
  };
  const isFollowingPostAuthor = (post: Post) => {
    const authorId = post.author?.id ?? post.author_id ?? null;
    return authorId ? followingIds.has(authorId) : false;
  };
  const isFollowingUser = (userId: string) => followingIds.has(userId);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_30%)]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.38em] text-sky-300/80">Social Nest</p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              Dark social, rebuilt clean.
            </h1>
          </div>

          {token ? (
            <nav className="flex flex-wrap items-center justify-end gap-2">
              {(["feed", "explore", "create", "profile"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-white text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-rose-400/25 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
              >
                Logout
              </button>
            </nav>
          ) : (
            <nav className="flex items-center gap-2">
              {(["login", "register"] as AuthMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAuthMode(mode)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    authMode === mode
                      ? "bg-white text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <div className="glass rounded-[24px] border border-rose-500/20 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="glass rounded-[24px] border border-sky-400/20 px-4 py-3 text-sm text-sky-100">
            {message}
          </div>
        ) : null}

        {showAuth ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
            <div className="glass-strong overflow-hidden rounded-[32px] p-6 sm:p-8">
              <div className="flex flex-col gap-4">
                <span className="w-fit rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">
                  Home preview
                </span>
                <h2 className="max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
                  A polished dark feed for posting, exploring, and profile control.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  See the newest two posts on the landing page, then sign in to switch into your
                  own feed, explore the full network, create a post, and manage your profile with
                  edits, uploads, and delete confirmations.
                </p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {recentPosts.length > 0 ? (
                  recentPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      token={token}
                      owner={false}
                      isFollowingAuthor={false}
                      isEditing={false}
                      editingDraft={null}
                      busyAction={busyAction}
                      followBusy={false}
                      onRefresh={refreshPublicView}
                      onStartEdit={startEditing}
                      onCancelEdit={() => setEditingPost(null)}
                      onDelete={deletePost}
                      onToggleFollow={toggleFollow}
                      onEditDraftChange={() => {}}
                      onEditImageFileChange={() => {}}
                      onSaveEdit={savePostEdit}
                    />
                  ))
                ) : (
                  <div className="glass rounded-[28px] p-6 text-sm text-slate-300">
                    No posts yet. Once users start sharing, the latest two will appear here.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-strong h-fit w-full max-w-[420px] justify-self-end rounded-[28px] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">
                    {authMode}
                  </p>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    {authMode === "login" ? "Login" : "Register"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  Dark mode only
                </div>
              </div>

              {authMode === "login" ? (
                <form className="space-y-3.5" onSubmit={handleLogin}>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-200">Email or username</label>
                    <input
                      value={loginForm.identifier}
                      onChange={(e) =>
                        setLoginForm((prev) => ({ ...prev, identifier: e.target.value }))
                      }
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="yourname@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-200">Password</label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) =>
                        setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busyAction === "login"}
                    className="w-full rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "login" ? "Logging in..." : "Login"}
                  </button>
                  <p className="text-sm leading-6 text-slate-400">
                    New here? Use the register tab to create your account.
                  </p>
                </form>
              ) : (
                <form className="space-y-3.5" onSubmit={handleRegister}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-200">First name</label>
                      <input
                        value={registerForm.first_name}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, first_name: e.target.value }))
                        }
                        required
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                        placeholder="Harsh"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-200">Last name</label>
                      <input
                        value={registerForm.last_name}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, last_name: e.target.value }))
                        }
                        required
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                        placeholder="Kumar"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-200">Email</label>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-200">Username</label>
                    <input
                      value={registerForm.username}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, username: e.target.value }))
                      }
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="social_creator"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-200">Password</label>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busyAction === "register"}
                    className="w-full rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "register" ? "Creating..." : "Create account"}
                  </button>
                  <p className="text-sm leading-6 text-slate-400">
                    Once your account exists, you can switch right back into login from the navbar.
                  </p>
                </form>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            {activeTab === "feed" ? (
              <div className="space-y-6">
                <div className="glass-strong rounded-[32px] p-6 sm:p-8">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">
                        Your feed
                      </p>
                      <h2 className="text-3xl font-semibold text-white">Only your posts</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                        This view shows only the posts you uploaded. Edit or delete any of them
                        directly from the card, and the newest two stay pinned at the top as a
                        quick preview.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-2xl font-semibold text-white">{formatCount(postsCount)}</div>
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Posts
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-2xl font-semibold text-white">
                          {formatCount(followersCount)}
                        </div>
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Followers
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-2xl font-semibold text-white">
                          {formatCount(followingCount)}
                        </div>
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Following
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Recent two posts</h3>
                    <p className="text-sm text-slate-400">Newest posts from your account</p>
                  </div>
                  {feedPosts.length > 0 ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {feedPosts.slice(0, 2).map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          token={token}
                          owner={isOwnedPost(post)}
                          isFollowingAuthor={isFollowingPostAuthor(post)}
                          isEditing={editingPost?.id === post.id}
                          editingDraft={editingPost?.id === post.id ? editingPost : null}
                          busyAction={busyAction}
                          followBusy={followBusyId === `follow:${post.author?.id ?? post.author_id ?? ""}`}
                          onRefresh={refreshCurrentData}
                          onStartEdit={startEditing}
                          onCancelEdit={() => setEditingPost(null)}
                          onDelete={deletePost}
                          onToggleFollow={toggleFollow}
                          onEditDraftChange={updateEditingDraft}
                          onEditImageFileChange={updateEditingImage}
                          onSaveEdit={savePostEdit}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="glass rounded-[28px] p-6 text-sm text-slate-300">
                      You have not posted yet. Use Create to publish your first post.
                    </div>
                  )}
                </div>

                {feedPosts.length > 2 ? (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Older posts</h3>
                      <p className="text-sm text-slate-400">Everything else in reverse chronology</p>
                    </div>
                    <div className="space-y-4">
                      {feedPosts.slice(2).map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          token={token}
                          owner={isOwnedPost(post)}
                          isFollowingAuthor={isFollowingPostAuthor(post)}
                          isEditing={editingPost?.id === post.id}
                          editingDraft={editingPost?.id === post.id ? editingPost : null}
                          busyAction={busyAction}
                          followBusy={followBusyId === `follow:${post.author?.id ?? post.author_id ?? ""}`}
                          onRefresh={refreshCurrentData}
                          onStartEdit={startEditing}
                          onCancelEdit={() => setEditingPost(null)}
                          onDelete={deletePost}
                          onToggleFollow={toggleFollow}
                          onEditDraftChange={updateEditingDraft}
                          onEditImageFileChange={updateEditingImage}
                          onSaveEdit={savePostEdit}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "explore" ? (
              <div className="space-y-6">
                <div className="glass-strong rounded-[32px] p-6 sm:p-8">
                  <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">Explore</p>
                  <h2 className="text-3xl font-semibold text-white">Every user&apos;s posts</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                    This is the public wall: posts from all users appear here, Instagram-style, so
                    you can browse beyond your own network.
                  </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
                  <div className="space-y-4">
                    {explorePosts.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                        {explorePosts.map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            token={token}
                            owner={isOwnedPost(post)}
                            isFollowingAuthor={isFollowingPostAuthor(post)}
                            isEditing={editingPost?.id === post.id}
                            editingDraft={editingPost?.id === post.id ? editingPost : null}
                            busyAction={busyAction}
                            followBusy={
                              followBusyId === `follow:${post.author?.id ?? post.author_id ?? ""}`
                            }
                            onRefresh={refreshCurrentData}
                            onStartEdit={startEditing}
                            onCancelEdit={() => setEditingPost(null)}
                            onDelete={deletePost}
                            onToggleFollow={toggleFollow}
                            onEditDraftChange={updateEditingDraft}
                            onEditImageFileChange={updateEditingImage}
                            onSaveEdit={savePostEdit}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="glass rounded-[28px] p-6 text-sm text-slate-300">
                        No public posts found yet.
                      </div>
                    )}
                  </div>

                  <aside className="space-y-4">
                    <div className="glass-strong rounded-[32px] p-6 sm:p-8">
                      <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">Users</p>
                      <h3 className="text-2xl font-semibold text-white">Visible creators</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-300">
                        See how many posts each user has, plus their follower activity.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {users.length > 0 ? (
                        users.map((user) => {
                          const isSelf = user.id === profile?.id;
                          const busy = followBusyId === `follow:${user.id}`;
                          return (
                            <div
                              key={user.id}
                              className="glass rounded-[28px] border border-white/10 p-4"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar
                                  name={displayName(user)}
                                  src={user.avatar_url ?? null}
                                  className="h-12 w-12 rounded-full"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold text-white">@{user.username}</p>
                                  <p className="text-xs text-slate-400">
                                    {formatCount(user.posts_count ?? 0)} posts
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-slate-300">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                  <div className="font-semibold text-white">
                                    {formatCount(user.follower_count ?? 0)}
                                  </div>
                                  <div className="uppercase tracking-[0.22em] text-slate-500">
                                    Followers
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                  <div className="font-semibold text-white">
                                    {formatCount(user.following_count ?? 0)}
                                  </div>
                                  <div className="uppercase tracking-[0.22em] text-slate-500">
                                    Following
                                  </div>
                                </div>
                              </div>

                              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                                {user.bio || "No bio added yet."}
                              </p>

                              {!isSelf && token ? (
                                <button
                                  type="button"
                                  onClick={() => toggleFollowUser(user.id)}
                                  disabled={busy}
                                  className="mt-4 w-full rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isFollowingUser(user.id) ? "Unfollow" : "Follow"}
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        <div className="glass rounded-[28px] p-6 text-sm text-slate-300">
                          No users loaded yet.
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}

            {activeTab === "create" ? (
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="glass-strong rounded-[32px] p-6 sm:p-8">
                  <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">Create</p>
                  <h2 className="text-3xl font-semibold text-white">Publish a new post</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                    Write the post, optionally attach a photo from your device or paste an image
                    link, and send it straight to your feed.
                  </p>
                </div>

                <form className="glass-strong space-y-5 rounded-[32px] p-6 sm:p-8" onSubmit={handleCreatePost}>
                  <textarea
                    value={createContent}
                    onChange={(e) => setCreateContent(e.target.value)}
                    rows={7}
                    maxLength={280}
                    required
                    className="min-h-40 w-full rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                    placeholder="Share a thought, photo story, or update..."
                  />

                  <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <input
                      value={createImageUrl}
                      onChange={(e) => setCreateImageUrl(e.target.value)}
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="Image link (optional)"
                    />
                    <label className="flex cursor-pointer items-center justify-center rounded-3xl border border-dashed border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15">
                      Upload image
                      <input
                        key={createImageKey}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={handleCreateFileChange}
                      />
                    </label>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    {createImageFile
                      ? `Selected file: ${createImageFile.name}`
                      : createImageUrl
                        ? "A link is ready to use."
                        : "Image is optional. You can publish text-only posts too."}
                  </div>

                  {createImageUrl ? (
                    <img
                      src={createImageUrl}
                      alt="Create preview"
                      className="max-h-80 w-full rounded-[28px] object-cover"
                    />
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={busyAction === "create"}
                      className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "create" ? "Publishing..." : "Publish post"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateContent("");
                        setCreateImageUrl("");
                        setCreateImageFile(null);
                        setCreateImageKey((value) => value + 1);
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {activeTab === "profile" ? (
              <div className="space-y-6">
                <div className="glass-strong rounded-[32px] p-6 sm:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar
                        name={profileName}
                        src={profile?.avatar_url ?? null}
                        className="h-24 w-24 rounded-[28px] text-2xl"
                      />
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">
                            Profile
                          </p>
                          <h2 className="text-3xl font-semibold text-white">{profileName}</h2>
                          <p className="text-sm text-slate-400">{profileHandle}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                            {formatCount(postsCount)} posts
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                            {formatCount(followersCount)} followers
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                            {formatCount(followingCount)} following
                          </span>
                        </div>
                        {profile?.bio ? (
                          <p className="max-w-2xl text-sm leading-7 text-slate-300">{profile.bio}</p>
                        ) : (
                          <p className="text-sm text-slate-500">Add a bio so your profile feels complete.</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={logout}
                      className="rounded-full border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
                    >
                      Logout
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                  <form className="glass-strong space-y-4 rounded-[32px] p-6 sm:p-8">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">
                          Edit profile
                        </p>
                        <h3 className="text-2xl font-semibold text-white">Avatar, bio, and details</h3>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                        Save changes
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <input
                        value={profileForm.first_name}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, first_name: e.target.value }))
                        }
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                        placeholder="First name"
                      />
                      <input
                        value={profileForm.last_name}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, last_name: e.target.value }))
                        }
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                        placeholder="Last name"
                      />
                    </div>

                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
                      rows={5}
                      className="min-h-32 w-full rounded-[28px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="Bio"
                    />

                    <input
                      value={profileForm.website}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, website: e.target.value }))
                      }
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="Website"
                    />
                    <input
                      value={profileForm.location}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, location: e.target.value }))
                      }
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="Location"
                    />
                    <input
                      value={profileForm.avatar_url}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, avatar_url: e.target.value }))
                      }
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:bg-white/[0.08]"
                      placeholder="Avatar link"
                    />

                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <label className="flex cursor-pointer items-center justify-center rounded-3xl border border-dashed border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15">
                        Upload avatar from device
                        <input
                          key={profileAvatarKey}
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={handleProfileAvatarChange}
                        />
                      </label>
                      {profileAvatarFile ? (
                        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                          Selected file: {profileAvatarFile.name}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                          Use a public link or upload a new avatar.
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={busyAction === "profile-save"}
                      className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "profile-save" ? "Saving profile..." : "Save profile"}
                    </button>
                  </form>

                  <div className="space-y-4">
                    <div className="glass-strong rounded-[32px] p-6 sm:p-8">
                      <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">
                        Profile overview
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                          <div className="text-2xl font-semibold text-white">{formatCount(postsCount)}</div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Posts
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                          <div className="text-2xl font-semibold text-white">
                            {formatCount(followersCount)}
                          </div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Followers
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                          <div className="text-2xl font-semibold text-white">
                            {formatCount(followingCount)}
                          </div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Following
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                        Your avatar, bio, website, and location update from here. If someone follows
                        you, the follower count above moves with it.
                      </div>
                    </div>

                    <div className="glass-strong rounded-[32px] p-6 sm:p-8">
                      <p className="text-xs uppercase tracking-[0.34em] text-sky-300/80">Posts</p>
                      <h3 className="text-2xl font-semibold text-white">Edit or delete your posts</h3>
                      <div className="mt-4 space-y-4">
                        {profilePosts.length > 0 ? (
                          profilePosts.map((post) => (
                            <PostCard
                              key={post.id}
                              post={post}
                              token={token}
                              owner={isOwnedPost(post)}
                              isFollowingAuthor={isFollowingPostAuthor(post)}
                              isEditing={editingPost?.id === post.id}
                              editingDraft={editingPost?.id === post.id ? editingPost : null}
                              busyAction={busyAction}
                              followBusy={followBusyId === `follow:${post.author?.id ?? post.author_id ?? ""}`}
                              onRefresh={refreshCurrentData}
                              onStartEdit={startEditing}
                              onCancelEdit={() => setEditingPost(null)}
                              onDelete={deletePost}
                              onToggleFollow={toggleFollow}
                              onEditDraftChange={updateEditingDraft}
                              onEditImageFileChange={updateEditingImage}
                              onSaveEdit={savePostEdit}
                            />
                          ))
                        ) : (
                          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                            Your posts will appear here after you create your first one.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
