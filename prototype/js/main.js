/**
 * AuditOS Application Bootstrap
 *
 * Single entry point that starts the static prototype once the shell markup is
 * ready. For this issue it initializes the Static Routing Foundation; later
 * issues extend this bootstrap to start additional foundations. It contains no
 * business logic of its own.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  function start() {
    if (AuditOS.router && typeof AuditOS.router.init === 'function') {
      AuditOS.router.init();
    }
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
