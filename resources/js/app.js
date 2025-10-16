// CLASS
class SlideTracker {
  /**
 * Tracks slide gestures on a given HTML element.
 * Locks the gesture to either the X or Y axis and reports the
 * axis and signed distance on each movement tick.
 */

  /**
   * @param {HTMLElement} element The element to listen for events on.
   * @param {function(object): void} onTick The callback function.
   * @param {object} [options] Optional configuration.
   * @param {number} [options.axisLockThreshold=10] The number of pixels to move before locking the axis.
   */
  constructor(element, onTick, options = {}) {
    if (!element || typeof onTick !== 'function') {
      console.error("SlideTracker requires a valid HTML element and an onTick callback function.");
      return;
    }

    this.element = element;
    this.onTick = onTick;
    this.axisLockThreshold = options.axisLockThreshold || 10; // Pixels

    this.isSliding = false;
    this.startX = 0;
    this.startY = 0;
    this.lockedAxis = null; // Will be 'x', 'y', or null

    // Bind event handlers
    this._handleSlideStart = this._handleSlideStart.bind(this);
    this._handleSlideMove = this._handleSlideMove.bind(this);
    this._handleSlideEnd = this._handleSlideEnd.bind(this);

    this._attachEventListeners();
  }

  _attachEventListeners() {
    this.element.addEventListener('mousedown', this._handleSlideStart);
    window.addEventListener('mousemove', this._handleSlideMove);
    window.addEventListener('mouseup', this._handleSlideEnd);
    this.element.addEventListener('touchstart', this._handleSlideStart, { passive: true });
    window.addEventListener('touchmove', this._handleSlideMove);
    window.addEventListener('touchend', this._handleSlideEnd);
  }

  /**
   * Resets state and records the starting position.
   * @private
   */
  _handleSlideStart(event) {
    this.isSliding = true;
    this.lockedAxis = null; // Reset axis lock on new slide
    const point = event.touches ? event.touches[0] : event;
    this.startX = point.clientX;
    this.startY = point.clientY;
  }

  /**
   * Determines the axis lock and reports slide data.
   * @private
   */
  _handleSlideMove(event) {
    if (!this.isSliding) return;

    const point = event.touches ? event.touches[0] : event;
    const deltaX = point.clientX - this.startX;
    const deltaY = point.clientY - this.startY;

    // --- AXIS LOCK LOGIC ---
    // If the axis isn't locked yet, determine it
    if (!this.lockedAxis) {
      // Wait until the user has moved past the threshold
      if (Math.abs(deltaX) > this.axisLockThreshold || Math.abs(deltaY) > this.axisLockThreshold) {
        // Lock to the axis with the greater movement
        this.lockedAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
      }
    }

    // --- ON-TICK CALLBACK ---
    // If the axis is locked, fire the callback with the relevant data
    if (this.lockedAxis) {
      this.onTick({
        axis: this.lockedAxis,
        // Provide the signed distance for the locked axis
        distance: this.lockedAxis === 'x' ? deltaX : -1 * deltaY,
      });
    }
  }

  /**
   * Resets the sliding state.
   * @private
   */
  _handleSlideEnd() {
    this.isSliding = false;
    this.lockedAxis = null;
  }

  destroy() {
    this.element.removeEventListener('mousedown', this._handleSlideStart);
    window.removeEventListener('mousemove', this._handleSlideMove);
    window.removeEventListener('mouseup', this._handleSlideEnd);
    this.element.removeEventListener('touchstart', this._handleSlideStart);
    window.removeEventListener('touchmove', this._handleSlideMove);
    window.removeEventListener('touchend', this._handleSlideEnd);
  }
}

// METHODS
var originalVal = $.fn.val;

jQuery.fn.getStyleValue = function(prop){
  return parseFloat($(this).css(prop).replace('px', ''));
};

jQuery.fn.val = function(){
  var result = originalVal.apply(this, arguments);
  if(this.hasClass('resizingInp')){
      resizeInput(this[0]);
  };
  return result;
};

// GLOBAL VARS

const isMobile = /Mobi/.test(navigator.userAgent);
var current_page = "app"; // app | settings

// Wave animation variables
var ctx, canvas, gestureTracker;

let waveOffset = 0;
var waveAmplitude = 20;
var waveLength = 800;
var waveSpeed = 0.055;

var params, waterhistory;
// Keep reference to the currently displayed recall notification (if any)
var activeRecallNotification = null;
// Stats object (persisted)
var stats;

// Water variables
var ml, pastML, targetMl
var animating = false;
// Snapshot of profiles when opening the editor to detect no-op closes
var profilesSnapshotJSON = null;

