import type { PostMeta } from "@/lib/content";

export function BlogCover({ post, priority = false, decorative = false }: { post: PostMeta; priority?: boolean; decorative?: boolean }) {
  return (
    <img
      src={post.displayImage}
      alt={decorative ? "" : post.imageAlt}
      width={1200}
      height={630}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className="blog-cover-image"
    />
  );
}
