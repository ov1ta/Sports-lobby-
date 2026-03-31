const CACHE = 'private-lobby-v2';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for assets, network-first for navigation
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Notification from main thread
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'class-alert',
      renotify: true,
    });
  }
});

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});

// Periodic background sync
self.addEventListener('periodicsync', e => {
  if (e.tag === 'class-check') e.waitUntil(bgCheck());
});

async function bgCheck() {
  const TIMETABLE = {
    Monday:    [{ start:'10:00',code:'STA 213',course:'Economic & Social Statistics I',room:'C5'},{ start:'14:00',code:'STA 213P',course:'Eco Social Stats Practical',room:'NASB 0-8'}],
    Tuesday:   [{ start:'08:00',code:'STA 211',course:'Statistical Theory II',room:'C5'},{ start:'10:00',code:'STA 212',course:'Elements of Sampling Theory',room:'C5'},{ start:'13:00',code:'STA 214',course:'Industrial Statistics I',room:'C5'},{ start:'15:00',code:'GNS 201',course:'General Studies 201',room:'C5'}],
    Wednesday: [{ start:'08:00',code:'STA 214P',course:'Industrial Stats Practical',room:'NASB 0-9'},{ start:'10:00',code:'EED 216',course:'Practice of Entrepreneurship',room:'C5'},{ start:'13:00',code:'MTH 212',course:'Calculus II',room:'C5'},{ start:'15:00',code:'STA 212P',course:'Sampling Theory Practical',room:'NASB 0-8'}],
    Thursday:  [{ start:'08:00',code:'COM 215',course:'Computer Packages II',room:'C5'},{ start:'14:00',code:'STA 212P',course:'Sampling Theory Practical',room:'NASB 0-8'}],
    Friday:    [{ start:'10:00',code:'MTH 213',course:'Linear Algebra',room:'C5'}],
  };
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const now=new Date(), dayN=days[now.getDay()], slots=TIMETABLE[dayN];
  if (!slots) return;
  const curMin=now.getHours()*60+now.getMinutes();
  for (const s of slots) {
    const [sh,sm]=s.start.split(':').map(Number);
    const sMin=sh*60+sm, diff=sMin-curMin;
    if (diff>0 && diff<=10) {
      await self.registration.showNotification(`⏰ Class in ${diff} min!`,{
        body:`${s.code} — ${s.course} @ ${s.room}`,
        icon:'/icon-192.png', vibrate:[200,100,200], tag:'cls-'+s.code,
      });
    }
  }
}