// UTILITY 
function showBlurPage(className) {
  if(className == 'hide') {
    // 4. Use a tiny timeout to trigger the fade-in effect on the next browser paint cycle
    $(".blurBG").css('opacity', '0');
    
    setTimeout(() => {
      $(".blurBG").css('display', 'none');
    }, 200);
    
    return;
  };

  const $blurBG = $(".blurBG");
  const $targetPage = $(`.${className}`);
  const overlayVisible = $blurBG.css('display') === 'flex' && parseFloat($blurBG.css('opacity') || '0') > 0.9;
  
  // If overlay is already visible, crossfade between pages without hiding overlay
  if (overlayVisible) {
    const $current = $blurBG.children().filter(':visible').not($targetPage).first();

    // Show target immediately as fully opaque BEHIND current
    // So at least one opaque panel covers the background at all times
    $targetPage.css({ display: 'flex', opacity: 1, 'z-index': 1 });
    if ($current.length) $current.css('z-index', 2);

    // Next frame, fade current out only (fade-through)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if ($current.length) {
          $current.css('opacity', 0);
          setTimeout(() => {
            $current.css({ display: 'none', opacity: 1, 'z-index': '' });
            $targetPage.css('z-index', '');
          }, 240); // align with CSS (~220ms) + small buffer
        }
      });
    });
  } else {
    // Opening from closed state: hide others instantly
    $blurBG.children(':not(.' + className + ')').css({ display: 'none', opacity: 0 });

    // Prepare target
    $targetPage.css({ display: 'flex', opacity: 0 });

    // Show overlay, then fade both overlay and target in
    $blurBG.css('display', 'flex');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        $blurBG.css('opacity', '1');
        $targetPage.css('opacity', '1');
      });
    });
  }
};

function zeroAM(data, mode){
  var date = new Date(data);

  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);

  if(mode == "timestamp"){
      return date.getTime();
  }else if(mode == "date"){
      return date;
  };
};

function getToday(mode, offset = 0){
  var today = zeroAM(new Date(), "date");
  today.setDate(today.getDate() + offset);

  if(mode == "timestamp"){
    return today.getTime();
  }else if(mode == "date"){
    return today;
  };
};

function formatDate(timestamp) {
  var d = new Date(timestamp);
  var month = '' + (d.getMonth() + 1);
  var day = '' + d.getDate();
  var year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('/');
};

function formatTime(time, mode='string'){
  let hour = Math.floor(time / 60);
  let min = time - (hour * 60);

  if(mode == "string"){
    if(min.toString().length == 1){
      min = "0" + min
    };

    return hour + "h" + min;
  }else if(mode == "number"){
    return {
      hours : hour,
      minutes : min,
    }
  }

}

function getHoursMinutes(date, mode='split'){
  if(mode == "uni"){
    return date.getHours() * 60 + date.getMinutes()
  }else if(mode == "split"){
    return {
      hours : date.getHours(),
      minutes: date.getMinutes()
    }
  }
}

function setHoursMinutes(date, hours, minutes){
  date.setHours(hours);
  date.setMinutes(minutes);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date;
};

function isNaI(input) {
  if (typeof input === 'number') {
      input = input.toString();
  } else if (typeof input !== 'string') {
      return true;
  }
  return !/^-?\d+$/.test(input);
};

function smallestAvailableId(data, idKey){

  let idList = [0];

  for(let i=0; i<data.length; i++){
    idList.push(parseInt(data[i][idKey]));
  };

  
  let max = Math.max(...idList.filter(id => !isNaI(id)));
  
  for(let i=1; i<max; i++){
    if(!idList.includes(i)){
      return i.toString();
    };
  };

  return (max + 1).toString();
};

function getItemIndexByID(item, id){
  for(let i=0; i<item.length; i++){
      if(item[i].id == id){
          return i;
      };
  };

  return false;
};

function removeItem(arr, index) {
  return arr.slice(0, index).concat(arr.slice(index + 1));
}

// SAVE AND LOAD

function saveItem(name, data){
  localStorage.setItem(name, JSON.stringify(data));
  return;
};

// Stats read/init
function stats_read(){
  let data = localStorage.getItem('stats');
  if(data === null || data === ''){
    data = {
      total: 0,
      debt: 0,
      installDate: getToday('timestamp'),
      lastProcessedDay: getToday('timestamp')
    };
    saveItem('stats', data);
  }else{
    data = JSON.parse(data);
    // Backfill missing fields if any
    if(typeof data.total !== 'number') data.total = 0;
    if(typeof data.debt !== 'number') data.debt = 0;
    if(!data.installDate) data.installDate = getToday('timestamp');
    if(!data.lastProcessedDay) data.lastProcessedDay = getToday('timestamp');
  }
  return data;
}

function water_read(){
  let level = localStorage.getItem("waterlevel");
  let today = localStorage.getItem("watertoday");

  if(level === null || level == ""){
    saveItem("watertoday", getToday("timestamp"));
    return 0;
  }else{
    if(today != zeroAM(getToday('timestamp'), 'timestamp')){
      // Before resetting the day, update stats with yesterday's debt
      stats = stats || stats_read();
      params = params || parameters_read();

      const prevDayTs = parseInt(today);
      const currDayTs = zeroAM(getToday('timestamp'), 'timestamp');
      const diffDays = Math.max(1, Math.floor((currDayTs - prevDayTs) / (24 * 60 * 60 * 1000)));
      const consumedYesterday = parseInt(level) || 0;
      // First day in gap accounts for consumed water; the rest assumed 0
      let newDebt = Math.max((params.goal || 0) - consumedYesterday, 0);
      if(diffDays > 1){
        newDebt += (diffDays - 1) * (params.goal || 0);
      }
      stats.debt += newDebt;
      stats.lastProcessedDay = currDayTs;
      saveItem('stats', stats);

      saveItem("watertoday", getToday("timestamp"));
      saveItem("waterhistory", []);
      saveItem("waterlevel", 0);

      return 0;
    }else{
      return parseInt(level);
    };
  };
};

