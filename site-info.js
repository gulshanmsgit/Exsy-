'use strict';
/* Public details shown in the app (More → About & help) and on the privacy, terms and delete-account pages.
   Fill these in once – everything else reads them from here. Empty = the pages show "(to be added)". */
const SITE_INFO = {
  owner: '',                                          // your full name, as on the Google Play developer account
  email: '',                                          // public support email, e.g. exsy.help@gmail.com
  website: 'https://gulshanmsgit.github.io/Exsy-/',
  policyDate: '20 November 2026'                      // change when the privacy policy or terms change
};

// On the legal pages: put the details into every [data-info] element
if (typeof document !== 'undefined' && document.documentElement.dataset.legal !== undefined) {
  document.addEventListener('DOMContentLoaded', () => {
    for (const el of document.querySelectorAll('[data-info]')) {
      const k = el.dataset.info, v = SITE_INFO[k];
      if (k === 'email' && v) { const a = document.createElement('a'); a.href = 'mailto:' + v; a.textContent = v; el.replaceChildren(a); }
      else el.textContent = v || '(to be added)';
    }
  });
}
