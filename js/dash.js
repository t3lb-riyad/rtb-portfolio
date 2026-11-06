
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }

  var KEY_STORE = 'dashServiceKey';

  var url = (window.DATA && window.DATA.SUPABASE_URL)
    ? String(window.DATA.SUPABASE_URL).replace(/\/+$/, '')
    : '';

  function readKey() {
    try { return sessionStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }

  function saveKey(value) {
    try { sessionStorage.setItem(KEY_STORE, value); } catch (e) { /* ignore */ }
  }

  function note(text) {
    var el = $('#dash-note');
    if (el) el.textContent = text;
  }

  function headers(extra) {
    var key = readKey();
    var out = { apikey: key, Authorization: 'Bearer ' + key };

    if (extra) {
      Object.keys(extra).forEach(function (name) { out[name] = extra[name]; });
    }
    return out;
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function loadHearts() {
    return fetch(url + '/rest/v1/hearts?select=id', {
      headers: headers({ Prefer: 'count=exact', Range: '0-0' })
    }).then(function (response) {
      if (!response.ok) throw new Error('hearts');
      var range = response.headers.get('content-range') || '';
      var total = range.split('/')[1];
      var out = $('#dash-hearts');
      if (!total || total === '*') out.textContent = '0';
      else out.textContent = total;
    });
  }

  function loadFollows() {
    return fetch(url + '/rest/v1/follows?select=name,created_at&order=created_at.desc', {
      headers: headers()
    }).then(function (response) {
      if (!response.ok) throw new Error('follows');
      return response.json();
    }).then(function (rows) {
      var list = $('#dash-follows');
      list.innerHTML = '';

      if (!rows || !rows.length) {
        note('Nothing here yet');
        return;
      }

      note('');
      rows.forEach(function (row) {
        var li = document.createElement('li');
        li.className = 'dash__row';

        var name = document.createElement('span');
        name.textContent = row.name;

        var time = document.createElement('span');
        time.className = 'dash__time';
        time.textContent = formatDate(row.created_at);

        li.appendChild(name);
        li.appendChild(time);
        list.appendChild(li);
      });
    });
  }

  function refresh() {
    if (!url) { note('Not configured'); return; }

    if (!readKey()) {
      $('#dash-key-section').hidden = false;
      return;
    }

    Promise.allSettled([loadHearts(), loadFollows()]).then(function (results) {
      var failed = results.some(function (item) { return item.status === 'rejected'; });
      if (failed) note('Could not load');
    });
  }

  function boot() {
    $('#dash-refresh').addEventListener('click', refresh);

    $('#dash-key-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var value = ($('#dash-key').value || '').trim();
      if (!value) return;
      saveKey(value);
      $('#dash-key-section').hidden = true;
      refresh();
    });

    if (!url) {
      note('Not configured');
      $('#dash-key-section').hidden = true;
      return;
    }

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