function parameters_read(){
    let data = localStorage.getItem("parameters");
    if(data == "" || data === null){
        data = {
            "language": "french",
            "goal": 2000,
            "profiles": [
              {"id": 1, "skin" : "😮", "label": "Gorgée", "value": 100, "count": 0},
              {"id": 2, "skin" : "🥛", "label": "Verre", "value": 250, "count": 0},
              {"id": 3, "skin" : "☕️", "label": "Tasse", "value": 300, "count": 0},
              {"id": 4, "skin" : "🧴", "label": "Bouteille", "value": 800, "count": 0},
              {"id": 5, "skin" : "🍺", "label": "Pinte", "value": 1500, "count": 0}
            ],
            "recall": [
              {"id": 1, "qty": 500, "before": 570},
              {"id": 2, "qty": 1000, "before": 720},
              {"id": 3, "qty": 1500, "before": 930},
              {"id": 4, "qty": 2000, "before": 1080}
            ]
        }
        
        saveItem('parameters', data);
    }else{
        data = JSON.parse(data);

        // Ensure profiles have a "count" field (migration for older saves)
        if (Array.isArray(data.profiles)) {
          data.profiles = data.profiles.map(p => {
            if (typeof p.count !== 'number' || isNaN(p.count)) {
              p.count = 0;
            }
            return p;
          });
          // Persist migration so future loads keep the field
          saveItem('parameters', data);
        }

        $('#goalInput').val(data.goal);
    };

    return data;
};

function waterhistory_read(){
  let data = localStorage.getItem("waterhistory");

  if(data == "" || data === null){
      data = [];
      saveItem("waterhistory", data);
  }else{
      data = JSON.parse(data);
  };

  return data;
}

// GAUGE

function resizeCanvas() {
    // Get the device pixel ratio to scale the canvas for high-res screens
    const dpr = window.devicePixelRatio || 1;

    // Set the canvas drawing buffer size to match the display size scaled by DPR
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    drawGauge(ml);
}

