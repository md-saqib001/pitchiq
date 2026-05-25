import React from 'react';
import { SearchX, Filter, Database } from 'lucide-react';

const illustrations = {
    noData: {
        icon: Database,
        title: 'No data found',
        description: 'Try adjusting your filters or searching for a different player.',
    },
    noResults: {
        icon: SearchX,
        title: 'No results match your search',
        description: 'We couldn\'t find any players matching that name. Check the spelling and try again.',
    },
    noFilters: {
        icon: Filter,
        title: 'No matches for these filters',
        description: 'This combination of filters returned zero results. Try relaxing some conditions.',
    },
};

const EmptyState = ({ type = 'noData', title, description, action }) => {
    const config = illustrations[type] || illustrations.noData;
    const Icon = config.icon;

    return (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="relative mb-6">
                <div className="w-20 h-20 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center">
                    <Icon className="w-8 h-8 text-neutral-600" />
                </div>
                <div className="absolute -inset-4 bg-purple-500/5 rounded-3xl blur-2xl -z-10"></div>
            </div>
            <h3 className="text-lg font-bold text-neutral-300 mb-2">
                {title || config.title}
            </h3>
            <p className="text-sm text-neutral-500 max-w-md leading-relaxed">
                {description || config.description}
            </p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-6 bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 text-sm text-neutral-300 hover:text-white px-5 py-2.5 rounded-xl font-semibold transition-all"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
