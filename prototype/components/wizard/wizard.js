/**
 * AuditOS Shared Wizard Engine
 * Platform Foundation II — GitHub Issue #34 (Client Creation Wizard /
 * Engagement Creation Wizard) / Component Design Patterns — Chapter 81
 *
 * One reusable multi-step wizard renderer both creation wizards configure
 * declaratively — steps, fields, validation, review, and completion — so
 * neither workspace invents its own form chrome. Presentation and captured
 * input only: the engine holds the in-progress values in memory, renders a
 * Single Pane step flow (step rail, field form, back / next, review,
 * finish), and hands the captured values to the caller's `onComplete`. What
 * the values become — a Repository write, an audit event, a navigation —
 * belongs to the calling wizard workspace, never to this engine.
 *
 * Field types: `text`, `date`, `textarea`, `select` (options supplied by the
 * caller from real data), and `list` (one entry per line, captured as an
 * array). Required fields gate step advance with an inline explanation.
 * The final step of every wizard is the generated Review step: every
 * captured value, grouped by step, read back before anything is written.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Creates an element with a class and optional text content. */
  function el(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null && textContent !== '') {
      node.textContent = textContent;
    }
    return node;
  }

  // ------------------------------------------------------------------
  // Pure helpers — no DOM, offline-testable.
  // ------------------------------------------------------------------

  /** Splits a list field's raw text into trimmed, non-empty entries. */
  function parseListValue(raw) {
    return String(raw || '').split('\n').map(function (line) {
      return line.trim();
    }).filter(function (line) {
      return line !== '';
    });
  }

  /**
   * The required fields of a step that are still missing from the captured
   * values. A list field counts as present when it has at least one entry.
   */
  function missingRequiredFields(step, values) {
    return asArray(step.fields).filter(function (field) {
      if (!field.required) {
        return false;
      }
      var value = values[field.id];
      if (field.type === 'list') {
        return asArray(value).length === 0;
      }
      return value === undefined || value === null || String(value).trim() === '';
    }).map(function (field) {
      return field.id;
    });
  }

  /** A field's captured value formatted for the Review step. */
  function formatReviewValue(field, value) {
    if (field.type === 'list') {
      var entries = asArray(value);
      return entries.length > 0 ? entries.join(' · ') : 'Not provided';
    }
    if (field.type === 'select' && value) {
      var match = asArray(field.options).filter(function (option) {
        return (typeof option === 'string' ? option : option.value) === value;
      })[0];
      if (match && typeof match !== 'string') {
        return match.label;
      }
    }
    return value === undefined || value === null || String(value).trim() === ''
      ? 'Not provided' : String(value);
  }

  // ------------------------------------------------------------------
  // Renderer
  // ------------------------------------------------------------------

  /** Builds one form field row and wires it to the wizard's value store. */
  function buildField(field, values, prefix) {
    var row = el('div', prefix + '__field');
    var fieldId = prefix + '-field-' + field.id;

    var label = el('label', prefix + '__label', field.label + (field.required ? ' *' : ''));
    label.setAttribute('for', fieldId);
    row.appendChild(label);

    var control;
    if (field.type === 'textarea' || field.type === 'list') {
      control = el('textarea', prefix + '__input');
      control.setAttribute('rows', field.type === 'list' ? '3' : '3');
      if (field.type === 'list') {
        control.value = asArray(values[field.id]).join('\n');
      } else {
        control.value = values[field.id] || '';
      }
    } else if (field.type === 'select') {
      control = el('select', prefix + '__input');
      var placeholderOption = el('option', null, field.placeholder || 'Select…');
      placeholderOption.value = '';
      control.appendChild(placeholderOption);
      asArray(field.options).forEach(function (option) {
        var value = typeof option === 'string' ? option : option.value;
        var optionLabel = typeof option === 'string' ? option : option.label;
        var node = el('option', null, optionLabel);
        node.value = value;
        control.appendChild(node);
      });
      control.value = values[field.id] || '';
    } else {
      control = el('input', prefix + '__input');
      control.setAttribute('type', field.type === 'date' ? 'date' : 'text');
      control.value = values[field.id] || '';
    }
    control.id = fieldId;
    if (field.placeholder && field.type !== 'select') {
      control.setAttribute('placeholder', field.placeholder);
    }
    control.addEventListener('input', function () {
      values[field.id] = field.type === 'list' ? parseListValue(control.value) : control.value;
    });
    control.addEventListener('change', function () {
      values[field.id] = field.type === 'list' ? parseListValue(control.value) : control.value;
    });
    row.appendChild(control);

    if (field.help) {
      row.appendChild(el('p', prefix + '__help', field.help));
    }
    return row;
  }

  /** Builds the step rail: every step with its position and state. */
  function buildStepRail(steps, currentIndex, prefix) {
    var rail = el('ol', prefix + '__rail');
    rail.setAttribute('aria-label', 'Wizard steps');
    steps.forEach(function (step, index) {
      var item = el('li', prefix + '__rail-step' +
        (index === currentIndex ? ' ' + prefix + '__rail-step--current' : '') +
        (index < currentIndex ? ' ' + prefix + '__rail-step--done' : ''));
      if (index === currentIndex) {
        item.setAttribute('aria-current', 'step');
      }
      item.appendChild(el('span', prefix + '__rail-index', String(index + 1)));
      item.appendChild(el('span', prefix + '__rail-title', step.title));
      rail.appendChild(item);
    });
    return rail;
  }

  /** Builds the Review step body: every captured value grouped by step. */
  function buildReview(steps, values, prefix) {
    var review = el('div', prefix + '__review');
    steps.filter(function (step) { return !step.review; }).forEach(function (step) {
      var group = el('section', prefix + '__review-group');
      group.appendChild(el('h3', prefix + '__review-title', step.title));
      var list = el('dl', prefix + '__review-list');
      asArray(step.fields).forEach(function (field) {
        var row = el('div', prefix + '__review-row');
        row.appendChild(el('dt', prefix + '__review-term', field.label));
        row.appendChild(el('dd', prefix + '__review-detail', formatReviewValue(field, values[field.id])));
        list.appendChild(row);
      });
      group.appendChild(list);
      review.appendChild(group);
    });
    return review;
  }

  /**
   * Creates and mounts a wizard into a host element. `config` is
   * `{ prefix, title, steps, completeLabel, onComplete(values) }` where the
   * last step may declare `review: true`. `onComplete` returns
   * `{ ok, title, description, actions: [{ label, href }] }` rendered as the
   * completion panel. Returns a controller with the in-memory `values`.
   */
  function create(hostElement, config) {
    var prefix = config.prefix || 'aos-wizard';
    var steps = asArray(config.steps);
    var values = config.initialValues ? config.initialValues : {};
    var currentIndex = 0;
    var errorMessage = '';
    var completion = null;

    function render() {
      var wizard = el('div', prefix);

      if (completion) {
        var done = el('div', prefix + '__completion');
        done.setAttribute('role', 'status');
        done.appendChild(el('p', prefix + '__completion-title', completion.title));
        if (completion.description) {
          done.appendChild(el('p', prefix + '__completion-description', completion.description));
        }
        var actionRow = el('div', prefix + '__actions');
        asArray(completion.actions).forEach(function (action) {
          var link = el('a', 'aos-button aos-button--primary', action.label);
          link.setAttribute('href', action.href);
          actionRow.appendChild(link);
        });
        done.appendChild(actionRow);
        wizard.appendChild(done);
        hostElement.replaceChildren(wizard);
        return;
      }

      wizard.appendChild(buildStepRail(steps, currentIndex, prefix));

      var step = steps[currentIndex];
      var body = el('div', prefix + '__body');
      body.appendChild(el('h2', prefix + '__step-title', step.title));
      if (step.description) {
        body.appendChild(el('p', prefix + '__step-description', step.description));
      }

      if (step.review) {
        body.appendChild(buildReview(steps, values, prefix));
      } else {
        var form = el('div', prefix + '__form');
        asArray(step.fields).forEach(function (field) {
          form.appendChild(buildField(field, values, prefix));
        });
        body.appendChild(form);
      }

      if (errorMessage) {
        var error = el('p', prefix + '__error', errorMessage);
        error.setAttribute('role', 'alert');
        body.appendChild(error);
      }

      var actions = el('div', prefix + '__actions');
      if (currentIndex > 0) {
        var back = el('button', 'aos-button aos-button--subtle', 'Back');
        back.setAttribute('type', 'button');
        back.addEventListener('click', function () {
          errorMessage = '';
          currentIndex -= 1;
          render();
        });
        actions.appendChild(back);
      }
      var isLast = currentIndex === steps.length - 1;
      var next = el('button', 'aos-button aos-button--primary',
        isLast ? (config.completeLabel || 'Finish') : 'Next');
      next.setAttribute('type', 'button');
      next.addEventListener('click', function () {
        var missing = step.review ? [] : missingRequiredFields(step, values);
        if (missing.length > 0) {
          errorMessage = 'Complete the required fields before continuing.';
          render();
          return;
        }
        errorMessage = '';
        if (isLast) {
          var result = config.onComplete ? config.onComplete(values) : null;
          if (result && result.ok) {
            completion = result;
          } else if (result && result.message) {
            errorMessage = result.message;
          }
          render();
          return;
        }
        currentIndex += 1;
        render();
      });
      actions.appendChild(next);
      body.appendChild(actions);

      wizard.appendChild(body);
      hostElement.replaceChildren(wizard);
    }

    render();
    return {
      values: values,
      goTo: function (index) {
        if (index >= 0 && index < steps.length) {
          currentIndex = index;
          render();
        }
      }
    };
  }

  AuditOS.wizard = {
    create: create,
    // Pure helpers, exposed for the offline suites.
    parseListValue: parseListValue,
    missingRequiredFields: missingRequiredFields,
    formatReviewValue: formatReviewValue
  };
})(window);