function drawGauge(mlValue) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width;
  const height = canvas.height;

  const outerRadius = Math.min(width, height) * 0.07;
  const innerRadius = Math.min(width, height) * 0.1;

  // Get theme colors
  const rootStyles = getComputedStyle(document.documentElement);
  const bgColor = rootStyles.getPropertyValue('--bg').trim() || '#f0f0f0';
  const colorStart = rootStyles.getPropertyValue('--c-start').trim() || '#00aaff';
  const colorEnd = rootStyles.getPropertyValue('--c-end').trim() || '#0077cc';

  // Clear the canvas
  ctx.clearRect(0, 0, width, height);

  // --- 1. Draw the gauge background ---
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(4, 4, width - 8, height - 8, innerRadius);
  } else {
    // Fallback for rounded rectangle
    ctx.moveTo(4 + innerRadius, 4);
    ctx.lineTo(width - 4 - innerRadius, 4);
    ctx.quadraticCurveTo(width - 4, 4, width - 4, 4 + innerRadius);
    ctx.lineTo(width - 4, height - 4 - innerRadius);
    ctx.quadraticCurveTo(width - 4, height - 4, width - 4 - innerRadius, height - 4);
    ctx.lineTo(4 + innerRadius, height - 4);
    ctx.quadraticCurveTo(4, height - 4, 4, height - 4 - innerRadius);
    ctx.lineTo(4, 4 + innerRadius);
    ctx.quadraticCurveTo(4, 4, 4 + innerRadius, 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- 2. Calculate water level and define text ---
  const minFillPercent = 0.0035;
  const maxFillPercent = 0.94;
  const percent = Math.min(mlValue / targetMl, 1);
  const waterLevel = Math.min(
      Math.max(
          height - (height * percent),
          height * (1 - maxFillPercent)),
      height * (1 - minFillPercent));

  const centerY = height / 2;
  const absText = `${Math.round(mlValue)} / ${targetMl} ml`;
  const percentText = `${Math.round(percent * 100)}%`;

  // --- 3. Draw the BACKGROUND wave (BEHIND the text) ---
  // This is drawn early so the text will appear on top of it.
  ctx.save();
  // Clip this wave to the rounded rectangle
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(4, 4, width - 8, height - 8, innerRadius);
  } else {
    // Fallback
    ctx.moveTo(4 + innerRadius, 4);
    ctx.lineTo(width - 4 - innerRadius, 4);
    ctx.quadraticCurveTo(width - 4, 4, width - 4, 4 + innerRadius);
    ctx.lineTo(width - 4, height - 4 - innerRadius);
    ctx.quadraticCurveTo(width - 4, height - 4, width - 4 - innerRadius, height - 4);
    ctx.lineTo(4 + innerRadius, height - 4);
    ctx.quadraticCurveTo(4, height - 4, 4, height - 4 - innerRadius);
    ctx.lineTo(4, 4 + innerRadius);
    ctx.quadraticCurveTo(4, 4, 4 + outerRadius, 4);
  }
  ctx.closePath();
  ctx.clip();
  
  // Now draw the wave itself
  ctx.beginPath();
  const bgWaveAmplitude = (waveAmplitude * 0.7) * dpr;
  const bgWaveLength = (waveLength * 1.2) * dpr;
  const bgWaveOffset = waveOffset + Math.PI / 2;
  ctx.moveTo(0, waterLevel);
  for (let x = 0; x <= width; x += 2) {
    const y = bgWaveAmplitude * Math.sin((x / bgWaveLength) * 2 * Math.PI + bgWaveOffset) + waterLevel;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(170, 217, 255, 0.7)';
  ctx.fill();
  ctx.restore(); // Restore from the clip

  // --- 4. Draw the BASE text (ON TOP of the background wave) ---
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(height * 0.04)}px Arial`;
  ctx.fillStyle = '#000';
  ctx.fillText(absText, width / 2, centerY - height * 0.03);
  ctx.font = `bold ${Math.floor(height * 0.086)}px Arial`;
  const textGradient = ctx.createLinearGradient(0, 0, width, 0);
  textGradient.addColorStop(0, colorStart);
  textGradient.addColorStop(1, colorEnd);
  ctx.fillStyle = textGradient;
  ctx.fillText(percentText, width / 2, centerY + height * 0.05);
  ctx.restore();

  // --- 6. Draw the white border (on top of everything) ---
  ctx.save();
  ctx.strokeStyle = '#fff';
  
  // Define the line width and calculate the inset needed
  const lineWidth = 8 * dpr;
  const halfLineWidth = lineWidth / 2;

  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';

  // The new path is inset by half the line's width
  const inset = 4 + halfLineWidth;
  const newWidth = width - 8 - lineWidth;
  const newHeight = height - 8 - lineWidth;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(inset, inset, newWidth, newHeight, outerRadius);
  } else {
     // Fallback with inset coordinates
     ctx.moveTo(inset + outerRadius, inset);
     ctx.lineTo(width - inset - outerRadius, inset);
     ctx.quadraticCurveTo(width - inset, inset, width - inset, inset + outerRadius);
     ctx.lineTo(width - inset, height - inset - outerRadius);
     ctx.quadraticCurveTo(width - inset, height - inset, width - inset - outerRadius, height - inset);
     ctx.lineTo(inset + outerRadius, height - inset);
     ctx.quadraticCurveTo(inset, height - inset, inset, height - inset - outerRadius);
     ctx.lineTo(inset, inset + outerRadius);
     ctx.quadraticCurveTo(inset, inset, inset + outerRadius, inset);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  
  // --- 5. Draw the MAIN wave and its text mask ---
  ctx.save();
  // First, clip the entire operation to the rounded rectangle
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(4, 4, width - 8, height - 8, innerRadius);
  } else {
    // Fallback
    ctx.moveTo(4 + innerRadius, 4);
    ctx.lineTo(width - 4 - innerRadius, 4);
    ctx.quadraticCurveTo(width - 4, 4, width - 4, 4 + innerRadius);
    ctx.lineTo(width - 4, height - 4 - innerRadius);
    ctx.quadraticCurveTo(width - 4, height - 4, width - 4 - innerRadius, height - 4);
    ctx.lineTo(4 + innerRadius, height - 4);
    ctx.quadraticCurveTo(4, height - 4, 4, height - 4 - innerRadius);
    ctx.lineTo(4, 4 + innerRadius);
    ctx.quadraticCurveTo(4, 4, 4 + outerRadius, 4);
  }
  ctx.closePath();
  ctx.clip();
  
  // Define the main wave's path
  const mainWavePath = new Path2D();
  const scaledWaveAmplitude = waveAmplitude * dpr;
  const scaledWaveLength = waveLength * dpr;
  mainWavePath.moveTo(0, waterLevel);
  for (let x = 0; x <= width; x += 2) {
    const y = scaledWaveAmplitude * Math.sin((x / scaledWaveLength) * 2 * Math.PI + waveOffset) + waterLevel;
    mainWavePath.lineTo(x, y);
  }
  mainWavePath.lineTo(width, height);
  mainWavePath.lineTo(0, height);
  mainWavePath.closePath();
  
  // Draw the visual wave
  const gradient = ctx.createLinearGradient(0, waterLevel, 0, height);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  ctx.fillStyle = gradient;
  ctx.fill(mainWavePath);
  
  // Now, clip to that wave's path to create the mask
  ctx.clip(mainWavePath);
  
  // Draw the white text, which will only appear inside the mask
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(height * 0.04)}px Arial`;
  ctx.fillText(absText, width / 2, centerY - height * 0.03);
  ctx.font = `bold ${Math.floor(height * 0.086)}px Arial`;
  ctx.fillText(percentText, width / 2, centerY + height * 0.05);
  
  ctx.restore(); // Removes all clips set in this block
}

function addMl(mlToAdd) {
  pastML = ml;

  ml += mlToAdd;
  animating = true;
  // Track total consumed since install (net)
  stats = stats || stats_read();
  stats.total = Math.max(0, (stats.total || 0) + mlToAdd);
  saveItem('stats', stats);
};

