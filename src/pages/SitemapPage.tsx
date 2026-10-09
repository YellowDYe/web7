import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Newspaper, Loader2 } from 'lucide-react';
import { supabase } from '../config/supabase';

interface SitemapEntry {
  path: string;
  title: string;
  updatedAt: string | null;
}

interface BlogEntry {
  slug: string;
  title: string;
  publishedAt: string | null;
}

const EXCLUDED_PATHS = new Set([
  '/account',
  '/cart',
  '/checkout',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/order',
]);

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const SitemapPage: React.FC = () => {
  const navigate = useNavigate();
  const [pages, setPages] = useState<SitemapEntry[]>([]);
  const [posts, setPosts] = useState<BlogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [pagesRes, postsRes] = await Promise.all([
          supabase
            .from('cms_pages')
            .select('path, title, updated_at')
            .eq('published', true)
            .order('path'),
          supabase
            .from('blog_posts')
            .select('slug, title, published_at')
            .eq('status', 'published')
            .order('published_at', { ascending: false, nullsFirst: false }),
        ]);

        if (pagesRes.error) throw pagesRes.error;
        if (postsRes.error) throw postsRes.error;

        setPages(
          (pagesRes.data || []).filter(
            (p) => !EXCLUDED_PATHS.has(p.path)
          )
        );
        setPosts(postsRes.data || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Regresar</span>
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Mapa del Sitio
          </h1>
          <p className="text-gray-600 mb-8">
            Encuentra r&aacute;pidamente todas las p&aacute;ginas de nuestro sitio.
          </p>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-500">Cargando...</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                No se pudo cargar el mapa del sitio en este momento.
              </p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-10">
              {/* Pages section */}
              {pages.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 mb-5">
                    <FileText className="w-6 h-6 text-[#bfd730]" />
                    P&aacute;ginas
                  </h2>
                  <ul className="space-y-1">
                    {pages.map((page) => (
                      <li key={page.path}>
                        <Link
                          to={page.path}
                          className="group flex items-center justify-between rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-gray-700 group-hover:text-gray-900 font-medium">
                            {page.title || page.path}
                          </span>
                          {page.updatedAt && (
                            <span className="text-sm text-gray-400 hidden sm:block">
                              {formatDate(page.updatedAt)}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Blog posts section */}
              {posts.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 mb-5">
                    <Newspaper className="w-6 h-6 text-[#bfd730]" />
                    Blog
                  </h2>
                  <ul className="space-y-1">
                    {posts.map((post) => (
                      <li key={post.slug}>
                        <Link
                          to={`/blog/${post.slug}`}
                          className="group flex items-center justify-between rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-gray-700 group-hover:text-gray-900 font-medium">
                            {post.title}
                          </span>
                          {post.publishedAt && (
                            <span className="text-sm text-gray-400 hidden sm:block">
                              {formatDate(post.publishedAt)}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {pages.length === 0 && posts.length === 0 && (
                <p className="text-gray-500 text-center py-12">
                  No hay contenido publicado para mostrar.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SitemapPage;
