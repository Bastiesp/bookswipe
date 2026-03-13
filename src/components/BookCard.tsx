import React, { useState } from 'react';
import { BookWithImages } from '../types';
import { Button } from './ui/button';

interface BookCardProps {
  book: BookWithImages;
  onLike: () => void;
  onPass: () => void;
  isLoading?: boolean;
}

const GENRE_LABELS: Record<string, string> = {
  ficcion: 'Ficción',
  literatura_clasica: 'Literatura Clásica',
  autoayuda: 'Autoayuda',
  mystery: 'Misterio',
  romance: 'Romance',
  ciencia_ficcion: 'Ciencia Ficción',
  fantasia: 'Fantasía',
  historia: 'Historia',
  biografia: 'Biografía',
  poesia: 'Poesía',
};

const IMPORTANCE_LABELS: Record<string, string> = {
  bestseller: 'Bestseller',
  medium: 'Importancia Media',
  low_influence: 'Menos Influyente',
};

const IMPORTANCE_COLORS: Record<string, string> = {
  bestseller: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low_influence: 'bg-gray-100 text-gray-800',
};

export function BookCard({ book, onLike, onPass, isLoading }: BookCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const currentImage = book.images?.[currentImageIndex];
  const hasMultipleImages = (book.images?.length || 0) > 1;

  const nextImage = () => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) => (prev + 1) % (book.images?.length || 1));
    }
  };

  const prevImage = () => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? (book.images?.length || 1) - 1 : prev - 1
      );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="relative bg-gray-200 h-96 flex items-center justify-center">
        {currentImage ? (
          <img
            src={currentImage}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center text-gray-400">
            <p className="text-xl">📚</p>
            <p>Sin imagen</p>
          </div>
        )}

        {hasMultipleImages && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition"
            >
              ‹
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition"
            >
              ›
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {book.images?.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition ${
                    idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="absolute top-3 right-3">
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${IMPORTANCE_COLORS[book.importance_level]}`}>
            {IMPORTANCE_LABELS[book.importance_level]}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{book.title}</h2>
          <p className="text-gray-600 text-lg">{book.author}</p>
        </div>

        {book.description && (
          <p className="text-gray-700 text-sm line-clamp-2">{book.description}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {GENRE_LABELS[book.genre] || book.genre}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-lg">📖</span>
            <span className="font-bold text-gray-900">{book.condition_rating}/10</span>
          </div>
        </div>

        {book.user && (
          <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
            {book.user.avatar_url && (
              <img
                src={book.user.avatar_url}
                alt={book.user.display_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-semibold text-gray-900">{book.user.display_name}</p>
              <p className="text-xs text-gray-500">@{book.user.username}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button
            variant="secondary"
            size="md"
            onClick={onPass}
            disabled={isLoading}
            className="w-full"
          >
            ✕ Pasar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onLike}
            disabled={isLoading}
            className="w-full"
          >
            ♥ Me gusta
          </Button>
        </div>
      </div>
    </div>
  );
}
