// Water Tracker – app.js (v3: canvas wave, bottom rail, multi reminders, light history)
(function () {
  'use strict';
    
  const gaugeCenter = document.querySelector('.gauge-center');

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEYS = {
    SETTINGS: 'wt_settings',
    TODAY: () => 'wt_day_' + new Date().toISOString().slice(0,10),
    HISTORY: () => 'wt_history_' + new Date().toISOString().slice(0,10),
    REMINDER_SENT_PREFIX: () => 'wt_reminder_sent_' + new Date().toISOString().slice(0,10) + '_'
  };

  function load(k, fallback){ try{ const s = localStorage.getItem(k); return s ? JSON.parse(s) : fallback; } catch(_){ return fallback; } }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  const defaults = {
    goalMl: 2000,
    profiles: [
      { id: rnd(), name:'Gorgée', ml:100, icon:'mouth' },
      { id: rnd(), name:'Verre', ml:250, icon:'glass' },
      { id: rnd(), name:'Tasse', ml:300, icon:'mug' },
      { id: rnd(), name:'Bouteille', ml:750, icon:'bottle' },
    ],
    reminders: [
      { id: rnd(), amountMl: 500, time: '09:00' },
      { id: rnd(), amountMl: 1200, time: '12:00' }
    ]
  };

  function rnd(){ return Math.random().toString(36).slice(2, 9); }

  let settings = load(STORAGE_KEYS.SETTINGS, defaults);
  let consumed = load(STORAGE_KEYS.TODAY(), 0);
  let history = load(STORAGE_KEYS.HISTORY(), []);

  // UI refs
  const openSettingsBtn = $('#openSettingsBtn');
  const settingsDialog = $('#settingsDialog');

  const progressText = $('#progressText');
  const percentText = $('#percentText');
  const canvas = $('#gaugeCanvas');

  const profilesRail = $('#profilesRail');
  const manageBtn = $('#manageProfilesBtn');
  const addProfileBtn = $('#addProfileBtn');

  const goalInput = $('#goalInput');
  const saveGoalBtn = $('#saveGoalBtn');

  const newReminderAmount = $('#newReminderAmount');
  const newReminderTime = $('#newReminderTime');
  const addReminderBtn = $('#addReminderBtn');
  const remindersList = $('#remindersList');
  const enableNotifBtn = $('#enableNotifBtn');

  const profileDialog = $('#profileDialog');
  const profileForm = $('#profileForm');
  const profileId = $('#profileId');
  const profileName = $('#profileName');
  const profileMl = $('#profileMl');
  const profileIcon = $('#profileIcon');
  const manageDialog = $('#manageDialog');
  const manageList = $('#manageList');

  const historyList = $('#historyList');
  const undoBtn = $('#undoBtn');
  const resetDayBtn = $('#resetDayBtn');

  // Canvas wave state
  let ctx, W, H, DPR, animId;
  let t = 0;
  let levelTarget = 0; // 0..1
  let levelCurrent = 0;

  function init(){
    goalInput.value = settings.goalMl;

    renderProfiles();
    renderProgress(true);
    renderHistory();
    renderReminders();

    // events
    openSettingsBtn.addEventListener('click', () => settingsDialog.showModal());

    saveGoalBtn.addEventListener('click', onSaveGoal);
    addProfileBtn?.addEventListener('click', () => openProfileDialog());
    manageBtn?.addEventListener('click', () => openManageDialog());

    addReminderBtn.addEventListener('click', onAddReminder);
    enableNotifBtn.addEventListener('click', requestNotificationPermission);

    undoBtn.addEventListener('click', undoLast);
    resetDayBtn.addEventListener('click', resetDayConfirm);

    // PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./serviceworker.js');
    }

    // Reminder on focus
    window.addEventListener('focus', checkRemindersOnLaunch);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkRemindersOnLaunch();
    });

    // Canvas init and resize
    initCanvas();
    window.addEventListener('resize', initCanvas, { passive: true });
  }

  function initCanvas(){
    // Setup canvas scaled for DPR
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    W = Math.max(300, Math.floor(rect.width * DPR));
    H = Math.max(300, Math.floor(rect.height * DPR));
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cancelAnimationFrame(animId);
    animate();
  }

  // Smooth animation loop
  function animate(){
    animId = requestAnimationFrame(animate);
    t += 0.018; // speed
    levelCurrent += (levelTarget - levelCurrent) * 0.06; // ease
    drawGauge(levelCurrent);
  }

  function drawGauge(level){
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;

    ctx.clearRect(0, 0, w, h);

    // water surface level
    const waterTop = h * (1 - level * 0.93);

    const grad = ctx.createLinearGradient(0, waterTop-60, 0, h);
    grad.addColorStop(0, '#1ac4ff');
    grad.addColorStop(1, '#0a6bff');

    const amp = Math.max(8, Math.min(26, h * 0.035));
    const waveLen = Math.max(180, Math.min(420, w * 0.7));
    const offset = (t * 60) % (waveLen * 2);

    // main wave
    ctx.beginPath();
    ctx.moveTo(0, waterTop);
    const step = 2;
    for (let x = 0; x <= w + step; x += step){
      const y = waterTop + Math.sin((x + offset) / waveLen * Math.PI * 2) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // secondary wave
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    const offset2 = (t * 40) % (waveLen * 2);
    for (let x = -step; x <= w + step; x += step){
      const y = waterTop + Math.cos((x + offset2) / (waveLen*0.9) * Math.PI * 2) * (amp*0.7) + 8;
      if (x === -step) ctx.moveTo(0, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Rendering
    function renderProgress(first=false){
        const goal = Math.max(1, settings.goalMl);
        const pct = Math.min(100, Math.round(consumed / goal * 100));

        progressText.textContent = `${consumed} / ${goal} ml`;
        percentText.textContent = `${pct}%`;

        // --- NOUVEAU : texte blanc à partir de 42% ---
        if (pct >= 42) {
            gaugeCenter.classList.add('on-water');
        } else {
            gaugeCenter.classList.remove('on-water');
        }

        levelTarget = pct / 100;
        if (first) levelCurrent = levelTarget;
    }


  function renderProfiles(){
    profilesRail.innerHTML = '';
    settings.profiles.forEach(p => {
      const item = document.createElement('button');
      item.className = 'rail-item';
      item.title = `Ajouter ${p.ml} ml`;
      item.innerHTML = `<span class="icon">${iconFor(p.icon)}</span>
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="ml">${p.ml} ml</span>`;
      item.addEventListener('click', () => addIntake(p.ml, p));
      profilesRail.appendChild(item);
    });
  }

  function renderHistory(){
    historyList.innerHTML = '';
    history.slice(-3).reverse().forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="icon">${iconFor(item.icon || 'glass')}</span>
        <b>${item.ml} ml</b>
        <span class="muted">${escapeHtml(item.name || 'Ajout')}</span>
        <span class="when">${new Date(item.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>`;
      historyList.appendChild(li);
    });
  }

  function renderReminders(){
    remindersList.innerHTML = '';
    if (!settings.reminders || !settings.reminders.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = "Aucun rappel — ajoutez une règle ci‑dessous.";
      remindersList.appendChild(empty);
      return;
    }
    settings.reminders.forEach(rule => {
      const row = document.createElement('div');
      row.className = 'rule';
      row.innerHTML = `
				<div class="line1">
					<b>${rule.amountMl} ml</b> avant <b>${rule.time}</b>
				</div>
				<div class="line2">
					<button class="btn small ghost del" data-id="${rule.id}">Supprimer</button>
				</div>
			`;
      row.querySelector('.del').addEventListener('click', () => {
        settings.reminders = settings.reminders.filter(r => r.id !== rule.id);
        save(STORAGE_KEYS.SETTINGS, settings);
        renderReminders();
      });
      remindersList.appendChild(row);
    });
  }

  // Profiles CRUD
  function openProfileDialog(p){
    $('#profileDialogTitle').textContent = p ? 'Modifier le profil' : 'Nouveau profil';
    profileId.value = p ? p.id : '';
    profileName.value = p ? p.name : '';
    profileMl.value = p ? p.ml : '';
    profileIcon.value = p ? p.icon : 'glass';
    profileDialog.showModal();
  }
  $('#saveProfileBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const id = profileId.value || rnd();
    const name = profileName.value.trim();
    const ml = parseInt(profileMl.value, 10);
    const ic = profileIcon.value;
    if (!name || !ml || ml<=0) return;
    const idx = settings.profiles.findIndex(p => p.id === id);
    const newObj = { id, name, ml, icon: ic };
    if (idx >= 0) settings.profiles[idx] = newObj; else settings.profiles.push(newObj);
    save(STORAGE_KEYS.SETTINGS, settings);
    renderProfiles();
    profileDialog.close();
  });
  function openManageDialog(){
    manageList.innerHTML = '';
    settings.profiles.forEach(p => {
      const row = document.createElement('div');
      row.className = 'profile';
      row.innerHTML = `
        <span class="icon">${iconFor(p.icon)}</span>
        <div class="info"><div class="name">${escapeHtml(p.name)}</div><div class="ml">${p.ml} ml</div></div>
        <div class="actions">
          <button class="btn small outline edit">Éditer</button>
          <button class="btn small ghost del">Supprimer</button>
        </div>`;
      row.querySelector('.edit').addEventListener('click', () => { openProfileDialog(p); });
      row.querySelector('.del').addEventListener('click', () => { deleteProfile(p.id); });
      manageList.appendChild(row);
    });
    $('#manageDialog').showModal();
  }
  function deleteProfile(id){
    settings.profiles = settings.profiles.filter(p => p.id !== id);
    save(STORAGE_KEYS.SETTINGS, settings);
    renderProfiles();
    openManageDialog();
  }

  // Goal & reminders
  function onSaveGoal(){
    const val = parseInt(goalInput.value, 10);
    if (!val || val < 100) return;
    settings.goalMl = val; save(STORAGE_KEYS.SETTINGS, settings);
    renderProgress();
  }
  function onAddReminder(e){
    e.preventDefault();
    const amount = parseInt(newReminderAmount.value, 10);
    const time = newReminderTime.value || '09:00';
    if (!amount || amount <= 0) return;
    settings.reminders = settings.reminders || [];
    settings.reminders.push({ id: rnd(), amountMl: amount, time });
    save(STORAGE_KEYS.SETTINGS, settings);
    renderReminders();
  }

  async function requestNotificationPermission(){
    if (!('Notification' in window)) { alert('Notifications non supportées'); return; }
    await Notification.requestPermission();
  }

  function parseTimeToToday(timeStr){
    const [hh, mm] = (timeStr || '10:00').split(':').map(n => parseInt(n, 10));
    const d = new Date(); d.setHours(hh||10, mm||0, 0, 0);
    return d;
  }	
  async function checkRemindersOnLaunch(){
    try{
      if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      if (!settings.reminders || !settings.reminders.length) return;

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      const prefix = STORAGE_KEYS.REMINDER_SENT_PREFIX();
      const now = new Date();

      for (const rule of settings.reminders){
        const k = prefix + rule.id;
        if (localStorage.getItem(k)) continue; // already sent this rule today
        const cutoff = parseTimeToToday(rule.time);
        if (now >= cutoff && consumed < rule.amountMl){
          reg.showNotification('Hydratation 💧', {
            body: `Vous avez bu ${consumed} ml. Palier: ${rule.amountMl} ml avant ${rule.time}.`,
            icon: './resources/imgs/icon-192.png',
            badge: './resources/imgs/icon-192.png',
            tag: 'water-reminder-' + rule.id,
            vibrate: [80, 20, 80]
          });
          localStorage.setItem(k, '1');
        }
      }
    }catch(e){ /* ignore */ }
  }

  // Intake & history
  function addIntake(ml, srcProfile){
    ml = parseInt(ml, 10); if (!ml || ml<=0) return;
    consumed = Math.max(0, consumed + ml);
    save(STORAGE_KEYS.TODAY(), consumed);
    history.push({ ml, name: srcProfile?.name || 'Ajout', icon: srcProfile?.icon, at: Date.now() });
    save(STORAGE_KEYS.HISTORY(), history);
    renderHistory(); renderProgress();
  }
  function undoLast(){
    const item = history.pop(); if (!item) return;
    consumed = Math.max(0, consumed - item.ml);
    save(STORAGE_KEYS.TODAY(), consumed); save(STORAGE_KEYS.HISTORY(), history);
    renderHistory(); renderProgress();
  }
  function resetDayConfirm(){
    if (!confirm("Réinitialiser la consommation et l'historique du jour ?")) return;
    consumed = 0; history = [];
    save(STORAGE_KEYS.TODAY(), consumed); save(STORAGE_KEYS.HISTORY(), history);
    const prefix = STORAGE_KEYS.REMINDER_SENT_PREFIX();
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
    renderHistory(); renderProgress();
  }

  // Utils
  function escapeHtml(str){ return (str||'').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }
  function iconFor(name){
    switch(name){
      case 'mouth': return '🙂';
      case 'glass': return '🥛';
      case 'mug': return '☕';
      case 'bottle': return '🧴';
      default: return '💧';
    }
  }

  init();
})();
