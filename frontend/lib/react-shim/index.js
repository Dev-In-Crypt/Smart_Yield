'use strict';
/**
 * Shim: wraps Next.js vendored React and adds useEffectEvent for InterwovenKit 2.x.
 * Webpack alias 'react' → this directory so sub-paths like react/jsx-runtime still work.
 */
const React = require('next/dist/compiled/react');

if (typeof React.useEffectEvent !== 'function') {
  React.useEffectEvent =
    typeof React.experimental_useEffectEvent === 'function'
      ? React.experimental_useEffectEvent
      : function useEffectEvent(fn) { return fn; };
}

module.exports = React;