// Animation loop
function animateGauge() {
  waveOffset += waveSpeed;
  
  if (animating) {
    if (Math.abs(pastML - ml) < 1) {
      pastML = ml;
      animating = false;
    } else {
      pastML += (ml - pastML) * 0.05; // Smooth transition
    }
  }

  drawGauge(pastML);
  requestAnimationFrame(animateGauge);
}

function handleGestures(e) {
  if(e.axis == 'y'){
    let newAmplitude = waveAmplitude + e.distance * 0.01;
    waveAmplitude = Math.max(Math.min(newAmplitude, 30), 15)
  }else if(e.axis == 'x'){
    let newSpeed = waveSpeed + (e.distance * 0.000005);
    waveSpeed = Math.max(Math.min(newSpeed, 0.1), 0.025)
  };
}

// OTHER

function checkPaliers(items){
  if(items.length == 0) return;

  let output = [];
  let now = getHoursMinutes(new Date(), 'uni');

  for (const item of items) {
    if(item.before < now && item.qty > ml){
      output.push(item);
    };
  };

  let alert = output[output.length -1];

  if(alert !== undefined){
    if (Notification.permission === "granted") {
      // Close any existing recall notification to avoid flooding
      try {
        if (activeRecallNotification && typeof activeRecallNotification.close === 'function') {
          activeRecallNotification.close();
        }
      } catch (e) { /* no-op */ }

      // Show a fresh one and keep a reference
      const n = new Notification("Rappel d'hydratation", {
        body: `Vous auriez du boire ${alert.qty}ml avant ${formatTime(alert.before)}`,
        icon: './resources/imgs/icon.png',
        tag: 'watertracker-recall', // helps some browsers replace existing notifications
        renotify: false
      });
      activeRecallNotification = n;
      // Clear the reference when it closes
      if (n && typeof n.addEventListener === 'function') {
        n.addEventListener('close', function(){
          if (activeRecallNotification === n) activeRecallNotification = null;
        });
        // Some browsers use 'click' then auto-close; also clear on click
        n.addEventListener('click', function(){
          try { n.close && n.close(); } catch(_) {}
          if (activeRecallNotification === n) activeRecallNotification = null;
        });
      }
    };
  };
};

function loadFastItems(items) {
  const $container = $('.fast_container');
  const container = $container[0];

  // Sort by usage count (most used first); fallback to 0 if undefined
  const sorted = [...items].sort((a, b) => (b.count || 0) - (a.count || 0));

  // Map existing nodes by id and record FIRST rects for FLIP
  const existingNodes = new Map();
  const firstRects = new Map();
  $container.children().each(function(){
    const id = $(this).data('id');
    if (id !== undefined) {
      existingNodes.set(String(id), this);
      // Clear any previous transition to ensure correct measurements
      this.style.transition = 'none';
      this.style.transform = '';
      firstRects.set(String(id), this.getBoundingClientRect());
    }
  });

  // Rebuild DOM in the new order, reusing nodes when possible
  const present = new Map();
  for (const item of sorted) {
    const idStr = String(item.id);
    let el = existingNodes.get(idStr);
    if (!el) {
      // Create a new node if it doesn't exist yet
      el = document.createElement('div');
      el.className = 'fast_item noselect';
      el.innerHTML = '<span class="fast_item_emoji"></span>\n                      <span class="fast_item_label"></span>\n                      <span class="fast_item_value"></span>';
      // Initial enter state
      el.style.opacity = '0';
      el.style.transform = 'scale(0.96)';
      $(el).data('id', item.id);
    }

    // Update content
    el.querySelector('.fast_item_emoji').textContent = item.skin;
    el.querySelector('.fast_item_label').textContent = item.label;
    el.querySelector('.fast_item_value').textContent = item.value + 'ml';

    // Append in correct order (moves existing nodes as well)
    container.appendChild(el);
    present.set(idStr, el);
  }

  // Remove nodes that are no longer present
  existingNodes.forEach((el, id) => {
    if (!present.has(id)) {
      el.remove();
    }
  });

  // Record LAST rects, then apply FLIP transforms
  present.forEach((el, id) => {
    const last = el.getBoundingClientRect();
    const first = firstRects.get(id);

    if (first) {
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      // Invert
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      // Force reflow
      void el.offsetWidth; // eslint-disable-line no-unused-expressions
      // Play
      el.style.transition = 'transform 700ms ease, opacity 700ms ease';
      el.style.transform = 'translate(0, 0)';
    } else {
      // Enter animation
      void el.offsetWidth;
      el.style.transition = 'transform 360ms ease, opacity 360ms ease';
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    }
  });
} 

