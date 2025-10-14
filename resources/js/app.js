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

// Water variables
var ml, pastML, targetMl
var animating = false;
$('img').attr('draggable', false);

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
  
  // 1. Instantly hide any other pages that might be visible
  $blurBG.children(':not(.' + className + ')').css('display', 'none');

  // 2. Prepare the target page: make it part of the layout but fully transparent
  $targetPage.css({
    'display': 'flex',
    'opacity': '0'
  });
  
  // 3. Make the main container visible (it's still transparent at this point)
  $blurBG.css('display', 'flex');

  // 4. Use a tiny timeout to trigger the fade-in effect on the next browser paint cycle
  setTimeout(() => {
    $blurBG.css('opacity', '1');
    $targetPage.css('opacity', '1');
  }, 10); // A small delay is enough
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

function water_read(){
  let level = localStorage.getItem("waterlevel");
  let today = localStorage.getItem("watertoday");

  if(level === null || level == ""){
    saveItem("watertoday", getToday("timestamp"));
    return 0;
  }else{
    if(today != zeroAM(getToday('timestamp'), 'timestamp')){
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
              {"id": 1, "skin" : "😮", "label": "Gorgée", "value": 100},
              {"id": 2, "skin" : "🥛", "label": "Verre", "value": 250},
              {"id": 3, "skin" : "☕️", "label": "Tasse", "value": 300},
              {"id": 4, "skin" : "🧴", "label": "Bouteille", "value": 800},
              {"id": 5, "skin" : "🍺", "label": "Pinte", "value": 1500}
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
    if(item.before < now){
      output.push(item);
    };
  };

  return output[output.length -1];
};

function loadFastItems(items) {
  let $fast_container = $('.fast_container')
  let $fast_item = $(`<div class="fast_item noselect">
                      <span class="fast_item_emoji">😮</span>
                      <span class="fast_item_label">Gorgée</span>
                      <span class="fast_item_value">100ml</span>
                    </div>`);

  for (const item of items) {
    let $curr_item = $fast_item.clone();

    $curr_item.data('id', item.id);
    $curr_item.find('.fast_item_emoji').text(item.skin);
    $curr_item.find('.fast_item_label').text(item.label);
    $curr_item.find('.fast_item_value').text(item.value + "ml");

    $fast_container.append($curr_item);
  }
} 

function loadRecallItems(items) {
  let $recallContainer = $('.parameters_recallBody');
  let $recallItem = $(`<div class="recallItemWrapper">
                          <span class="recallItem">
                              <span class="recallItem_val">500ml</span>
                              <span class="recallItem_interText"> avant </span> 
                              <span class="recallItem_time">9h00</span>
                          </span>
                          <div class="recallItem_bin">🗑</div>
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

// ON LOAD
$(document).ready(function(){
  // rectangular waterGauge in .waterGauge using canvas 2d
  canvas = document.getElementById('waterGauge');
  ctx = canvas.getContext('2d');

  gestureTracker = new SlideTracker(canvas, handleGestures);

  // Water level variables
  params = parameters_read();
  ml = water_read(); // initial ml value
  waterhistory = waterhistory_read();

  pastML = ml;
  targetMl = params.goal; // target ml value

  // Initial resize and start animation
  resizeCanvas();
  animateGauge();

  // Resize the canvas when the window is resized
  window.addEventListener('resize', resizeCanvas);

  $(document).on('click', '.recallItem_bin', function(){
    let $item = $(this).closest('.recallItemWrapper')
    let id = $item.data('id');
    let index = getItemIndexByID(params.recall, id);
    
    params.recall = removeItem(params.recall, index);
    
    loadRecallItems(params.recall);
    saveItem('parameters', params);
  });

  $(document).on('click', '.fast_item', function(){
    const val = parseInt($(this).find('.fast_item_value').text().split('ml')[0]);
    addMl(val);

    waterhistory.push({"id": $(this).data('id'), 'val': val, 'time': Date.now()})
    saveItem('waterhistory', waterhistory);
    saveItem("waterlevel", ml);
  });

  $('.parameters').on('click', function(){
    showBlurPage('parameters_page');
  });

  $('.blurBG').on('click', function(e){
    if($(e.target).is($(this))) showBlurPage('hide');
  });

  $('.closeParams').on('click', function(){
    showBlurPage('hide');
  })

  $('.save_ml').on('click', function(){
    targetMl = parseInt($('#goalInput').val());
    params.goal = targetMl;
    
    saveItem('parameters', params);
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
    let mlVal = $('#newReminderAmount').val();
    let time = $('#newReminderTime').val();

    let hour = parseInt(time.split(':')[0]) * 60
    let min = parseInt(time.split(':')[1])

    let sum = hour + min;

    let recallItem = {
      'id': smallestAvailableId(params.recall, 'id'),
      'qty': parseInt(mlVal),
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
    $(this).remove();
  });

  loadFastItems(params.profiles);
  loadRecallItems(params.recall);

  checkPaliers(params.recall);
})
