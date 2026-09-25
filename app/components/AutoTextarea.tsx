"use client";

import { TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";

/**
 * A textarea that grows to fit its text, so an editable report item never cuts off
 * mid-sentence. `field-sizing: content` does this natively where supported; the
 * measurement below covers browsers without it.
 */
export default function AutoTextarea({ value, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Width changes (a resized window, a font finishing loading) reflow the text. Only
    // react to width — our own height change would otherwise re-trigger the observer.
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={`[field-sizing:content] overflow-hidden ${className}`}
      {...props}
    />
  );
}