function renderFastProfilesEditor(items){
  const $container = $('.fastProfiles_container');
  $container.children().remove();

  // Template similar to recallItemWrapper with inline inputs
  const $row = $(`
    <div class="profileItemWrapper">
      <div class="profileItem_inputs">
        <input class="profile_skin" placeholder=':)' type="text" maxlength="2" value="😮" aria-label="Emoji"/>
        <input class="profile_label" placeholder='Label' type="text" value="Gorgée" aria-label="Label"/>
        <input class="profile_value strictlyNumeric" placeholder='ml' type="number" min="1" step="1" value="100" aria-label="Valeur (ml)"/>
      </div>
      <div class="profileItem_bin">
        <img class="bin_img" src="./resources/imgs/bin.svg" alt="Supprimer le profil">
      </div>
    </div>`);

  for(const item of items){
    const $item = $row.clone();
    $item.data('id', item.id);
    $item.find('.profile_skin').val(item.skin);
    $item.find('.profile_label').val(item.label);
    $item.find('.profile_value').val(item.value);
    $container.append($item);
  }

  if(params.profiles.length === 1){
    $('.fastProfiles_container .profileItem_bin').css('display', 'none');
  }else{
    $('.fastProfiles_container .profileItem_bin').css('display', 'block');
  };
}

function loadRecallItems(items) {
  let $recallContainer = $('.parameters_recallBody');
  let $recallItem = $(`<div class="recallItemWrapper">
                          <span class="recallItem">
                              <span class="recallItem_val">500ml</span>
                              <span class="recallItem_interText"> avant </span> 
                              <span class="recallItem_time">9h00</span>
                          </span>
                          <div class="recallItem_bin">
                              <img class="bin_img offset" src="./resources/imgs/bin.svg" alt="Supprimer le palier">
                          </div>
                        </div>`);  

  $recallContainer.children().remove();

  if(items.length == 0){
    let $item = $("<span class='muted'>Aucun palier à ce jour</span>");
    $recallContainer.append($item);
  }else{
    for (const item of items) {
      let $item = $recallItem.clone();

      $item.data('id', item.id);
      $item.find('.recallItem_val').text(item.qty + "ml");
      $item.find('.recallItem_time').text(formatTime(item.before));

      $recallContainer.append($item);
    }
  };
}

function loadHistoryItems(items){
  const $historyContainer = $('.parameters_historyBody');
  const $historyItem = $(`<div class="historyItemWrapper">
                            <span class="historyItem">
                              <span class="history_skin">💧</span>
                              <span class="history_label">Gorgée</span>
                              <span class="history_val">+100ml</span>
                              <span class="history_time">à 09:00</span>
                            </span>
                          </div>`);

  $historyContainer.children().remove();

  if(!items || items.length === 0){
    $historyContainer.append($('<span class="muted">Aucun historique pour aujourd\'hui</span>'));
    return;
  }

  for(const entry of items){
    const $item = $historyItem.clone();
    const date = new Date(entry.time);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const prof = (params && Array.isArray(params.profiles)) ? params.profiles.find(p => p.id == entry.id) : null;
    $item.find('.history_skin').text(prof && prof.skin ? prof.skin : '💧');
    $item.find('.history_label').text(prof && prof.label ? prof.label : 'Gorgée');
    $item.find('.history_val').text('+' + entry.val + 'ml');
    $item.find('.history_time').text('à ' + hh + ':' + mm);
    $historyContainer.prepend($item);
  }
}

