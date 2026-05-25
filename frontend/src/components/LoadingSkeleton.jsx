import React from 'react';

const shimmer = "relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-neutral-700/20 before:to-transparent before:animate-[shimmer_1.5s_ease-in-out_infinite] before:-translate-x-full";

export const StatCardSkeleton = () => (
    <div className={`bg-neutral-950/80 border border-neutral-800 p-8 rounded-3xl h-52 flex flex-col justify-between ${shimmer}`}>
        <div className="flex justify-between items-start">
            <div className="h-3 bg-neutral-800 rounded-md w-24"></div>
            <div className="w-10 h-10 bg-neutral-800 rounded-xl"></div>
        </div>
        <div className="space-y-3">
            <div className="h-10 bg-neutral-800 rounded-md w-28"></div>
            <div className="h-3 bg-neutral-800/60 rounded-md w-36"></div>
        </div>
        <div className="h-10 bg-neutral-800/40 rounded-lg w-full"></div>
    </div>
);

export const WideCardSkeleton = () => (
    <div className={`xl:col-span-2 bg-neutral-950/80 border border-neutral-800 p-8 rounded-3xl h-52 flex flex-col justify-between ${shimmer}`}>
        <div className="h-4 bg-neutral-800 rounded-md w-40 mb-4"></div>
        <div className="flex justify-around items-end h-28 pb-2">
            {[1, 2, 3].map(j => (
                <div key={j} className="flex flex-col items-center gap-3 w-1/3">
                    <div className="h-10 bg-neutral-800 rounded-md w-16"></div>
                    <div className="h-3 bg-neutral-800 rounded-md w-12"></div>
                </div>
            ))}
        </div>
    </div>
);

export const ChartSkeleton = ({ height = 'h-64' }) => (
    <div className={`bg-neutral-950/80 border border-neutral-800 p-6 rounded-3xl ${height} flex flex-col ${shimmer}`}>
        <div className="h-4 bg-neutral-800 rounded-md w-48 mb-6"></div>
        <div className="flex-1 flex items-end gap-3 pb-4">
            {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
                <div key={i} className="flex-1 bg-neutral-800/60 rounded-t-lg" style={{ height: `${h}%` }}></div>
            ))}
        </div>
    </div>
);

export const TableRowSkeleton = ({ cols = 5 }) => (
    <tr className="border-b border-neutral-800/30">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="p-5">
                <div className={`h-4 bg-neutral-800 rounded-md ${i === 1 ? 'w-32' : 'w-16'}`}></div>
            </td>
        ))}
    </tr>
);

export const TimelineCardSkeleton = () => (
    <div className={`bg-neutral-950/80 border border-neutral-800 p-6 rounded-2xl ${shimmer}`}>
        <div className="flex justify-between items-start mb-4">
            <div className="space-y-2">
                <div className="h-3 bg-neutral-800 rounded-md w-44"></div>
                <div className="h-4 bg-neutral-800 rounded-md w-24"></div>
            </div>
            <div className="h-8 bg-neutral-800 rounded-lg w-20"></div>
        </div>
        <div className="h-3 bg-neutral-800/50 rounded-full w-full"></div>
    </div>
);

// Full page loading skeleton for stats dashboard
export const DashboardSkeleton = () => (
    <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
            <WideCardSkeleton />
            <WideCardSkeleton />
        </div>
    </div>
);

export default DashboardSkeleton;
