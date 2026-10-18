'use client';

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

export interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  duration?: number;
  yOffset?: number;
  children: React.ReactNode;
}

/**
  * FadeIn: Animasi masuk halus (DESIGN.md §12: <= 200ms, menghormati prefers-reduced-motion).
 */
export function FadeIn({
  delay = 0,
  duration = 0.2,
  yOffset = 8,
  className,
  children,
  initial,
  ...props
}: FadeInProps): React.JSX.Element {
  const prefersReducedMotion = useReducedMotion();

  // Cegah pemblokiran FCP/LCP: jika initial bernilai false atau reduced-motion, render konten terlihat penuh tanpa opacity 0
  const resolvedInitial =
    prefersReducedMotion || initial === false
      ? false
      : initial !== undefined
        ? initial
        : false;

  return (
    <motion.div
      initial={resolvedInitial}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration, delay, ease: [0.22, 1, 0.36, 1] }
      }
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerGroupProps extends HTMLMotionProps<'div'> {
  staggerChildren?: number;
  delayChildren?: number;
  children: React.ReactNode;
}

/**
 * StaggerGroup: Kontainer animasi berurutan cepat untuk daftar kartu/baris.
 */
export function StaggerGroup({
  staggerChildren = 0.04,
  delayChildren = 0,
  className,
  children,
  initial,
  ...props
}: StaggerGroupProps): React.JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const resolvedInitial =
    prefersReducedMotion || initial === false
      ? false
      : initial !== undefined
        ? initial
        : false;

  return (
    <motion.div
      initial={resolvedInitial}
      animate="visible"
      variants={{
        hidden: { opacity: prefersReducedMotion ? 1 : 0 },
        visible: {
          opacity: 1,
          transition: prefersReducedMotion
            ? { duration: 0 }
            : {
                staggerChildren,
                delayChildren,
              },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
}

/**
 * StaggerItem: Item anak di dalam StaggerGroup (y: 6 -> 0, duration: 0.18s).
 */
export function StaggerItem({
  className,
  children,
  ...props
}: StaggerItemProps): React.JSX.Element {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 },
        visible: {
          opacity: 1,
          y: 0,
          transition: prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface AnimatedPanelProps {
  panelKey: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * AnimatedPanel: Pembungkus AnimatePresence mode="wait" untuk pergantian tab (duration: 0.15s).
 */
export function AnimatedPanel({
  panelKey,
  className,
  children,
}: AnimatedPanelProps): React.JSX.Element {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={panelKey}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.15, ease: [0.22, 1, 0.36, 1] }
        }
        className={cn(className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { motion, AnimatePresence, useReducedMotion };
