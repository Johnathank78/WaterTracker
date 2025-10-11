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
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  drawGauge(ml);
}

function drawGauge(mlValue) {
  const width = canvas.width;
  const height = canvas.height;
  const radius = Math.min(width, height) * 0.05; // Radius for rounded corners

  // Get background color from CSS variable
  const rootStyles = getComputedStyle(document.documentElement);
  const bgColor = rootStyles.getPropertyValue('--bg').trim() || '#f0f0f0';
  const colorStart = rootStyles.getPropertyValue('--c-start').trim() || '#00aaff';
  const colorEnd = rootStyles.getPropertyValue('--c-end').trim() || '#0077cc';

  // Clear the canvas
  ctx.clearRect(0, 0, width, height);

  // Draw the gauge background (rounded rectangle)
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
      ctx.roundRect(4, 4, width - 8, height - 8, radius);
  } else {
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

  // Water level (e.g., mlValue as percent of max)
  const minFillPercent = 0.02;
  const maxFillPercent = 0.92;
  const percent = Math.min(mlValue / targetMl, 1);
  const fillRange = maxFillPercent - minFillPercent;
  const waterLevel = height * (minFillPercent + fillRange * percent);

  // Clip to rounded rectangle for water
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
      ctx.roundRect(4, 4, width - 8, height - 8, radius);
  } else {
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
  ctx.closePath();
  ctx.clip();

  // Create vertical gradient for water
  const gradient = ctx.createLinearGradient(0, height - waterLevel, 0, height);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);

  // Draw background wave (lighter, offset)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, height - waterLevel);

  const bgWaveAmplitude = waveAmplitude * 0.7;
  const bgWaveLength = waveLength * 1.2;
  const bgWaveOffset = waveOffset + Math.PI / 2;

  for (let x = 0; x <= width; x += 2) {
      const y = bgWaveAmplitude * Math.sin((x / bgWaveLength) * 2 * Math.PI + bgWaveOffset) + (height - waterLevel);
      ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();

  ctx.fillStyle = 'rgba(170, 217, 255, 0.7)';
  ctx.fill();
  ctx.restore();

  // Draw animated wave at water level (main wave)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, height - waterLevel);

  for (let x = 0; x <= width; x += 2) {
      const y = waveAmplitude * Math.sin((x / waveLength) * 2 * Math.PI + waveOffset) + (height - waterLevel);
      ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.restore(); // Remove clip

  // Draw thick rounded white border
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(4, 4, width - 8, height - 8, radius);
      ctx.stroke();
  } else {
      ctx.beginPath();
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

  // Draw ml / target ml and percentage at center
  const colWidth = width;
  const colX = (width - colWidth) / 2;
  const centerY = height / 2;

  let y = -50;
  let z = 32;

  const absNearWater = height - waterLevel - Math.abs(centerY - height * 0.05) < 23;
  const percentNearWater = height - waterLevel - Math.abs(centerY - height * 0.05) < 52;

  ctx.save();
  ctx.font = `bold ${Math.floor(height * 0.034)}px Arial`;
  ctx.fillStyle = absNearWater ? '#fff' : '#000'; // Use white if near water, else gradient
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const absText = `${Math.round(mlValue)} / ${targetMl} ml`;
  ctx.fillText(absText, width / 2, centerY - height * 0.03, colWidth);

  const percentText = `${Math.round(percent * 100)}%`;
  ctx.font = `bold ${Math.floor(height * 0.08)}px Arial`;
  const textGradient = ctx.createLinearGradient(colX, 0, colX + colWidth, 0);
  textGradient.addColorStop(0, colorStart);
  textGradient.addColorStop(1, colorEnd);
  ctx.fillStyle = percentNearWater ? '#fff' : textGradient; // Use white if near water, else gradient
  ctx.fillText(percentText, width / 2, centerY + height * 0.05, colWidth);

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
