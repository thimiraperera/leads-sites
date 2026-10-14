/* ============================================================
   BlinQ leads site · video.js
   Inline YouTube player for the hero preview. The video ID is
   set on #videoCover in index.html (data-video-id).
   ============================================================ */
(function () {
  'use strict';

  var cover     = document.getElementById('videoCover');
  var screenEl  = document.getElementById('videoScreen');
  var frame     = document.getElementById('videoFrame');
  var playBtn   = document.getElementById('playBtn');
  var closeBtn  = document.getElementById('videoClose');
  var footTitle = document.getElementById('footTitle');
  var footSub   = document.getElementById('footSub');

  if (!cover || !screenEl || !frame) return;

  var VIDEO_ID  = cover.getAttribute('data-video-id') || '';
  var VIDEO_SRC = 'https://www.youtube.com/embed/' + VIDEO_ID +
                  '?autoplay=1&rel=0&modestbranding=1';

  function playVideo() {
    frame.src = VIDEO_SRC;
    screenEl.classList.add('playing');
    cover.classList.add('playing');
    if (footTitle) footTitle.textContent = 'Now playing — BlinQ Installer App demo';
    if (footSub)   footSub.textContent   = 'Manage blinds installations from your phone';
  }

  function stopVideo() {
    frame.src = '';
    screenEl.classList.remove('playing');
    cover.classList.remove('playing');
    if (footTitle) footTitle.textContent = 'See how BlinQ brings it all together';
    if (footSub)   footSub.textContent   = 'Illustrative workflow preview · Play the Installer App demo';
  }

  if (playBtn)  playBtn.addEventListener('click', function (e) { e.stopPropagation(); playVideo(); });
  if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); stopVideo(); });
})();
