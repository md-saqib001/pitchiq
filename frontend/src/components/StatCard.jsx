import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { 
    TrendingUp, TrendingDown, Minus, 
    Trophy, Zap, Activity, Target 
} from 'lucide-react';
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
    label,
    value,
    icon,
    type = 'avg', // 'avg' | 'sr' | 'runs' | 'boundary'
    color,
    suffix = '',
    decimals = 0,
    seasonData = [],  // Array of { season, value } for sparkline
    sparkData,
    iplAvg = null,    // IPL average for comparison
    benchmark,
    matches = null,
    innings = null,
    subValue,
    lowerIsBetter = false,
}) => {
    // Resolve compatible prop names
    const displayTitle = title || label;
    
    // Extract numeric value for counting/comparison
    const rawStringVal = typeof value === 'string' ? value.replace(/[%,\s]/g, '') : value;
    const numericVal = parseFloat(rawStringVal);
    const displaySuffix = suffix || (typeof value === 'string' && value.includes('%') ? '%' : '');
    
    let displayType = type;
    if (color) {
        if (color === 'emerald') displayType = 'avg';
        else if (color === 'amber') displayType = 'sr';
        else if (color === 'fuchsia') displayType = 'runs';
        else if (color === 'blue') displayType = 'boundary';
        else if (color === 'red') displayType = 'runs';
        else if (color === 'cyan') displayType = 'boundary';
    }

    const theme = gradientMap[displayType] || gradientMap.avg;
    
    // Animate numeric values
    const isStringNonNumeric = isNaN(numericVal) && typeof value === 'string';
    const animatedValue = useCountUp(isStringNonNumeric ? 0 : numericVal, 800, decimals);
    const displayValue = isStringNonNumeric ? value : `${animatedValue}${displaySuffix}`;

    const displaySeasonData = seasonData && seasonData.length > 0 ? seasonData : (sparkData || []);
    const displayIplAvg = iplAvg !== null ? iplAvg : (benchmark !== undefined ? parseFloat(benchmark) : null);

    // Compute IPL comparison
    const comparison = useMemo(() => {
        if (displayIplAvg === null || displayIplAvg === 0 || isNaN(numericVal) || isStringNonNumeric) return null;
        const diff = ((numericVal - displayIplAvg) / displayIplAvg) * 100;
        return {
            diff: Math.abs(diff).toFixed(0),
            isAbove: diff > 0,
            isEqual: Math.abs(diff) < 2,
        };
    }, [numericVal, displayIplAvg, isStringNonNumeric]);

    // Prepare sparkline data
    const sparkDataToRender = useMemo(() => {
        if (!displaySeasonData || displaySeasonData.length === 0) return null;
        return displaySeasonData.slice(-5).map(s => ({
            season: s.season,
            value: parseFloat(s.value) || 0,
        }));
    }, [displaySeasonData]);

    const isPositiveComparison = comparison ? (lowerIsBetter ? !comparison.isAbove : comparison.isAbove) : false;

    // Resolve default icon if none provided
    const displayIcon = useMemo(() => {
        if (icon) return icon;
        switch (displayType) {
            case 'avg': return <Trophy className="w-4 h-4" />;
            case 'sr': return <Zap className="w-4 h-4" />;
            case 'boundary': return <Activity className="w-4 h-4" />;
            case 'runs': return <Target className="w-4 h-4" />;
            default: return <Trophy className="w-4 h-4" />;
        }
    }, [icon, displayType]);

    return (
        <div className="bg-neutral-950 border border-neutral-800 p-6 pb-4 rounded-3xl flex flex-col justify-between hover:border-neutral-700 transition-all duration-300 group overflow-hidden relative shadow-lg min-h-[160px] text-left">
            {/* Gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}></div>
            {/* Glow blob */}
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full ${theme.glow} blur-2xl group-hover:blur-3xl group-hover:scale-125 transition-all duration-500 pointer-events-none`}></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <h3 className="text-neutral-500 font-bold text-[11px] uppercase tracking-widest">{displayTitle}</h3>
                <span className={`${theme.accent} p-2 ${theme.accentBg} rounded-xl transition-transform group-hover:scale-110 duration-300`}>
                    {displayIcon}
                </span>
            </div>

            {/* Main Value */}
            <div className="relative z-10 mb-1">
                <div className="text-4xl font-black text-white tracking-tighter tabular-nums">
                    {displayValue}
                </div>

                {/* Sub value */}
                {subValue && (
                    <div className="text-[11px] text-neutral-500 font-medium mt-1">
                        {subValue}
                    </div>
                )}

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
            {sparkDataToRender && sparkDataToRender.length > 1 && (
                <div className="h-10 w-full relative z-10 mt-3 -mb-2 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkDataToRender} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`spark-${displayType}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={theme.sparkGradient[0]} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={theme.sparkGradient[1]} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={theme.sparkColor}
                                strokeWidth={1.5}
                                fill={`url(#spark-${displayType})`}
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