// ON LOAD
$(document).ready(function(){
  // rectangular waterGauge in .waterGauge using canvas 2d
  canvas = document.getElementById('waterGauge');
  ctx = canvas.getContext('2d');

  gestureTracker = new SlideTracker(canvas, handleGestures);

  // Water level variables
  params = parameters_read();
  stats = stats_read();
  ml = water_read(); // initial ml value
  waterhistory = waterhistory_read();

  pastML = ml;
  targetMl = params.goal; // target ml value

  // Initial resize and start animation
  resizeCanvas();
  animateGauge();

  // Resize the canvas when the window is resized
  window.addEventListener('resize', resizeCanvas);

  $('img').attr('draggable', false);
  if (Notification.permission === "granted") {
    $('#enableNotifBtn').remove();
  }

  $(document).on('click', '.recallItem_bin', function(){
    let $item = $(this).closest('.recallItemWrapper')
    let id = $item.data('id');
    let index = getItemIndexByID(params.recall, id);
    
    params.recall = removeItem(params.recall, index);
    
    loadRecallItems(params.recall);
    saveItem('parameters', params);
    // Notify deletion
  });

  $(document).on('click', '.fast_item', function(){
    const val = parseInt($(this).find('.fast_item_value').text().split('ml')[0]);
    const id = $(this).data('id');
    addMl(val);

    waterhistory.push({"id": id, 'val': val, 'time': Date.now()})
    saveItem('waterhistory', waterhistory);
    saveItem("waterlevel", ml);

    // Increment profile usage count and refresh fast items order
    const idx = getItemIndexByID(params.profiles, id);
    if (idx !== false) {
      const curr = params.profiles[idx];
      curr.count = (typeof curr.count === 'number' && !isNaN(curr.count)) ? curr.count + 1 : 1;
      saveItem('parameters', params);
      loadFastItems(params.profiles);
    }
  });

  $('.parameters').on('click', function(){
    loadHistoryItems(waterhistory);
    // Ensure goal input reflects saved value when opening
    try { $('#goalInput').val(params.goal); } catch(_) {}
    showBlurPage('parameters_page');
  });

  // Stats button
  $('.statistics').on('click', function(){
    // Refresh displayed stats values
    stats = stats_read();
    const totalTxt = `${Math.max(0, Math.round(stats.total || 0))} ml`;
    const debtTxt = `${Math.max(0, Math.round(stats.debt || 0))} ml`;
    const installTxt = formatDate(stats.installDate || getToday('timestamp'));
    $('#stats_totalMl').text(totalTxt);
    $('#stats_debtMl').text(debtTxt);
    $('#stats_installDate').text(installTxt);
    // Version: mirror header span text if present, else keep default
    const v = $('.versionNB').text() || 'v2.0';
    $('#stats_version').text(v);
    showBlurPage('stats_page');
  });

  $(document).on('click', '.closeStats', function(){
    showBlurPage('hide');
  });

  $('.editProfiles').on('click', function(){
    renderFastProfilesEditor(params.profiles);
    // Take a snapshot to detect whether anything changes before closing
    try { profilesSnapshotJSON = JSON.stringify(params.profiles); } catch(_) { profilesSnapshotJSON = null; }
    showBlurPage('fastProfile_page');
  });

  $('.closeParams').on('click', function(){
    // Rollback goal input to the last saved value when closing without saving
    try { $('#goalInput').val(params.goal); } catch(_) {}
    showBlurPage('hide');
  })

  $(document).on('click', '.closeFastProfiles', function(){
    // Validate profiles before closing
    const $rows = $('.fastProfiles_container .profileItemWrapper');
    let ok = true;
    $rows.each(function(){
      const $row = $(this);
      const skin = String($row.find('.profile_skin').val() || '').trim();
      const label = String($row.find('.profile_label').val() || '').trim();
      const valueRaw = String($row.find('.profile_value').val() || '').trim();
      const value = parseInt(valueRaw, 10);
      if(!skin || !label || !valueRaw || isNaN(value) || value < 1){
        ok = false;
        return false; // break
      }
    });
    if(!ok){
      try { bottomNotification && bottomNotification('invalidProfile', 'Complétez tous les profils avec des valeurs valides'); } catch(_) {}
      return;
    }
    // Persist normalized values
    $rows.each(function(){
      const $row = $(this);
      const id = $row.data('id');
      const idx = getItemIndexByID(params.profiles, id);
      params.profiles[idx].skin = String($row.find('.profile_skin').val()).trim();
      params.profiles[idx].label = String($row.find('.profile_label').val()).trim();
      params.profiles[idx].value = parseInt(String($row.find('.profile_value').val()).trim(), 10);
    });
    saveItem('parameters', params);
    loadFastItems(params.profiles);
    // Notify only if something actually changed since opening
    let hasChanges = true;
    try {
      const currentJSON = JSON.stringify(params.profiles);
      if (profilesSnapshotJSON !== null && profilesSnapshotJSON === currentJSON) {
        hasChanges = false;
      }
    } catch(_) { /* keep hasChanges = true on JSON issues */ }
    if (hasChanges) {
      try { bottomNotification && bottomNotification('updated', 'Profils enregistrés'); } catch(_) {}
    }
    showBlurPage('parameters_page');
  });

  $('.save_ml').on('click', function(){
    const raw = String($('#goalInput').val() || '').trim();
    const n = parseInt(raw, 10);
    if(!raw){
      try { bottomNotification && bottomNotification('missingFields', 'Objectif manquant'); } catch(_) {}
      return;
    }
    if(isNaN(n) || n < 1){
      try { bottomNotification && bottomNotification('invalidNumber', 'Objectif invalide'); } catch(_) {}
      return;
    }
    // If unchanged, just close without notifying
    if (n === params.goal) {
      showBlurPage('hide');
      return;
    }
    targetMl = n;
    params.goal = targetMl;
    
    saveItem('parameters', params);
    try { bottomNotification && bottomNotification('updated', 'Objectif mis à jour'); } catch(_) {}
    showBlurPage('hide');
  });

  $('.rollBack').on('click', function(){
    if(waterhistory.length == 0) return;
    let lastHistoryItem = waterhistory[waterhistory.length - 1];

    addMl(-1 * lastHistoryItem.val);
    waterhistory = waterhistory.slice(0, waterhistory.length - 1)

    saveItem('waterhistory', waterhistory);
    saveItem('waterlevel', ml);
  });

  $('#addReminderBtn').on('click', function(){
    const mlRaw = String($('#newReminderAmount').val() || '').trim();
    const time = String($('#newReminderTime').val() || '').trim();

    if(!mlRaw || !time){
      try { bottomNotification && bottomNotification('missingFields', 'Veuillez renseigner quantité et heure'); } catch(_) {}
      return;
    }
    const mlVal = parseInt(mlRaw, 10);
    if(isNaN(mlVal) || mlVal < 1){
      try { bottomNotification && bottomNotification('invalidNumber', 'Quantité invalide'); } catch(_) {}
      return;
    }
    if(!/^\d{2}:\d{2}$/.test(time)){
      try { bottomNotification && bottomNotification('invalidTime', 'Format heure HH:MM'); } catch(_) {}
      return;
    }

    const parts = time.split(':');
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    if(isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59){
      try { bottomNotification && bottomNotification('invalidTime', 'Heure invalide'); } catch(_) {}
      return;
    }

    const sum = hh * 60 + mm;

    // verify that the hour is not already used
    if (params.recall.some(item => item.before === sum)){
      try { bottomNotification && bottomNotification('duplicateTime'); } catch(_) {}
      return;
    }

    const recallItem = {
      'id': smallestAvailableId(params.recall, 'id'),
      'qty': mlVal,
      'before': sum
    }

    params.recall.push(recallItem);
    params.recall.sort((a, b) => {
      return a.before - b.before;
    });

    loadRecallItems(params.recall);
    saveItem('parameters', params);
  });

  $('#enableNotifBtn').on('click', function(){
    // ask for notification permission
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        checkPaliers(params.recall);
        try { bottomNotification && bottomNotification('updated', 'Notifications activées'); } catch(_) {}
      } else if (permission === 'denied') {
        try { bottomNotification && bottomNotification('invalid', 'Notifications refusées'); } catch(_) {}
      };
    });

    $(this).remove();
  });

  // Enforce strictly numeric behavior on numeric inputs
  try {
    $('#goalInput, #newReminderAmount').attr({ inputmode: 'numeric', pattern: '\\d*' });
  } catch(_) {}

  $(document).on('input', '#goalInput, #newReminderAmount, .profile_value', function(){
    const cleaned = String($(this).val() || '').replace(/\D+/g, '');
    if($(this).val() !== cleaned){
      $(this).val(cleaned);
    }
  });

  // History actions
  $(document).on('click', '.history_undo_last', function(){
    if(!waterhistory || waterhistory.length === 0) return;
    const last = waterhistory[waterhistory.length - 1];
    addMl(-1 * last.val);
    waterhistory = waterhistory.slice(0, waterhistory.length - 1);
    saveItem('waterhistory', waterhistory);
    saveItem('waterlevel', ml);
    loadHistoryItems(waterhistory);
  });

  $(document).on('click', '.history_undo_all', function(){
    if(!waterhistory || waterhistory.length === 0) return;
    // Subtract the sum to reflect visually
    const total = waterhistory.reduce((s, e) => s + e.val, 0);
    addMl(-1 * total);
    waterhistory = [];
    saveItem('waterhistory', waterhistory);
    saveItem('waterlevel', ml);
    loadHistoryItems(waterhistory);
    showBlurPage('hide');
  });

  // Fast Profiles editor: live edits
  $(document).on('input', '.fastProfiles_container .profile_skin', function(){
    const $row = $(this).closest('.profileItemWrapper');
    const id = $row.data('id');
    const idx = getItemIndexByID(params.profiles, id);
    params.profiles[idx].skin = $(this).val();
    saveItem('parameters', params);
    loadFastItems(params.profiles);
  });

  $(document).on('input', '.fastProfiles_container .profile_label', function(){
    const $row = $(this).closest('.profileItemWrapper');
    const id = $row.data('id');
    const idx = getItemIndexByID(params.profiles, id);
    params.profiles[idx].label = $(this).val();
    saveItem('parameters', params);
  });

  $(document).on('input', '.fastProfiles_container .profile_value', function(){
    const $row = $(this).closest('.profileItemWrapper');
    const id = $row.data('id');
    const idx = getItemIndexByID(params.profiles, id);
    let v = parseInt($(this).val());
    if(isNaN(v) || v < 1) v = 1;
    params.profiles[idx].value = v;
    saveItem('parameters', params);
  });

  // Delete profile
  $(document).on('click', '.fastProfiles_container .profileItem_bin', function(){
    const $row = $(this).closest('.profileItemWrapper');
    const id = $row.data('id');
    const idx = getItemIndexByID(params.profiles, id);
    if(idx === false) return;
    params.profiles = removeItem(params.profiles, idx);
    saveItem('parameters', params);
    renderFastProfilesEditor(params.profiles);
  });

  // Add profile
  $(document).on('click', '.addProfileBtn', function(){
    const newProfile = {
      id: smallestAvailableId(params.profiles, 'id'),
      skin: '🙂',
      label: 'Profil',
      value: 100,
      count: 0
    };
    params.profiles.push(newProfile);
    saveItem('parameters', params);
    renderFastProfilesEditor(params.profiles);
  });

  // inputs

  $(document).on("keydown", ".strictlyNumeric", function (e) {
    let allowedKeys = [..."0123456789", "Backspace", "ArrowLeft", "ArrowRight", "Delete", "Tab"];

    if (!allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  });

  $(document).on("keydown", ".strictlyFloatable", function (e) {
    let allowedKeys = [..."0123456789.,", "Backspace", "ArrowLeft", "ArrowRight", "Delete", "Tab"];

    if((e.key === "," || e.key === ".") && !$(this).val().includes(".")){
      e.preventDefault();
      $(this).val($(this).val() + ".");
    }else if((e.key === "," || e.key === ".") && $(this).val().includes(".")){
      e.preventDefault();
    };

    if (!allowedKeys.includes(e.key)) {
      e.preventDefault();
    };
  });

  loadFastItems(params.profiles);
  loadRecallItems(params.recall);
  loadHistoryItems(waterhistory);

  checkPaliers(params.recall);
})
