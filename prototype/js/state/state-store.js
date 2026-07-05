/**
 * AuditOS Shared Audit State Store
 * Shared Audit State — Chapter 9 / Shared Audit State Model — Chapter 45
 *
 * The single source of truth for runtime application data in the static
 * prototype. The store loads the demo-data catalog once, keeps that baseline
 * immutable, and maintains a runtime in-memory state that consumers read
 * through a framework-agnostic API. Writes are simulated: they mutate only
 * the runtime state, never the demo-data files, and every change publishes a
 * state event. Reset restores the runtime state to the immutable baseline.
 *
 * Out of scope by design: UI, business workflows, governance/approval flows,
 * AI, and persistence. The production architecture routes every mutation
 * through the Human Approval Engine (Model §45.12); in this prototype
 * foundation the simulated write API is the mechanical substrate that later
 * governance issues build in front of.
 *
 * The store loads from the generated demo-data bundle
 * (`demo-data/demo-data.js`, exposed as `AuditOS.demoDataBundle`), a classic
 * script projection of the canonical demo-data JSON produced by
 * `node prototype/tools/generate-demo-data-bundle.js`. Loading is therefore
 * identical under file:// and http(s), fully offline, and requires no
 * network access, no localhost, and no build step at runtime. Consumers see
 * only the AuditOS.state API and never know how the data was loaded.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};
  var registry = AuditOS.demoDataRegistry;

  /**
   * State events, named as completed facts (Coding Standards §30.13 — Event
   * Standards). Published through the store's own subscribe/publish API — not
   * DOM events — so the state layer stays framework-agnostic.
   */
  var EVENTS = {
    STATE_LOADED: 'auditos:state-loaded',
    STATE_CHANGED: 'auditos:state-changed',
    STATE_RESET: 'auditos:state-reset'
  };

  /** Change types carried in the STATE_CHANGED event detail. */
  var CHANGE_TYPES = {
    RECORD_CREATED: 'record-created',
    RECORD_UPDATED: 'record-updated',
    RECORD_REMOVED: 'record-removed'
  };

  /** Internal dataset key under which shared-scope documents are stored. */
  var SHARED_DATASET_KEY = 'shared';

  /** Default record identifier field; entries may override via idKey. */
  var DEFAULT_ID_KEY = 'id';

  // Store state, established during init().
  var baseline = null;    // Deep-frozen demo-data snapshot. Never mutated.
  var runtime = null;     // Mutable working copy all reads and writes use.
  var loadPromise = null; // Memoized so demo-data loads exactly once.
  var listeners = {};     // eventName → array of subscriber handlers.
  var simulatedIdCounter = 0;

  var status = {
    ready: false,
    demoDataLoaded: false,
    degraded: false,
    degradedReason: null, // 'bundle-missing' | 'bundle-incomplete' | null
    failedSources: [],
    loadedAt: null
  };

  /**
   * Deep-clones a JSON-safe value. Demo-data is static JSON and simulated
   * writes accept only JSON-safe records, so a JSON round-trip is exact.
   */
  function clone(value) {
    if (value === undefined || value === null) {
      return null;
    }
    return JSON.parse(JSON.stringify(value));
  }

  /** Recursively freezes a value so the baseline stays immutable. */
  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(function (key) {
        deepFreeze(value[key]);
      });
    }
    return value;
  }

  /**
   * Builds the empty state shape: one dataset map per registered collection.
   * Used both as the loading target and as the degraded fallback shape.
   */
  function emptyState() {
    var state = {};
    registry.COLLECTIONS.forEach(function (entry) {
      state[entry.id] = {};
    });
    return state;
  }

  /**
   * Loads every registered collection once from the generated demo-data
   * bundle. Only registered collections are taken from the bundle; a
   * registered collection missing from the bundle is recorded by its
   * canonical demo-data source and skipped, so one gap cannot take down the
   * whole state. Environment-independent: no network, no protocol checks.
   */
  function loadDemoData() {
    var data = emptyState();
    var failedSources = [];
    var bundle = AuditOS.demoDataBundle;

    if (!bundle || typeof bundle !== 'object' || !bundle.collections) {
      return {
        data: data,
        demoDataLoaded: false,
        degradedReason: 'bundle-missing',
        failedSources: failedSources
      };
    }

    registry.COLLECTIONS.forEach(function (entry) {
      var documents = bundle.collections[entry.id];
      if (!documents || typeof documents !== 'object') {
        failedSources.push(entry.path || entry.manifestPath);
        return;
      }
      Object.keys(documents).forEach(function (datasetKey) {
        // Cloned so the state detaches from the bundle global entirely;
        // neither freezing the baseline nor mutating the bundle can reach
        // across.
        data[entry.id][datasetKey] = clone(documents[datasetKey]);
      });
    });

    var loaded = failedSources.length === 0;
    return {
      data: data,
      demoDataLoaded: loaded,
      degradedReason: loaded ? null : 'bundle-incomplete',
      failedSources: failedSources
    };
  }

  /**
   * Resolves a collection reference to its runtime dataset key. Shared
   * collections take no dataset identifier; engagement collections require
   * one. Returns null when the reference is invalid.
   */
  function resolveDatasetKey(entry, datasetId) {
    if (entry.scope === registry.SCOPES.SHARED) {
      return datasetId === undefined || datasetId === null ? SHARED_DATASET_KEY : null;
    }
    return typeof datasetId === 'string' && datasetId.length > 0 ? datasetId : null;
  }

  /** Looks up a runtime document. Returns null when absent or unresolvable. */
  function resolveDocument(collectionId, datasetId) {
    if (!status.ready) {
      return null;
    }
    var entry = registry.findById(collectionId);
    if (!entry) {
      return null;
    }
    var datasetKey = resolveDatasetKey(entry, datasetId);
    if (!datasetKey) {
      return null;
    }
    return runtime[entry.id][datasetKey] || null;
  }

  /**
   * Resolves the records array a write targets, creating an empty simulated
   * document when the dataset does not exist yet (which keeps simulated
   * writes functional even when demo-data is unavailable).
   */
  function resolveRecordsForWrite(entry, datasetKey) {
    var document = runtime[entry.id][datasetKey];
    if (!document) {
      document = { metadata: { simulated: true } };
      runtime[entry.id][datasetKey] = document;
    }
    if (!Array.isArray(document[entry.recordsKey])) {
      document[entry.recordsKey] = [];
    }
    return document[entry.recordsKey];
  }

  /** Finds a record's index within a records array by identifier. */
  function indexOfRecord(records, idKey, recordId) {
    for (var index = 0; index < records.length; index += 1) {
      if (records[index] && records[index][idKey] === recordId) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Validates a write reference. Returns the resolved write context, or null
   * when the store is not ready or the reference is invalid.
   */
  function resolveWriteContext(collectionId, datasetId) {
    if (!status.ready) {
      return null;
    }
    var entry = registry.findById(collectionId);
    if (!entry) {
      return null;
    }
    var datasetKey = resolveDatasetKey(entry, datasetId);
    if (!datasetKey) {
      return null;
    }
    return {
      entry: entry,
      datasetKey: datasetKey,
      idKey: entry.idKey || DEFAULT_ID_KEY,
      // Event detail reports null (not the internal key) for shared scope.
      datasetId: entry.scope === registry.SCOPES.SHARED ? null : datasetKey
    };
  }

  /**
   * Publishes a state event to subscribers. Handler failures are isolated so
   * one subscriber cannot break the others, and surfaced on the console.
   */
  function publish(eventName, detail) {
    Object.freeze(detail);
    var subscribers = (listeners[eventName] || []).slice();
    for (var index = 0; index < subscribers.length; index += 1) {
      try {
        subscribers[index](detail);
      } catch (error) {
        global.console.error('AuditOS state subscriber failed for ' + eventName, error);
      }
    }
  }

  /** Publishes a STATE_CHANGED event for one record mutation. */
  function publishChange(changeType, context, recordId) {
    publish(EVENTS.STATE_CHANGED, {
      changeType: changeType,
      collectionId: context.entry.id,
      datasetId: context.datasetId,
      recordId: recordId
    });
  }

  AuditOS.state = {
    EVENTS: EVENTS,
    CHANGE_TYPES: CHANGE_TYPES,

    /**
     * Loads demo-data once and establishes the immutable baseline and the
     * runtime state. Idempotent: repeated calls return the same promise, so
     * the catalog is never loaded twice. Kept promise-based so consumers are
     * independent of the loading strategy. Never rejects; load problems are
     * reported through getStatus() and the STATE_LOADED event detail.
     */
    init: function () {
      if (loadPromise) {
        return loadPromise;
      }
      loadPromise = Promise.resolve().then(loadDemoData).then(function (loaded) {
        runtime = clone(loaded.data);
        baseline = deepFreeze(loaded.data);
        status.ready = true;
        status.demoDataLoaded = loaded.demoDataLoaded;
        status.degraded = !loaded.demoDataLoaded;
        status.degradedReason = loaded.degradedReason;
        status.failedSources = loaded.failedSources.slice();
        status.loadedAt = new Date().toISOString();
        publish(EVENTS.STATE_LOADED, {
          demoDataLoaded: status.demoDataLoaded,
          degradedReason: status.degradedReason,
          failedSources: status.failedSources.slice()
        });
      });
      return loadPromise;
    },

    /** Reports whether the state has been initialized. */
    isReady: function () {
      return status.ready;
    },

    /** Returns a snapshot of the store status and load diagnostics. */
    getStatus: function () {
      return clone(status);
    },

    // ------------------------------------------------------------------
    // Read API — every result is a defensive deep copy; mutating it never
    // touches the runtime state. State changes go through the write API.
    // ------------------------------------------------------------------

    /** Returns the structural descriptors of every registered collection. */
    listCollections: function () {
      return registry.COLLECTIONS.map(function (entry) {
        return {
          id: entry.id,
          scope: entry.scope,
          recordsKey: entry.recordsKey,
          idKey: entry.idKey || DEFAULT_ID_KEY
        };
      });
    },

    /**
     * Returns the dataset identifiers currently held for an engagement-scoped
     * collection. Shared collections and unknown identifiers yield [].
     */
    getDatasetIds: function (collectionId) {
      if (!status.ready) {
        return [];
      }
      var entry = registry.findById(collectionId);
      if (!entry || entry.scope !== registry.SCOPES.ENGAGEMENT) {
        return [];
      }
      return Object.keys(runtime[entry.id]);
    },

    /**
     * Returns a full runtime document — including structural keys such as
     * metadata and summary — or null. Shared collections take no datasetId;
     * engagement collections require one.
     */
    getDocument: function (collectionId, datasetId) {
      return clone(resolveDocument(collectionId, datasetId));
    },

    /** Returns the records of a collection document, or []. */
    listRecords: function (collectionId, datasetId) {
      var entry = registry.findById(collectionId);
      var document = entry ? resolveDocument(collectionId, datasetId) : null;
      if (!document || !Array.isArray(document[entry.recordsKey])) {
        return [];
      }
      return clone(document[entry.recordsKey]);
    },

    /** Returns one record by identifier, or null. */
    getRecord: function (collectionId, recordId, datasetId) {
      var entry = registry.findById(collectionId);
      var document = entry ? resolveDocument(collectionId, datasetId) : null;
      if (!document || !Array.isArray(document[entry.recordsKey])) {
        return null;
      }
      var idKey = entry.idKey || DEFAULT_ID_KEY;
      var index = indexOfRecord(document[entry.recordsKey], idKey, recordId);
      return index === -1 ? null : clone(document[entry.recordsKey][index]);
    },

    /**
     * Returns the dataset identifiers of an engagement-scoped collection
     * whose document metadata declares the given engagement.
     */
    findDatasetsForEngagement: function (collectionId, engagementId) {
      return this.getDatasetIds(collectionId).filter(function (datasetId) {
        var document = resolveDocument(collectionId, datasetId);
        return Boolean(document && document.metadata &&
          document.metadata.engagementId === engagementId);
      });
    },

    // ------------------------------------------------------------------
    // Simulated write API — mutates only the runtime in-memory state.
    // Nothing is persisted; demo-data files are never touched. Every
    // mutation publishes a STATE_CHANGED event.
    // ------------------------------------------------------------------

    /**
     * Adds a record to a collection. Assigns a simulated identifier when the
     * record has none; rejects duplicates. Returns a copy of the stored
     * record, or null when the reference or record is invalid.
     */
    createRecord: function (collectionId, record, datasetId) {
      var context = resolveWriteContext(collectionId, datasetId);
      if (!context || !record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
      }
      var records = resolveRecordsForWrite(context.entry, context.datasetKey);
      var stored = clone(record);
      if (stored[context.idKey] === undefined || stored[context.idKey] === null) {
        simulatedIdCounter += 1;
        stored[context.idKey] = 'SIM-' + String(1000 + simulatedIdCounter).slice(1);
      }
      if (indexOfRecord(records, context.idKey, stored[context.idKey]) !== -1) {
        return null;
      }
      records.push(stored);
      publishChange(CHANGE_TYPES.RECORD_CREATED, context, stored[context.idKey]);
      return clone(stored);
    },

    /**
     * Shallow-merges changes onto an existing record. The record identifier
     * cannot be changed; an identifier field in `changes` is ignored.
     * Returns a copy of the updated record, or null when not found.
     */
    updateRecord: function (collectionId, recordId, changes, datasetId) {
      var context = resolveWriteContext(collectionId, datasetId);
      if (!context || !changes || typeof changes !== 'object' || Array.isArray(changes)) {
        return null;
      }
      var document = runtime[context.entry.id][context.datasetKey];
      if (!document || !Array.isArray(document[context.entry.recordsKey])) {
        return null;
      }
      var records = document[context.entry.recordsKey];
      var index = indexOfRecord(records, context.idKey, recordId);
      if (index === -1) {
        return null;
      }
      var applied = clone(changes);
      Object.keys(applied).forEach(function (key) {
        if (key !== context.idKey) {
          records[index][key] = applied[key];
        }
      });
      publishChange(CHANGE_TYPES.RECORD_UPDATED, context, recordId);
      return clone(records[index]);
    },

    /**
     * Removes a record from a collection. Returns true when a record was
     * removed, false otherwise.
     */
    removeRecord: function (collectionId, recordId, datasetId) {
      var context = resolveWriteContext(collectionId, datasetId);
      if (!context) {
        return false;
      }
      var document = runtime[context.entry.id][context.datasetKey];
      if (!document || !Array.isArray(document[context.entry.recordsKey])) {
        return false;
      }
      var records = document[context.entry.recordsKey];
      var index = indexOfRecord(records, context.idKey, recordId);
      if (index === -1) {
        return false;
      }
      records.splice(index, 1);
      publishChange(CHANGE_TYPES.RECORD_REMOVED, context, recordId);
      return true;
    },

    // ------------------------------------------------------------------
    // Reset API
    // ------------------------------------------------------------------

    /**
     * Discards every simulated write and restores the runtime state to the
     * immutable demo-data baseline. Returns true when the reset ran.
     */
    reset: function () {
      if (!status.ready) {
        return false;
      }
      runtime = clone(baseline);
      publish(EVENTS.STATE_RESET, {});
      return true;
    },

    // ------------------------------------------------------------------
    // Publish/subscribe API — framework-agnostic; no DOM dependency.
    // ------------------------------------------------------------------

    /**
     * Subscribes a handler to one state event (see EVENTS). Returns an
     * unsubscribe function. Unknown events and non-function handlers yield a
     * no-op unsubscriber.
     */
    subscribe: function (eventName, handler) {
      var known = Object.keys(EVENTS).some(function (key) {
        return EVENTS[key] === eventName;
      });
      if (!known || typeof handler !== 'function') {
        return function () {};
      }
      if (!listeners[eventName]) {
        listeners[eventName] = [];
      }
      listeners[eventName].push(handler);
      return function () {
        var subscribers = listeners[eventName];
        var index = subscribers.indexOf(handler);
        if (index !== -1) {
          subscribers.splice(index, 1);
        }
      };
    }
  };
})(window);
