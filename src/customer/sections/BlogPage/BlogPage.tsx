import React, { useState, useEffect } from 'react';
import { ArrowRight, Calendar, Search, Tag, X } from 'lucide-react';
import { blogService } from '../../../services/blogService';
import type { BlogPost } from '../../../types/website';

interface BlogPageProps {
  title?: string;
  subtitle?: string;
  description?: string;
  basePath?: string;
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  descriptionColor?: string;
}

const PostCard: React.FC<{ post: BlogPost; basePath: string; onTagClick: (tag: string) => void }> = ({ post, basePath, onTagClick }) => {
  const postUrl = `${basePath}/blog/${post.slug}`;
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <article className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300">
      <a href={postUrl} className="block aspect-[16/9] bg-gray-100 overflow-hidden">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
            <svg className="w-16 h-16 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
        )}
      </a>

      <div className="p-6 flex flex-col flex-1">
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.map(tag => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="text-xs font-medium bg-[#e9ff93] text-[#1e1e1e] px-2.5 py-0.5 rounded-full border border-black/10 hover:bg-[#d4e87a] transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <a href={postUrl}>
          <h2 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-2xl leading-tight mb-3 group-hover:text-red-600 transition-colors line-clamp-2">
            {post.title}
          </h2>
        </a>

        {post.summary && (
          <p className="[font-family:'Chivo',Helvetica] text-gray-600 text-base leading-relaxed flex-1 line-clamp-3 mb-4">
            {post.summary}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
          <div className="flex items-center gap-3 text-sm text-gray-400 [font-family:'Chivo',Helvetica]">
            {formattedDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>
            )}
            {post.author && (
              <span className="hidden sm:block">{post.author}</span>
            )}
          </div>
          <a
            href={postUrl}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-600 [font-family:'Chivo',Helvetica] hover:gap-2.5 transition-all"
          >
            Leer más
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </article>
  );
};

const isValidCssColor = (value: string): boolean => {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ||
    /^rgba?\(/.test(value) ||
    /^hsla?\(/.test(value) ||
    /^[a-zA-Z]+$/.test(value);
};

export const BlogPage: React.FC<BlogPageProps> = ({
  title = 'Artículos y Consejos',
  subtitle = 'Blog',
  description = 'Nutrición, recetas saludables y todo lo que necesitas saber para alcanzar tus metas.',
  basePath = '',
  backgroundColor = '#1e1e1e',
  titleColor = '#ffffff',
  subtitleColor = '#e9ff93',
  descriptionColor = '#d1d5db',
}) => {
  const safeBgColor = backgroundColor && isValidCssColor(backgroundColor) ? backgroundColor : '#1e1e1e';
  const safeTitleColor = titleColor && isValidCssColor(titleColor) ? titleColor : '#ffffff';
  const safeSubtitleColor = subtitleColor && isValidCssColor(subtitleColor) ? subtitleColor : '#e9ff93';
  const safeDescriptionColor = descriptionColor && isValidCssColor(descriptionColor) ? descriptionColor : '#d1d5db';
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    blogService.getPublishedPosts()
      .then(setPosts)
      .catch(err => console.error('Error loading blog posts:', err))
      .finally(() => setLoading(false));
  }, []);

  const allTags = Array.from(new Set(posts.flatMap(p => p.tags))).sort();

  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchTerm || (
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const matchesTag = !activeTag || post.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-white overflow-hidden rounded-[45px]">
      <div
        className="pt-20 pb-14 px-4 rounded-t-[45px]"
        style={{ backgroundColor: safeBgColor }}
      >
        <div className="max-w-6xl mx-auto">
          <p
            className="[font-family:'Chivo',Helvetica] text-sm font-medium uppercase tracking-widest mb-3"
            style={{ color: safeSubtitleColor }}
          >
            {subtitle}
          </p>
          <h1
            className="[font-family:'Antonio',Helvetica] font-bold text-4xl md:text-5xl lg:text-6xl tracking-tight mb-4"
            style={{ color: safeTitleColor }}
          >
            {title}
          </h1>
          <p className="[font-family:'Chivo',Helvetica] text-lg max-w-xl" style={{ color: safeDescriptionColor }}>
            {description}
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar artículos..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm [font-family:'Chivo',Helvetica] focus:outline-none focus:ring-2 focus:ring-[#1e1e1e] focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors [font-family:'Chivo',Helvetica] ${
                activeTag === null
                  ? 'bg-[#1e1e1e] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors [font-family:'Chivo',Helvetica] ${
                  activeTag === tag
                    ? 'bg-[#e9ff93] text-[#1e1e1e] border border-black/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag}
                {activeTag === tag && <X className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-80" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="w-7 h-7 text-gray-300" />
            </div>
            <p className="[font-family:'Antonio',Helvetica] text-xl font-bold text-gray-900 mb-1">
              Sin resultados
            </p>
            <p className="[font-family:'Chivo',Helvetica] text-gray-500 text-sm">
              {activeTag ? `No hay artículos con la etiqueta "${activeTag}".` : 'Prueba con otra búsqueda.'}
            </p>
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                className="mt-4 text-sm text-red-600 hover:underline [font-family:'Chivo',Helvetica]"
              >
                Ver todos los artículos
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="[font-family:'Chivo',Helvetica] text-sm text-gray-400 mb-6">
              {filteredPosts.length} artículo{filteredPosts.length !== 1 ? 's' : ''}
              {activeTag ? ` · etiqueta: "${activeTag}"` : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map(post => (
                <PostCard key={post.id} post={post} basePath={basePath} onTagClick={setActiveTag} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
