import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Calendar, Tag, CircleAlert as AlertCircle } from 'lucide-react';
import { blogService } from '../../services/blogService';
import { BlogPostEditor } from './BlogPostEditor';
import type { BlogPost } from '../../types/website';

export const BlogManager: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [editingPost, setEditingPost] = useState<BlogPost | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; post: BlogPost | null }>({
    show: false,
    post: null
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await blogService.getPosts();
      setPosts(data);
    } catch (err) {
      console.error('Error loading blog posts:', err);
      setError('Error al cargar artículos.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (saved: BlogPost) => {
    setPosts(prev => {
      const exists = prev.find(p => p.id === saved.id);
      if (exists) return prev.map(p => p.id === saved.id ? saved : p);
      return [saved, ...prev];
    });
    setEditingPost(undefined);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.post) return;
    try {
      await blogService.deletePost(deleteConfirm.post.id);
      setPosts(prev => prev.filter(p => p.id !== deleteConfirm.post!.id));
      setDeleteConfirm({ show: false, post: null });
    } catch (err) {
      console.error('Error deleting post:', err);
      setError('Error al eliminar artículo.');
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await blogService.updatePost(post.id, {
        status: newStatus,
        published_at: newStatus === 'published' && !post.published_at
          ? new Date().toISOString()
          : post.published_at
      });
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (err) {
      console.error('Error updating post status:', err);
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (editingPost !== undefined) {
    return (
      <BlogPostEditor
        post={editingPost}
        onSave={handleSave}
        onCancel={() => setEditingPost(undefined)}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Artículos de Blog</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {posts.length} artículo{posts.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        <button
          onClick={() => setEditingPost(null)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Artículo
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar artículos..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
          {(['all', 'published', 'draft'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'published' ? 'Publicados' : 'Borradores'}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {searchTerm || statusFilter !== 'all' ? (
            <div>
              <p className="text-base font-medium text-gray-600">Sin resultados</p>
              <p className="text-sm mt-1">Prueba con otros filtros.</p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-base font-medium text-gray-600">No hay artículos</p>
              <p className="text-sm mt-1 mb-4">Crea tu primer artículo de blog.</p>
              <button
                onClick={() => setEditingPost(null)}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuevo Artículo
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPosts.map(post => (
            <div
              key={post.id}
              className="flex items-center gap-4 border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:bg-gray-50 transition-all group"
            >
              {/* Cover thumbnail */}
              <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Post info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-gray-900 truncate">{post.title}</h3>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    post.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {post.status === 'published' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {post.status === 'published' ? 'Publicado' : 'Borrador'}
                  </span>
                </div>

                <p className="text-sm text-gray-500 truncate">{post.summary || 'Sin resumen'}</p>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  {post.published_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.published_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
                    </span>
                  )}
                  {post.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {post.tags.slice(0, 3).join(', ')}
                      {post.tags.length > 3 && ` +${post.tags.length - 3}`}
                    </span>
                  )}
                  {post.author && (
                    <span>{post.author}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggleStatus(post)}
                  title={post.status === 'published' ? 'Pasar a borrador' : 'Publicar'}
                  className={`p-2 rounded-lg transition-colors ${
                    post.status === 'published'
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                >
                  {post.status === 'published' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                {post.status === 'published' && (
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ver publicado"
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}

                <button
                  onClick={() => setEditingPost(post)}
                  title="Editar"
                  className="p-2 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setDeleteConfirm({ show: true, post })}
                  title="Eliminar"
                  className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirm.show && deleteConfirm.post && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar artículo</h3>
            <p className="text-sm text-gray-600 mb-5">
              ¿Estás seguro de que quieres eliminar <strong>"{deleteConfirm.post.title}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, post: null })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
