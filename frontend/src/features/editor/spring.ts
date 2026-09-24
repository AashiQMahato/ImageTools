import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Apple-style springs, described by damping ratio and response (seconds) rather than mass/stiffness.
 * damping 1.0 = critically damped (no overshoot); < 1 overshoots. Values are always animated from their
 * current on-screen value and keep their velocity when retargeted, so any motion can be interrupted.
 */
export interface SpringConfig {
    damping: number;
    response: number;
}

export const SPRINGS = {
    /** Default for repositioning: smooth, no overshoot. */
    smooth: { damping: 1, response: 0.4 },
    /** Rotation, per Apple's shipped value: a touch of life. */
    rotation: { damping: 0.8, response: 0.4 },
    /** After a flick: momentum earns a little bounce. */
    momentum: { damping: 0.85, response: 0.35 },
} as const satisfies Record<string, SpringConfig>;

interface Channel {
    value: number;
    velocity: number;
    target: number;
    config: SpringConfig;
}

/**
 * A set of named numeric springs driven by one requestAnimationFrame loop. `set` retargets (keeping velocity);
 * `jump` moves instantly (for 1:1 gesture tracking). Re-renders the component each frame while anything moves.
 */
export function useSprings<K extends string>(initial: Record<K, number>, reduceMotion = false) {
    const channels = useRef<Record<string, Channel>>(
        Object.fromEntries(
            Object.entries(initial).map(([key, value]) => [key, { value: value as number, velocity: 0, target: value as number, config: SPRINGS.smooth }]),
        ),
    );
    const snapshot = () => {
        const entries = Object.entries(channels.current);
        return {
            values: Object.fromEntries(entries.map(([key, channel]) => [key, channel.value])) as Record<K, number>,
            targets: Object.fromEntries(entries.map(([key, channel]) => [key, channel.target])) as Record<K, number>,
        };
    };
    const [state, setState] = useState(() => ({ values: { ...initial }, targets: { ...initial } }));
    const publish = useCallback(() => setState(snapshot()), []);
    const frame = useRef(0);
    const last = useRef(0);
    const onRest = useRef<Array<() => void>>([]);

    const tickRef = useRef<(now: number) => void>(() => undefined);
    const tick = useCallback((now: number) => {
        const dt = Math.min(1 / 30, (now - (last.current || now)) / 1000) || 1 / 60;
        last.current = now;
        let moving = false;
        for (const channel of Object.values(channels.current)) {
            if (channel.value === channel.target && channel.velocity === 0) continue;
            const stiffness = ((2 * Math.PI) / channel.config.response) ** 2;
            const damping = 4 * Math.PI * channel.config.damping / channel.config.response;
            // Semi-implicit Euler in small sub-steps for stability.
            const steps = 4;
            const h = dt / steps;
            for (let i = 0; i < steps; i++) {
                const force = -stiffness * (channel.value - channel.target) - damping * channel.velocity;
                channel.velocity += force * h;
                channel.value += channel.velocity * h;
            }
            const scale = Math.max(1, Math.abs(channel.target));
            if (Math.abs(channel.value - channel.target) < 1e-4 * scale && Math.abs(channel.velocity) < 1e-3 * scale) {
                channel.value = channel.target;
                channel.velocity = 0;
            } else {
                moving = true;
            }
        }
        publish();
        if (moving) {
            frame.current = requestAnimationFrame(tickRef.current);
        } else {
            frame.current = 0;
            last.current = 0;
            const callbacks = onRest.current;
            onRest.current = [];
            callbacks.forEach((callback) => callback());
        }
    }, [publish]);
    useEffect(() => {
        tickRef.current = tick;
    }, [tick]);

    const start = useCallback(() => {
        if (!frame.current) frame.current = requestAnimationFrame(tick);
    }, [tick]);

    useEffect(() => () => cancelAnimationFrame(frame.current), []);

    /** Animate toward targets. Pass `velocity` (units/s) to hand off a gesture's speed. */
    const set = useCallback(
        (targets: Partial<Record<K, number>>, options: { config?: SpringConfig; velocity?: Partial<Record<K, number>> } = {}) => {
            for (const [key, target] of Object.entries(targets) as Array<[K, number]>) {
                const channel = channels.current[key];
                if (!channel) continue;
                if (reduceMotion) {
                    channel.value = target;
                    channel.velocity = 0;
                    channel.target = target;
                    continue;
                }
                channel.target = target;
                channel.config = options.config ?? SPRINGS.smooth;
                const velocity = options.velocity?.[key];
                if (velocity !== undefined) channel.velocity = velocity;
            }
            if (reduceMotion) publish();
            else start();
        },
        [reduceMotion, start, publish],
    );

    /** Move instantly (gesture tracking). Stops any motion on those channels. */
    const jump = useCallback((values: Partial<Record<K, number>>) => {
        for (const [key, value] of Object.entries(values) as Array<[K, number]>) {
            const channel = channels.current[key];
            if (!channel) continue;
            channel.value = value;
            channel.target = value;
            channel.velocity = 0;
        }
        publish();
    }, [publish]);

    const whenRested = useCallback((callback: () => void) => {
        if (frame.current) onRest.current.push(callback);
        else callback();
    }, []);

    return { values: state.values, targets: state.targets, set, jump, whenRested };
}

/** Apple's momentum projection (Designing Fluid Interfaces): where a flick would come to rest. */
export function project(velocity: number, decelerationRate = 0.998) {
    return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
    if (dimension <= 0) return 0;
    return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Tracks recent pointer samples to estimate release velocity (units per second). */
export class VelocityTracker {
    private samples: Array<{ t: number; v: number }> = [];

    reset(value: number) {
        this.samples = [{ t: performance.now(), v: value }];
    }

    add(value: number) {
        const t = performance.now();
        this.samples.push({ t, v: value });
        while (this.samples.length > 2 && t - (this.samples[0]?.t ?? t) > 100) this.samples.shift();
    }

    get velocity() {
        const first = this.samples[0];
        const lastSample = this.samples[this.samples.length - 1];
        if (!first || !lastSample || lastSample.t - first.t < 8) return 0;
        return ((lastSample.v - first.v) / (lastSample.t - first.t)) * 1000;
    }
}
