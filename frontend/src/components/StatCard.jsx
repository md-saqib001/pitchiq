import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import useCountUp from '../hooks/useCountUp';

// Gradient configs per metric type/color
const gradientMap = {
    emerald: {
        gradient: 'from-emerald-500/15 to-emerald-500/0',
        glow: 'bg-emerald-500/10',
        accent: 'text-emerald-400',
        accentBg: 'bg-emerald-400/10',
        sparkColor: '#34d399',
        sparkGradient: ['#34d399', 'rgba(52, 211, 153, 0.05)'],
    },
    amber: {
        gradient: 'from-amber-500/15 to-amber-500/0',
        glow: 'bg-amber-500/10',
        accent: 'text-amber-400',
        accentBg: 'bg-amber-400/10',
        sparkColor: '#fbbf24',
        sparkGradient: ['#fbbf24', 'rgba(251, 191, 36, 0.05)'],
    },
    fuchsia: {
        gradient: 'from-fuchsia-500/15 to-fuchsia-500/0',
        glow: 'bg-fuchsia-500/10',
        accent: 'text-fuchsia-400',
        accentBg: 'bg-fuchsia-400/10',
        sparkColor: '#c084fc',
        sparkGradient: ['#c084fc', 'rgba(192, 132, 252, 0.05)'],
    },
    blue: {
        gradient: 'from-blue-500/15 to-blue-500/0',
        glow: 'bg-blue-500/10',
        accent: 'text-blue-400',
        accentBg: 'bg-blue-400/10',
        sparkColor: '#60a5fa',
        sparkGradient: ['#60a5fa', 'rgba(96, 165, 250, 0.05)'],
    },
    red: {
        gradient: 'from-red-500/15 to-red-500/0',
        glow: 'bg-red-500/10',
        accent: 'text-red-400',
        accentBg: 'bg-red-400/10',
        sparkColor: '#f87171',
        sparkGradient: ['#f87171', 'rgba(248, 113, 113, 0.05)'],
    },
    cyan: {
        gradient: 'from-cyan-500/15 to-cyan-500/0',
        glow: 'bg-cyan-500/10',
        accent: 'text-cyan-400',
        accentBg: 'bg-cyan-400/10',
        sparkColor: '#22d3ee',
        sparkGradient: ['#22d3ee', 'rgba(34, 211, 238, 0.05)'],
    }
};

// Aliases for compatibility
gradientMap.avg = gradientMap.emerald;
gradientMap.sr = gradientMap.amber;
gradientMap.runs = gradientMap.fuchsia;
gradientMap.boundary = gradientMap.blue;
gradientMap.green = gradientMap.emerald;
gradientMap.yellow = gradientMap.amber;
gradientMap.purple = gradientMap.fuchsia;

const StatCard = ({
    title,
    label,            // alias for title
    value,
    icon,
    type,
    color,            // alias for type
    suffix = '',
    decimals = 0,
    seasonData,       // Array of { season, value } for sparkline
    sparkData,        // alias for seasonData
    iplAvg,           // IPL average for comparison
    benchmark,        // alias for iplAvg
    matches = null,
    innings = null,
    subValue = null,  // text to display below
    lowerIsBetter = false,
}) => {
    // Map aliases
    const cardTitle = title || label || '';
    const cardColor = color || type || 'avg';
    const cardSparkData = seasonData || sparkData || [];
    const cardIplAvg = iplAvg !== undefined ? iplAvg : (benchmark !== undefined ? benchmark : null);

    const theme = gradientMap[cardColor] || gradientMap[cardColor] || gradientMap.avg;
    const animatedValue = useCountUp(value, 800, decimals);

    // Compute IPL comparison
    const comparison = useMemo(() => {
        if (cardIplAvg === null || cardIplAvg === 0 || value === null || isNaN(parseFloat(value))) return null;
        const numValue = parseFloat(value);
        const diff = ((numValue - cardIplAvg) / cardIplAvg) * 100;
        return {
            diff: Math.abs(diff).toFixed(0),
            isAbove: diff > 0,
            isEqual: Math.abs(diff) < 2,
        };
    }, [value, cardIplAvg]);

    // Prepare sparkline data
    const normalizedSparkData = useMemo(() => {
        if (!cardSparkData || cardSparkData.length === 0) return null;
        return cardSparkData.slice(-5).map(s => ({
            season: s.season,
            value: parseFloat(s.value) || 0,
        }));
    }, [cardSparkData]);

    const isPositiveComparison = comparison ? (lowerIsBetter ? !comparison.isAbove : comparison.isAbove) : false;

    return (
        <div className="bg-neutral-950 border border-neutral-800 p-6 pb-3 rounded-3xl flex flex-col justify-between hover:border-neutral-700 transition-all duration-300 group overflow-hidden relative shadow-lg">
            {/* Gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}></div>
            {/* Glow blob */}
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full ${theme.glow} blur-2xl group-hover:blur-3xl group-hover:scale-125 transition-all duration-500 pointer-events-none`}></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <h3 className="text-neutral-500 font-bold text-[11px] uppercase tracking-widest">{cardTitle}</h3>
                {icon && (
                    <span className={`${theme.accent} p-2 ${theme.accentBg} rounded-xl transition-transform group-hover:scale-110 duration-300`}>
                        {icon}
                    </span>
                )}
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
            {(matches !== null || innings !== null || subValue !== null) && (
                <div className="flex gap-4 text-[11px] text-neutral-500 font-medium mb-2 relative z-10">
                    {subValue !== null ? (
                        <span>{subValue}</span>
                    ) : (
                        <>
                            {matches !== null && <span>{matches} matches</span>}
                            {innings !== null && <span>{innings} innings</span>}
                        </>
                    )}
                </div>
            )}

            {/* Sparkline */}
            {normalizedSparkData && normalizedSparkData.length > 1 && (
                <div className="h-10 w-full relative z-10 mt-auto -mb-1 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={normalizedSparkData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`spark-${cardColor}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={theme.sparkGradient[0]} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={theme.sparkGradient[1]} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={theme.sparkColor}
                                strokeWidth={1.5}
                                fill={`url(#spark-${cardColor})`}
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
