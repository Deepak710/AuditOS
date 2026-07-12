/**
 * AuditOS Shared Enterprise Component Library — Registry
 * Component Architecture — Chapter 74 / Layout Components — Chapter 75 /
 * Navigation Components — Chapter 76
 *
 * The single authoritative catalog of the reusable presentation components
 * AuditOS provides. Each entry is a component identity only — a stable
 * identifier, a human-readable name, an architectural category, the base CSS
 * class that renders it (defined in css/components.css), and a one-line
 * description of its presentation responsibility.
 *
 * No visual values, business objects, Shared Audit State, demo-data, or
 * workflow logic live here. Components are presentation only; this registry is
 * a catalog of them, exactly as the Workspace Registry is a catalog of
 * workspaces. It exists so the library is discoverable and verifiable (no
 * future workspace may invent duplicate primitives) and so later tooling can
 * enumerate the approved components.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader. Keep
 * this catalog in sync with css/components.css and component-library.html.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /**
   * Architectural component categories (Component Architecture §74.7).
   * Centralized so entries reference one constant instead of repeating string
   * literals (Coding Standards §30.11 — Constants).
   */
  var COMPONENT_CATEGORIES = {
    FOUNDATION: 'foundation',
    DATA_DISPLAY: 'data-display',
    INPUT: 'input',
    LAYOUT: 'layout',
    STATE: 'state'
  };

  /**
   * Ordered component catalog.
   *
   * `id` is the stable, lowercase, hyphenated component identifier. `className`
   * is the base CSS class the component renders through (css/components.css);
   * variants and sub-parts extend it with `--modifier` / `__part`. Order groups
   * components by category in the reading order of the component documentation.
   */
  var COMPONENTS = [
    {
      id: 'surface',
      name: 'Surface',
      category: COMPONENT_CATEGORIES.FOUNDATION,
      className: 'aos-surface',
      description: 'Base bordered container primitive that every card-like surface composes from.'
    },
    {
      id: 'card',
      name: 'Card',
      category: COMPONENT_CATEGORIES.FOUNDATION,
      className: 'aos-card',
      description: 'A Surface composed with an optional header, body, and footer; supports an accessible interactive variant.'
    },
    {
      id: 'section',
      name: 'Section',
      category: COMPONENT_CATEGORIES.FOUNDATION,
      className: 'aos-section',
      description: 'A content grouping that owns vertical rhythm and an optional titled header inside a surface or canvas.'
    },
    {
      id: 'panel-section',
      name: 'Panel Section',
      category: COMPONENT_CATEGORIES.FOUNDATION,
      className: 'aos-panel-section',
      description: 'A titled bordered region with header and body; the reusable panel primitive the workspace framework composes from.'
    },
    {
      id: 'divider',
      name: 'Divider',
      category: COMPONENT_CATEGORIES.FOUNDATION,
      className: 'aos-divider',
      description: 'A hairline separator with separator semantics; horizontal, vertical, and labeled variants.'
    },
    {
      id: 'kpi-tile',
      name: 'KPI Tile',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-kpi-tile',
      description: 'A metric tile with label, dominant value, directional delta, and caption; trend conveyed beyond color alone.'
    },
    {
      id: 'status-badge',
      name: 'Status Badge',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-status-badge',
      description: 'A compact status pill whose tone reads through a semantic surface and its own text label, never color alone.'
    },
    {
      id: 'chip',
      name: 'Chip',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-chip',
      description: 'A compact token for tags, filters, and selections; interactive and selected states are keyboard accessible.'
    },
    {
      id: 'property-row',
      name: 'Property Row',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-property-row',
      description: 'A single label/value pair that aligns on wide layouts and stacks on narrow ones.'
    },
    {
      id: 'property-grid',
      name: 'Property Grid',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-property-grid',
      description: 'A dense, divided collection of Property Rows for object detail views; one or two responsive columns.'
    },
    {
      id: 'metadata-list',
      name: 'Metadata List',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-metadata-list',
      description: 'A semantic description list of term/detail metadata pairs; stacked or inline.'
    },
    {
      id: 'progress',
      name: 'Progress',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-progress',
      description: 'A labeled progress meter whose value always reads as text beside the track, never through the bar alone.'
    },
    {
      id: 'item-list',
      name: 'Item List',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-item-list',
      description: 'A semantic list of operational items — tone marker, content, trailing meta — for feeds, notifications, tasks, and documents.'
    },
    {
      id: 'timeline',
      name: 'Timeline',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-timeline',
      description: 'An ordered list of dated events with tone markers on a connecting rail; the reusable timeline primitive (§15.10).'
    },
    {
      id: 'data-grid',
      name: 'Data Grid',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-data-grid',
      description: 'The enterprise collection table: configurable columns, sortable headers (UI only), selectable rows, status rails, badges, row actions, compact/comfortable density, and a sticky header (§77.10).'
    },
    {
      id: 'entity-card',
      name: 'Entity Card',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-entity-card',
      description: 'The one shared object-card language for clients, engagements, controls, evidence, and findings; a type avatar, identity, status badge, facts, meter, and tags (§77.8).'
    },
    {
      id: 'activity-feed',
      name: 'Activity Feed',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-activity-feed',
      description: 'A grouped stream of operational events with a tone icon, title, actor, metadata, and trailing timestamp; the grouped sibling of Item List (§77.13).'
    },
    {
      id: 'inspector',
      name: 'Inspector Panel',
      category: COMPONENT_CATEGORIES.DATA_DISPLAY,
      className: 'aos-inspector',
      description: 'The reusable object detail panel: identity header, status badges, titled property/metadata/relationship sections with reserved placeholders, and a footer action cluster (§77.9).'
    },
    {
      id: 'button',
      name: 'Button',
      category: COMPONENT_CATEGORIES.INPUT,
      className: 'aos-button',
      description: 'The standard action control for buttons and button-styled links; primary, subtle, and small variants with a visible focus ring.'
    },
    {
      id: 'search-field',
      name: 'Search Field',
      category: COMPONENT_CATEGORIES.INPUT,
      className: 'aos-search-field',
      description: 'A compact search control — a leading glyph and a borderless input in a bordered field that lifts the focus ring through :focus-within; placeholder only in Release 1.'
    },
    {
      id: 'select',
      name: 'Select',
      category: COMPONENT_CATEGORIES.INPUT,
      className: 'aos-select',
      description: 'A native select styled to the enterprise field language with a custom caret; fully keyboard and screen-reader accessible. Powers the toolbar sort/view and filter-bar dropdowns.'
    },
    {
      id: 'toolbar-group',
      name: 'Toolbar Group',
      category: COMPONENT_CATEGORIES.LAYOUT,
      className: 'aos-toolbar-group',
      description: 'A horizontal cluster of related toolbar controls with a consistent gap that wraps responsively.'
    },
    {
      id: 'action-group',
      name: 'Action Group',
      category: COMPONENT_CATEGORIES.LAYOUT,
      className: 'aos-action-group',
      description: 'A cluster of workspace actions with predictable spacing and alignment variants; presentation only.'
    },
    {
      id: 'master-detail',
      name: 'Master–Detail',
      category: COMPONENT_CATEGORIES.LAYOUT,
      className: 'aos-master-detail',
      description: 'The reusable split layout: a list/table region beside an inspector region, with configurable proportions, an optional resizable divider, and responsive collapse (§81.8).'
    },
    {
      id: 'empty-state',
      name: 'Empty State',
      category: COMPONENT_CATEGORIES.STATE,
      className: 'aos-empty-state',
      description: 'The reusable no-information surface that explains why a region is empty and what happens next (§15.12).'
    },
    {
      id: 'loading-state',
      name: 'Loading State',
      category: COMPONENT_CATEGORIES.STATE,
      className: 'aos-loading-state',
      description: 'A layout-stable loading region with an accessible live label that composes Skeletons (§15.12).'
    },
    {
      id: 'skeleton',
      name: 'Skeleton',
      category: COMPONENT_CATEGORIES.STATE,
      className: 'aos-skeleton',
      description: 'A decorative placeholder block whose shimmer collapses to a static block under reduced motion.'
    },
    {
      id: 'permission-notice',
      name: 'Permission Notice',
      category: COMPONENT_CATEGORIES.STATE,
      className: 'aos-permission-notice',
      description: 'The permission-aware action area (Issue #33 §5): unavailable actions stay hidden, and hovering or focusing the area explains the required role, the appropriate contact, and the reason.'
    }
  ];

  AuditOS.componentLibrary = {
    CATEGORIES: COMPONENT_CATEGORIES,
    COMPONENTS: COMPONENTS,

    /**
     * Returns the component registered for an identifier, or null when the
     * identifier matches no registered component.
     */
    findById: function (id) {
      for (var index = 0; index < COMPONENTS.length; index += 1) {
        if (COMPONENTS[index].id === id) {
          return COMPONENTS[index];
        }
      }
      return null;
    },

    /**
     * Returns the components registered under a category, in catalog order.
     * Returns an empty array when the category matches no registered component.
     */
    findByCategory: function (category) {
      var matches = [];
      for (var index = 0; index < COMPONENTS.length; index += 1) {
        if (COMPONENTS[index].category === category) {
          matches.push(COMPONENTS[index]);
        }
      }
      return matches;
    }
  };
})(window);
