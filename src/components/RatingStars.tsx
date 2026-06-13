import { useState } from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  interactive?: boolean;
  onChange?: (score: number) => void;
  size?: number; // Tailwind size class representations or just custom dimensions
}

export default function RatingStars({ rating, interactive = false, onChange, size = 6 }: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleClick = (score: number) => {
    if (interactive && onChange) {
      onChange(score);
    }
  };

  const handleMouseEnter = (score: number) => {
    if (interactive) {
      setHoverRating(score);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(null);
    }
  };

  const displayedRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div className="flex space-x-1 justify-center py-2" onMouseLeave={handleMouseLeave}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => handleClick(star)}
          onMouseEnter={() => handleMouseEnter(star)}
          disabled={!interactive}
          className={`focus:outline-none transition-transform duration-100 ${
            interactive ? 'cursor-pointer hover:scale-125' : 'cursor-default'
          }`}
        >
          <Star
            className={`fill-current ${
              star <= displayedRating ? 'text-amber-400' : 'text-slate-200'
            }`}
            style={{ width: `${size * 6}px`, height: `${size * 6}px` }}
          />
        </button>
      ))}
    </div>
  );
}
