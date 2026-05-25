import React, { useState, useMemo } from 'react';
import { MapPin, TrendingUp, TrendingDown } from 'lucide-react';
import { ChartSkeleton } from './LoadingSkeleton';

// Color scale from red to green (with lowerIsBetter inversion support)
const getHeatColor = (val, minVal, maxVal, lowerIsBetter = false) => {
    if (val === null || val === undefined || maxVal === minVal) return 'rgba(100, 100, 100, 0.3)';
    let ratio = (val - minVal) / (maxVal - minVal);
    if (lowerIsBetter) {
        ratio = 1 - ratio;
    }
    // Interpolate from red → yellow → green
    if (ratio < 0.5) {
        const r = 220;
        const g = Math.round(80 + (ratio * 2) * 160);
        return `rgba(${r}, ${g}, 60, ${0.3 + ratio * 0.5})`;
    } else {
        const r = Math.round(220 - ((ratio - 0.5) * 2) * 180);
        const g = 200;
        return `rgba(${r}, ${g}, 60, ${0.3 + ratio * 0.5})`;
    }
};

const VenueTooltip = ({ venue, stats, position, mode = 'batting' }) => {
    if (!venue) return null;
    if (mode === 'bowling') {
        return (
            <div
                className="fixed bg-neutral-900 border border-neutral-700 rounded-xl p-4 shadow-2xl z-[100] pointer-events-none min-w-[200px]"
                style={{ top: position.y - 10, left: position.x + 15 }}
            >
                <div className="font-bold text-white text-sm mb-2 leading-tight">{stats.venue}</div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs">
                    <span className="text-neutral-400">Wickets</span>
                    <span className="text-emerald-400 font-semibold tabular-nums">{stats.wickets || '0'}</span>
                    <span className="text-neutral-400">Economy</span>
                    <span className="text-amber-400 font-semibold tabular-nums">{stats.economy?.toFixed(2) || '-'}</span>
                    <span className="text-neutral-400">Runs Conceded</span>
                    <span className="text-white font-semibold tabular-nums">{stats.runs?.toLocaleString() || '0'}</span>
                    <span className="text-neutral-400">Matches</span>
                    <span className="text-white font-semibold tabular-nums">{stats.matches || '0'}</span>
                </div>
            </div>
        );
    }
    return (
        <div
            className="fixed bg-neutral-900 border border-neutral-700 rounded-xl p-4 shadow-2xl z-[100] pointer-events-none min-w-[200px]"
            style={{ top: position.y - 10, left: position.x + 15 }}
        >
            <div className="font-bold text-white text-sm mb-2 leading-tight">{stats.venue}</div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs">
                <span className="text-neutral-400">Average</span>
                <span className="text-emerald-400 font-semibold tabular-nums">{stats.avg?.toFixed(1) || '-'}</span>
                <span className="text-neutral-400">Strike Rate</span>
                <span className="text-amber-400 font-semibold tabular-nums">{stats.sr?.toFixed(1) || '-'}</span>
                <span className="text-neutral-400">Runs</span>
                <span className="text-white font-semibold tabular-nums">{stats.runs?.toLocaleString() || '0'}</span>
                <span className="text-neutral-400">Matches</span>
                <span className="text-white font-semibold tabular-nums">{stats.matches || '0'}</span>
                <span className="text-neutral-400">Innings</span>
                <span className="text-white font-semibold tabular-nums">{stats.innings || '0'}</span>
            </div>
        </div>
    );
};

