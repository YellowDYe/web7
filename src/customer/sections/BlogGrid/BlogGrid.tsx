import React, { useState, useEffect } from 'react';
import { ArrowRight, Calendar, Tag } from 'lucide-react';
import { blogService } from '../../../services/blogService';
import type { BlogPost } from '../../../types/website';

interface BlogGridProps {
  title?: string;
  subtitle?: string;
  postsToShow?: number;
  showViewAll?: boolean;
  viewAllLink?: string;
  viewAllText?: string;
  basePath?: string;
}

const PostCard: React.FC<{ post: BlogPost; basePath: string }> = ({ post, basePath }) => {
  const postUrl = `${basePath}/blog/${post.slug}`;
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <a
      href={postUrl}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
    >
      <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
            <svg className="w-12 h-12 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-xs font-medium bg-[#e9ff93] text-[#1e1e1e] px-2 py-0.5 rounded-full border border-black/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h3 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-xl leading-tight mb-2 group-hover:text-red-600 transition-colors line-clamp-2">
          {post.title}
        </h3>

        {post.summary && (
          <p className="[font-family:'Chivo',Helvetica] text-gray-600 text-sm leading-relaxed flex-1 line-clamp-3 mb-4">
            {post.summary}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
          {formattedDate && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400 [font-family:'Chivo',Helvetica]">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-sm font-medium text-red-600 [font-family:'Chivo',Helvetica] group-hover:gap-2 transition-all">
            Leer más
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </a>
  );
};

export const BlogGrid: React.FC<BlogGridProps> = ({
  title = "Artículos Recientes",
  subtitle = "Consejos de nutrición, recetas y más",
  postsToShow = 3,
  showViewAll = true,
  viewAllLink = "/shop/blog",
  viewAllText = "Ver todos los artículos",
  basePath = '/shop'
}) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    blogService.getPublishedPosts(postsToShow)
      .then(setPosts)
      .catch(err => console.error('Error loading blog posts:', err))
      .finally(() => setLoading(false));
  }, [postsToShow]);

  const resolvedViewAllLink = viewAllLink.startsWith('/shop') ? viewAllLink : `${basePath}${viewAllLink}`;

  if (loading) {
    return (
      <section className="w-full py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: postsToShow }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-80" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="w-full py-16 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            {title && (
              <h2 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-3xl md:text-4xl tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="[font-family:'Chivo',Helvetica] text-gray-500 mt-2 text-base">
                {subtitle}
              </p>
            )}
          </div>
          {showViewAll && (
            <a
              href={resolvedViewAllLink}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-[#1e1e1e] [font-family:'Chivo',Helvetica] border border-black rounded-full px-5 py-2 hover:bg-black hover:text-white transition-colors shrink-0 ml-6"
            >
              {viewAllText}
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => (
            <PostCard key={post.id} post={post} basePath={basePath} />
          ))}
        </div>

        {/* Mobile view all button */}
        {showViewAll && (
          <div className="mt-8 text-center md:hidden">
            <a
              href={resolvedViewAllLink}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#1e1e1e] [font-family:'Chivo',Helvetica] border border-black rounded-full px-6 py-2.5 hover:bg-black hover:text-white transition-colors"
            >
              {viewAllText}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};
