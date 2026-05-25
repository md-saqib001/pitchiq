import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import useCountUp from '../hooks/useCountUp';

// Gradient configs per metric type
const gradientMap = {
    avg: {
        gradient: 'from-emerald-500/15 to-emerald-500/0',
        glow: 'bg-emerald-500/10',
        accent: 'text-emerald-400',
        accentBg: 'bg-emerald-400/10',
        sparkColor: '#34d399',
        sparkGradient: ['#34d399', 'rgba(52, 211, 153, 0.05)'],
    },
    sr: {
        gradient: 'from-amber-500/15 to-amber-500/0',
        glow: 'bg-amber-500/10',
        accent: 'text-amber-400',
        accentBg: 'bg-amber-400/10',
        sparkColor: '#fbbf24',
        sparkGradient: ['#fbbf24', 'rgba(251, 191, 36, 0.05)'],
    },
    runs: {
        gradient: 'from-fuchsia-500/15 to-fuchsia-500/0',
        glow: 'bg-fuchsia-500/10',
        accent: 'text-fuchsia-400',
        accentBg: 'bg-fuchsia-400/10',
        sparkColor: '#c084fc',
        sparkGradient: ['#c084fc', 'rgba(192, 132, 252, 0.05)'],
    },
    boundary: {
        gradient: 'from-blue-500/15 to-blue-500/0',
        glow: 'bg-blue-500/10',
        accent: 'text-blue-400',
        accentBg: 'bg-blue-400/10',
        sparkColor: '#60a5fa',
        sparkGradient: ['#60a5fa', 'rgba(96, 165, 250, 0.05)'],
    },
};

const StatCard = ({
    title,
    value,
    icon,
    type = 'avg', // 'avg' | 'sr' | 'runs' | 'boundary'
    suffix = '',
    decimals = 0,
    seasonData = [],  // Array of { season, value } for sparkline
    iplAvg = null,    // IPL average for comparison
    matches = null,
    innings = null,
    lowerIsBetter = false,
}) => {
    const theme = gradientMap[type] || gradientMap.avg;
    const animatedValue = useCountUp(value, 800, decimals);

    // Compute IPL comparison
    const comparison = useMemo(() => {
        if (iplAvg === null || iplAvg === 0 || value === null || isNaN(value)) return null;
        const diff = ((value - iplAvg) / iplAvg) * 100;
        return {
            diff: Math.abs(diff).toFixed(0),
            isAbove: diff > 0,
            isEqual: Math.abs(diff) < 2,
        };
    }, [value, iplAvg]);

    // Prepare sparkline data
    const sparkData = useMemo(() => {
        if (!seasonData || seasonData.length === 0) return null;
        return seasonData.slice(-5).map(s => ({
            season: s.season,
            value: parseFloat(s.value) || 0,
        }));
    }, [seasonData]);

    const isPositiveComparison = comparison ? (lowerIsBetter ? !comparison.isAbove : comparison.isAbove) : false;

    return (
        <div className="bg-neutral-950 border border-neutral-800 p-6 pb-3 rounded-3xl flex flex-col justify-between hover:border-neutral-700 transition-all duration-300 group overflow-hidden relative shadow-lg">
            {/* Gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}></div>
            {/* Glow blob */}
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full ${theme.glow} blur-2xl group-hover:blur-3xl group-hover:scale-125 transition-all duration-500 pointer-events-none`}></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <h3 className="text-neutral-500 font-bold text-[11px] uppercase tracking-widest">{title}</h3>
                <span className={`${theme.accent} p-2 ${theme.accentBg} rounded-xl transition-transform group-hover:scale-110 duration-300`}>
                    {icon}
                </span>
            </div>

            {/* Main Value */}
            <div className="relative z-10 mb-1">
                <div className="text-4xl font-black text-white tracking-tighter tabular-nums">
                    {animatedValue}{suffix}
                </div>

                {/* IPL Average Comparison */}
                {comparison && !comparison.isEqual && (
                    <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${isPositiveComparison ? 'text-emerald-400' : 'text-red-400'}`}>
                        {comparison.isAbove ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span>{comparison.diff}% {comparison.isAbove ? 'above' : 'below'} IPL avg</span>
                    </div>
                )}
                {comparison && comparison.isEqual && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs font-semibold text-neutral-500">
                        <Minus className="w-3.5 h-3.5" />
                        <span>At IPL average</span>
                    </div>
                )}
            </div>

            {/* Secondary stats */}
            {(matches !== null || innings !== null) && (
                <div className="flex gap-4 text-[11px] text-neutral-500 font-medium mb-2 relative z-10">
                    {matches !== null && <span>{matches} matches</span>}
                    {innings !== null && <span>{innings} innings</span>}
                </div>
            )}

            {/* Sparkline */}
            {sparkData && sparkData.length > 1 && (
                <div className="h-10 w-full relative z-10 mt-auto -mb-1 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`spark-${type}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={theme.sparkGradient[0]} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={theme.sparkGradient[1]} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={theme.sparkColor}
                                strokeWidth={1.5}
                                fill={`url(#spark-${type})`}
                                dot={false}
                                activeDot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default StatCard;
