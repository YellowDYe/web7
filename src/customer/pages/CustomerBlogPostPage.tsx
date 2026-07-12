import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Tag } from 'lucide-react';
import { blogService } from '../../services/blogService';
import type { BlogPost } from '../../types/website';
import { CustomerSiteHeader } from '../components/CustomerSiteHeader';

const CustomerBlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    blogService.getPostBySlug(slug)
      .then(data => {
        if (!data || data.status !== 'published') {
          setNotFound(true);
        } else {
          setPost(data);
          document.title = data.meta_title || data.title;

          const metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) {
            metaDesc.setAttribute('content', data.meta_description || data.summary);
          } else {
            const tag = document.createElement('meta');
            tag.name = 'description';
            tag.content = data.meta_description || data.summary;
            document.head.appendChild(tag);
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerSiteHeader />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-100 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="aspect-[16/9] bg-gray-100 rounded-2xl mt-8" />
            <div className="space-y-3 mt-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`h-4 bg-gray-100 rounded ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerSiteHeader />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="[font-family:'Antonio',Helvetica] font-bold text-4xl text-gray-900 mb-4">
            Artículo no encontrado
          </h1>
          <p className="[font-family:'Chivo',Helvetica] text-gray-500 mb-8">
            El artículo que buscas no existe o ya no está disponible.
          </p>
          <Link
            to="/shop/blog"
            className="inline-flex items-center gap-2 bg-[#1e1e1e] text-white px-6 py-3 rounded-full text-sm font-medium [font-family:'Chivo',Helvetica] hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al blog
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-white">
      <CustomerSiteHeader />

      {/* Cover Image */}
      {post.cover_image_url && (
        <div className="w-full aspect-[21/9] max-h-[520px] overflow-hidden bg-gray-100">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Article */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          to="/shop/blog"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 [font-family:'Chivo',Helvetica] mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Volver al blog
        </Link>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map(tag => (
              <Link
                key={tag}
                to={`/shop/blog?tag=${encodeURIComponent(tag)}`}
                className="text-xs font-medium bg-[#e9ff93] text-[#1e1e1e] px-2.5 py-1 rounded-full border border-black/10 hover:bg-[#d4e87a] transition-colors [font-family:'Chivo',Helvetica]"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-3xl md:text-4xl lg:text-5xl leading-tight tracking-tight mb-5">
          {post.title}
        </h1>

        {/* Meta: date + author */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 [font-family:'Chivo',Helvetica] mb-8 pb-8 border-b border-gray-100">
          {formattedDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formattedDate}
            </span>
          )}
          {post.author && (
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {post.author}
            </span>
          )}
        </div>

        {/* Summary (if exists and body also exists) */}
        {post.summary && post.body && (
          <p className="[font-family:'Chivo',Helvetica] text-gray-600 text-lg leading-relaxed mb-8 font-medium border-l-4 border-[#e9ff93] pl-4">
            {post.summary}
          </p>
        )}

        {/* Body - render HTML safely */}
        {post.body ? (
          <div
            className="prose-blog"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        ) : post.summary ? (
          <p className="[font-family:'Chivo',Helvetica] text-gray-700 text-lg leading-relaxed">
            {post.summary}
          </p>
        ) : null}

        {/* Footer tags */}
        {post.tags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <p className="flex items-center gap-2 text-sm text-gray-400 [font-family:'Chivo',Helvetica] mb-3">
              <Tag className="w-4 h-4" />
              Etiquetas:
            </p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/shop/blog?tag=${encodeURIComponent(tag)}`}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors [font-family:'Chivo',Helvetica]"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back to blog CTA */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="[font-family:'Chivo',Helvetica] text-gray-500 mb-4">
            ¿Te gustó este artículo?
          </p>
          <Link
            to="/shop/blog"
            className="inline-flex items-center gap-2 bg-[#1e1e1e] text-white px-7 py-3 rounded-full text-sm font-medium [font-family:'Chivo',Helvetica] hover:bg-gray-800 transition-colors"
          >
            Ver todos los artículos
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </article>

      <style>{`
        .prose-blog h1, .prose-blog h2, .prose-blog h3, .prose-blog h4 {
          font-family: 'Antonio', Helvetica, sans-serif;
          font-weight: 700;
          color: #1e1e1e;
          line-height: 1.2;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
        }
        .prose-blog h2 { font-size: 1.75rem; }
        .prose-blog h3 { font-size: 1.375rem; }
        .prose-blog h4 { font-size: 1.125rem; }
        .prose-blog p {
          font-family: 'Chivo', Helvetica, sans-serif;
          color: #374151;
          font-size: 1.0625rem;
          line-height: 1.75;
          margin-bottom: 1.25rem;
        }
        .prose-blog ul, .prose-blog ol {
          font-family: 'Chivo', Helvetica, sans-serif;
          color: #374151;
          font-size: 1.0625rem;
          line-height: 1.75;
          padding-left: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .prose-blog ul { list-style-type: disc; }
        .prose-blog ol { list-style-type: decimal; }
        .prose-blog li { margin-bottom: 0.375rem; }
        .prose-blog strong {
          font-weight: 700;
          color: #1e1e1e;
        }
        .prose-blog em {
          font-style: italic;
        }
        .prose-blog a {
          color: #dc2626;
          text-decoration: underline;
        }
        .prose-blog a:hover {
          color: #b91c1c;
        }
        .prose-blog img {
          width: 100%;
          border-radius: 1rem;
          margin: 1.5rem 0;
          object-fit: cover;
        }
        .prose-blog blockquote {
          border-left: 4px solid #e9ff93;
          padding-left: 1rem;
          margin: 1.5rem 0;
          color: #6b7280;
          font-style: italic;
        }
        .prose-blog hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 2rem 0;
        }
      `}</style>
    </div>
  );
};

export default CustomerBlogPostPage;
