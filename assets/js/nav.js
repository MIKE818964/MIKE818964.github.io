/* Honeybadger Software — shared nav behavior.
   No framework, no build step. Handles: mobile hamburger,
   dropdown tap-to-open on touch, and active-tab highlighting. */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('siteNav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Dropdowns: hover works via CSS on desktop; on touch/click, toggle .open
  document.querySelectorAll('.nav-dropdown-trigger').forEach(function (t) {
    t.addEventListener('click', function (e) {
      // Only intercept when the dropdown is acting as a tap-target (mobile)
      // or when the trigger has no real destination yet.
      if (window.matchMedia('(max-width: 980px)').matches) {
        e.preventDefault();
        t.parentElement.classList.toggle('open');
      }
    });
  });

  // Highlight the current page in the nav.
  var path = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.site-nav a[href]').forEach(function (a) {
    var href = a.getAttribute('href').replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    if (href === path) {
      a.classList.add('active');
      var dd = a.closest('.nav-dropdown');
      if (dd) dd.classList.add('active');
    }
  });

  // Close the mobile menu when a real link is tapped.
  document.querySelectorAll('.site-nav a[href]:not(.nav-dropdown-trigger)').forEach(function (a) {
    a.addEventListener('click', function () {
      nav && nav.classList.remove('open');
      toggle && toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();
