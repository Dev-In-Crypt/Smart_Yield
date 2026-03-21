'use strict';
/**
 * Webpack alias shim for `react`.
 * Next.js 15 vendors a React canary that lacks `useEffectEvent`.
 * InterwovenKit 2.x imports it by name. We wrap the vendored React,
 * add the missing export, and re-export the same object.
 */
const React = require('next/dist/compiled/react');

if (typeof React.useEffectEvent !== 'function') {
  // Use experimental variant if present (some canary builds), else identity shim.
  React.useEffectEvent =
    typeof React.experimental_useEffectEvent === 'function'
      ? React.experimental_useEffectEvent
      : function useEffectEvent(fn) { return fn; };
}

module.exports = React;
