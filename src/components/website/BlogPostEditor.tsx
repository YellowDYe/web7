import React, { useState, useEffect } from 'react';
import { Save, X, Image as ImageIcon, Tag, Globe, Eye, EyeOff, CircleAlert as AlertCircle, CircleCheck as CheckCircle } from 'lucide-react';
import { blogService } from '../../services/blogService';
import { MediaLibraryBrowser } from './MediaLibraryBrowser';
import { RichTextEditor } from './RichTextEditor';
import type { BlogPost, BlogStatus } from '../../types/website';

interface BlogPostEditorProps {
  post: BlogPost | null;
  onSave: (post: BlogPost) => void;
  onCancel: () => void;
}

const emptyPost = (): Omit<BlogPost, 'id' | 'created_at' | 'updated_at'> => ({
  slug: '',
  title: '',
  summary: '',
  body: '',
  cover_image_url: '',
  author: '',
  tags: [],
  meta_title: '',
  meta_description: '',
  status: 'draft',
  published_at: null
});

export const BlogPostEditor: React.FC<BlogPostEditorProps> = ({ post, onSave, onCancel }) => {
  const [form, setForm] = useState(emptyPost());
  const [tagInput, setTagInput] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });
  const [activeSection, setActiveSection] = useState<'content' | 'seo'>('content');

  useEffect(() => {
    if (post) {
      setForm({
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        body: post.body,
        cover_image_url: post.cover_image_url,
        author: post.author,
        tags: post.tags || [],
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        status: post.status,
        published_at: post.published_at
      });
      setTagInput((post.tags || []).join(', '));
      setSlugManuallyEdited(true);
    } else {
      setForm(emptyPost());
      setTagInput('');
      setSlugManuallyEdited(false);
    }
  }, [post]);

  const handleTitleChange = (title: string) => {
    setForm(prev => ({
      ...prev,
      title,
      slug: slugManuallyEdited ? prev.slug : blogService.generateSlug(title)
    }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setForm(prev => ({ ...prev, slug: blogService.generateSlug(slug) }));
  };

  const handleTagsChange = (value: string) => {
    setTagInput(value);
    const tags = value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    setForm(prev => ({ ...prev, tags }));
  };

  const removeTag = (tag: string) => {
    const newTags = form.tags.filter(t => t !== tag);
    setForm(prev => ({ ...prev, tags: newTags }));
    setTagInput(newTags.join(', '));
  };

  const handleStatusToggle = () => {
    const newStatus: BlogStatus = form.status === 'published' ? 'draft' : 'published';
    setForm(prev => ({
      ...prev,
      status: newStatus,
      published_at: newStatus === 'published' && !prev.published_at
        ? new Date().toISOString()
        : prev.published_at
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setSaveStatus({ type: 'error', message: 'El título es obligatorio.' });
      return;
    }
    if (!form.slug.trim()) {
      setSaveStatus({ type: 'error', message: 'El slug es obligatorio.' });
      return;
    }

    setSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const slugAvailable = await blogService.isSlugAvailable(form.slug, post?.id);
      if (!slugAvailable) {
        setSaveStatus({ type: 'error', message: 'El slug ya existe. Usa uno diferente.' });
        setSaving(false);
        return;
      }

      let saved: BlogPost;
      if (post) {
        saved = await blogService.updatePost(post.id, form);
      } else {
        saved = await blogService.createPost(form);
      }

      setSaveStatus({ type: 'success', message: '¡Artículo guardado!' });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
      onSave(saved);
    } catch (err) {
      console.error('Error saving blog post:', err);
      setSaveStatus({ type: 'error', message: 'Error al guardar. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {post ? 'Editar Artículo' : 'Nuevo Artículo'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {post ? `Editando: ${post.title}` : 'Crea un nuevo artículo de blog'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus.type && (
            <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
              saveStatus.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {saveStatus.type === 'success'
                ? <CheckCircle className="w-4 h-4" />
                : <AlertCircle className="w-4 h-4" />
              }
              {saveStatus.message}
            </div>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Main form area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Section tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveSection('content')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSection === 'content'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Contenido
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('seo')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSection === 'seo'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              SEO
            </button>
          </div>

          {activeSection === 'content' && (
            <div className="space-y-5">
              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen de Portada
                </label>
                {form.cover_image_url ? (
                  <div className="relative group rounded-xl overflow-hidden border border-gray-200 h-48 bg-gray-100">
                    <img
                      src={form.cover_image_url}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3">
                      <button
                        type="button"
                        onClick={() => setShowMediaBrowser(true)}
                        className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, cover_image_url: '' }))}
                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMediaBrowser(true)}
                    className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
                  >
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-sm font-medium">Seleccionar imagen de portada</span>
                  </button>
                )}
                <input
                  type="text"
                  value={form.cover_image_url}
                  onChange={e => setForm(prev => ({ ...prev, cover_image_url: e.target.value }))}
                  placeholder="O pega una URL directamente..."
                  className="mt-2 w-full text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="Título del artículo..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Slug (URL) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 whitespace-nowrap">/blog/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => handleSlugChange(e.target.value)}
                    placeholder="mi-articulo"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Author */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Autor
                </label>
                <input
                  type="text"
                  value={form.author}
                  onChange={e => setForm(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Nombre del autor..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Resumen
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">Aparece en las tarjetas del blog</span>
                </label>
                <textarea
                  value={form.summary}
                  onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="Descripción corta del artículo..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contenido
                </label>
                <RichTextEditor
                  value={form.body}
                  onChange={body => setForm(prev => ({ ...prev, body }))}
                  placeholder="Escribe el contenido del artículo aquí..."
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Etiquetas
                    <span className="text-xs text-gray-400 font-normal">Separadas por comas</span>
                  </div>
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => handleTagsChange(e.target.value)}
                  placeholder="nutrición, recetas, salud..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs px-2.5 py-1 rounded-full border border-primary-200"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-primary-900 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'seo' && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                Estos campos controlan cómo aparece el artículo en motores de búsqueda. Si los dejas vacíos, se usarán el título y resumen del artículo.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Meta Título
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">Recomendado: 50-60 caracteres</span>
                </label>
                <input
                  type="text"
                  value={form.meta_title}
                  onChange={e => setForm(prev => ({ ...prev, meta_title: e.target.value }))}
                  placeholder={form.title || 'Título para SEO...'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-400">{form.meta_title.length}/60 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Meta Descripción
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">Recomendado: 150-160 caracteres</span>
                </label>
                <textarea
                  value={form.meta_description}
                  onChange={e => setForm(prev => ({ ...prev, meta_description: e.target.value }))}
                  placeholder={form.summary || 'Descripción para motores de búsqueda...'}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <p className="mt-1 text-xs text-gray-400">{form.meta_description.length}/160 caracteres</p>
              </div>

              {/* SEO Preview */}
              {(form.meta_title || form.title) && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Vista previa en Google</p>
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <p className="text-[#1a0dab] text-lg hover:underline cursor-pointer truncate">
                      {form.meta_title || form.title}
                    </p>
                    <p className="text-[#006621] text-sm">
                      {window.location.origin}/blog/{form.slug}
                    </p>
                    <p className="text-[#545454] text-sm mt-1 line-clamp-2">
                      {form.meta_description || form.summary || 'Sin descripción.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: status + publish date */}
        <div className="w-64 shrink-0 space-y-4">
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">Estado de publicación</h3>

            <button
              type="button"
              onClick={handleStatusToggle}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-colors text-sm font-medium ${
                form.status === 'published'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400'
              }`}
            >
              <span className="flex items-center gap-2">
                {form.status === 'published'
                  ? <Eye className="w-4 h-4" />
                  : <EyeOff className="w-4 h-4" />
                }
                {form.status === 'published' ? 'Publicado' : 'Borrador'}
              </span>
              <span className={`w-2 h-2 rounded-full ${
                form.status === 'published' ? 'bg-green-500' : 'bg-gray-400'
              }`} />
            </button>

            {form.status === 'published' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fecha de publicación
                </label>
                <input
                  type="datetime-local"
                  value={form.published_at
                    ? new Date(form.published_at).toISOString().slice(0, 16)
                    : ''
                  }
                  onChange={e => setForm(prev => ({
                    ...prev,
                    published_at: e.target.value ? new Date(e.target.value).toISOString() : null
                  }))}
                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            )}
          </div>

          {/* Quick info */}
          {post && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-2 text-xs text-gray-500">
              <p>Creado: {new Date(post.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</p>
              <p>Actualizado: {new Date(post.updated_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</p>
              {post.status === 'published' && post.published_at && (
                <a
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-primary-600 hover:underline mt-1"
                >
                  Ver artículo publicado →
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Browser Modal */}
      {showMediaBrowser && (
        <MediaLibraryBrowser
          selectedUrl={form.cover_image_url}
          onSelect={media => {
            setForm(prev => ({ ...prev, cover_image_url: media.url }));
            setShowMediaBrowser(false);
          }}
          onClose={() => setShowMediaBrowser(false)}
        />
      )}
    </div>
  );
};
