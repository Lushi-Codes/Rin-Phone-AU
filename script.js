

    // Debug panel initialization (visible on-page to help diagnose JS/load errors)
    (function initDebugPanel(){
      try {
        const existing = document.getElementById('debugPanel');
        if (existing) return;
        const dp = document.createElement('div');
        dp.id = 'debugPanel';
        dp.style.position = 'fixed';
        dp.style.right = '12px';
        dp.style.bottom = '12px';
        dp.style.width = '320px';
        dp.style.maxHeight = '220px';
        dp.style.overflow = 'auto';
        dp.style.background = 'rgba(0,0,0,0.75)';
        dp.style.color = '#9ff';
        dp.style.fontSize = '12px';
        dp.style.padding = '8px';
        dp.style.borderRadius = '8px';
        dp.style.zIndex = 9999;
        dp.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
        dp.innerHTML = '<div style="font-weight:700; margin-bottom:6px;"></div>';
        document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(dp); });

        window.debug = function (msg) {
          try {
            const el = document.getElementById('debugPanel');
            if (!el) return;
            const row = document.createElement('div');
            row.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
            el.appendChild(row);
            while (el.childElementCount > 18) el.removeChild(el.children[1]);
          } catch (e) { /* ignore */ }
        };

        window.addEventListener('error', function (ev) {
          debug('ERROR: ' + ev.message + ' @ ' + (ev.filename || '') + ':' + (ev.lineno || '') );
        });
        window.addEventListener('unhandledrejection', function (ev) {
          try { debug('UNHANDLED PROMISE REJECTION: ' + (ev.reason && ev.reason.message ? ev.reason.message : JSON.stringify(ev.reason))); } catch(e){}
        });
      } catch (e) { /* ignore */ }
    })();

    // Notification system
    window.appNotifications = {};
    window.notificationTimers = {};

    function getDataAppValue(appId) {
      const mapping = {
        'app-camera': 'camera',
        'app-gallery': 'gallery',
        'app-notes': 'notes',
        'app-ytmusic': 'music'
      };
      return mapping[appId] || appId;
    }

    function showNotifications(appIds) {
      appIds.forEach(appId => {
        const icon = document.querySelector(`[data-app="${appId}"]`);
        if (icon) {
          icon.classList.add('has-notification');
          const badge = document.createElement('div');
          badge.className = 'notification-badge';
          badge.textContent = '!';
          if (!icon.querySelector('.notification-badge')) {
            icon.appendChild(badge);
          }
          window.appNotifications[appId] = true;
        }
      });
    }

    function removeNotification(appId) {
      const icon = document.querySelector(`[data-app="${appId}"]`);
      if (icon) {
        icon.classList.remove('has-notification');
        const badge = icon.querySelector('.notification-badge');
        if (badge) badge.remove();
      }
      delete window.appNotifications[appId];
    }

    function clearNotificationTimer(appId) {
      if (window.notificationTimers[appId]) {
        clearTimeout(window.notificationTimers[appId]);
        delete window.notificationTimers[appId];
      }
    }

    function removeNotificationAfterDelay(appId) {
      clearNotificationTimer(appId);
      window.notificationTimers[appId] = setTimeout(() => {
        removeNotification(appId);
      }, 10000);
    }

    function openApp(appId, el) {
  // If caller passed the icon element, use it to check lock state
  if (el && el.classList && el.classList.contains('locked')) {
    showToast('App is locked');
    return;
  }

  // fallback: if no element passed, attempt to find corresponding icon by data-app
  if (!el) {
    const icon = document.querySelector('[data-app]');
    if (icon && icon.classList && icon.classList.contains('locked')) {
      showToast('App is locked');
      return;
    }
  }

  const screen = document.getElementById(appId);
  if (!screen) {
    showToast('App not available');
    return;
  }

  // Close any other open screens so only one app is visible at a time
  // Use all .app-screen to be robust in case classes are out-of-sync
  const others = document.querySelectorAll('.app-screen');
  console.log('openApp: requested', appId, 'current active:', Array.from(document.querySelectorAll('.app-screen.active')).map(x=>x.id));
  others.forEach(s => {
    if (s !== screen) {
      s.classList.remove('active');
      // hide via inline style as a robust fallback
      s.style.display = 'none';
    }
  });

  // Ensure the screen has a visible loading placeholder if empty while fragments load
  const body = screen.querySelector('.screen-body') || screen;
  const hasContent = body.querySelector('*') || (body.innerText && body.innerText.trim().length > 0);
  if (!hasContent) {
    body.innerHTML = '<div class="loading">Loading…</div>';
  }

  // Open requested screen
  screen.style.display = 'flex';
  screen.classList.add('active');
  console.log('openApp: after open active:', Array.from(document.querySelectorAll('.app-screen.active')).map(x=>x.id));

  // Refresh gallery album display if opening gallery
  if (appId === 'app-gallery' && typeof showSecretAlbumsIfUnlocked === 'function') {
    showSecretAlbumsIfUnlocked();
  }

  // Initialize camera only when opening camera app
  if (appId === 'app-camera' && typeof initializeCamera === 'function') {
    initializeCamera();
  }

  // For accessibility, move focus into the opened screen
  const focusTarget = screen.querySelector('button, a, [tabindex]') || screen.querySelector('.screen-body');
  if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();

  // Remove notification after 30 seconds of opening the app
  const dataAppValue = getDataAppValue(appId);
  if (window.appNotifications && window.appNotifications[dataAppValue]) {
    removeNotificationAfterDelay(dataAppValue);
  }
}

        function closeApp(appId) {
          // Close camera if closing camera app
          if (appId === 'app-camera') {
            if (typeof closeCameraStream === 'function') {
              closeCameraStream();
            }
          }

          const el = document.getElementById(appId);
          if (el) {
            el.classList.remove('active');
            el.style.display = 'none';
          }
        }

        // small toast helper for feedback
        function showToast(message, duration = 1200) {
          let t = document.querySelector('.toast');
          if (!t) {
            t = document.createElement('div');
            t.className = 'toast';
            document.querySelector('.phone-frame').appendChild(t);
          }
          t.textContent = message;
          t.style.display = 'block';
          setTimeout(() => { t.style.display = 'none'; }, duration);
        }


    // Lock screen unlock behavior
    function forceUnlock() {
      const lock = document.getElementById('lockScreen');
      const homes = document.querySelector('.homescreen');

      if (lock) {
        lock.style.display = 'none';
        lock.classList.remove('is-active');
      }
      if (homes) {
        homes.style.display = 'flex';
      }
    }

    document.addEventListener('DOMContentLoaded', function () {
      const lock = document.getElementById('lockScreen');
      const homes = document.querySelector('.homescreen');

      if (lock && homes) {
        // hide homescreen while lock is visible
        homes.style.display = 'none';

        function unlock() {
          forceUnlock();
        }

        // Click anywhere on lock screen to unlock
        lock.addEventListener('click', (e) => {
          e.stopPropagation();
          unlock();
        });

        lock.addEventListener('touchstart', unlock);

        // Keyboard shortcuts to unlock
        document.addEventListener('keydown', (e) => {
          if (lock.style.display !== 'none' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
            e.preventDefault();
            unlock();
          }
        });

        lock.addEventListener('dblclick', unlock);

        // Emergency unlock button
        const ubtn = document.getElementById('unlockBtn');
        if (ubtn) {
          ubtn.addEventListener('click', (e) => {
            e.stopPropagation();
            forceUnlock();
          });
        }

        // initialize analog clock and date
        function updateAnalogClock() {
          const now = new Date();
          const secs = now.getSeconds();
          const mins = now.getMinutes();
          const hrs = now.getHours();

          const secDeg = secs * 6;
          const minDeg = mins * 6 + secs * 0.1;
          const hourDeg = (hrs % 12) * 30 + mins * 0.5;

          const s = document.getElementById('secondHand');
          const m = document.getElementById('minuteHand');
          const h = document.getElementById('hourHand');

          if (s) s.style.transform = `translate(-50%, -100%) rotate(${secDeg}deg)`;
          if (m) m.style.transform = `translate(-50%, -100%) rotate(${minDeg}deg)`;
          if (h) h.style.transform = `translate(-50%, -100%) rotate(${hourDeg}deg)`;

          const dateEl = document.getElementById('lockDate');
          if (dateEl) {
            const opts = { weekday: 'short', month: 'long', day: 'numeric' };
            dateEl.textContent = now.toLocaleDateString(undefined, opts);
          }
        }

        updateAnalogClock();
        setInterval(updateAnalogClock, 1000);
      }
    });

        // Phone tab switching
        function phoneSwitchTab(tab, btn) {
          // update active button
          document.querySelectorAll('.phone-tab').forEach(b => b.classList.remove('active'));
          if (btn) btn.classList.add('active');

          // show views
          const views = { keypad: 'phoneKeypad', recents: 'phoneRecents', contacts: 'phoneContacts' };
          Object.values(views).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          const toShow = document.getElementById(views[tab]);
          if (toShow) {
            toShow.style.display = 'block';
            // If showing keypad, move focus there so keyboard input works immediately
            if (tab === 'keypad') {
              const kp = document.getElementById('phoneKeypad');
              const focusTarget = (kp && (kp.querySelector('.phone-keypad-wrapper') || kp.querySelector('.keypad'))) || kp;
              if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
            }
          }
        }

        // Soft key behavior
        function softBack() {
          // close topmost active app-screen
          const actives = Array.from(document.querySelectorAll('.app-screen.active'));
          if (actives.length) {
            const top = actives[actives.length - 1];
            top.classList.remove('active');
            return;
          }
          // if none open, show toast
          showToast('Nothing to go back to');
        }

        function softHome() {
          // close all app screens
          document.querySelectorAll('.app-screen.active').forEach(el => el.classList.remove('active'));
          // ensure homescreen visible
          const homes = document.getElementById('homescreen');
          if (homes) homes.style.display = 'flex';
        }

        function softApps() {
          // toggle folders row visibility as a simple app drawer
          const folders = document.querySelector('.folders-row');
          if (!folders) { showToast('No app drawer'); return; }
          folders.style.display = (folders.style.display === 'none' || !folders.style.display) ? 'grid' : 'none';
        }

        // Load contacts from Apps/Contacts.html and attach expand/action behavior
        document.addEventListener('DOMContentLoaded', () => {
          const contactsList = document.getElementById('contactsList') || document.querySelector('.contacts-list');
          if (!contactsList) return;

          // populate from fragment file (Apps/Contacts.html)
          loadContactsFromFile(contactsList);

          // delegate clicks on rows (ignore clicks on action buttons)
          contactsList.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (btn) { handleContactAction(btn); return; }
            const row = e.target.closest('.contact-row');
            if (!row) return;
            toggleContactRow(row);
          });

          // keyboard support: Enter or Space toggles a focused row
          contactsList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const row = e.target.closest('.contact-row');
              if (row) { e.preventDefault(); toggleContactRow(row); }
            }
          });
        });

        function loadContactsFromFile(container) {
          fetch('Apps/Contacts.html')
            .then(r => { if (!r.ok) throw new Error('Failed to load contacts'); return r.text(); })
            .then(html => {
              const tmp = document.createElement('div');
              tmp.innerHTML = html;

              // If the fragment already contains fully-formed .contact-row entries, use them directly
              const existingRows = tmp.querySelectorAll('.contact-row');
              if (existingRows.length) {
                container.innerHTML = '';
                const rows = Array.from(existingRows);
                // Sort alphabetically by contact name
                rows.sort((a, b) => {
                  const nameA = a.querySelector('.contact-name')?.textContent?.trim() || '';
                  const nameB = b.querySelector('.contact-name')?.textContent?.trim() || '';
                  return nameA.localeCompare(nameB);
                });
                rows.forEach(r => {
                  const clone = r.cloneNode(true);
                  if (!clone.dataset.number) {
                    const num = clone.querySelector('.contact-number')?.textContent?.trim();
                    if (num) clone.dataset.number = num;
                  }
                  clone.tabIndex = 0;
                  container.appendChild(clone);
                });
                return;
              }

              // Older fragment format: .contact-item with .contact-name and .contact-num
              const items = tmp.querySelectorAll('.contact-item');
              if (items.length) {
                container.innerHTML = '';
                const contactsData = [];
                items.forEach(it => {
                  const nameEl = it.querySelector('.contact-name');
                  const numEl = it.querySelector('.contact-num');
                  const name = nameEl ? nameEl.textContent.trim() : 'Unknown';
                  const num = numEl ? numEl.textContent.trim() : '';
                  contactsData.push({ name, num });
                });
                // Sort alphabetically by name
                contactsData.sort((a, b) => a.name.localeCompare(b.name));
                contactsData.forEach(contact => {
                  const avatar = initialsFromName(contact.name);
                  const row = document.createElement('div');
                  row.className = 'contact-row';
                  row.tabIndex = 0;
                  row.dataset.number = contact.num;
                  row.innerHTML = `<div class="contact-avatar">${escapeHtml(avatar)}</div>` +
                    `<div class="contact-main">` +
                    `<div class="contact-name">${escapeHtml(contact.name)}</div>` +
                    `<div class="contact-details">` +
                    `<div class="contact-number">${escapeHtml(contact.num)}</div>` +
                    `<div class="contact-actions">` +
                    `<button class="action-btn action-call" title="Call">📞</button>` +
                    `<button class="action-btn action-msg" title="Message">💬</button>` +
                    `<button class="action-btn action-info" title="Info">ℹ️</button>` +
                    `</div></div></div>`;
                  container.appendChild(row);
                });
                return;
              }

              container.innerHTML = '<div class="loading">No contacts found in Apps/Contacts.html</div>';
            })
            .catch(err => { console.error(err); container.innerHTML = '<div class="loading">Unable to load contacts</div>'; });
        }

        function initialsFromName(name) {
          const parts = name.split(/\s+/).filter(Boolean);
          if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
          return (parts[0][0] + (parts[1][0] || '')).toUpperCase();
        }

        function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

        function normalizeNumber(n) {
  let s = String(n || '').trim();
  if (!s) return '';
  const hasPlus = s.startsWith('+');
  // remove all non-digit characters
  s = s.replace(/[^\d]/g, '');
  return hasPlus ? ('+' + s) : s;
}

        function toggleContactRow(row) {
          // close other expanded rows
          document.querySelectorAll('.contact-row.expanded').forEach(r => { if (r !== row) r.classList.remove('expanded'); });
          row.classList.toggle('expanded');
        }

        function goToKeypadWithNumber(number) {
          const norm = normalizeNumber(number);
          openApp('app-phone');
          const keypadTabBtn = document.querySelector('#app-phone .phone-tab[data-tab="keypad"]');
          phoneSwitchTab('keypad', keypadTabBtn);
          const display = document.querySelector('#phoneKeypad .dial-display');
          if (display) display.value = norm;
        }

        function goToMessageThreadForContact(name, icon) {
          openApp('app-messages');
          const existingId = Object.keys(messageThreads).find(id =>
            messageThreads[id].name.trim().toLowerCase() === name.trim().toLowerCase()
          );
          if (existingId) {
            openThreadView(existingId);
            return;
          }

          const id = slugify(name) || ('chat-' + Math.random().toString(36).slice(2));
          const resolvedIcon = icon || (name[0] || '?').toUpperCase();
          messageThreads[id] = { name, icon: resolvedIcon, messages: [] };

          const list = document.querySelector('#app-messages .message-list');
          if (list && !list.querySelector(`.message-item[data-id="${id}"]`)) {
            const el = document.createElement('div');
            el.className = 'message-item';
            el.dataset.id = id;
            el.innerHTML = `
              <div class="avatar">${escapeHtml(resolvedIcon)}</div>
              <div class="message-main">
                <div class="message-name">${escapeHtml(name)}</div>
                <div class="message-snippet"></div>
              </div>
              <div class="message-meta"><div class="message-date"></div></div>
            `;
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
              openApp('app-messages');
              openThreadView(id);
            });
            list.insertBefore(el, list.firstChild);
          }

          openThreadView(id);
        }

        function handleContactAction(btn) {
          const row = btn.closest('.contact-row');
          if (!row) return;
          const number = row.dataset.number || row.querySelector('.contact-number')?.textContent || '';
          const name = row.querySelector('.contact-name')?.textContent.trim() || '';
          const avatar = row.querySelector('.contact-avatar')?.textContent.trim() || '';
          if (btn.classList.contains('action-call')) {
            goToKeypadWithNumber(number);
            return;
          }
          if (btn.classList.contains('action-msg')) {
            goToMessageThreadForContact(name, avatar);
            return;
          }
          if (btn.classList.contains('action-info')) {
            showToast('Info for ' + name, 1200);
            return;
          }
        }

        // Load other app fragments using a single unified loader
        function loadFragmentTo(selector, fileName) {
          const container = document.querySelector(selector);
          if (!container) {
            console.warn('Fragment container not found:', selector);
            return Promise.resolve('');
          }
          console.log('Loading fragment:', fileName, 'into', selector);
          return fetch(fileName)
            .then(r => { if (!r.ok) throw new Error('Failed to load ' + fileName); return r.text(); })
            .then(html => {
              console.log('Fragment loaded:', fileName);
              container.innerHTML = html.trim();
              console.log('Fragment inserted into DOM:', selector);
              return html;
            })
            .catch(err => {
              console.error('Fragment load error:', fileName, err);
              container.innerHTML = '<div class="loading">Unable to load ' + fileName + '</div>';
              return '';
            });
        }

        function slugify(text) {
          return String(text || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-_]/g, '')
            .replace(/-+/g, '-');
        }

        // Fragment initializers (for fragments that include their own scripts or when scripts
        // don't execute via innerHTML). Keep these in script.js so they always run.
        function initializeKeypad() {
          console.log('initializeKeypad called');
          try {
            const container = document.getElementById('phoneKeypad') || document.querySelector('.phone-keypad-wrapper');
            console.log('Keypad container:', container ? 'found' : 'NOT FOUND');
            if (!container) return;

            if (container._keypadInitialized) {
              console.log('Keypad already initialized, skipping');
              return;
            }
            container._keypadInitialized = true;

            const display = container.querySelector('.dial-display');
            const keypad = container.querySelector('.keypad');
            console.log('Keypad display:', display ? 'found' : 'NOT FOUND');
            console.log('Keypad grid:', keypad ? 'found' : 'NOT FOUND');

            if (!display) return;
            if (!keypad) return;

            // Initialize display to 0
            if (display.tagName === 'INPUT') display.value = '0';
            else display.textContent = '0';
            console.log('Keypad initialized successfully');

            const backspaceBtn = container.querySelector('.backspace-btn');
            const clearBtn = container.querySelector('.clear-btn');
            const callBtn = container.querySelector('.call-btn');

            function getDisplay() {
              return (display.tagName === 'INPUT' || display.tagName === 'TEXTAREA') ? display.value : display.textContent;
            }
            function setDisplay(v) {
              v = String(v || '0');
              if (display.tagName === 'INPUT' || display.tagName === 'TEXTAREA') display.value = v;
              else display.textContent = v;
            }

            // Use event delegation on keypad grid
            keypad.addEventListener('click', (e) => {
              const key = e.target.closest('.key');
              if (!key) return;
              const d = key.dataset.digit;
              if (d !== undefined) {
                const current = getDisplay();
                if (current === '0' && d !== '.') setDisplay(d);
                else setDisplay(current + d);
              }
            });

            if (backspaceBtn) {
              backspaceBtn.addEventListener('click', () => {
                const val = getDisplay();
                setDisplay(val.slice(0, -1) || '0');
              });
            }

            if (clearBtn) {
              clearBtn.addEventListener('click', () => {
                setDisplay('0');
              });
            }

            if (callBtn) {
              callBtn.addEventListener('click', () => {
                const n = (getDisplay() || '').trim();
                if (!n) { showToast && showToast('Enter number', 1200); return; }
                const norm = (n.startsWith('+') ? '+' : '') + n.replace(/[^\d]/g, '');
                if (norm) window.location.href = 'tel:' + norm;
              });
            }

            // keyboard: only accept digits and dial symbols when focused
            container.addEventListener('keydown', (e) => {
              if (/^[0-9*#+]$/.test(e.key)) {
                e.preventDefault();
                const current = getDisplay();
                if (current === '0' && /[0-9]/.test(e.key)) setDisplay(e.key);
                else setDisplay(current + e.key);
              } else if (e.key === 'Backspace') {
                e.preventDefault();
                setDisplay(getDisplay().slice(0, -1) || '0');
              }
            });
            if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '0');
          } catch(e) {
            console.error('initializeKeypad error:', e);
          }
        }

        function initializeCalculator(){
          console.log('initializeCalculator called');
          try{
            const container = document.querySelector('#app-calculator .screen-body') || document.querySelector('.calculator');
            console.log('Calculator container:', container ? 'found' : 'NOT FOUND');
            if (!container) return;

            if (container._calcInitialized) {
              console.log('Calculator already initialized, skipping');
              return;
            }
            container._calcInitialized = true;

            const display = container.querySelector('.calc-display');
            const grid = container.querySelector('.calc-grid');
            console.log('Calculator display:', display ? 'found' : 'NOT FOUND');
            console.log('Calculator grid:', grid ? 'found' : 'NOT FOUND');

            if (!display) return;
            if (!grid) return;

            console.log('Calculator initialized successfully');
            let expr = '';

            function set(val){
              val = String(val || '0');
              display.value = val;
            }
            function append(v){
              expr += String(v);
              set(expr);
            }
            function clearAll(){ expr = ''; set('0'); }
            function back(){ expr = expr.slice(0,-1); set(expr || '0'); }
            function toggleNeg(){
              if(!expr) return;
              if(expr.charAt(0)==='-') expr = expr.slice(1);
              else expr = '-' + expr;
              set(expr);
            }
            function percent(){
              try{
                const v = parseFloat(expr || '0');
                expr = String(v/100);
                set(expr);
              }catch(e){}
            }
            function evaluate(){
              try{
                if (expr === '543') {
                  window.niiChanUnlocked = true;
                  window.videoGalleryUnlocked = true;
                  window.unlockedCode543 = true;
                  showNotifications(['gallery', 'notes', 'messages', 'phone']);
                  window.appNotifications['camera'] = true;
                  if (window.loadSecretNotes) window.loadSecretNotes();
                  set('🩷');
                  expr = '';
                  return;
                }
                if (expr === '090902') {
                  window.whatIfUnlocked = true;
                  window.unlockedCode090902 = true;
                  showNotifications(['music', 'gallery', 'notes']);
                  if (window.loadSecretNotes) window.loadSecretNotes();
                  set('🔪');
                  expr = '';
                  return;
                }
                const s = expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
                const safe = s.replace(/[^0-9+\-*/(). %]/g,'');
                if (!safe) { expr = ''; set('0'); return; }
                const fn = new Function('return ' + safe);
                const res = fn();
                expr = (res===undefined||res===null)?'':String(res);
                set(expr || '0');
              }catch(e){
                set('Error');
                expr = '';
              }
            }

            // Use event delegation on grid
            grid.addEventListener('click', (e)=>{
              const btn = e.target.closest('button');
              if(!btn) return;

              const d = btn.dataset.digit;
              const op = btn.dataset.op;
              const action = btn.dataset.action;

              if(d !== undefined) {
                if(d==='%') percent();
                else append(d);
              } else if(op) {
                append(' ' + op + ' ');
              } else if(action) {
                if(action==='clear') clearAll();
                else if(action==='back') back();
                else if(action==='neg') toggleNeg();
                else if(action==='equals') evaluate();
              }
            });

            // Keyboard support
            container.addEventListener('keydown', (e)=>{
              if(/^[0-9]$/.test(e.key)) { e.preventDefault(); append(e.key); }
              else if('+-*/'.includes(e.key)) { e.preventDefault(); append(' '+e.key+' '); }
              else if(e.key==='Enter' || e.key==='=') { e.preventDefault(); evaluate(); }
              else if(e.key==='Backspace') { e.preventDefault(); back(); }
              else if(e.key==='Escape') { e.preventDefault(); clearAll(); }
              else if(e.key==='.') { e.preventDefault(); append('.'); }
            });

            if(!container.hasAttribute('tabindex')) container.setAttribute('tabindex','0');

            clearAll();
          }catch(e){ console.error('initializeCalculator error:', e); }
        }

        function initializeCalendar(){
          try{
            const container = document.querySelector('#app-calendar .screen-body') || document.querySelector('.calendar-app');
            if (!container) return;
            if (container._calendarInitialized) return;
            container._calendarInitialized = true;

            const STORAGE_KEY = 'calendar_events_v1';
            let currentDate = new Date();
            let selectedDate = new Date();
            let editingEvent = null;

            const PERMANENT_EVENTS = ['2026-09-09', '2026-10-10'];
            const PERMANENT_EVENTS_DATA = {
              '2026-09-09': { title: '🦉🎉', time: '', description: 'Happy Birthday!' },
              '2026-10-10': { title: "🍵🎉", time: '', description: 'Password to my locked notes' }
            };

            function loadEvents() {
              try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
              catch(e) { return []; }
            }

            function saveEvents(events) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
            }

            function isPermanentEvent(event) {
              if (!event || !event.date) return false;
              return PERMANENT_EVENTS.includes(event.date);
            }

            function initializePermanentEvents() {
              let events = loadEvents();
              // Remove old permanent events that are no longer in PERMANENT_EVENTS
              events = events.filter(e => !isPermanentEvent(e) || PERMANENT_EVENTS.includes(e.date));
              // Add new permanent events if they don't exist
              PERMANENT_EVENTS.forEach(date => {
                const exists = events.some(e => e.date === date && isPermanentEvent(e));
                if (!exists) {
                  const data = PERMANENT_EVENTS_DATA[date];
                  events.push({
                    id: 'permanent-' + date,
                    date: date,
                    title: data.title,
                    time: data.time,
                    description: data.description
                  });
                }
              });
              saveEvents(events);
            }

            initializePermanentEvents();

            function getEventsForDate(date) {
              const dateStr = date.getFullYear() + '-' +
                             String(date.getMonth() + 1).padStart(2, '0') + '-' +
                             String(date.getDate()).padStart(2, '0');
              return loadEvents().filter(e => e.date === dateStr);
            }

            function formatDateForDisplay(date) {
              const month = date.toLocaleString('default', { month: 'short' });
              const day = date.getDate();
              return month + ' ' + day;
            }

            function renderCalendar() {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              const monthName = currentDate.toLocaleString('default', { month: 'long' }).toUpperCase();
              document.getElementById('cal-month').textContent = monthName;

              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const daysInPrevMonth = new Date(year, month, 0).getDate();

              const grid = document.getElementById('cal-days');
              if (!grid) return;
              grid.innerHTML = '';

              for (let i = firstDay - 1; i >= 0; i--) {
                const day = daysInPrevMonth - i;
                const dateObj = new Date(year, month - 1, day);
                grid.appendChild(createDayElement(dateObj, true));
              }

              for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(year, month, day);
                grid.appendChild(createDayElement(dateObj, false));
              }

              const totalCells = grid.children.length;
              const remainingCells = 42 - totalCells;
              for (let day = 1; day <= remainingCells; day++) {
                const dateObj = new Date(year, month + 1, day);
                grid.appendChild(createDayElement(dateObj, true));
              }
            }

            function createDayElement(dateObj, isOtherMonth) {
              const dayEl = document.createElement('div');
              dayEl.className = 'cal-day';
              dayEl.dataset.date = dateObj.getFullYear() + '-' +
                                   String(dateObj.getMonth() + 1).padStart(2, '0') + '-' +
                                   String(dateObj.getDate()).padStart(2, '0');

              if (isOtherMonth) {
                dayEl.classList.add('other-month');
              } else {
                dayEl.classList.add('current-month');
              }

              if (new Date().toDateString() === dateObj.toDateString()) dayEl.classList.add('today');
              if (selectedDate.toDateString() === dateObj.toDateString()) dayEl.classList.add('selected');

              const dayNum = document.createElement('div');
              dayNum.className = 'cal-day-num';
              dayNum.textContent = dateObj.getDate();
              dayEl.appendChild(dayNum);

              const events = getEventsForDate(dateObj);
              if (events.length > 0) {
                const eventsDiv = document.createElement('div');
                eventsDiv.className = 'cal-day-events';
                eventsDiv.textContent = events[0].title + (events.length > 1 ? ' ...' : '');
                dayEl.appendChild(eventsDiv);
              }

              dayEl.addEventListener('click', () => {
                selectedDate = new Date(dateObj);
                const events = getEventsForDate(selectedDate);
                showDayView(selectedDate, events);
              });
              return dayEl;
            }

          function updateAddButton() {
              const dateSpan = document.getElementById('cal-add-date');
              if (dateSpan) dateSpan.textContent = formatDateForDisplay(selectedDate);
            }

            function showDayView(dateObj, events) {
              const dayView = document.getElementById('cal-day-view');
              const dateTitle = document.getElementById('day-view-date');
              const dayname = document.getElementById('day-view-dayname');
              const container = document.getElementById('day-events-container');

              const dayNum = dateObj.getDate();
              const dayNameStr = dateObj.toLocaleString('default', { weekday: 'long' });
              dateTitle.textContent = dayNum;
              dayname.textContent = dayNameStr;

              container.innerHTML = '';
              events.forEach(event => {
                const card = document.createElement('div');
                card.className = 'cal-event-card';
                const isPerm = isPermanentEvent(event);
                if (isPerm) card.classList.add('permanent');

                let html = '<div class="cal-event-icon">📅</div>';
                html += '<div class="cal-event-title">' + event.title + '</div>';
                if (event.time) html += '<div class="cal-event-time">' + event.time + '</div>';
                if (event.description) html += '<div class="cal-event-description">' + event.description + '</div>';

                card.innerHTML = html;
                if (!isPerm) {
                  card.addEventListener('click', () => openModal(event));
                }
                container.appendChild(card);
              });

              const dayAddBtn = document.getElementById('day-add-event');
              if (dayAddBtn) {
                dayAddBtn.addEventListener('click', () => {
                  closeDayView();
                  openModal(null);
                });
              }

              dayView.classList.add('active');
            }

            function closeDayView() {
              const dayView = document.getElementById('cal-day-view');
              dayView.classList.remove('active');
            }


            function openModal(event) {
              if (event && isPermanentEvent(event)) return;
              editingEvent = event;
              const modal = document.getElementById('cal-modal');
              const titleEl = document.getElementById('modal-title');
              const titleInput = document.getElementById('event-title');
              const timeInput = document.getElementById('event-time');
              const descInput = document.getElementById('event-desc');
              const deleteBtn = document.getElementById('btn-delete-event');

              if (event) {
                titleEl.textContent = 'Edit Event';
                titleInput.value = event.title || '';
                timeInput.value = event.time || '';
                descInput.value = event.description || '';
                deleteBtn.style.display = 'block';
              } else {
                titleEl.textContent = 'Add Event';
                titleInput.value = '';
                timeInput.value = '';
                descInput.value = '';
                deleteBtn.style.display = 'none';
              }

              modal.classList.add('active');
              titleInput.focus();
            }

            function closeModal() {
              const modal = document.getElementById('cal-modal');
              modal.classList.remove('active');
              editingEvent = null;
            }

            function saveEvent() {
              const title = document.getElementById('event-title').value.trim();
              const time = document.getElementById('event-time').value;
              const description = document.getElementById('event-desc').value.trim();

              if (!title) { alert('Please enter event title'); return; }

              const events = loadEvents();
              const dateStr = selectedDate.getFullYear() + '-' +
                             String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' +
                             String(selectedDate.getDate()).padStart(2, '0');

              if (editingEvent) {
                if (isPermanentEvent(editingEvent)) { alert('Cannot edit permanent events'); return; }
                const idx = events.findIndex(e => e.date === editingEvent.date && e.id === editingEvent.id);
                if (idx >= 0) {
                  events[idx] = { id: editingEvent.id, date: dateStr, title, time, description };
                }
              } else {
                const event = { id: Date.now(), date: dateStr, title, time, description };
                events.push(event);
              }

              saveEvents(events);
              renderCalendar();
              closeModal();
            }

            function deleteEvent() {
              if (!editingEvent) return;
              if (isPermanentEvent(editingEvent)) { alert('Cannot delete permanent events'); return; }
              if (!confirm('Delete this event?')) return;

              const events = loadEvents();
              const filtered = events.filter(e => !(e.date === editingEvent.date && e.id === editingEvent.id));
              saveEvents(filtered);
              renderCalendar();
              closeModal();
              closeDayView();
            }

            const addBtn = document.getElementById('cal-add-event');
            const saveBtn = document.getElementById('btn-save-event');
            const cancelBtn = document.getElementById('btn-cancel-event');
            const deleteBtn = document.getElementById('btn-delete-event');
            const monthBtn = document.getElementById('cal-month');
            const prevBtn = document.getElementById('cal-prev-month');
            const nextBtn = document.getElementById('cal-next-month');
            const todayBtn = document.getElementById('cal-today');
            const modal = document.getElementById('cal-modal');
            const dayView = document.getElementById('cal-day-view');
            const dayViewClose = document.getElementById('day-view-close');

            if (addBtn) addBtn.addEventListener('click', () => openModal(null));
            if (saveBtn) saveBtn.addEventListener('click', saveEvent);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
            if (deleteBtn) deleteBtn.addEventListener('click', deleteEvent);
            if (monthBtn) monthBtn.addEventListener('click', () => {
              currentDate = new Date();
              selectedDate = new Date();
              renderCalendar();
              updateAddButton();
            });
            if (prevBtn) prevBtn.addEventListener('click', () => {
              currentDate.setMonth(currentDate.getMonth() - 1);
              renderCalendar();
            });
            if (nextBtn) nextBtn.addEventListener('click', () => {
              currentDate.setMonth(currentDate.getMonth() + 1);
              renderCalendar();
            });
            if (todayBtn) todayBtn.addEventListener('click', () => {
              currentDate = new Date();
              selectedDate = new Date();
              renderCalendar();
              updateAddButton();
            });
            if (dayViewClose) dayViewClose.addEventListener('click', closeDayView);
            if (dayView) dayView.addEventListener('click', (e) => {
              if (e.target.id === 'cal-day-view') closeDayView();
            });
            if (modal) modal.addEventListener('click', (e) => {
              if (e.target.id === 'cal-modal') closeModal();
            });

            renderCalendar();
            updateAddButton();
          }catch(e){ console.error('initializeCalendar error:', e); }
        }
        
        

        function setupMessagesList() {
          const msgList = document.querySelector('#app-messages .message-list');
          if (!msgList) return;
          window.__messagesStore = window.__messagesStore || {};
          const items = Array.from(msgList.querySelectorAll('.message-item'));
          if (!items.length) {
            msgList.innerHTML = '<div class="loading">No messages available</div>';
            return;
          }

          items.forEach(item => {
            const id = item.dataset.id || slugify(item.querySelector('.message-name')?.textContent || 'chat');
            const name = item.querySelector('.message-name')?.textContent.trim() || 'Chat';
            const snippet = item.querySelector('.message-snippet')?.textContent.trim() || '';
            item.dataset.id = id;
            if (!window.__messagesStore[id] || !window.__messagesStore[id].length) {
              window.__messagesStore[id] = [{ from: 'them', text: snippet, time: new Date().toISOString() }];
            }
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
              openApp('app-messages');
              openThreadView(id);
            });
          });
        }

        function setupMessagesConversationControls() {
          const screen = document.getElementById('app-messages');
          if (!screen) return;
          const back = screen.querySelector('.conv-back');
          const input = screen.querySelector('.conv-input');
          const send = screen.querySelector('.conv-send');

          if (back) back.addEventListener('click', closeConversation);
          if (input) {
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendCurrentMessage();
              }
            });
          }
          if (send) send.addEventListener('click', sendCurrentMessage);
        }

        function renderConversation(id) {
          const convScroll = document.querySelector('#app-messages .conversation-scroll');
          if (!convScroll) return;
          convScroll.innerHTML = '';
          const msgs = (window.__messagesStore[id] || []).sort((a, b) => new Date(a.time) - new Date(b.time));
          msgs.forEach(m => {
            const bubble = document.createElement('div');
            bubble.className = 'conv-bubble ' + (m.from === 'me' ? 'me' : 'them');
            bubble.innerHTML = '<div class="conv-text">' + escapeHtml(m.text) + '</div>' +
              '<div class="conv-time">' + new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>';
            convScroll.appendChild(bubble);
          });
          convScroll.scrollTop = convScroll.scrollHeight;
        }

        function openConversation(id, name) {
          const screen = document.getElementById('app-messages');
          if (!screen) return;
          const title = screen.querySelector('.screen-title');
          if (title) title.textContent = name;
          const list = screen.querySelector('.message-list');
          const conv = screen.querySelector('.conversation-container');
          if (list) list.style.display = 'none';
          if (conv) conv.style.display = 'flex';

          window.__messagesStore = window.__messagesStore || {};
          window.__messagesStore[id] = window.__messagesStore[id] || [];
          screen.dataset.currentConversation = id;
          renderConversation(id);

          const input = screen.querySelector('.conv-input');
          if (input) input.focus();
        }

        function closeConversation() {
          const screen = document.getElementById('app-messages');
          if (!screen) return;
          const title = screen.querySelector('.screen-title');
          if (title) title.textContent = 'Messages';
          const list = screen.querySelector('.message-list');
          const conv = screen.querySelector('.conversation-container');
          if (conv) conv.style.display = 'none';
          if (list) list.style.display = 'flex';
          screen.dataset.currentConversation = '';
        }

        function sendCurrentMessage() {
          const screen = document.getElementById('app-messages');
          if (!screen) return;
          const id = screen.dataset.currentConversation;
          if (!id) return;
          const input = screen.querySelector('.conv-input');
          if (!input) return;
          const text = input.value.trim();
          if (!text) return;
          const msg = { from: 'me', text: text, time: new Date().toISOString() };
          window.__messagesStore = window.__messagesStore || {};
          window.__messagesStore[id] = window.__messagesStore[id] || [];
          window.__messagesStore[id].push(msg);
          renderConversation(id);
          input.value = '';
        }

        function loadAppFragments() {
          console.log('Starting loadAppFragments...');
          const mappings = [
            { file: 'Apps/Notes.html', selector: '#app-notes .notes-list' },
            { file: 'Apps/Messages.html', selector: '#app-messages .message-list' },
            { file: 'Apps/Soccer.html', selector: '#soccerBody' },
            { file: 'Apps/Gallery.html', selector: '#app-gallery .screen-body' },
            { file: 'Apps/Calls.html', selector: '#phoneRecents .recents-list' },
            { file: 'Apps/Keypad.html', selector: '#phoneKeypad' },
            { file: 'Apps/Calculator.html', selector: '#app-calculator .screen-body' },
            { file: 'Apps/Calendar.html', selector: '#app-calendar .screen-body' },
            { file: 'Apps/Camera.html', selector: '#app-camera .screen-body' },
            { file: 'Apps/Clock.html', selector: '#app-clock .screen-body' },
            { file: 'Apps/Music.html', selector: '#app-ytmusic .screen-body' },
          ];

          const promises = mappings.map(map => loadFragmentTo(map.selector, map.file));
          return Promise.all(promises).then(() => {
            console.log('All fragments loaded');
            setupMessagesList();
            loadMessageThreadsFromFragment();
            setupMessagesConversationControls();
            setupThreadInput();
            initializeLockedNotes();
            // initialize fragments that need JS (keypad, calculator, calendar)
            console.log('Initializing keypad...');
            if (typeof initializeKeypad === 'function') initializeKeypad();
            else console.warn('initializeKeypad not defined');

            console.log('Initializing calculator...');
            if (typeof initializeCalculator === 'function') initializeCalculator();
            else console.warn('initializeCalculator not defined');

            console.log('Initializing calendar...');
            if (typeof initializeCalendar === 'function') initializeCalendar();
            else console.warn('initializeCalendar not defined');

            console.log('Initializing gallery...');
            if (typeof initializeGallery === 'function') initializeGallery();
            else console.warn('initializeGallery not defined');

            console.log('Initializing phone contacts...');
            if (typeof initializePhoneContacts === 'function') initializePhoneContacts();
            else console.warn('initializePhoneContacts not defined');

            console.log('Initializing phone recents...');
            if (typeof initializeRecents === 'function') initializeRecents();
            else console.warn('initializeRecents not defined');

            console.log('Initializing music player...');
            if (typeof initializeMusicPlayer === 'function') initializeMusicPlayer();
            else console.warn('initializeMusicPlayer not defined');

            console.log('Initializing clock...');
            if (typeof initializeClock === 'function') initializeClock();
            else console.warn('initializeClock not defined');
          });
        }

        // Initialize app fragments after load
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('.app-screen').forEach(s => { if (!s.classList.contains('active')) s.style.display = 'none'; });
          loadAppFragments().then(() => {
            // Give a tiny delay to ensure DOM is fully updated
            setTimeout(() => {
              if (typeof initializeKeypad === 'function') initializeKeypad();
              if (typeof initializeCalculator === 'function') initializeCalculator();
              if (typeof initializeCalendar === 'function') initializeCalendar();
              if (typeof initializeGallery === 'function') initializeGallery();
            }, 100);
          });
        });

        // Auto-initialize when apps are opened if not already initialized
        const originalOpenApp = window.openApp;
        window.openApp = function(appId, el) {
          originalOpenApp(appId, el);
          setTimeout(() => {
            if (appId === 'app-phone' && typeof initializeKeypad === 'function') initializeKeypad();
            if (appId === 'app-calculator' && typeof initializeCalculator === 'function') initializeCalculator();
          }, 50);
        };


        // Expose fragment initializers so fragment files could optionally call them
        // (define placeholders to be implemented below)

        function switchNotesTab(tab) {
          const tabs = document.querySelectorAll('.notes-tab');
          const normalNotes = document.getElementById('normal-notes');
          const lockedNotes = document.getElementById('locked-notes');

          tabs.forEach(t => t.classList.remove('active'));

          if (tab === 'normal') {
            tabs[0].classList.add('active');
            normalNotes.style.display = 'block';
            lockedNotes.style.display = 'none';
          } else {
            tabs[1].classList.add('active');
            normalNotes.style.display = 'none';
            lockedNotes.style.display = 'block';
          }
        }

        let lockedNotesUnlocked = false; // resets on every page refresh (not persisted)

        // Initialize Nii-chan and What if albums - reset on every page refresh
        window.niiChanUnlocked = false;
        window.whatIfUnlocked = false;
        window.unlockedCode543 = false;
        window.unlockedCode090902 = false;

        function unlockNotes() {
          const password = document.getElementById('locked-notes-password').value;
          const correctPassword = '1010'; // October 10 - Nii-chan's Birthday
          const errorEl = document.getElementById('locked-notes-error');

          if (password === correctPassword) {
            document.querySelector('.locked-notes-container').style.display = 'none';
            document.getElementById('locked-notes-content').style.display = 'block';
            lockedNotesUnlocked = true;
            loadSecretNotes();
            errorEl.style.display = 'none';
          } else {
            errorEl.textContent = 'Where the dates meet, there lies the key';
            errorEl.style.display = 'block';
          }
        }

        function initializeLockedNotes() {
          if (lockedNotesUnlocked) {
            document.querySelector('.locked-notes-container').style.display = 'none';
            document.getElementById('locked-notes-content').style.display = 'block';
            loadSecretNotes();
          } else {
            document.querySelector('.locked-notes-container').style.display = 'block';
            document.getElementById('locked-notes-content').style.display = 'none';
            document.getElementById('locked-notes-password').value = '';
            document.getElementById('locked-notes-error').style.display = 'none';
          }
        }

        function loadSecretNotes() {
          fetch('Apps/Notes.html')
            .then(r => { if (!r.ok) throw new Error('Failed to load notes'); return r.text(); })
            .then(html => {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');

              // Get regular locked notes (not special code-based ones)
              const lockedNotes = Array.from(doc.querySelectorAll('.locked-note:not([data-code])'))
                .filter(el => el.querySelector('.note-text')?.textContent?.trim())
                .map(el => ({
                  element: el.cloneNode(true),
                  dateStr: el.querySelector('.note-date')?.textContent?.trim() || ''
                }));

              // Get special notes and filter by unlock status
              const specialNotes = Array.from(doc.querySelectorAll('.locked-note[data-code]'))
                .filter(el => {
                  const code = el.getAttribute('data-code');
                  if (code === '543') return window.unlockedCode543;
                  if (code === '090902') return window.unlockedCode090902;
                  return false;
                })
                .map(el => ({
                  element: el.cloneNode(true),
                  dateStr: el.querySelector('.note-date')?.textContent?.trim() || ''
                }));

              // Combine and sort by date
              const allNotes = [...lockedNotes, ...specialNotes];

              // Sort notes by date (handling various date formats)
              allNotes.sort((a, b) => {
                const dateA = parseNoteDate(a.dateStr);
                const dateB = parseNoteDate(b.dateStr);
                return dateA - dateB;
              });

              const container = document.getElementById('locked-notes-content');
              let contentHTML = '<div class="locked-notes-section">';

              if (allNotes.length > 0) {
                contentHTML += allNotes.map(item => {
                  const note = item.element;
                  note.classList.remove('locked-note');
                  note.classList.add('note-card');

                  const dataCode = note.getAttribute('data-code');
                  if (dataCode) {
                    const color = note.getAttribute('data-color');
                    const rgba = `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.12)`;
                    note.setAttribute('style', `background: ${rgba}; border-left: 4px solid ${color};`);
                    note.removeAttribute('data-code');
                    note.removeAttribute('data-color');
                    note.removeAttribute('data-emoji');
                  }

                  return note.outerHTML;
                }).join('');
              } else {
                contentHTML += '<div style="color: #999;">No locked notes yet</div>';
              }

              contentHTML += '</div>';
              container.innerHTML = contentHTML;
            })
            .catch(err => {
              console.error('Locked notes load error:', err);
              document.getElementById('locked-notes-content').innerHTML = '<div class="locked-notes-section"><div style="color: #ff6b6b;">Failed to load locked notes</div></div>';
            });

          function parseNoteDate(dateStr) {
            // Remove italic tags and extra text like "(Updated XX:XX)"
            const cleanDate = dateStr.replace(/<[^>]*>/g, '').replace(/\s*\(Updated[^)]*\)/i, '').trim();

            // Try to parse common date formats: "Month DD, YYYY" or "Month D, YYYY"
            const months = {
              'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
              'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
            };

            const match = cleanDate.match(/(\w+)\s+(\d+),\s+(\d{4})/);
            if (match) {
              const month = months[match[1]] || 0;
              const day = parseInt(match[2]) || 1;
              const year = parseInt(match[3]) || 2000;
              return new Date(year, month, day).getTime();
            }

            // Fallback to Date.parse
            return new Date(cleanDate).getTime();
          }
        }

        // Gallery Functions
        let albumData = null;

        function loadAlbumData() {
          if (albumData) return Promise.resolve(albumData);

          return fetch('Apps/Gallery.html')
            .then(response => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.text();
            })
            .then(html => {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');
              const dataElement = doc.getElementById('gallery-album-data');
              if (dataElement && dataElement.textContent.trim()) {
                albumData = JSON.parse(dataElement.textContent);
                if (!albumData) throw new Error('Parsed data is null');
                return albumData;
              }
              throw new Error('Album data element not found in Gallery.html');
            })
            .catch(err => {
              console.error('Failed to load album data:', err);
              albumData = {
                screenshots: { name: 'Screenshots', photos: [] },
                downloaded: { name: 'Downloaded', photos: [] },
                camera: { name: 'Camera', photos: [] },
                favorites: { name: 'Favorites', photos: [] },
                niiChan: { name: 'Nii-chan', photos: [] },
                whatIf: { name: 'What if', photos: [] }
              };
              return albumData;
            });
        }

        function updateAlbumCounts() {
          loadAlbumData().then(data => {
            Object.keys(data).forEach(albumName => {
              // Skip showing secret albums unless unlocked in this session
              if (albumName === 'niiChan' && !window.niiChanUnlocked) {
                return;
              }
              if (albumName === 'whatIf' && !window.whatIfUnlocked) {
                return;
              }
              const count = data[albumName].photos.length;
              const countEl = document.getElementById(`count-${albumName}`);
              if (countEl) countEl.textContent = count;
            });
          });
        }

        function openAlbum(albumName) {
          loadAlbumData().then(data => {
            const album = data[albumName];
            const albumsView = document.getElementById('albumsView');
            const photosView = document.getElementById('photosView');

            if (!albumsView || !photosView) return;

            albumsView.style.display = 'none';
            photosView.classList.add('active');
            document.getElementById('currentAlbumTitle').textContent = album.name;

            const photosGrid = document.getElementById('photosGrid');
            photosGrid.innerHTML = '';

            album.photos.forEach((photo, index) => {
              const photoItem = document.createElement('div');
              photoItem.className = 'photo-item';
              const img = document.createElement('img');

              const photoUrl = typeof photo === 'string' ? photo : photo.url;
              const description = typeof photo === 'string' ? '' : (photo.description || '');

              img.src = photoUrl;
              img.alt = 'Photo';
              img.style.cursor = 'pointer';
              img.onclick = (e) => {
                e.stopPropagation();
                window.currentAlbumPhotos = album.photos;
                window.currentPhotoIndex = index;
                openPhotoViewer(photoUrl, description);
              };
              photoItem.appendChild(img);
              photosGrid.appendChild(photoItem);
            });

          });
        }

        function closeAlbum() {
          const albumsView = document.getElementById('albumsView');
          const photosView = document.getElementById('photosView');

          if (photosView) photosView.classList.remove('active');
          if (albumsView) albumsView.style.display = 'flex';
        }

        function openPhotoViewer(photoUrl, description = '') {
          const modal = document.getElementById('photoViewerModal');
          const img = document.getElementById('photoViewerImage');
          const descEl = document.getElementById('photoViewerDescription');

          if (modal && img) {
            img.src = photoUrl;
            if (descEl) {
              descEl.textContent = description || '';
            }
            modal.classList.add('active');
            updatePhotoCounter();
          }
        }

        function nextPhoto() {
          if (window.currentAlbumPhotos && window.currentPhotoIndex !== undefined) {
            window.currentPhotoIndex = (window.currentPhotoIndex + 1) % window.currentAlbumPhotos.length;
            displayCurrentPhoto();
          }
        }

        function prevPhoto() {
          if (window.currentAlbumPhotos && window.currentPhotoIndex !== undefined) {
            window.currentPhotoIndex = (window.currentPhotoIndex - 1 + window.currentAlbumPhotos.length) % window.currentAlbumPhotos.length;
            displayCurrentPhoto();
          }
        }

        function displayCurrentPhoto() {
          if (window.currentAlbumPhotos && window.currentPhotoIndex !== undefined) {
            const photo = window.currentAlbumPhotos[window.currentPhotoIndex];
            const photoUrl = typeof photo === 'string' ? photo : photo.url;
            const description = typeof photo === 'string' ? '' : (photo.description || '');

            const img = document.getElementById('photoViewerImage');
            const descEl = document.getElementById('photoViewerDescription');

            if (img) img.src = photoUrl;
            if (descEl) descEl.textContent = description || '';
            updatePhotoCounter();
          }
        }

        function updatePhotoCounter() {
          const counter = document.getElementById('photoViewerCounter');
          if (counter && window.currentAlbumPhotos) {
            counter.textContent = `${window.currentPhotoIndex + 1}/${window.currentAlbumPhotos.length}`;
          }
        }

        function showSecretAlbumsIfUnlocked() {
          loadAlbumData().then(data => {
            const niiChanAlbum = document.getElementById('niiChanAlbum');
            const whatIfAlbum = document.getElementById('whatIfAlbum');

            if (niiChanAlbum) {
              if (window.niiChanUnlocked) {
                niiChanAlbum.classList.remove('hidden');
                const countEl = document.getElementById('count-niiChan');
                if (countEl) countEl.textContent = data.niiChan.photos.length;
              } else {
                niiChanAlbum.classList.add('hidden');
              }
            }

            if (whatIfAlbum) {
              if (window.whatIfUnlocked) {
                whatIfAlbum.classList.remove('hidden');
                const countEl = document.getElementById('count-whatIf');
                if (countEl) countEl.textContent = data.whatIf.photos.length;
              } else {
                whatIfAlbum.classList.add('hidden');
              }
            }
          });
        }

        function showNiiChanAlbumIfUnlocked() {
          showSecretAlbumsIfUnlocked();
        }

        // Make functions globally accessible
        window.showSecretAlbumsIfUnlocked = showSecretAlbumsIfUnlocked;
        window.showNiiChanAlbumIfUnlocked = showNiiChanAlbumIfUnlocked;
        window.loadSecretNotes = loadSecretNotes;
        window.loadAlbumData = loadAlbumData;
        window.updateAlbumCounts = updateAlbumCounts;
        window.openAlbum = openAlbum;
        window.closeAlbum = closeAlbum;
        window.openPhotoViewer = openPhotoViewer;
        window.nextPhoto = nextPhoto;
        window.prevPhoto = prevPhoto;
        window.flipCamera = function() {
          cameraMode = cameraMode === 'selfie' ? 'back' : 'selfie';
          if (cameraMode === 'selfie' && selfiePhotos.length > 0) {
            cameraIndex = getNextShuffledPhoto();
          } else {
            cameraIndex = 0;
          }
          previousPhotoUrl = '';
          closeCameraStream();
          updateCameraDisplay();
        };
        window.capturePhoto = function() {
          if (cameraMode === 'selfie' && selfiePhotos.length > 0) {
            cameraIndex = getNextShuffledPhoto();
            updateCameraDisplay();
          }
        };
        window.initializeCamera = initializeCamera;

        function closePhotoViewer() {
          const modal = document.getElementById('photoViewerModal');
          if (modal) modal.classList.remove('active');
          window.currentAlbumPhotos = null;
          window.currentPhotoIndex = undefined;
        }

        window.closePhotoViewer = closePhotoViewer;

        function initializeGallery() {
          updateAlbumCounts();
          showNiiChanAlbumIfUnlocked();
          const modal = document.getElementById('photoViewerModal');
          if (modal) {
            modal.onclick = (e) => {
              if (e.target === modal) closePhotoViewer();
            };

            // Swipe detection
            let startX = 0;
            modal.addEventListener('touchstart', (e) => {
              startX = e.touches[0].clientX;
            });

            modal.addEventListener('touchend', (e) => {
              const endX = e.changedTouches[0].clientX;
              if (startX - endX > 50) nextPhoto();
              else if (endX - startX > 50) prevPhoto();
            });
          }

          // Keyboard navigation
          document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('photoViewerModal');
            if (modal && modal.classList.contains('active')) {
              if (e.key === 'ArrowRight') nextPhoto();
              else if (e.key === 'ArrowLeft') prevPhoto();
              else if (e.key === 'Escape') closePhotoViewer();
            }
          });
        }


        // Message Threading System
        // Thread content (names, icons, messages) lives in Apps/Messages.html as
        // hidden .thread-data blocks — parsed into this object once the fragment loads.
        let messageThreads = {};

        function loadMessageThreadsFromFragment() {
          const container = document.querySelector('#app-messages .message-list');
          if (!container) return;

          messageThreads = {};
          const threadEls = Array.from(container.querySelectorAll('.thread-data'));
          threadEls.forEach(el => {
            const id = el.dataset.id;
            if (!id) return;
            const name = el.dataset.name || id;
            const icon = el.dataset.icon || '?';
            const messages = Array.from(el.querySelectorAll('.thread-msg')).map(m => {
              const msg = {
                sender: m.dataset.sender || 'them',
                text: m.textContent.trim(),
                time: m.dataset.time || ''
              };
              if (m.dataset.date) msg.date = m.dataset.date;
              return msg;
            });
            messageThreads[id] = { name, icon, messages };
          });
        }

        function displayThreadMessages(id) {
          const container = document.getElementById('messagesContainer');
          const thread = messageThreads[id];
          if (!container || !thread) return;

          container.innerHTML = '';
          let previousDate = null;

          thread.messages.forEach((msg) => {
            // If date changed, show date divider
            if (msg.date && msg.date !== previousDate) {
              const dateHeader = document.createElement('div');
              dateHeader.className = 'message-timestamp';
              dateHeader.textContent = msg.date;
              container.appendChild(dateHeader);
              previousDate = msg.date;
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.sender === 'you' ? 'sent' : 'received'}`;

            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            bubble.textContent = msg.text;

            messageDiv.appendChild(bubble);

            if (msg.time) {
              const time = document.createElement('div');
              time.className = 'message-time';
              time.textContent = msg.time;
              messageDiv.appendChild(time);
            }

            container.appendChild(messageDiv);
          });

          container.scrollTop = container.scrollHeight;
        }

        function sendThreadMessage(id, text) {
          if (!text.trim()) return;

          const thread = messageThreads[id];
          if (!thread) return;

          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

          thread.messages.push({
            sender: 'you',
            text: text,
            time: timeStr,
            date: dateStr
          });

          displayThreadMessages(id);
        }

        window.currentThreadId = null;

        function openThreadView(id) {
          const thread = messageThreads[id];
          if (!thread) return;

          window.currentThreadId = id;
          const thread_el = document.getElementById('conversationThread');
          const items = document.querySelectorAll('#app-messages .message-item');

          if (thread_el) {
            thread_el.style.display = 'flex';
            items.forEach(item => item.style.display = 'none');
            document.getElementById('threadTitle').textContent = thread.name;
            displayThreadMessages(id);
            const messageInputEl = document.getElementById('messageInput');
            if (messageInputEl) messageInputEl.focus();
          }
        }

        function closeThreadView() {
          const thread_el = document.getElementById('conversationThread');
          const items = document.querySelectorAll('#app-messages .message-item');

          if (thread_el) {
            thread_el.style.display = 'none';
            items.forEach(item => item.style.display = 'flex');
            window.currentThreadId = null;
          }
        }

        // Setup thread input - called after fragments load
        function setupThreadInput() {
          const messageInput = document.getElementById('messageInput');
          if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter' && window.currentThreadId) {
                sendThreadMessage(window.currentThreadId, messageInput.value);
                messageInput.value = '';
              }
            });
          }
        }

        // Security: Protect critical functions from external modification
        function lockDownApp() {
          if (!window.AO3Security) return;

          // Make sensitive functions immutable
          const criticalFunctions = ['openThreadView', 'closeThreadView', 'sendThreadMessage',
                                    'displayThreadMessages', 'openModal', 'saveEvent', 'deleteEvent'];

          criticalFunctions.forEach(fnName => {
            if (typeof window[fnName] === 'function') {
              try {
                Object.freeze(window[fnName]);
              } catch (e) {
                // Function already protected or not available
              }
            }
          });

          console.log('🔒 Critical functions locked - modifications restricted');
        }

        // Execute lockdown after app fully initializes
        setTimeout(() => {
          lockDownApp();
        }, 3000);

        // ==================== PHONE APP ====================
        const phoneContacts = [
          { name: 'Akane Hatori', number: '+81 60-893-0568', avatar: 'AH', color: '#006c9b' },
          { name: 'Noisy Bee (Bachira)', number: '+81 80-8821-3091', avatar: 'NB', color: '#ffd900' },
          { name: 'Coach (Ichinan FC Youth)', number: '+81 90-1102-8841', avatar: 'C', color: '#e41818' },
          { name: 'Dabadie', number: '+34 612 89 40 11', avatar: 'Da', color: '#5c7c11' },
          { name: 'Dad', number: '+81 90-3312-0095', avatar: 'D', color: '#0a8789' },
          { name: 'Ego', number: '+81 30-0000-1101', avatar: 'E', color: '#212121' },
          { name: 'NPC (Isagi)', number: '+81 80-4419-2018', avatar: 'N', color: '#009a21' },
          { name: 'Miss Anri Teieri', number: '+81 30-5510-9923', avatar: 'A', color: '#ff6ccc' },
          { name: 'Mom', number: '+81 90-3312-0094', avatar: 'M', color: '#4cac98' },
          { name: 'Nanase', number: '+81 12-30-06363', avatar: 'Na', color: '#9370db' },
          { name: 'Seishiro Nagi', number: '+81 90-2201-0042', avatar: 'SN', color: '#bcbcbc' },
          { name: 'Pesky Cockroach (Shidou)', number: '+81 90-6669-1313', avatar: 'PC', color: '#ff009d' },
          { name: 'Reo Mikage', number: '+81 90-9999-7777', avatar: 'Re', color: '#a300bc' },
          { name: 'Shitty Aniki', number: '+34 698 07 41 81', avatar: 'S', color: '#834655' }
        ];

        function initializePhoneContacts() {
          const contactsContainer = document.getElementById('phoneContacts');
          if (!contactsContainer) return;

          contactsContainer.innerHTML = '<div style="padding: 12px;">';
          phoneContacts.forEach(contact => {
            const contactEl = document.createElement('div');
            contactEl.className = 'contact-row';
            contactEl.style.cssText = 'padding: 12px; border-bottom: 1px solid #333; cursor: pointer; display: flex; align-items: center; gap: 12px;';
            contactEl.innerHTML = `
              <div style="width: 40px; height: 40px; border-radius: 50%; background: ${contact.color}; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; flex-shrink: 0;">${contact.avatar}</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #fff;">${contact.name}</div>
                <div style="font-size: 12px; color: #aaa;">${contact.number}</div>
              </div>
              <button onclick="dialNumber('${contact.number}')" style="background: none; border: none; color: #00a896; font-size: 18px; cursor: pointer;">📞</button>
            `;
            contactsContainer.appendChild(contactEl);
          });
          contactsContainer.innerHTML += '</div>';
        }

        // Make dialNumber globally available
        window.dialNumber = function(number) {
          goToKeypadWithNumber(number);
        };

        // Recents call data lives in Apps/Calls.html as hidden .recent-call
        // blocks — parsed into this array once the fragment loads.
        let phoneRecents = [];

        function loadPhoneRecentsFromFragment() {
          const container = document.querySelector('#phoneRecents .recents-list');
          if (!container) return;
          phoneRecents = Array.from(container.querySelectorAll('.recent-call')).map(el => {
            const fullDate = new Date(el.dataset.datetime);
            return {
              name: el.dataset.name || '',
              number: el.dataset.number || '',
              type: el.dataset.type || 'incoming',
              callCount: parseInt(el.dataset.count, 10) || 1,
              audio: el.dataset.audio || '',
              fullDate,
              date: fullDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            };
          });
        }

        window.playCallRecording = function(index) {
          const call = phoneRecents[index];
          if (!call) return;
          if (!call.audio) {
            showToast('No recording available', 1200);
            return;
          }
          new Audio(call.audio).play().catch(() => showToast('Unable to play recording', 1200));
        };

        function initializeRecents() {
          loadPhoneRecentsFromFragment();
          const recentsContainer = document.querySelector('#phoneRecents .recents-list');
          if (!recentsContainer) return;

          // Group recents by date
          const grouped = {};
          phoneRecents.forEach((call, index) => {
            const dateKey = call.date;
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push({ ...call, index });
          });

          let html = '<div style="padding: 12px; color: #fff;">';

          // Render grouped by date (newest first)
          Object.keys(grouped).reverse().forEach(dateKey => {
            html += `<div style="color: #aaa; font-size: 12px; padding: 12px 0 8px 0; margin-top: 8px;">${dateKey}</div>`;

            grouped[dateKey].forEach(call => {
              const typeIcon = call.type === 'missed' ? '↙️' : call.type === 'outgoing' ? '↗️' : '↙️';
              const timeFormatted = call.fullDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              const callCountText = call.callCount > 1 ? ` (${call.callCount})` : '';

              html += `
                <div onclick="playCallRecording(${call.index})" style="padding: 12px; background: #1a1a1a; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; cursor: pointer;">
                  <div style="font-size: 18px;">${typeIcon}</div>
                  <div style="flex: 1;">
                    <div style="color: #fff; font-weight: 600;">${call.name}${callCountText}</div>
                    ${call.number ? `<div style="font-size: 12px; color: #aaa;">${call.number}</div>` : ''}
                  </div>
                  <div style="text-align: right; font-size: 12px; color: #aaa;">${timeFormatted}</div>
                </div>
              `;
            });
          });

          html += '</div>';
          recentsContainer.innerHTML = html;
        }

        // ==================== MUSIC APP ====================
        // Playlist data lives in Apps/Music.html as hidden .song-item
        // blocks — parsed into this array once the fragment loads.
        let playlistSongs = [];
        let currentSongAudio = null;
        let currentSongIndex = null;
        let currentSongIsYouTube = false;

        function loadPlaylistFromFragment() {
          const container = document.querySelector('#app-ytmusic .screen-body');
          if (!container) return;
          playlistSongs = Array.from(container.querySelectorAll('.song-item')).map(el => ({
            title: el.dataset.title || 'Untitled',
            artist: el.dataset.artist || '',
            duration: el.dataset.duration || '',
            cover: el.dataset.cover || '🎵',
            audio: el.dataset.audio || ''
          }));
        }

        // Accepts youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID —
        // with or without extra query params (like ?si=... share links add).
        function getYouTubeId(url) {
          const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{6,})/);
          return match ? match[1] : null;
        }

        function renderPlaylist() {
          const container = document.querySelector('#app-ytmusic .screen-body');
          if (!container) return;
          if (!playlistSongs.length) {
            container.innerHTML = '<div class="loading">No songs yet</div>';
            return;
          }
          container.innerHTML = '<div class="playlist-list">' + playlistSongs.map((song, i) => `
            <div class="playlist-row" data-index="${i}" onclick="toggleSongPlay(${i})">
              <div class="playlist-cover">${escapeHtml(song.cover)}</div>
              <div class="playlist-main">
                <div class="playlist-title">${escapeHtml(song.title)}</div>
                <div class="playlist-sub">${escapeHtml(song.artist)}${song.artist && song.duration ? ' • ' : ''}${escapeHtml(song.duration)}</div>
              </div>
              <div class="playlist-toggle">▶️</div>
            </div>
          `).join('') + '</div>' +
            '<div class="playlist-yt-wrap" id="playlistYtWrap" style="display:none;"><iframe id="playlistYtFrame" width="100%" height="180" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>';
        }

        function initializeMusicPlayer() {
          loadPlaylistFromFragment();
          renderPlaylist();
        }

        function setPlaylistRowIcon(index, icon) {
          const row = document.querySelector(`#app-ytmusic .playlist-row[data-index="${index}"]`);
          if (!row) return;
          row.classList.toggle('playing', icon === '⏸️');
          const toggle = row.querySelector('.playlist-toggle');
          if (toggle) toggle.textContent = icon;
        }

        function stopCurrentSong() {
          if (currentSongIndex === null) return;
          setPlaylistRowIcon(currentSongIndex, '▶️');
          if (currentSongIsYouTube) {
            const frame = document.getElementById('playlistYtFrame');
            const wrap = document.getElementById('playlistYtWrap');
            if (frame) frame.src = '';
            if (wrap) wrap.style.display = 'none';
          } else if (currentSongAudio) {
            currentSongAudio.pause();
          }
          currentSongAudio = null;
          currentSongIndex = null;
          currentSongIsYouTube = false;
        }

        window.toggleSongPlay = function(index) {
          const song = playlistSongs[index];
          if (!song) return;

          if (currentSongIndex === index) {
            stopCurrentSong();
            return;
          }

          if (!song.audio) {
            showToast('No audio linked yet', 1200);
            return;
          }

          stopCurrentSong();

          const youtubeId = getYouTubeId(song.audio);
          if (youtubeId) {
            const frame = document.getElementById('playlistYtFrame');
            const wrap = document.getElementById('playlistYtWrap');
            const row = document.querySelector(`#app-ytmusic .playlist-row[data-index="${index}"]`);
            if (!frame || !wrap) return;
            if (row) row.insertAdjacentElement('afterend', wrap);
            frame.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;
            wrap.style.display = 'block';
            currentSongIndex = index;
            currentSongIsYouTube = true;
            setPlaylistRowIcon(index, '⏸️');
            wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
          }

          currentSongAudio = new Audio(song.audio);
          currentSongIndex = index;
          currentSongIsYouTube = false;
          setPlaylistRowIcon(index, '⏸️');
          currentSongAudio.addEventListener('ended', () => {
            setPlaylistRowIcon(index, '▶️');
            currentSongAudio = null;
            currentSongIndex = null;
          });
          currentSongAudio.play().catch(() => {
            showToast('Unable to play song', 1200);
            setPlaylistRowIcon(index, '▶️');
            currentSongAudio = null;
            currentSongIndex = null;
          });
        };

        // ==================== CLOCK / ALARM APP ====================
        const ALARM_DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

        function initializeClock() {
          const list = document.getElementById('alarmList');
          if (!list) return;
          if (list._clockInitialized) { renderAlarmCountdown(); return; }
          list._clockInitialized = true;

          const items = Array.from(list.querySelectorAll('.alarm-item'));
          items.forEach(item => renderAlarmItem(item));

          renderAlarmCountdown();
          setInterval(renderAlarmCountdown, 30000);

          const dayEls = document.querySelectorAll('#alarmEditorDays .editor-day');
          dayEls.forEach(el => el.addEventListener('click', () => el.classList.toggle('on')));
        }

        // ---- Add-alarm editor (session-only: nothing is persisted, so a
        // refresh wipes any alarms the user creates here) ----
        const TIME_WHEEL_ITEM_HEIGHT = 56;

        function buildTimeWheel(el, values, defaultIndex) {
          el.innerHTML = '';
          el._values = values;

          const topPad = document.createElement('div');
          topPad.className = 'time-wheel-pad';
          el.appendChild(topPad);

          values.forEach(v => {
            const item = document.createElement('div');
            item.className = 'time-wheel-item';
            item.textContent = v;
            el.appendChild(item);
          });

          const bottomPad = document.createElement('div');
          bottomPad.className = 'time-wheel-pad';
          el.appendChild(bottomPad);

          el.onscroll = () => {
            clearTimeout(el._scrollTimeout);
            el._scrollTimeout = setTimeout(() => snapWheel(el), 100);
          };

          el.scrollTop = defaultIndex * TIME_WHEEL_ITEM_HEIGHT;
          updateWheelActive(el, defaultIndex);
        }

        function snapWheel(el) {
          const index = Math.round(el.scrollTop / TIME_WHEEL_ITEM_HEIGHT);
          el.scrollTo({ top: index * TIME_WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
          updateWheelActive(el, index);
        }

        function updateWheelActive(el, index) {
          const items = el.querySelectorAll('.time-wheel-item');
          const clamped = Math.min(Math.max(index, 0), items.length - 1);
          items.forEach((it, i) => it.classList.toggle('active', i === clamped));
          el._selectedIndex = clamped;
        }

        function getWheelValue(el) {
          return el._values[el._selectedIndex || 0];
        }

        function selectAmPm(btn) {
          btn.parentElement.querySelectorAll('.ampm-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        window.selectAmPm = selectAmPm;

        function openAlarmEditor() {
          const overlay = document.getElementById('alarmEditorOverlay');
          if (!overlay) return;

          const hourValues = Array.from({ length: 12 }, (_, i) => String(i + 1));
          const minuteValues = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
          buildTimeWheel(document.getElementById('hourWheel'), hourValues, 5);
          buildTimeWheel(document.getElementById('minuteWheel'), minuteValues, 0);

          document.querySelectorAll('.ampm-btn').forEach(b => b.classList.toggle('active', b.dataset.val === 'AM'));
          document.querySelectorAll('#alarmEditorDays .editor-day').forEach(d => d.classList.remove('on'));
          document.getElementById('alarmEditorName').value = '';

          overlay.style.display = 'flex';
        }
        window.openAlarmEditor = openAlarmEditor;

        function closeAlarmEditor() {
          const overlay = document.getElementById('alarmEditorOverlay');
          if (overlay) overlay.style.display = 'none';
        }
        window.closeAlarmEditor = closeAlarmEditor;

        function saveNewAlarm() {
          const hourWheel = document.getElementById('hourWheel');
          const minuteWheel = document.getElementById('minuteWheel');
          const hour12 = parseInt(getWheelValue(hourWheel), 10);
          const minute = getWheelValue(minuteWheel);
          const ampm = document.querySelector('.ampm-btn.active')?.dataset.val || 'AM';

          let hour24 = hour12 % 12;
          if (ampm === 'PM') hour24 += 12;
          const timeStr = String(hour24).padStart(2, '0') + ':' + minute;

          const selectedDays = Array.from(document.querySelectorAll('#alarmEditorDays .editor-day.on'))
            .map(d => d.dataset.letter)
            .join('');

          const name = document.getElementById('alarmEditorName').value.trim();

          const item = document.createElement('div');
          item.className = 'alarm-item';
          item.dataset.time = timeStr;
          item.dataset.enabled = 'true';
          if (name) item.dataset.label = name;
          if (selectedDays) {
            item.dataset.days = selectedDays;
          } else {
            const now = new Date();
            item.dataset.date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          }

          document.getElementById('alarmList').appendChild(item);
          renderAlarmItem(item);
          renderAlarmCountdown();
          closeAlarmEditor();
        }
        window.saveNewAlarm = saveNewAlarm;

        function renderAlarmItem(item) {
          const time = item.dataset.time || '00:00';
          const [hh, mm] = time.split(':').map(Number);
          const ampm = hh >= 12 ? 'PM' : 'AM';
          const hour12 = ((hh % 12) === 0) ? 12 : (hh % 12);
          const enabled = item.dataset.enabled !== 'false';

          let scheduleHtml = '';
          if (item.dataset.date === 'Everyday') {
            scheduleHtml = `<div class="alarm-item-date">Everyday</div>`;
          } else if (item.dataset.date) {
            scheduleHtml = `<div class="alarm-item-date">${item.dataset.date}</div>`;
          } else {
            const activeDays = (item.dataset.days || '').toUpperCase();
            const daySpans = ALARM_DAY_LETTERS.map((letter) => {
              const isOn = activeDays.includes(letter);
              return `<span class="day${isOn ? ' on' : ''}">${letter}</span>`;
            }).join('');
            scheduleHtml = `<div class="alarm-item-days">${daySpans}</div>`;
          }

          item.classList.toggle('disabled', !enabled);
          item.innerHTML = `
            <div class="alarm-item-main">
              <div class="alarm-item-time">${hour12}:${String(mm).padStart(2, '0')}<span class="ampm">${ampm}</span></div>
              ${item.dataset.label ? `<div class="alarm-item-label">${item.dataset.label}</div>` : ''}
              ${scheduleHtml}
            </div>
            <label class="alarm-toggle">
              <input type="checkbox" ${enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          `;

          const checkbox = item.querySelector('.alarm-toggle input');
          checkbox.addEventListener('change', () => {
            item.dataset.enabled = checkbox.checked ? 'true' : 'false';
            item.classList.toggle('disabled', !checkbox.checked);
            renderAlarmCountdown();
          });
        }

        function renderAlarmCountdown() {
          const list = document.getElementById('alarmList');
          const mainEl = document.getElementById('alarmCountdownText');
          const subEl = document.getElementById('alarmCountdownDate');
          if (!list || !mainEl || !subEl) return;

          const items = Array.from(list.querySelectorAll('.alarm-item')).filter(i => i.dataset.enabled !== 'false');
          if (!items.length) {
            mainEl.textContent = 'No alarms set';
            subEl.textContent = '';
            return;
          }

          const now = new Date();
          let soonest = null;

          items.forEach(item => {
            const [hh, mm] = (item.dataset.time || '00:00').split(':').map(Number);
            let candidate;
            if (item.dataset.date) {
              // One-time alarms: parse "Fri, Aug 14" against the current year
              const parsed = new Date(`${item.dataset.date} ${now.getFullYear()} ${hh}:${mm}:00`);
              candidate = isNaN(parsed.getTime()) ? null : parsed;
            } else {
              candidate = new Date(now);
              candidate.setHours(hh, mm, 0, 0);
              if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
            }
            if (candidate && candidate > now && (!soonest || candidate < soonest)) {
              soonest = candidate;
            }
          });

          if (!soonest) {
            mainEl.textContent = 'No alarms set';
            subEl.textContent = '';
            return;
          }

          const diffMs = soonest - now;
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);
          mainEl.textContent = `Alarm in ${diffHours} hour${diffHours !== 1 ? 's' : ''} ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
          subEl.textContent = soonest.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        }

        // ==================== CAMERA APP ====================
        let cameraMode = 'back';
        let cameraIndex = 0;
        let cameraStream = null;
        let selfiePhotos = [];
        let shuffledPhotos = [];
        let shufflePosition = 0;
        let previousPhotoUrl = '';

        function loadSelfiePhotos() {
          const container = document.querySelector('#app-camera .screen-body');
          if (!container) return;
          selfiePhotos = Array.from(container.querySelectorAll('.selfie-photo'))
            .map(el => el.dataset.url)
            .filter(url => url && url.trim());
          shufflePhotos();
        }

        function shufflePhotos() {
          shuffledPhotos = [...selfiePhotos].sort(() => Math.random() - 0.5);
          shufflePosition = 0;
        }

        function getNextShuffledPhoto() {
          if (shuffledPhotos.length === 0) return 0;
          if (shufflePosition >= shuffledPhotos.length) {
            shufflePhotos();
          }
          const photoUrl = shuffledPhotos[shufflePosition];
          const photoIndex = selfiePhotos.indexOf(photoUrl);
          shufflePosition++;
          return photoIndex >= 0 ? photoIndex : 0;
        }

        function closeCameraStream() {
          if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
          }
          stopVideo();
          const overlay = document.getElementById('videoGalleryOverlay');
          if (overlay) {
            overlay.classList.remove('active');
          }
        }

        function initializeCamera() {
          loadSelfiePhotos();
          setupVideoGallery();
          setupCameraFeed();
        }

        function setupCameraFeed() {
          let video = document.getElementById('cameraVideo');
          let img = document.getElementById('cameraImage');
          let placeholder = document.getElementById('cameraPlaceholder');
          let captureBtn = document.getElementById('cameraCapture');
          let flipBtn = document.getElementById('cameraFlip');
          const modeLabel = document.getElementById('cameraModeLabel');

          if (!captureBtn) return;

          // Clone buttons to remove old event listeners
          if (flipBtn) {
            const newFlipBtn = flipBtn.cloneNode(true);
            flipBtn.parentNode.replaceChild(newFlipBtn, flipBtn);
            flipBtn = newFlipBtn;
          }
          if (captureBtn) {
            const newCaptureBtn = captureBtn.cloneNode(true);
            captureBtn.parentNode.replaceChild(newCaptureBtn, captureBtn);
            captureBtn = newCaptureBtn;
          }

          // Set initial display
          updateCameraDisplay();

          // Flip button switches camera mode
          if (flipBtn) {
            flipBtn.addEventListener('click', () => {
              cameraMode = cameraMode === 'selfie' ? 'back' : 'selfie';
              if (cameraMode === 'selfie' && selfiePhotos.length > 0) {
                cameraIndex = getNextShuffledPhoto();
              } else {
                cameraIndex = 0;
              }
              previousPhotoUrl = '';
              closeCameraStream();
              updateCameraDisplay();
            });
          }

          // Capture button cycles through shuffled photos in selfie mode
          captureBtn.addEventListener('click', () => {
            if (cameraMode === 'selfie' && selfiePhotos.length > 0) {
              cameraIndex = getNextShuffledPhoto();
              updateCameraDisplay();
            }
          });
        }

        function updateCameraDisplay() {
          const video = document.getElementById('cameraVideo');
          const img = document.getElementById('cameraImage');
          const placeholder = document.getElementById('cameraPlaceholder');
          const modeLabel = document.getElementById('cameraModeLabel');
          const thumbnail = document.getElementById('cameraThumbnail');
          const display = document.getElementById('cameraDisplay');

          if (cameraMode === 'selfie') {
            // Selfie mode: show shuffled photos
            if (modeLabel) modeLabel.textContent = 'Selfie Mode';
            if (display) display.textContent = '🤳';
            if (video) video.style.display = 'none';
            if (img) img.style.display = 'none';
            closeCameraStream();

            // Remove notification badge in selfie mode
            if (thumbnail) {
              const notificationBadge = thumbnail.querySelector('.thumbnail-notification');
              if (notificationBadge) notificationBadge.remove();
            }

            if (selfiePhotos.length > 0) {
              const photoUrl = selfiePhotos[cameraIndex];
              if (img) {
                img.src = photoUrl;
                img.style.display = 'block';
              }
              if (placeholder) placeholder.style.display = 'none';

              // Thumbnail shows previous photo
              if (thumbnail) {
                if (previousPhotoUrl) {
                  thumbnail.style.backgroundImage = `url('${previousPhotoUrl}')`;
                  thumbnail.style.backgroundSize = 'cover';
                  thumbnail.style.backgroundPosition = 'center';
                } else {
                  thumbnail.style.backgroundImage = 'none';
                }
              }

              previousPhotoUrl = photoUrl;
            } else {
              if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.textContent = '📷\nNo photos linked';
              }
              if (img) img.style.display = 'none';
              if (thumbnail) thumbnail.style.backgroundImage = 'none';
            }
          } else {
            // Capture mode: real camera
            if (modeLabel) modeLabel.textContent = 'Capture Mode';
            if (display) display.textContent = '📷';
            if (placeholder) placeholder.style.display = 'none';
            if (img) img.style.display = 'none';
            if (video) video.style.display = 'block';
            if (thumbnail) {
              thumbnail.style.backgroundImage = 'none';

              // Add notification badge in capture mode
              if (window.appNotifications && window.appNotifications['camera']) {
                let notificationBadge = thumbnail.querySelector('.thumbnail-notification');
                if (!notificationBadge) {
                  notificationBadge = document.createElement('div');
                  notificationBadge.className = 'thumbnail-notification';
                  notificationBadge.style.position = 'absolute';
                  notificationBadge.style.top = '5px';
                  notificationBadge.style.right = '5px';
                  notificationBadge.style.background = '#ff4444';
                  notificationBadge.style.color = '#fff';
                  notificationBadge.style.borderRadius = '50%';
                  notificationBadge.style.width = '20px';
                  notificationBadge.style.height = '20px';
                  notificationBadge.style.display = 'flex';
                  notificationBadge.style.alignItems = 'center';
                  notificationBadge.style.justifyContent = 'center';
                  notificationBadge.style.fontSize = '12px';
                  notificationBadge.style.fontWeight = 'bold';
                  notificationBadge.textContent = '!';
                  thumbnail.style.position = 'relative';
                  thumbnail.appendChild(notificationBadge);
                  
                  // Remove notification badge after 10 seconds
                  setTimeout(() => {
                    if (notificationBadge) notificationBadge.remove();
                  }, 10000);
                }
              } else {
                const notificationBadge = thumbnail.querySelector('.thumbnail-notification');
                if (notificationBadge) notificationBadge.remove();
              }
            }

            closeCameraStream();
            navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user' },
              audio: false
            }).then(stream => {
              cameraStream = stream;
              if (video) video.srcObject = stream;
            }).catch(err => {
              console.warn('Camera access denied:', err.message);
              if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.textContent = '📷\nCamera access denied';
              }
            });
          }
        }

        // ==================== VIDEO GALLERY ====================
        let videoFiles = [];
        let currentVideoIndex = 0;
        window.videoGalleryUnlocked = false;

        function loadVideoFiles() {
          const container = document.querySelector('#app-camera .screen-body');
          if (!container) return;
          videoFiles = Array.from(container.querySelectorAll('.video-file'))
            .map(el => el.dataset.url)
            .filter(url => url && url.trim());
        }

        function setupVideoGallery() {
          loadVideoFiles();
          const thumbnail = document.getElementById('cameraThumbnail');
          const overlay = document.getElementById('videoGalleryOverlay');
          const backBtn = document.getElementById('videoGalleryBack');
          const swipeLeft = document.getElementById('swipeLeft');
          const swipeRight = document.getElementById('swipeRight');

          if (thumbnail) {
            thumbnail.addEventListener('click', () => {
              if (videoFiles.length === 0 || !window.videoGalleryUnlocked || cameraMode !== 'back') return;
              showVideoGallery();
            });
          }

          if (backBtn) {
            backBtn.addEventListener('click', () => {
              stopVideo();
              overlay.classList.remove('active');
            });
          }

          if (swipeLeft) {
            swipeLeft.addEventListener('click', () => {
              currentVideoIndex = (currentVideoIndex - 1 + videoFiles.length) % videoFiles.length;
              displayCurrentVideo();
            });
          }

          if (swipeRight) {
            swipeRight.addEventListener('click', () => {
              currentVideoIndex = (currentVideoIndex + 1) % videoFiles.length;
              displayCurrentVideo();
            });
          }

        }

        function showVideoGallery() {
          const overlay = document.getElementById('videoGalleryOverlay');
          currentVideoIndex = 0;
          displayCurrentVideo();
          overlay.classList.add('active');
        }

        function displayCurrentVideo() {
          const video = document.getElementById('galleryVideo');
          const counter = document.getElementById('videoCounter');
          if (video && videoFiles[currentVideoIndex]) {
            video.src = videoFiles[currentVideoIndex];
            video.play().catch(() => {});
          }
          if (counter) {
            counter.textContent = `${currentVideoIndex + 1} / ${videoFiles.length}`;
          }
        }

        function stopVideo() {
          const video = document.getElementById('galleryVideo');
          if (video) {
            video.pause();
            video.src = '';
          }
        }

        function showPinOverlay() {
          const pinOverlay = document.getElementById('pinUnlockOverlay');
          pinInput = '';
          updatePinDisplay();
          pinOverlay.classList.add('active');
        }

        function setupPinKeypad() {
          const keypad = document.getElementById('pinKeypad');
          if (!keypad) return;

          for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.className = 'pin-key';
            btn.textContent = i;
            btn.addEventListener('click', () => addPinDigit(i));
            keypad.appendChild(btn);
          }

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'pin-key';
          deleteBtn.textContent = '⌫';
          deleteBtn.addEventListener('click', deletePinDigit);
          keypad.appendChild(deleteBtn);

          const zeroBtn = document.createElement('button');
          zeroBtn.className = 'pin-key';
          zeroBtn.textContent = '0';
          zeroBtn.addEventListener('click', () => addPinDigit(0));
          keypad.appendChild(zeroBtn);

          const okBtn = document.createElement('button');
          okBtn.className = 'pin-key';
          okBtn.textContent = '✓';
          okBtn.addEventListener('click', checkPin);
          keypad.appendChild(okBtn);
        }

        let pinInput = '';

        function addPinDigit(digit) {
          if (pinInput.length < 3) {
            pinInput += digit;
            updatePinDisplay();
          }
        }

        function deletePinDigit() {
          pinInput = pinInput.slice(0, -1);
          updatePinDisplay();
        }

        function updatePinDisplay() {
          const display = document.getElementById('pinDisplay');
          if (display) {
            display.textContent = pinInput.padEnd(3, '●').split('').join('');
          }
        }

        function checkPin() {
          if (pinInput === '543') {
            window.videoGalleryUnlocked = true;
            document.getElementById('pinUnlockOverlay').classList.remove('active');
            showVideoGallery();
          } else {
            pinInput = '';
            updatePinDisplay();
          }
        }
