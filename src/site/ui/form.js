/**
 * Enquiry form — validation, states, and delivery.
 *
 * Delivery is configured in markup, not here: set data-endpoint on
 * <form id="enquiry-form"> in index.html to any form-to-email service that
 * accepts a JSON POST. Formspree (https://formspree.io/f/XXXXXXXX) and
 * Web3Forms (https://api.web3forms.com/submit, plus an access_key hidden
 * input) both work with no changes to this file.
 *
 * With no endpoint set the form does NOT claim to have sent anything — it
 * hands the completed brief to the visitor's own mail client instead, so an
 * unconfigured deploy still reaches a human rather than silently discarding
 * the enquiry.
 */

import { gsap } from 'gsap';

/** Where the mailto fallback goes. Matches the address in the contact list. */
const FALLBACK_EMAIL = 'studio@vincibuilders.in';

async function submitEnquiry(payload, endpoint) {
  if (!endpoint) return { via: 'mailto' };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Enquiry endpoint returned ${res.status}`);
  return { via: 'endpoint' };
}

/** Hands the brief to the visitor's mail client, pre-filled. */
function openMailClient(payload) {
  const subject = `Enquiry — ${payload.type || 'New project'}`;
  const body = [
    `Name:  ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    `Type:  ${payload.type}`,
    '',
    payload.message,
  ]
    .filter(Boolean)
    .join('\n');

  window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

export const RULES = {
  name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name'),
  email: (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address',
  phone: (v) =>
    v.trim() === '' || /^[\d\s+()-]{7,18}$/.test(v.trim()) ? '' : 'Enter a valid phone number',
  type: (v) => (v ? '' : 'Choose a project type'),
  message: (v) => (v.trim().length >= 12 ? '' : 'Tell us a little more — 12 characters minimum'),
};

export function initForm() {
  const form = /** @type {HTMLFormElement} */ (document.getElementById('enquiry-form'));
  if (!form) return;

  const note = document.getElementById('form-note');
  const fields = [...form.querySelectorAll('.field')];
  const endpoint = (form.dataset.endpoint || '').trim();

  const validateField = (field, { silent = false } = {}) => {
    const input = /** @type {HTMLInputElement|null} */ (
      field.querySelector('input, select, textarea')
    );
    if (!input) return true;
    const rule = RULES[input.name];
    const msg = rule ? rule(input.value) : '';
    const ok = msg === '';

    if (!silent) {
      field.classList.toggle('is-invalid', !ok);
      const err = field.querySelector('.field__err');
      if (err) err.textContent = msg;
    }
    return ok;
  };

  for (const field of fields) {
    const input = /** @type {HTMLInputElement|null} */ (
      field.querySelector('input, select, textarea')
    );
    if (!input) continue;

    // Only nag once the user has left the field.
    input.addEventListener('blur', () => validateField(field));
    input.addEventListener('input', () => {
      if (field.classList.contains('is-invalid')) validateField(field);
    });

    // The floating-label CSS keys off :not(:placeholder-shown), which selects
    // don't have — mirror it with a class.
    if (input.tagName === 'SELECT') {
      input.addEventListener('change', () => {
        input.classList.toggle('has-value', !!input.value);
        validateField(field);
      });
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const results = fields.map((f) => validateField(f));
    const firstBad = fields[results.indexOf(false)];

    if (firstBad) {
      gsap.fromTo(firstBad, { x: -7 }, { x: 0, duration: 0.55, ease: 'elastic.out(1, 0.35)' });
      /** @type {HTMLElement|null} */ (firstBad.querySelector('input, select, textarea'))?.focus();
      note.textContent = 'Please correct the highlighted fields';
      note.style.color = '#E0705F';
      note.classList.add('is-on');
      return;
    }

    const btn = /** @type {HTMLButtonElement} */ (form.querySelector('.btn--submit'));
    const label = btn.querySelector('span');
    const original = label.textContent;

    btn.disabled = true;
    label.textContent = 'Sending…';
    note.classList.remove('is-on');

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const { via } = await submitEnquiry(payload, endpoint);

      if (via === 'mailto') {
        // The brief is not sent yet — the visitor still has to press send in
        // their mail client — so the form is left filled in and the copy says
        // what actually happened.
        openMailClient(payload);
        label.textContent = original;
        note.textContent = 'Opening your email app — press send there to reach us';
        note.style.color = '';
        note.classList.add('is-on');
        btn.disabled = false;
        return;
      }

      gsap.to(form, {
        autoAlpha: 0.35,
        duration: 0.4,
        onComplete: () => {
          form.reset();
          for (const f of fields) f.classList.remove('is-invalid');
          form.querySelectorAll('select').forEach((s) => s.classList.remove('has-value'));
          gsap.to(form, { autoAlpha: 1, duration: 0.5 });
        },
      });

      label.textContent = 'Sent';
      note.textContent = 'Thank you — we reply within two working days';
      note.style.color = '';
      note.classList.add('is-on');

      setTimeout(() => {
        label.textContent = original;
        btn.disabled = false;
      }, 2200);
    } catch (err) {
      console.error('[VINCI] enquiry failed to send:', err);
      label.textContent = original;
      btn.disabled = false;
      note.textContent = 'Something went wrong — please email us directly';
      note.style.color = '#E0705F';
      note.classList.add('is-on');
    }
  });
}
