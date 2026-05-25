import React from 'react';
import { Zap } from 'lucide-react';
import { ChartSkeleton } from './LoadingSkeleton';

const phaseColors = {
    powerplay: '#22c55e',
    middle: '#f59e0b',
    death: '#ef4444',
};

const phaseLabels = {
    powerplay: 'Powerplay (0-5)',
    middle: 'Middle (6-14)',
    death: 'Death (15-19)',
};

const PhaseBreakdown = ({ data = [], loading = false, onPhaseClick, mode = 'batting' }) => {
    if (loading) return <ChartSkeleton height="h-72" />;

    if (!data || data.length === 0) return null;

    const chartData = ['powerplay', 'middle', 'death'].map(phase => {
        const d = data.find(d => d.phase === phase) || {};
        if (mode === 'bowling') {
            return {
                phase,
                label: phaseLabels[phase],
                wickets: d.wickets || 0,
                economy: d.economy || 0,
                sr: d.strike_rate || 0,
                runs: d.runs || 0,
                balls: d.legal_balls || 0,
            };
        }
        return {
            phase,
            label: phaseLabels[phase],
            sr: d.sr || d.strike_rate || 0,
            avg: d.avg || 0,
            runs: d.runs || d.total_runs || 0,
            balls: d.balls || d.balls_faced || 0,
            dismissals: d.dismissals || 0,
        };
    });

    const maxValue = mode === 'bowling' 
        ? Math.max(...chartData.map(c => c.wickets), 5)
        : Math.max(...chartData.map(c => c.sr), 100);

    return (
        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group shadow-lg">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl -mr-24 -mt-24 transition-all group-hover:bg-amber-500/8 pointer-events-none"></div>

            <h3 className="text-neutral-400 font-bold text-xs uppercase tracking-widest mb-6 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-amber-500" />
                Phase Performance
            </h3>

            <div className="space-y-4">
                {chartData.map((d) => {
                    const currentValue = mode === 'bowling' ? d.wickets : d.sr;
                    const barWidth = Math.max((currentValue / maxValue) * 100, 5);
                    const color = phaseColors[d.phase];

                    return (
                        <button
                            key={d.phase}
                            onClick={() => onPhaseClick && onPhaseClick(d.phase)}
                            className="w-full text-left group/row hover:bg-neutral-900/50 rounded-xl p-3 -mx-3 transition-all cursor-pointer"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-neutral-300 group-hover/row:text-white transition-colors">
                                    {d.label}
                                </span>
                                {mode === 'bowling' ? (
                                    <div className="flex gap-6 text-xs tabular-nums">
                                        <span className="text-neutral-500">
                                            Wkts: <span className="text-white font-semibold">{d.wickets}</span>
                                        </span>
                                        <span className="text-neutral-500">
                                            Econ: <span className="text-white font-semibold">{d.economy.toFixed(2)}</span>
                                        </span>
                                        <span className="text-neutral-500">
                                            SR: <span className="text-white font-semibold">{d.sr > 0 ? d.sr.toFixed(1) : '-'}</span>
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex gap-6 text-xs tabular-nums">
                                        <span className="text-neutral-500">
                                            SR: <span className="text-white font-semibold">{d.sr.toFixed(1)}</span>
                                        </span>
                                        <span className="text-neutral-500">
                                            Avg: <span className="text-white font-semibold">{d.avg.toFixed(1)}</span>
                                        </span>
                                        <span className="text-neutral-500">
                                            Runs: <span className="text-white font-semibold">{d.runs.toLocaleString()}</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="w-full bg-neutral-800/50 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${barWidth}%`,
                                        background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                        boxShadow: `0 0 12px ${color}33`,
                                    }}
                                ></div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <p className="text-[10px] text-neutral-600 mt-4 text-center tracking-wide">
                Click a phase to filter the dashboard
            </p>
        </div>
    );
};

export default PhaseBreakdown;
