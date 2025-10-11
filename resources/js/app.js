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

// UTILITY 

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

function saveItem(name, data){
  localStorage.setItem(name, data);
  return;
};

// SAVE AND LOAD

function water_read(){
  let level = localStorage.getItem("waterlevel");
  let today = localStorage.getItem("watertoday");

  if(level === null || level == ""){
    saveItem("watertoday", getToday("date"));
    return 0;
  }else{
    if(formatDate(new Date(today)) != formatDate(getToday("date"))){
      saveItem("watertoday", getToday("date"));
      return 0;
    }else{
      return parseInt(level);
    };
  };
};

function water_save(val){
  saveItem("waterlevel", val);
  return;
};

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
    const radius = Math.min(width, height) * 0.05; // Radius for rounded corners

    // Get background color from CSS variable for theme consistency
    const rootStyles = getComputedStyle(document.documentElement);
    const bgColor = rootStyles.getPropertyValue('--bg').trim() || '#f0f0f0';
    const colorStart = rootStyles.getPropertyValue('--c-start').trim() || '#00aaff';
    const colorEnd = rootStyles.getPropertyValue('--c-end').trim() || '#0077cc';

    // Clear the canvas for redrawing
    ctx.clearRect(0, 0, width, height);

    // --- Draw the gauge background (rounded rectangle) ---
    ctx.save();
    ctx.beginPath();
    // Use the modern ctx.roundRect if available, with a fallback for older browsers
    if (ctx.roundRect) {
        ctx.roundRect(4, 4, width - 8, height - 8, radius);
    } else {
        // Manual fallback for rounded rectangle
        ctx.moveTo(4 + radius, 4);
        ctx.lineTo(width - 4 - radius, 4);
        ctx.quadraticCurveTo(width - 4, 4, width - 4, 4 + radius);
        ctx.lineTo(width - 4, height - 4 - radius);
        ctx.quadraticCurveTo(width - 4, height - 4, width - 4 - radius, height - 4);
        ctx.lineTo(4 + radius, height - 4);
        ctx.quadraticCurveTo(4, height - 4, 4, height - 4 - radius);
        ctx.lineTo(4, 4 + radius);
        ctx.quadraticCurveTo(4, 4, 4 + radius, 4);
    }
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.restore();

    // --- Calculate water level ---
    // The water fill has a minimum and maximum level to avoid touching the edges
    const minFillPercent = 0.02;
    const maxFillPercent = 0.92;
    const percent = Math.min(mlValue / targetMl, 1);
    const fillRange = maxFillPercent - minFillPercent;
    const waterLevel = height * (minFillPercent + fillRange * (1 - percent)); // Inverted for y-axis

    // --- Clip the drawing area to the rounded rectangle for the water effect ---
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(4, 4, width - 8, height - 8, radius);
    } else {
        // Manual fallback for rounded rectangle
        ctx.moveTo(4 + radius, 4);
        ctx.lineTo(width - 4 - radius, 4);
        ctx.quadraticCurveTo(width - 4, 4, width - 4, 4 + radius);
        ctx.lineTo(width - 4, height - 4 - radius);
        ctx.quadraticCurveTo(width - 4, height - 4, width - 4 - radius, height - 4);
        ctx.lineTo(4 + radius, height - 4);
        ctx.quadraticCurveTo(4, height - 4, 4, height - 4 - radius);
        ctx.lineTo(4, 4 + radius);
        ctx.quadraticCurveTo(4, 4, 4 + radius, 4);
    }
    ctx.closePath();
    ctx.clip();

    // --- Draw the water with waves ---
    // Create a vertical gradient for the water fill
    const gradient = ctx.createLinearGradient(0, waterLevel, 0, height);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);

    // Draw background wave (lighter, offset for parallax effect)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, waterLevel);
    const bgWaveAmplitude = (waveAmplitude * 0.7) * dpr;
    const bgWaveLength = (waveLength * 1.2) * dpr;
    const bgWaveOffset = waveOffset + Math.PI / 2;
    for (let x = 0; x <= width; x += 2) {
        const y = bgWaveAmplitude * Math.sin((x / bgWaveLength) * 2 * Math.PI + bgWaveOffset) + waterLevel;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(170, 217, 255, 0.7)'; // Lighter, semi-transparent color
    ctx.fill();
    ctx.restore();

    // Draw main animated wave
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, waterLevel);
    const scaledWaveAmplitude = waveAmplitude * dpr;
    const scaledWaveLength = waveLength * dpr;
    for (let x = 0; x <= width; x += 2) {
        const y = scaledWaveAmplitude * Math.sin((x / scaledWaveLength) * 2 * Math.PI + waveOffset) + waterLevel;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    // Restore context to remove the clipping path
    ctx.restore();

    // --- Draw thick rounded white border ---
    ctx.save();
    ctx.strokeStyle = '#fff';
    // Scale the line width by the device pixel ratio to keep it consistent
    ctx.lineWidth = 8 * dpr;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(4, 4, width - 8, height - 8, radius);
        ctx.stroke();
    } else {
        // Manual fallback for rounded rectangle stroke
        ctx.moveTo(4 + radius, 4);
        ctx.lineTo(width - 4 - radius, 4);
        ctx.quadraticCurveTo(width - 4, 4, width - 4, 4 + radius);
        ctx.lineTo(width - 4, height - 4 - radius);
        ctx.quadraticCurveTo(width - 4, height - 4, width - 4 - radius, height - 4);
        ctx.lineTo(4 + radius, height - 4);
        ctx.quadraticCurveTo(4, height - 4, 4, height - 4 - radius);
        ctx.lineTo(4, 4 + radius);
        ctx.quadraticCurveTo(4, 4, 4 + radius, 4);
        ctx.stroke();
    }
    ctx.restore();

    // --- Draw text labels (ml / target ml and percentage) ---
    const centerY = height / 2;

    // Check if the text is close to the water level to change its color for readability
    const isAbsTextNearWater = waterLevel - (centerY - height * 0.03) < 18;
    const isPercentTextNearWater = waterLevel - (centerY + height * 0.05) < 52;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw "ml / target ml" text
    ctx.font = `bold ${Math.floor(height * 0.034)}px Arial`;
    ctx.fillStyle = isAbsTextNearWater ? '#fff' : '#000';
    const absText = `${Math.round(mlValue)} / ${targetMl} ml`;
    ctx.fillText(absText, width / 2, centerY - height * 0.03);

    // Draw percentage text
    const percentText = `${Math.round(percent * 100)}%`;
    ctx.font = `bold ${Math.floor(height * 0.08)}px Arial`;
    const textGradient = ctx.createLinearGradient(0, 0, width, 0);
    textGradient.addColorStop(0, colorStart);
    textGradient.addColorStop(1, colorEnd);
    ctx.fillStyle = isPercentTextNearWater ? '#fff' : textGradient;
    ctx.fillText(percentText, width / 2, centerY + height * 0.05);

    ctx.restore();
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

// GLOBAL VARS

const isMobile = /Mobi/.test(navigator.userAgent);
var current_page = "app"; // app | settings

// Wave animation variables
var ctx, canvas

let waveOffset = 0;
const waveAmplitude = 20;
const waveLength = 800;
const waveSpeed = 0.03;

// Water variables
var ml, pastML, targetMl
var animating = false;
$('img').attr('draggable', false); 

// ON LOAD
$(document).ready(function(){
  // rectangular waterGauge in .waterGauge using canvas 2d
  canvas = document.getElementById('waterGauge');
  ctx = canvas.getContext('2d');

  // Water level variables
  ml = water_read(); // initial ml value
  pastML = ml;
  targetMl = 4000; // target ml value

  // Initial resize and start animation
  resizeCanvas();
  animateGauge();

  // Resize the canvas when the window is resized
  window.addEventListener('resize', resizeCanvas);

  $('.fast_item').on('click', function(){
    const val = parseInt($(this).find('.fast_item_value').text().split('ml')[0]);
    addMl(val);
    saveItem("waterlevel", ml);
  });
})
