
window.PortfolioDB = (function () {
  'use strict';

  function configured() {
    return !!(window.DATA && window.DATA.SUPABASE_URL && window.DATA.SUPABASE_ANON_KEY);
  }

  function base() {
    return String(window.DATA.SUPABASE_URL).replace(/\/+$/, '');
  }

  function insert(table, row) {
    if (!configured()) return;

    var key = window.DATA.SUPABASE_ANON_KEY;

    try {
      fetch(base() + '/rest/v1/' + table, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: 'Bearer ' + key,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(row),
        keepalive: true
      }).catch(function () { /* swallowed on purpose */ });
    } catch (e) { /* swallowed on purpose */ }
  }

  return {
    recordHeart: function (slug) {
      insert('hearts', { project_slug: String(slug) });
    },
    recordFollow: function (name) {
      insert('follows', { name: String(name).slice(0, 40) });
    }
  };
})();
