import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, ArrowRight, Code, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';

const AskPitchIQ = ({ setPlayerName, setFilters, onAnalyze }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [showSql, setShowSql] = useState(false);

    const handleAsk = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError('');
        setResult(null);
        setShowSql(false);

        try {
            const res = await axios.post(`${API_BASE}/ask`, { query });
            if (res.data.error) {
                setError(res.data.error);
            } else {
                setResult(res.data);
                // Also update the main dashboard
                if (res.data.params && res.data.params.name) {
                    setPlayerName(res.data.params.name);
                    const newFilters = {
                        phase: res.data.params.phase || 'all',
                        venue: res.data.params.venue || '',
                        situation: res.data.params.situation || 'all',
                        target: res.data.params.target_min ? `${res.data.params.target_min}+` : 'any',
                        season: res.data.params.season || 'all',
                        opposition: '',
                    };
                    setFilters(newFilters);
                    if (onAnalyze) {
                        setTimeout(() => onAnalyze(), 50);
                    }
                }
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl mt-12 mb-20 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-blue-600"></div>
            
            <div className="p-6 sm:p-8">
                <h2 className="text-2xl font-black flex items-center text-white mb-6">
                    <Sparkles className="w-6 h-6 mr-3 text-fuchsia-400" />
                    Ask PitchIQ
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2 flex items-center relative focus-within:border-fuchsia-500/50 transition-colors">
                            <input 
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                                placeholder='Try "Kohli death overs chasing 170+ at Chinnaswamy"'
                                className="w-full bg-transparent text-white pl-4 pr-4 py-3 outline-none font-medium placeholder:text-neutral-600"
                            />
                            <button 
                                onClick={handleAsk}
                                disabled={loading || !query.trim()}
                                className="bg-white text-black hover:bg-neutral-200 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center"
                            >
                                {loading ? <div className="w-5 h-5 border-2 border-neutral-800 border-t-white rounded-full animate-spin"></div> : <ArrowRight className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest mr-2">Try:</span>
                            <button onClick={() => setQuery("Kohli death overs chasing 170+ at Chinnaswamy")} className="text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-400 px-3 py-1.5 rounded-lg border border-neutral-800 transition-colors cursor-pointer">Kohli death overs chasing 170+</button>
                            <button onClick={() => setQuery("Best powerplay batsman in 2023 season")} className="text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-400 px-3 py-1.5 rounded-lg border border-neutral-800 transition-colors cursor-pointer">Best powerplay batsman 2023</button>
                            <button onClick={() => setQuery("Bowler with best economy in death overs at Wankhede")} className="text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-400 px-3 py-1.5 rounded-lg border border-neutral-800 transition-colors cursor-pointer">Best economy death overs Wankhede</button>
                            <button onClick={() => setQuery("Dhoni middle overs defending")} className="text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-400 px-3 py-1.5 rounded-lg border border-neutral-800 transition-colors cursor-pointer">Dhoni middle overs defending</button>
                        </div>
                    </div>

                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 border-l-4 border-l-fuchsia-500">
                        <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">How it works</h4>
                        <p className="text-neutral-400 text-sm leading-relaxed">
                            PitchIQ uses a strict natural language parser to map keywords directly to SQL queries. 
                            <strong> No AI hallucinations.</strong> 100% deterministic ball-by-ball analysis.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-start">
                        <span className="font-bold mr-2">Error:</span> {error}
                    </div>
                )}

                {result && (
                    <div className="mt-8 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 md:p-8">
                            <h3 className="text-xl font-bold text-white mb-6 leading-snug">
                                <span className="text-fuchsia-400">{result.description}</span>
                            </h3>

                            {result.type === 'player_stats' && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
                                        <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Average</div>
                                        <div className="text-2xl font-black text-emerald-400">{result.data.avg}</div>
                                        <div className="text-xs text-neutral-600 mt-1">{result.data.dismissals} dismissals</div>
                                    </div>
                                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
                                        <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Strike Rate</div>
                                        <div className="text-2xl font-black text-amber-400">{result.data.strike_rate}</div>
                                        <div className="text-xs text-neutral-600 mt-1">{result.data.balls_faced || 0} balls faced</div>
                                    </div>
                                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
                                        <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Total Runs</div>
                                        <div className="text-2xl font-black text-fuchsia-400">{result.data.total_runs}</div>
                                        <div className="text-xs text-neutral-600 mt-1">{result.data.matches} matches</div>
                                    </div>
                                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
                                        <div className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Boundary %</div>
                                        <div className="text-2xl font-black text-blue-400">{result.data.boundary_rate}%</div>
                                        <div className="text-xs text-neutral-600 mt-1">{result.data.fours}x4s, {result.data.sixes}x6s</div>
                                    </div>
                                </div>
                            )}

                            {result.type === 'leaderboard' && (
                                <div className="mb-6 overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-neutral-500 text-xs uppercase tracking-widest border-b border-neutral-800">
                                            <tr>
                                                <th className="pb-3 pr-4">Player</th>
                                                <th className="pb-3 px-4">Metric</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800">
                                            {result.data.map((row, i) => (
                                                <tr key={i}>
                                                    <td className="py-3 pr-4 text-white font-bold">{row.name}</td>
                                                    <td className="py-3 px-4 text-fuchsia-400 font-bold">{row.value}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-neutral-800 bg-neutral-950">
                            <button 
                                onClick={() => setShowSql(!showSql)}
                                className="w-full p-4 flex items-center justify-between text-sm text-neutral-400 hover:text-white transition-colors"
                            >
                                <span className="flex items-center font-mono">
                                    <Code className="w-4 h-4 mr-2 text-fuchsia-500" />
                                    Show SQL Query
                                </span>
                                {showSql ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            
                            {showSql && (
                                <div className="p-6 pt-0 border-t border-neutral-800 bg-black animate-in slide-in-from-top-2 duration-300">
                                    <pre className="text-[13px] text-fuchsia-300/80 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                                        {result.sql}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AskPitchIQ;