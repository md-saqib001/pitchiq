import React from 'react';
import { Clock, Shield, ChevronRight } from 'lucide-react';
import { TimelineCardSkeleton } from './LoadingSkeleton';

// Color-code by batting performance
const getPerformanceStyle = (runs) => {
    if (runs >= 100) return {
        bar: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        glow: 'shadow-amber-500/20',
    };
    if (runs >= 50) return {
        bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        glow: 'shadow-emerald-500/20',
    };
    if (runs >= 20) return {
        bar: 'bg-gradient-to-r from-amber-600 to-amber-500',
        badge: 'bg-amber-600/15 text-amber-500 border-amber-600/30',
        glow: '',
    };
    return {
        bar: 'bg-gradient-to-r from-red-600 to-red-500',
        badge: 'bg-red-500/15 text-red-400 border-red-500/30',
        glow: '',
    };
};

// Color-code by bowling performance
const getBowlingPerformanceStyle = (wickets) => {
    if (wickets >= 5) return {
        bar: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        glow: 'shadow-amber-500/20',
    };
    if (wickets >= 3) return {
        bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        glow: 'shadow-emerald-500/20',
    };
    if (wickets >= 1) return {
        bar: 'bg-gradient-to-r from-blue-500 to-blue-400',
        badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        glow: '',
    };
    return {
        bar: 'bg-gradient-to-r from-red-600 to-red-500',
        badge: 'bg-red-500/15 text-red-400 border-red-500/30',
        glow: '',
    };
};

const formatDismissal = (d) => {
    if (!d.dismissal || d.dismissal === '' || d.dismissal === null) return 'Not Out';

    const kind = d.dismissal.replace(/_/g, ' ');
    const parts = [];

    if (kind === 'caught' || kind === 'caught and bowled') {
        parts.push('Caught');
        if (d.fielder) parts.push(`by ${d.fielder}`);
    } else if (kind === 'bowled') {
        parts.push('Bowled');
    } else if (kind === 'lbw') {
        parts.push('LBW');
    } else if (kind === 'stumped') {
        parts.push('Stumped');
        if (d.fielder) parts.push(`by ${d.fielder}`);
    } else if (kind === 'run out') {
        parts.push('Run Out');
        if (d.fielder) parts.push(`(${d.fielder})`);
    } else {
        parts.push(kind.charAt(0).toUpperCase() + kind.slice(1));
    }

    if (d.bowler && kind !== 'run out') {
        parts.push(`— ${d.bowler}`);
    }

    return parts.join(' ');
};

const InningsCard = ({ innings, maxRuns }) => {
    const style = getPerformanceStyle(innings.runs);
    const barWidth = maxRuns > 0 ? Math.max((innings.runs / maxRuns) * 100, 3) : 3;
    const isNotOut = !innings.dismissal || innings.dismissal === '' || innings.dismissal === null;

    return (
        <div className={`bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-all group ${style.glow ? `shadow-lg ${style.glow}` : ''}`}>
            {/* Match info */}
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="text-[11px] text-neutral-500 font-medium mb-1">
                        {innings.date} • {innings.season}
                    </div>
                    <div className="text-sm text-neutral-300 font-semibold">
                        {innings.team1} vs {innings.team2}
                    </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border text-sm font-black tabular-nums ${style.badge}`}>
                    {innings.runs}{isNotOut && <span className="text-[10px] align-super">*</span>}
                    <span className="text-neutral-500 font-normal text-xs ml-0.5">({innings.balls})</span>
                </div>
            </div>

            {/* Run bar */}
            <div className="w-full bg-neutral-800/50 rounded-full h-2 mb-3 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${style.bar}`}
                    style={{ width: `${barWidth}%` }}
                ></div>
            </div>

            {/* Bottom row */}
            <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">
                    {formatDismissal(innings)}
                </span>
                <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-neutral-400">
                        SR: <span className="text-white font-semibold">{innings.strike_rate?.toFixed(1) || '-'}</span>
                    </span>
                    {innings.fours > 0 && (
                        <span className="text-amber-500/70">{innings.fours}×4</span>
                    )}
                    {innings.sixes > 0 && (
                        <span className="text-fuchsia-400/70">{innings.sixes}×6</span>
                    )}
                </div>
            </div>
        </div>
    );
};

const BowlingInningsCard = ({ innings, maxWickets }) => {
    const style = getBowlingPerformanceStyle(innings.wickets);
    const barWidth = maxWickets > 0 ? Math.max((innings.wickets / maxWickets) * 100, 3) : 3;

    return (
        <div className={`bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-all group ${style.glow ? `shadow-lg ${style.glow}` : ''}`}>
            {/* Match info */}
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="text-[11px] text-neutral-500 font-medium mb-1">
                        {innings.date} • {innings.season}
                    </div>
                    <div className="text-sm text-neutral-300 font-semibold">
                        {innings.team1} vs {innings.team2}
                    </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border text-sm font-black tabular-nums ${style.badge}`}>
                    {innings.wickets} <span className="text-xs font-normal">Wkts</span>
                    <span className="text-neutral-500 font-normal text-xs ml-1">({innings.runs} runs)</span>
                </div>
            </div>

            {/* Wickets bar */}
            <div className="w-full bg-neutral-800/50 rounded-full h-2 mb-3 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${style.bar}`}
                    style={{ width: `${barWidth}%` }}
                ></div>
            </div>

            {/* Bottom row */}
            <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">
                    Overs: <span className="text-white font-semibold">{innings.overs_str}</span>
                </span>
                <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-neutral-400">
                        Econ: <span className="text-white font-semibold">{innings.economy?.toFixed(2) || '-'}</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

const MatchTimeline = ({ data = [], loading = false, playerName = '', mode = 'batting' }) => {
    if (loading) {
        return (
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-lg">
                <div className="h-4 bg-neutral-800 rounded-md w-40 mb-6"></div>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => <TimelineCardSkeleton key={i} />)}
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) return null;

    const maxRuns = mode === 'bowling' ? 0 : Math.max(...data.map(d => d.runs), 1);
    const maxWickets = mode === 'bowling' ? Math.max(...data.map(d => d.wickets), 1) : 0;

    return (
        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group shadow-lg">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none"></div>

            <h3 className="text-neutral-400 font-bold text-xs uppercase tracking-widest mb-6 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-purple-500" />
                {mode === 'bowling' ? `Recent Bowling Figures` : `Recent Innings`} {playerName && `— ${playerName}`}
            </h3>

            <div className="space-y-3">
                {data.map((innings, i) => (
                    mode === 'bowling' ? (
                        <BowlingInningsCard key={i} innings={innings} maxWickets={maxWickets} />
                    ) : (
                        <InningsCard key={i} innings={innings} maxRuns={maxRuns} />
                    )
                ))}
            </div>
        </div>
    );
};

export default MatchTimeline;
