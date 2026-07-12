import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Search, Upload as UploadIcon } from 'lucide-react';
import { websiteService } from '../../services/websiteService';
import { MediaUploader } from './MediaUploader';
import type { Media } from '../../types/website';

interface MediaLibraryBrowserProps {
  onSelect?: (media: Media) => void;
  onClose?: () => void;
  selectedUrl?: string;
}

export const MediaLibraryBrowser: React.FC<MediaLibraryBrowserProps> = ({
  onSelect,
  onClose,
  selectedUrl
}) => {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const data = await websiteService.getMedia();
      setMedia(data);
    } catch (error) {
      console.error('Error loading media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      await websiteService.deleteMedia(id);
      setMedia(media.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Failed to delete image');
    }
  };

  const handleSelect = (item: Media) => {
    setSelectedMedia(item);
    if (onSelect) {
      onSelect(item);
    }
  };

  const handleUploadComplete = async () => {
    setShowUploader(false);
    await loadMedia();
  };

  const filteredMedia = media.filter(item =>
    item.alt_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Media Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search and Upload */}
        <div className="p-6 border-b space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowUploader(!showUploader)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              <UploadIcon className="w-5 h-5" />
              Upload New
            </button>
          </div>

          {showUploader && (
            <MediaUploader onUploadComplete={handleUploadComplete} />
          )}
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <p className="text-lg mb-2">No images found</p>
              <p className="text-sm">Upload your first image to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  className={`group relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedMedia?.id === item.id || selectedUrl === item.url
                      ? 'border-primary-600 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                  onClick={() => handleSelect(item)}
                >
                  {/* Image */}
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <img
                      src={item.url}
                      alt={item.alt_text}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(item);
                        }}
                        className="bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-lg transition-colors"
                        title="Select"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {(selectedMedia?.id === item.id || selectedUrl === item.url) && (
                    <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-1">
                      <Check className="w-4 h-4" />
                    </div>
                  )}

                  {/* Alt text */}
                  <div className="p-2 bg-white">
                    <p className="text-xs text-gray-600 truncate">{item.alt_text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {filteredMedia.length} {filteredMedia.length === 1 ? 'image' : 'images'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            {selectedMedia && onSelect && (
              <button
                onClick={() => {
                  onSelect(selectedMedia);
                  if (onClose) onClose();
                }}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Use Selected Image
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
