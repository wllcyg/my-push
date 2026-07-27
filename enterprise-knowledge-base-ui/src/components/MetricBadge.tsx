import React from 'react';

interface MetricBadgeProps {
  views?: number;
  likes?: number;
  comments?: number;
  favourites?: number;
}

export const MetricBadge: React.FC<MetricBadgeProps> = ({
  views = 0,
  likes = 0,
}) => {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
      <span className="flex items-center gap-1">
        <span>👁️</span> {views.toLocaleString()}
      </span>
      <span className="flex items-center gap-1">
        <span>👍</span> {likes.toLocaleString()}
      </span>
    </div>
  );
};
