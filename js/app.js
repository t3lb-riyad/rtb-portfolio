/* =========================================================================
   app.js
   Routing, gestures, likes, shares, follow sheet, profile grid, detail view.
   Plain JavaScript. No dependencies.
   ========================================================================= */

/* -------------------------------------------------------------------------
   Brand splash: fade the intro overlay out at 3.5s, then drop the node so the
   browser can release it. Kept outside the main closure so it still runs even
   if a later feature throws. The CSS failsafe hides the overlay on its own if
   scripts are blocked.
   ------------------------------------------------------------------------- */
(function () {
  'use strict';

  function unmountSplashScreen() {
    var targetLoader = document.getElementById('universalAppSplashLoader');
    if (!targetLoader) return;

    targetLoader.style.opacity = '0';
    targetLoader.style.visibility = 'hidden';
    targetLoader.style.pointerEvents = 'none';

    window.setTimeout(function () {
      if (targetLoader.parentNode) targetLoader.parentNode.removeChild(targetLoader);
    }, 600);
  }

  window.setTimeout(unmountSplashScreen, 3500);
  window.addEventListener('load', function () {
    window.setTimeout(unmountSplashScreen, 3500);
  });
})();

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Small helpers
     ----------------------------------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Turn bare http(s) URLs into real links after escaping the rest. */
  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, function (url) {
      return '<a class="profile-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  function readText(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function writeText(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  var STORE = {
    likes: 'likes',
    follow: 'followName',
    hint: 'hintSeen'
  };

  var VIEWS = ['home', 'contact', 'terms', 'profile'];

  var state = {
    route: 'home',
    reels: [],
    posts: [],
    activeReel: 0,
    atEnd: false,
    currentPost: null,
    returnHash: '#home',
    feedScroll: 0,
    viewScroll: {},
    hintTimer: null
  };

  /* -----------------------------------------------------------------------
     Data readers: everything comes from the HTML blocks.
     Adding a block needs zero changes here.
     ----------------------------------------------------------------------- */
  function readReels() {
    return $$('#scroll-feed .reel[data-slug]').map(function (el) {
      return {
        slug: el.getAttribute('data-slug'),
        title: el.getAttribute('data-title') || '',
        caption: el.getAttribute('data-caption') || '',
        images: $$('img', el).map(function (img) { return img.getAttribute('src'); }),
        el: el
      };
    });
  }

  function readPosts() {
    return $$('#posts-source .post[data-slug]').map(function (el) {
      return {
        slug: el.getAttribute('data-slug'),
        title: el.getAttribute('data-title') || '',
        description: el.getAttribute('data-description') || '',
        handle: el.getAttribute('data-handle') || STRINGS.profileHandle,
        images: $$('img', el).map(function (img) { return img.getAttribute('src'); })
      };
    });
  }

  function findPost(slug) {
    var post = null;
    state.posts.forEach(function (item) { if (!post && item.slug === slug) post = item; });
    if (post) return post;

    /* Fallback: a project without a matching post block still opens. */
    var reel = null;
    state.reels.forEach(function (item) { if (!reel && item.slug === slug) reel = item; });
    if (!reel) return null;

    return {
      slug: reel.slug,
      title: reel.title,
      description: reel.caption,
      handle: STRINGS.profileHandle,
      images: reel.images,
      fromReel: true
    };
  }

  /* -----------------------------------------------------------------------
     Links
     ----------------------------------------------------------------------- */
  function siteUrl() {
    return location.href.split('#')[0];
  }

  function postUrl(slug) {
    return siteUrl() + '#post/' + encodeURIComponent(slug);
  }

  function waLink(message) {
    var base = 'https://wa.me/' + DATA.WHATSAPP;
    return message ? base + '?text=' + encodeURIComponent(message) : base;
  }

  function askLink(slug) {
    return waLink("Hi, I'd like to ask about this project: " + postUrl(slug));
  }

  /* -----------------------------------------------------------------------
     Static text, icons and generated blocks
     ----------------------------------------------------------------------- */
  function applyStrings() {
    $$('[data-string]').forEach(function (el) {
      var key = el.getAttribute('data-string');
      if (STRINGS[key] == null) return;
      /* The bio may contain a URL; render it with a real anchor. */
      if (key === 'bio') el.innerHTML = linkify(STRINGS[key]);
      else el.textContent = STRINGS[key];
    });

    var count = $('#project-count');
    if (count) count.textContent = String(DATA.TODO_PROJECT_COUNT);

    var msg = $('#btn-message');
    if (msg) msg.setAttribute('href', waLink(''));
  }

  function applyStaticIcons() {
    var map = { home: 'homeFill', contact: 'plane', terms: 'termsFill' };

    $$('.nav__item').forEach(function (item) {
      var route = item.getAttribute('data-route');

      if (route === 'profile') {
        item.innerHTML = '<img class="nav__avatar" src="icons/profile.jpg" alt="" ' +
          'width="26" height="26" decoding="async">';
        var avatar = item.querySelector('.nav__avatar');
        if (avatar) {
          avatar.addEventListener('error', function () {
            item.innerHTML = Icons.user;
          });
        }
        return;
      }

      item.innerHTML = Icons[map[route]] || Icons.home;
    });

    var hintIcon = $('#hint-icon');
    if (hintIcon) hintIcon.innerHTML = Icons.chevronUp;

    /* Profile tabs: icon only, label kept for screen readers only. */
    var tabMap = {
      posts: { icon: 'grid', label: 'tabPosts' },
      skills: { icon: 'bolt', label: 'tabSkills' }
    };

    $$('.tab[data-tab]').forEach(function (tab) {
      var conf = tabMap[tab.getAttribute('data-tab')];
      if (!conf) return;
      tab.innerHTML = Icons[conf.icon] || '';
      if (STRINGS[conf.label]) tab.setAttribute('aria-label', STRINGS[conf.label]);
    });

    $$('[data-chev]').forEach(function (el) { el.innerHTML = Icons.chevronDown; });

    var sheetClose = $('#follow-sheet .icon-btn');
    if (sheetClose) sheetClose.innerHTML = Icons.close;

    $('#home-share').innerHTML = Icons.share;
  }

  function renderContact() {
    var grid = $('#contact-grid');
    if (!grid) return;

    grid.innerHTML = DATA.SOCIALS.map(function (social) {
      var label = STRINGS[social.labelKey] || '';
      var icon = Icons[social.icon] || '';
      var inert = !social.href || social.href.indexOf('TODO') === 0;

      if (inert) {
        return '<button class="contact-tile" type="button" data-social="' + esc(social.id) + '">' +
          icon + '<span class="contact-tile__label">' + esc(label) + '</span></button>';
      }

      return '<a class="contact-tile" href="' + esc(social.href) + '" target="_blank" rel="noopener noreferrer" data-social="' + esc(social.id) + '">' +
        icon + '<span class="contact-tile__label">' + esc(label) + '</span></a>';
    }).join('');
  }

  function renderSkills() {
    var grid = $('#skills-grid');
    if (!grid) return;

    grid.innerHTML = DATA.SKILLS.map(function (skill) {
      return '<div class="skill-card">' + (Icons[skill.icon] || '') +
        '<span class="skill-card__name">' + esc(skill.name) + '</span></div>';
    }).join('');

    var names = DATA.SKILLS.map(function (skill) { return skill.name; }).join(', ');
    var button = $('#btn-certificates');
    if (button) {
      button.setAttribute('href', waLink("Hi, I'd like to see your certificates for: " + names + '.'));
    }
  }

  function renderPostsGrid() {
    var grid = $('#posts-grid');
    if (!grid) return;

    grid.innerHTML = state.posts.map(function (post) {
      var first = post.images[0] || '';
      return '<button class="post-cell" type="button" data-post="' + esc(post.slug) + '" aria-label="' + esc(post.title || post.slug) + '">' +
        (first ? '<img src="' + esc(first) + '" alt="" width="1080" height="1080" loading="lazy" decoding="async">' : '') +
        '</button>';
    }).join('');
  }

  /* -----------------------------------------------------------------------
     Likes
     ----------------------------------------------------------------------- */
  function likesMap() { return readJSON(STORE.likes, {}); }

  function renderHearts() {
    var map = likesMap();
    $$('[data-heart-slug]').forEach(function (btn) {
      var slug = btn.getAttribute('data-heart-slug');
      var liked = !!map[slug];
      btn.innerHTML = liked ? Icons.heartFill : Icons.heart;
      btn.classList.toggle('is-liked', liked);
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.setAttribute('aria-label', liked ? 'Unlike' : 'Like');
    });
  }

  function likeSlug(slug) {
    if (!slug) return;
    var map = likesMap();
    if (map[slug]) { renderHearts(); return; }
    map[slug] = 1;
    writeJSON(STORE.likes, map);
    renderHearts();
    if (window.PortfolioDB) window.PortfolioDB.recordHeart(slug);
  }

  function toggleLike(slug) {
    if (!slug) return;
    var map = likesMap();
    if (map[slug]) {
      delete map[slug];
      writeJSON(STORE.likes, map);
      renderHearts();
      return;
    }
    likeSlug(slug);
  }

  /* -----------------------------------------------------------------------
     Share
     Opens the device share sheet (installed apps). Falls back to a silent
     clipboard copy only when the Web Share API is unavailable.
     ----------------------------------------------------------------------- */
  function fallbackCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
      return;
    }
    legacyCopy(text);
  }

  function legacyCopy(text) {
    try {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    } catch (e) { /* silent, as required */ }
  }

  function shareProject(slug) {
    if (!slug) return;
    var url = postUrl(slug);
    var title = document.title;

    var post = findPost(slug);
    if (post && post.title) title = post.title;

    var payload = { title: title, text: title, url: url };

    if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
      navigator.share(payload).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        fallbackCopy(url);
      });
      return;
    }

    fallbackCopy(url);
  }

  /* -----------------------------------------------------------------------
     Carousels
     ----------------------------------------------------------------------- */
  function initCarousel(carousel) {
    if (!carousel || carousel.dataset.ready === '1') return;
    carousel.dataset.ready = '1';

    var track = $('[data-track]', carousel) || $('.carousel__track', carousel);
    var dotsWrap = $('[data-dots]', carousel) || $('.carousel__dots', carousel);
    var slides = $$('.carousel__slide', track);
    var dots = [];
    var ticking = false;

    if (dotsWrap) {
      dotsWrap.innerHTML = slides.map(function (_, i) {
        return '<span class="dot' + (i === 0 ? ' is-active' : '') + '"></span>';
      }).join('');
      dots = $$('.dot', dotsWrap);
    }

    function sync() {
      ticking = false;
      var width = track.clientWidth || 1;
      var index = Math.round(track.scrollLeft / width);
      if (index < 0) index = 0;
      if (index > slides.length - 1) index = slides.length - 1;
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
      });
    }

    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    }, { passive: true });

    if (!carousel.closest('#view-home')) attachDoubleTap(carousel);
  }

  function attachDoubleTap(el) {
    if (!el || el.dataset.doubleTap === '1') return;
    el.dataset.doubleTap = '1';

    var lastTap = 0;
    var lastX = 0;
    var lastY = 0;
    var downX = 0;
    var downY = 0;
    var moved = false;

    el.addEventListener('pointerdown', function (e) {
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
    }, { passive: true });

    el.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - downX) > 12 || Math.abs(e.clientY - downY) > 12) moved = true;
    }, { passive: true });

    el.addEventListener('pointerup', function (e) {
      if (moved) return;
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, [role="button"]')) return;

      var now = Date.now();
      var sameSpot = Math.abs(e.clientX - lastX) < 30 && Math.abs(e.clientY - lastY) < 30;

      if (now - lastTap < 320 && sameSpot) {
        lastTap = 0;
        var host = e.target.closest('[data-slug]');
        var slug = host ? host.getAttribute('data-slug') : null;

        if (!slug && !state.atEnd && state.reels[state.activeReel]) {
          slug = state.reels[state.activeReel].slug;
        }

        if (slug) {
          likeSlug(slug);
          spawnHeart(e.clientX, e.clientY);
        }
        return;
      }

      lastTap = now;
      lastX = e.clientX;
      lastY = e.clientY;
    }, { passive: true });
  }

  function spawnHeart(x, y) {
    var pop = document.createElement('span');
    pop.className = 'heart-pop';
    pop.setAttribute('aria-hidden', 'true');
    pop.innerHTML = Icons.heartFill;
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    document.body.appendChild(pop);

    function remove() {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }

    pop.addEventListener('animationend', remove);
    setTimeout(remove, 1200);
  }

  /* -----------------------------------------------------------------------
     Home actions
     ----------------------------------------------------------------------- */
  function actionsVisibility() {
    var actions = $('#home-actions');
    if (!actions) return;
    actions.hidden = !(state.route === 'home' && !state.atEnd);
  }

  function renderActions() {
    actionsVisibility();
    if (state.route !== 'home') return;

    var reel = state.reels[state.activeReel];
    if (!reel) return;

    $('#home-heart').setAttribute('data-heart-slug', reel.slug);
    $('#home-share').setAttribute('data-share-slug', reel.slug);
    $('#home-visit').setAttribute('href', '#post/' + encodeURIComponent(reel.slug));
    $('#reel-caption').textContent = reel.caption || '';
    renderHearts();
  }

  function initReels() {
    state.reels = readReels();

    state.reels.forEach(function (reel) {
      var carousel = $('.carousel', reel.el);
      if (carousel) initCarousel(carousel);
    });

    var feed = $('#scroll-feed');
    if (!feed || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        if (entry.target.hasAttribute('data-end')) {
          state.atEnd = true;
          actionsVisibility();
          return;
        }

        state.atEnd = false;
        state.activeReel = parseInt(entry.target.getAttribute('data-index'), 10) || 0;
        renderActions();
      });
    }, { root: feed, threshold: 0.55 });

    $$('.reel', feed).forEach(function (el, index) {
      if (!el.hasAttribute('data-end')) el.setAttribute('data-index', String(index));
      observer.observe(el);
    });
  }

  /* -----------------------------------------------------------------------
     Router
     ----------------------------------------------------------------------- */
  function setNavActive(route) {
    $$('.nav__item').forEach(function (item) {
      var active = item.getAttribute('data-route') === route;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function showView(name) {
    if (VIEWS.indexOf(name) === -1) name = 'home';

    if (state.route === 'home' && name !== 'home') {
      var feed = $('#scroll-feed');
      if (feed) state.feedScroll = feed.scrollTop;
    }

    if (state.route && state.route !== 'post') {
      var oldPanel = $('#view-' + state.route);
      if (oldPanel) state.viewScroll[state.route] = oldPanel.scrollTop;
    }

    state.route = name;
    state.currentPost = null;

    $$('.view').forEach(function (view) {
      if (view.getAttribute('data-view-panel') === name) view.setAttribute('data-active', '');
      else view.removeAttribute('data-active');
    });

    document.body.setAttribute('data-view', name);
    setNavActive(name);
    actionsVisibility();

    if (name === 'profile') {
      state.posts = readPosts();
      renderPostsGrid();
    }

    if (name === 'home') {
      requestAnimationFrame(function () {
        var feed = $('#scroll-feed');
        if (feed) feed.scrollTop = state.feedScroll;
        state.atEnd = false;
        renderActions();
      });
    }

    var panel = $('#view-' + name);
    if (panel && name !== 'home') {
      panel.scrollTop = state.viewScroll[name] || 0;
    }
  }

  function renderPost(post) {
    var slides = post.images.map(function (src, index) {
      return '<div class="carousel__slide"><img src="' + esc(src) + '" alt="" width="1080" height="1080" loading="' +
        (index === 0 ? 'eager' : 'lazy') + '" decoding="async"></div>';
    }).join('');

    var html =
      '<header class="post-head">' +
        '<button class="post-head__back" type="button" data-back aria-label="Back">' + Icons.arrowLeft + '</button>' +
        '<span class="post-head__handle">' + esc(post.handle || STRINGS.profileHandle) + '</span>' +
        '<button class="post-head__next" type="button" data-next aria-label="Next project">' + Icons.arrowRight + '</button>' +
      '</header>' +
      '<div class="carousel" data-carousel data-slug="' + esc(post.slug) + '">' +
        '<div class="carousel__track" data-track>' + slides + '</div>' +
        '<div class="carousel__dots" data-dots aria-hidden="true"></div>' +
      '</div>' +
      '<div class="post-actions">' +
        '<button class="icon-btn" type="button" data-heart-slug="' + esc(post.slug) + '" aria-label="Like" aria-pressed="false"></button>' +
        '<button class="icon-btn" type="button" data-share-slug="' + esc(post.slug) + '" aria-label="Share"></button>' +
      '</div>' +
      '<p class="post-caption">' + esc(post.description || '') + '</p>' +
      '<a class="btn btn--ask glass" href="' + esc(askLink(post.slug)) + '" target="_blank" rel="noopener noreferrer">' +
        esc(STRINGS.askButton) + '</a>';

    var body = $('#post-body');
    body.innerHTML = html;

    var shareBtn = $('[data-share-slug]', body);
    if (shareBtn) shareBtn.innerHTML = Icons.share;

    initCarousel($('.carousel', body));
    renderHearts();
  }

  function openPost(slug) {
    var post = findPost(slug);
    if (!post) {
      location.hash = '#profile';
      return;
    }

    if (state.route !== 'post') {
      state.returnHash = '#' + state.route;

      /* Remember where the visitor was before the detail view opened. */
      if (state.route === 'home') {
        var feed = $('#scroll-feed');
        if (feed) state.feedScroll = feed.scrollTop;
      } else {
        var fromPanel = $('#view-' + state.route);
        if (fromPanel) state.viewScroll[state.route] = fromPanel.scrollTop;
      }
    }

    state.route = 'post';
    state.currentPost = post;

    $$('.view').forEach(function (view) {
      if (view.getAttribute('data-view-panel') === 'post') view.setAttribute('data-active', '');
      else view.removeAttribute('data-active');
    });

    document.body.setAttribute('data-view', 'post');
    setNavActive('profile');
    actionsVisibility();

    renderPost(post);

    var panel = $('#view-post');
    if (panel) panel.scrollTop = 0;
  }

  function onHashChange() {
    var raw = location.hash.replace(/^#/, '');

    if (raw.indexOf('post/') === 0) {
      openPost(decodeURIComponent(raw.slice(5)));
      return;
    }

    showView(raw || 'home');
  }

  function nextPostSlug() {
    if (!state.posts.length || !state.currentPost) return null;
    var index = -1;
    state.posts.forEach(function (post, i) {
      if (post.slug === state.currentPost.slug) index = i;
    });
    return state.posts[(index + 1) % state.posts.length].slug;
  }

  function goBackFromPost() {
    if (state.returnHash && state.returnHash !== '#post') {
      location.hash = state.returnHash;
    } else {
      location.hash = '#profile';
    }
  }

  /* -----------------------------------------------------------------------
     Follow sheet
     ----------------------------------------------------------------------- */
  function setFollowing(name) {
    var btn = $('#btn-follow');
    if (!btn) return;
    btn.textContent = STRINGS.following;
    btn.classList.add('is-following');
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('data-name', name || '');
  }

  function openSheet() {
    var sheet = $('#follow-sheet');
    var input = $('#follow-name');
    sheet.hidden = false;
    input.value = '';
    setTimeout(function () { input.focus(); }, 80);
  }

  function closeSheet() {
    var sheet = $('#follow-sheet');
    if (sheet) sheet.hidden = true;
  }

  function initFollow() {
    var saved = readText(STORE.follow);
    if (saved) setFollowing(saved);

    var followBtn = $('#btn-follow');
    followBtn.addEventListener('click', function () {
      if (followBtn.classList.contains('is-following')) return;
      openSheet();
    });

    $('#follow-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('#follow-name');
      var name = (input.value || '').trim().slice(0, 40);
      if (!name) { input.focus(); return; }

      writeText(STORE.follow, name);
      setFollowing(name);
      closeSheet();

      /* Local first: the Followed state must show even with no Supabase. */
      try {
        if (window.PortfolioDB) window.PortfolioDB.recordFollow(name);
      } catch (error) { /* silent, as if everything worked */ }
    });
  }

  /* -----------------------------------------------------------------------
     Contact tiles: finger-following 3D press
     -----------------------------------------------------------------------
     Each tile leans towards the finger and sinks slightly, and a soft light
     reflection tracks the same point. Pure CSS transforms, driven by custom
     properties, so it stays smooth and the browser keeps native scrolling. */
  function initContactTilt() {
    var grid = $('#contact-grid');
    if (!grid) return;

    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (reduce && reduce.matches) return;

    var MAX_TILT = 10;      // degrees
    var MAX_PRESS = 0.965;  // scale while the finger is on a tile
    var active = null;
    var releaseTimer = 0;
    var touchTimer = 0;
    var touching = false;
    var last = { x: 0, y: 0 };

    function reset(tile) {
      if (!tile) return;
      tile.classList.remove('is-tilting');
      tile.style.removeProperty('--rx');
      tile.style.removeProperty('--ry');
      tile.style.removeProperty('--press');
      tile.style.removeProperty('--mx');
      tile.style.removeProperty('--my');
    }

    function tilt(tile, point) {
      var rect = tile.getBoundingClientRect();
      var nx = ((point.x - rect.left) / rect.width) * 2 - 1;
      var ny = ((point.y - rect.top) / rect.height) * 2 - 1;

      nx = Math.max(-1, Math.min(1, nx));
      ny = Math.max(-1, Math.min(1, ny));

      tile.classList.add('is-tilting');
      tile.style.setProperty('--ry', (nx * MAX_TILT).toFixed(2) + 'deg');
      tile.style.setProperty('--rx', (-ny * MAX_TILT).toFixed(2) + 'deg');
      tile.style.setProperty('--press', String(MAX_PRESS));
      tile.style.setProperty('--mx', String(Math.round((nx + 1) * 50)) + '%');
      tile.style.setProperty('--my', String(Math.round((ny + 1) * 50)) + '%');
    }

    /* While the page scrolls under a finger, the tile beneath the finger
       changes; elementFromPoint keeps the tilt glued to that spot. */
    function tiltAt(x, y) {
      var el = document.elementFromPoint(x, y);
      var tile = el ? el.closest('.contact-tile') : null;

      if (!tile) {
        if (active) reset(active);
        active = null;
        return;
      }

      if (active && active !== tile) reset(active);
      active = tile;
      tilt(tile, { x: x, y: y });
    }

    function clear() {
      window.clearTimeout(releaseTimer);
      reset(active);
      active = null;
    }

    grid.addEventListener('pointerdown', function (event) {
      var tile = event.target.closest('.contact-tile');
      if (!tile) return;
      window.clearTimeout(releaseTimer);
      active = tile;
      tilt(tile, event);
    }, { passive: true });

    grid.addEventListener('pointermove', function (event) {
      last = { x: event.clientX, y: event.clientY };
      var tile = event.target.closest('.contact-tile');
      if (!tile) {
        if (active) clear();
        return;
      }
      if (active && active !== tile) reset(active);
      active = tile;
      tilt(tile, event);
    }, { passive: true });

    /* Touch scrolling: passive listeners keep native scrolling intact while
       the tile under the finger stays pressed and leaning. */
    grid.addEventListener('touchstart', function (event) {
      var touch = event.touches[0];
      if (!touch) return;
      touching = true;
      window.clearTimeout(touchTimer);
      last = { x: touch.clientX, y: touch.clientY };
      tiltAt(last.x, last.y);
    }, { passive: true });

    grid.addEventListener('touchmove', function (event) {
      var touch = event.touches[0];
      if (!touch) return;
      last = { x: touch.clientX, y: touch.clientY };
      tiltAt(last.x, last.y);
    }, { passive: true });

    grid.addEventListener('touchend', function () {
      touching = false;
      window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(clear, 140);
    }, { passive: true });

    grid.addEventListener('touchcancel', function () {
      touching = false;
      clear();
    }, { passive: true });

    grid.addEventListener('pointerleave', clear);
    grid.addEventListener('pointercancel', function () {
      if (!touching) clear();
    });
    grid.addEventListener('pointerup', function () {
      if (touching) return;
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(clear, 160);
    });
    window.addEventListener('scroll', function () {
      if (!touching) clear();
    }, { passive: true });
  }

  /* -----------------------------------------------------------------------
     Tabs and accordions
     ----------------------------------------------------------------------- */
  function initTabs() {
    var tabs = $$('[data-tab]');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-tab');

        tabs.forEach(function (other) {
          var active = other === tab;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        $('#panel-posts').hidden = name !== 'posts';
        $('#panel-skills').hidden = name !== 'skills';
      });
    });
  }

  function initAccordions() {
    $$('[data-acc]').forEach(function (acc) {
      var head = $('.acc__head', acc);
      var body = $('.acc__body', acc);
      if (!head || !body) return;

      head.addEventListener('click', function () {
        var open = head.getAttribute('aria-expanded') === 'true';
        head.setAttribute('aria-expanded', open ? 'false' : 'true');
        body.hidden = open;
      });
    });
  }

  /* -----------------------------------------------------------------------
     First visit hint
     ----------------------------------------------------------------------- */
  function hideHint() {
    var hint = $('#hint');
    if (!hint || hint.hidden) return;
    hint.hidden = true;
    clearTimeout(state.hintTimer);
    writeText(STORE.hint, '1');
  }

  function initHint() {
    if (readText(STORE.hint)) return;

    var hint = $('#hint');
    hint.hidden = false;
    state.hintTimer = setTimeout(hideHint, 3000);
    window.addEventListener('pointerdown', hideHint, { once: true, capture: true });
  }

  /* -----------------------------------------------------------------------
     Global click handling
     ----------------------------------------------------------------------- */
  function initClicks() {
    document.addEventListener('click', function (event) {
      var target = event.target;

      var heart = target.closest('[data-heart-slug]');
      if (heart) { toggleLike(heart.getAttribute('data-heart-slug')); return; }

      var share = target.closest('[data-share-slug]');
      if (share) { shareProject(share.getAttribute('data-share-slug')); return; }

      var back = target.closest('[data-back]');
      if (back) { goBackFromPost(); return; }

      var next = target.closest('[data-next]');
      if (next) {
        var slug = nextPostSlug();
        if (slug) location.hash = '#post/' + encodeURIComponent(slug);
        return;
      }

      var cell = target.closest('[data-post]');
      if (cell) { location.hash = '#post/' + encodeURIComponent(cell.getAttribute('data-post')); return; }

      var sheetClose = target.closest('[data-close-sheet]');
      if (sheetClose) { closeSheet(); return; }

      var retour = target.closest('[data-retour]');
      if (retour) {
        var feed = $('#scroll-feed');
        if (feed) feed.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var sheet = $('#follow-sheet');
      if (sheet && !sheet.hidden) { closeSheet(); return; }
      if (state.route === 'post') goBackFromPost();
    });
  }

  /* -----------------------------------------------------------------------
     Dropped image files must not break the layout
     ----------------------------------------------------------------------- */
  function initImageFallback() {
    document.addEventListener('error', function (event) {
      var img = event.target;
      if (img && img.tagName === 'IMG') img.classList.add('is-missing');
    }, true);
  }

  /* -----------------------------------------------------------------------
     Service worker
     ----------------------------------------------------------------------- */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* silent */ });
    });
  }

  /* -----------------------------------------------------------------------
     Boot
     ----------------------------------------------------------------------- */
  function init() {
    applyStaticIcons();
    applyStrings();

    state.posts = readPosts();

    renderContact();
    renderSkills();
    renderPostsGrid();

    initReels();

    var homeView = $('#view-home');
    if (homeView) attachDoubleTap(homeView);

    initFollow();
    initContactTilt();
    initTabs();
    initAccordions();
    initHint();
    initClicks();
    initImageFallback();

    renderHearts();
    actionsVisibility();

    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    initServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