const VenueIntelligence = ({ data = [], loading = false, mode = 'batting' }) => {
    const [hoveredVenue, setHoveredVenue] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // Filter and sort venues
    const qualified = useMemo(() => {
        if (mode === 'bowling') {
            return data
                .filter(v => v.matches >= 3 && v.economy !== null && v.economy > 0)
                .sort((a, b) => a.economy - b.economy); // lower economy is better!
        }
        return data
            .filter(v => v.innings >= 3 && v.avg !== null && v.avg > 0)
            .sort((a, b) => b.avg - a.avg);
    }, [data, mode]);

    const best5 = qualified.slice(0, 5);
    const worst5 = [...qualified].reverse().slice(0, 5);

    const minVal = useMemo(() => {
        if (qualified.length === 0) return 0;
        return Math.min(...qualified.map(v => mode === 'bowling' ? v.economy : v.avg));
    }, [qualified, mode]);

    const maxVal = useMemo(() => {
        if (qualified.length === 0) return 10;
        return Math.max(...qualified.map(v => mode === 'bowling' ? v.economy : v.avg));
    }, [qualified, mode]);

    if (loading) return <ChartSkeleton height="h-80" />;
    if (!data || data.length === 0) return null;

    const shortenVenue = (name) => {
        return name
            .replace('Stadium', '')
            .replace('International', 'Intl')
            .replace('Cricket', '')
            .trim();
    };

    return (
        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group shadow-lg">
            <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -mr-24 -mt-24 transition-all group-hover:bg-blue-500/8 pointer-events-none"></div>

            <h3 className="text-neutral-400 font-bold text-xs uppercase tracking-widest mb-6 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-blue-500" />
                Venue Intelligence
            </h3>

            {/* Best / Worst Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Best Venues */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                            {mode === 'bowling' ? 'Best Economy Venues' : 'Best Venues'}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {best5.map((v, i) => (
                            <div key={i} className="flex items-center justify-between bg-neutral-900/50 rounded-xl px-4 py-2.5 border border-neutral-800/50 hover:border-emerald-500/20 transition-colors">
                                <span className="text-sm text-neutral-300 font-medium truncate max-w-[180px]">
                                    {shortenVenue(v.venue)}
                                </span>
                                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                                    {mode === 'bowling' ? v.economy.toFixed(2) : v.avg.toFixed(1)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Worst Venues */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                            {mode === 'bowling' ? 'Worst Economy Venues' : 'Worst Venues'}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {worst5.map((v, i) => (
                            <div key={i} className="flex items-center justify-between bg-neutral-900/50 rounded-xl px-4 py-2.5 border border-neutral-800/50 hover:border-red-500/20 transition-colors">
                                <span className="text-sm text-neutral-300 font-medium truncate max-w-[180px]">
                                    {shortenVenue(v.venue)}
                                </span>
                                <span className="text-sm font-bold text-red-400 tabular-nums">
                                    {mode === 'bowling' ? v.economy.toFixed(2) : v.avg.toFixed(1)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Venue Heatmap Grid */}
            {qualified.length > 0 && (
                <>
                    <div className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3 font-bold">
                        All Venues Heatmap ({mode === 'bowling' ? 'Economy' : 'Average'})
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                        {qualified.map((v, i) => {
                            const val = mode === 'bowling' ? v.economy : v.avg;
                            return (
                                <div
                                    key={i}
                                    className="aspect-square rounded-lg cursor-pointer transition-transform hover:scale-110 hover:z-10 relative"
                                    style={{ backgroundColor: getHeatColor(val, minVal, maxVal, mode === 'bowling') }}
                                    onMouseEnter={(e) => {
                                        setHoveredVenue(i);
                                        setTooltipPos({ x: e.clientX, y: e.clientY });
                                    }}
                                    onMouseMove={(e) => {
                                        setTooltipPos({ x: e.clientX, y: e.clientY });
                                    }}
                                    onMouseLeave={() => setHoveredVenue(null)}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[8px] text-white/70 font-bold text-center leading-tight px-0.5 truncate">
                                            {val.toFixed(mode === 'bowling' ? 1 : 0)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-neutral-600">
                        <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: getHeatColor(minVal, minVal, maxVal, mode === 'bowling') }}></div>
                            {mode === 'bowling' ? 'Low Economy (Best)' : 'Low Avg'}
                        </span>
                        <span className="flex items-center gap-1">
                            {mode === 'bowling' ? 'High Economy (Worst)' : 'High Avg'}
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: getHeatColor(maxVal, minVal, maxVal, mode === 'bowling') }}></div>
                        </span>
                    </div>
                </>
            )}

            {/* Tooltip */}
            {hoveredVenue !== null && (
                <VenueTooltip
                    venue={qualified[hoveredVenue]?.venue}
                    stats={qualified[hoveredVenue]}
                    position={tooltipPos}
                    mode={mode}
                />
            )}
        </div>
    );
};

export default VenueIntelligence;
