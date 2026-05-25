import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook that animates a number counting up from 0 to a target value.
 * Uses requestAnimationFrame with easeOutExpo for smooth deceleration.
 *
 * @param {number} target - The final number to count up to
 * @param {number} duration - Animation duration in ms (default 800)
 * @param {number} decimals - Decimal places to show (default 0)
 * @returns {string} The current animated value as a formatted string
 */
const useCountUp = (target, duration = 800, decimals = 0) => {
    const [current, setCurrent] = useState(0);
    const rafRef = useRef(null);
    const startTimeRef = useRef(null);

    useEffect(() => {
        // Don't animate if target is null/undefined/NaN
        const numTarget = parseFloat(target);
        if (isNaN(numTarget)) {
            setCurrent(0);
            return;
        }

        startTimeRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const animate = (timestamp) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);

            // easeOutExpo: decelerating to zero velocity
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setCurrent(eased * numTarget);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                setCurrent(numTarget);
            }
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [target, duration]);

    // Format the number
    if (isNaN(parseFloat(target))) return '-';

    if (decimals > 0) {
        return current.toFixed(decimals);
    }
    return Math.round(current).toLocaleString();
};

export default useCountUp;
